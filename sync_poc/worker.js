/**
 * VoiScripter Sync Worker
 * Cloudflare Workers script for E2EE data sync
 *
 * Endpoints:
 *   GET  /              - Serve index.html
 *   GET  /challenge     - Issue a Proof-of-Work challenge (no KV write)
 *   GET  /data/:uuid    - Retrieve encrypted data
 *   PUT  /data/:uuid    - Store encrypted data (requires valid PoW, TTL: 90 days)
 *
 * Abuse mitigation:
 *   - PUT requires a Proof-of-Work token bound to (uuid, body hash). Each write
 *     forces the client to spend CPU, so tools cannot cheaply hammer the endpoint.
 *   - Challenge issuance and PoW verification are stateless (HMAC-signed) and do
 *     NOT touch KV, so they never consume the daily KV write quota.
 *   - Rate limiting uses Cloudflare's Rate Limiting binding (in-memory, free),
 *     not KV counters, so reads no longer burn write quota.
 */

// Inline HTML (sync_poc.html content)
import HTML_CONTENT from './public/index.html';

const MAX_VALUE_SIZE = 25 * 1024 * 1024; // Cloudflare KV limit: 25MB

const MIN_APP_VERSION = '0.3.1';

const POW_DEFAULT_DIFFICULTY = 20; // leading zero bits required
const POW_TTL_SECONDS = 120;       // challenge validity window

// Adaptive difficulty defaults (overridable via [vars] in wrangler.toml).
// Difficulty is in leading-zero bits; solve time ≈ 2^difficulty, so each +1 bit
// doubles the cost. A UUID that writes far more than a human would within 24h
// gets an escalating difficulty until its write cadence becomes infeasible.
const ADAPT_DEFAULTS = {
    // Short burst window: catches parallel/rapid writes to one UUID within minutes.
    // Normal use is ~2 consecutive syncs per session, then quiet for tens of
    // minutes to hours, so >3 within the window is abnormal. Steep curve: the
    // 4th request escalates, the 5th-6th reach the practically-infeasible range.
    SHORT_WINDOW_MIN: 10,  // base rolling short window (minutes)
    SHORT_THRESHOLD: 3,    // requests in the window above which escalation starts
    SHORT_BITS: 4,         // bits added per request above SHORT_THRESHOLD (steep)
    // Progressive penalty: each time a UUID keeps breaching, its window (memory)
    // lengthens (15 → 30 → 45 ... minutes), so it cannot reset difficulty by
    // briefly pausing. Penalty decays by one level per DECAY_MIN of quiet.
    PENALTY_STEP_MIN: 15,  // window length per penalty level (max(base, level*step))
    MAX_PENALTY: 8,        // cap penalty level (window up to ~2h)
    PENALTY_DECAY_MIN: 60, // minutes of quiet to drop one penalty level
    // 24h window: backstop for slow-but-sustained abuse that stays under the burst limit.
    ESC_THRESHOLD: 50,     // 24h request count below which no escalation applies
    ESC_STEP: 10,          // every STEP requests above the threshold...
    ESC_BITS: 2,           // ...adds this many difficulty bits
    MAX_DIFFICULTY: 30,    // hard cap (~hours to solve)
    NEW_UUID_DIFFICULTY: 22, // one-time cost for the first ever write to a UUID
};

const encoder = new TextEncoder();

function envInt(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Compute the PoW difficulty for a UUID from its recent activity.
 * - Normal, low-frequency use stays at the base difficulty (fast).
 * - A brand-new UUID pays a one-time higher cost (taxes UUID rotation).
 * - A UUID exceeding the 24h threshold escalates steeply (chokes hammering).
 */
function computeAdaptiveDifficulty(env, base, isNew, count24h, countShort) {
    const ST = envInt(env.POW_SHORT_THRESHOLD, ADAPT_DEFAULTS.SHORT_THRESHOLD);
    const SBITS = envInt(env.POW_SHORT_BITS, ADAPT_DEFAULTS.SHORT_BITS);
    const T = envInt(env.POW_ESC_THRESHOLD, ADAPT_DEFAULTS.ESC_THRESHOLD);
    const STEP = envInt(env.POW_ESC_STEP, ADAPT_DEFAULTS.ESC_STEP);
    const ESC = envInt(env.POW_ESC_BITS, ADAPT_DEFAULTS.ESC_BITS);
    const MAX = envInt(env.POW_MAX_DIFFICULTY, ADAPT_DEFAULTS.MAX_DIFFICULTY);
    const NEW = envInt(env.POW_NEW_UUID_DIFFICULTY, ADAPT_DEFAULTS.NEW_UUID_DIFFICULTY);

    // Short-burst escalation (steep, per request) and 24h backstop; take the larger.
    let escalation = 0;
    if (countShort > ST) escalation = Math.max(escalation, (countShort - ST) * SBITS);
    if (count24h > T) escalation = Math.max(escalation, Math.ceil((count24h - T) / Math.max(1, STEP)) * ESC);

    let d = base + escalation;
    if (isNew) d = Math.max(d, NEW);
    return Math.min(d, MAX);
}

/**
 * Ask the per-UUID Durable Object to record this request and return its recent
 * activity. Falls back to non-adaptive (isNew=false, count24h=0) when the DO
 * binding is unavailable (e.g. local dev) so sync never breaks.
 */
async function meterUuid(env, uuid) {
    if (!env.UUID_METER || typeof env.UUID_METER.idFromName !== 'function') {
        return { isNew: false, count24h: 0, countShort: 0 };
    }
    try {
        const stub = env.UUID_METER.get(env.UUID_METER.idFromName(uuid));
        const res = await stub.fetch('https://uuid-meter/record');
        return await res.json();
    } catch {
        return { isNew: false, count24h: 0, countShort: 0 };
    }
}

/**
 * Compare semver strings (e.g. "0.2.8" vs "0.2.9")
 * Returns true if version >= minVersion
 */
function isVersionAllowed(version, minVersion) {
    const parse = (v) => v.split('.').map(Number);
    const [aMaj, aMin, aPat] = parse(version);
    const [bMaj, bMin, bPat] = parse(minVersion);
    if (aMaj !== bMaj) return aMaj > bMaj;
    if (aMin !== bMin) return aMin > bMin;
    return aPat >= bPat;
}

// --- Proof-of-Work helpers -------------------------------------------------

function b64urlEncode(bytes) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function hmacSign(payloadStr, secret) {
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr));
    return b64urlEncode(new Uint8Array(sig));
}

async function sha256Hex(str) {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(str));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Count leading zero bits in a hex digest string. */
function leadingZeroBits(hexStr) {
    let bits = 0;
    for (const ch of hexStr) {
        const v = parseInt(ch, 16);
        if (v === 0) { bits += 4; continue; }
        bits += Math.clz32(v) - 28; // clz32 of a nibble (1..15) → leading zeros within 4 bits
        break;
    }
    return bits;
}

/** Constant-time-ish string compare (length + char). Good enough for HMAC tags. */
function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

function getDifficulty(env) {
    const d = parseInt(env.POW_DIFFICULTY, 10);
    return Number.isFinite(d) && d > 0 ? d : POW_DEFAULT_DIFFICULTY;
}

/**
 * Issue a stateless, HMAC-signed PoW challenge bound to (uuid, bodyHash).
 * No KV access.
 */
async function issueChallenge(uuid, bodyHash, difficulty, env) {
    const payload = {
        n: b64urlEncode(crypto.getRandomValues(new Uint8Array(12))),
        u: uuid,
        h: bodyHash,
        d: difficulty,
        e: Math.floor(Date.now() / 1000) + POW_TTL_SECONDS,
    };
    const payloadStr = b64urlEncode(encoder.encode(JSON.stringify(payload)));
    const sig = await hmacSign(payloadStr, env.POW_SECRET);
    return { token: `${payloadStr}.${sig}`, difficulty, expiresIn: POW_TTL_SECONDS };
}

/**
 * Verify a PoW solution for a PUT request.
 * Returns { ok: true } or { ok: false, error }.
 */
async function verifyPow(token, solution, uuid, body, env) {
    if (!token || solution === null || solution === undefined || solution === '') {
        return { ok: false, error: 'Proof-of-Workが指定されていません。アプリを最新版にアップデートしてください。' };
    }
    const dot = token.indexOf('.');
    if (dot < 0) return { ok: false, error: 'Proof-of-Workの形式が不正です。' };
    const payloadStr = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    const expectedSig = await hmacSign(payloadStr, env.POW_SECRET);
    if (!safeEqual(sig, expectedSig)) return { ok: false, error: 'Proof-of-Workの署名が不正です。' };

    let payload;
    try {
        payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadStr)));
    } catch {
        return { ok: false, error: 'Proof-of-Workの復号に失敗しました。' };
    }

    if (typeof payload.e !== 'number' || payload.e < Math.floor(Date.now() / 1000)) {
        return { ok: false, error: 'Proof-of-Workの有効期限が切れています。もう一度お試しください。' };
    }
    if (payload.u !== uuid) {
        return { ok: false, error: 'Proof-of-Workの対象が一致しません。' };
    }
    const bodyHash = await sha256Hex(body);
    if (payload.h !== bodyHash) {
        return { ok: false, error: 'Proof-of-Workとデータが一致しません。' };
    }
    const solutionHash = await sha256Hex(`${token}:${solution}`);
    if (leadingZeroBits(solutionHash) < payload.d) {
        return { ok: false, error: 'Proof-of-Workの検証に失敗しました。' };
    }
    return { ok: true };
}

/**
 * Rate limiting via Cloudflare Rate Limiting binding (in-memory, free, no KV write).
 * Falls back to "allowed" when the binding is not configured (e.g. local dev).
 */
async function checkRateLimit(binding, ip) {
    if (!binding || typeof binding.limit !== 'function') return { allowed: true };
    try {
        const { success } = await binding.limit({ key: ip });
        return { allowed: success };
    } catch {
        return { allowed: true };
    }
}

export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-App-Version, X-PoW-Challenge, X-PoW-Solution',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const jsonError = (status, message, extraHeaders = {}) => new Response(
            JSON.stringify({ error: message }),
            { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders } }
        );

        try {
            const url = new URL(request.url);
            const pathParts = url.pathname.split('/');
            const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

            // Route: /challenge (issue PoW challenge — no KV access)
            if (pathParts[1] === 'challenge' && request.method === 'GET') {
                const appVersion = request.headers.get('X-App-Version');
                if (!appVersion || !isVersionAllowed(appVersion, MIN_APP_VERSION)) {
                    return jsonError(426, `アプリのバージョンが古いため同期できません。最新版(v${MIN_APP_VERSION}以上)にアップデートしてください。`);
                }
                const rate = await checkRateLimit(env.RL_CHALLENGE, ip);
                if (!rate.allowed) {
                    return jsonError(429, 'リクエスト回数が制限を超えました。しばらく時間をおいてから再度お試しください。');
                }
                const uuid = url.searchParams.get('uuid');
                const hash = url.searchParams.get('hash');
                if (!uuid || !hash) {
                    return jsonError(400, 'uuid と hash が必要です。');
                }
                // Adaptive difficulty: per-UUID activity raises the cost so that an
                // abusive UUID's write cadence becomes infeasible, while normal
                // low-frequency users stay at the base difficulty.
                const { isNew, count24h, countShort } = await meterUuid(env, uuid);
                const difficulty = computeAdaptiveDifficulty(env, getDifficulty(env), isNew, count24h, countShort);
                const challenge = await issueChallenge(uuid, hash, difficulty, env);
                return new Response(JSON.stringify(challenge), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // Route: /data/:uuid (API)
            if (pathParts[1] === 'data' && pathParts[2]) {
                const uuid = pathParts[2];

                // Version check
                const appVersion = request.headers.get('X-App-Version');
                if (!appVersion || !isVersionAllowed(appVersion, MIN_APP_VERSION)) {
                    return jsonError(426, `アプリのバージョンが古いため同期できません。最新版(v${MIN_APP_VERSION}以上)にアップデートしてください。`);
                }

                if (request.method === 'GET') {
                    // Reads do not consume the KV write quota; protect only via rate limit.
                    const rate = await checkRateLimit(env.RL_GET, ip);
                    if (!rate.allowed) {
                        return jsonError(429, 'リクエスト回数が制限を超えました。しばらく時間をおいてから再度お試しください。');
                    }
                    const result = await env.SYNC_KV.getWithMetadata(uuid, { type: 'text' });
                    const data = result?.value;
                    if (!data) {
                        return new Response('Not Found', { status: 404, headers: corsHeaders });
                    }
                    const updatedAt = result?.metadata?.updatedAt;
                    return new Response(data, {
                        status: 200,
                        headers: {
                            ...corsHeaders,
                            'Content-Type': 'text/plain',
                            ...(updatedAt ? { 'X-Sync-Updated-At': updatedAt } : {})
                        }
                    });
                }

                if (request.method === 'PUT') {
                    const rate = await checkRateLimit(env.RL_PUT, ip);
                    if (!rate.allowed) {
                        return jsonError(429, 'リクエスト回数が制限を超えました。しばらく時間をおいてから再度お試しください。');
                    }

                    const body = await request.text();
                    if (body.length > MAX_VALUE_SIZE) {
                        return jsonError(413, `データサイズが上限(25MB)を超えています (${(body.length / 1024 / 1024).toFixed(1)}MB)`);
                    }

                    // Proof-of-Work gate (stateless; no KV write).
                    const pow = await verifyPow(
                        request.headers.get('X-PoW-Challenge'),
                        request.headers.get('X-PoW-Solution'),
                        uuid,
                        body,
                        env
                    );
                    if (!pow.ok) {
                        return jsonError(403, pow.error);
                    }

                    const updatedAt = new Date().toISOString();
                    await env.SYNC_KV.put(uuid, body, {
                        expirationTtl: 7776000,
                        metadata: { updatedAt }
                    });
                    return new Response('OK', {
                        status: 200,
                        headers: { ...corsHeaders, 'X-Sync-Updated-At': updatedAt }
                    });
                }
            }

            // Route: / (Serve HTML)
            if (url.pathname === '/' || url.pathname === '/index.html') {
                return new Response(HTML_CONTENT, {
                    status: 200,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
            }

            return new Response('Not Found', { status: 404, headers: corsHeaders });
        } catch (err) {
            return jsonError(500, err.message || 'Internal Server Error');
        }
    }
};

/**
 * Durable Object: per-UUID activity meter (SQLite-backed; see wrangler.toml
 * migrations `new_sqlite_classes`). State here does NOT consume the KV write
 * quota. One instance per UUID (addressed via idFromName(uuid)).
 *
 * Tracks per-UUID request timestamps (last 24h) plus a progressive `penaltyLevel`.
 * The effective short window grows with the penalty level, so a UUID that keeps
 * breaching cannot reset its difficulty by briefly pausing — it must stay quiet
 * for progressively longer. Returns { isNew, count24h, countShort, penaltyLevel,
 * effWindowMin }; the Worker turns count24h/countShort into the PoW difficulty.
 */
export class UuidMeter {
    constructor(state, env) {
        this.state = state;
        this.env = env;
    }

    async fetch() {
        const env = this.env;
        const now = Date.now();
        const MIN = 60 * 1000;
        const EVENTS_CAP = 2000;

        const shortWin = envInt(env.POW_SHORT_WINDOW_MIN, ADAPT_DEFAULTS.SHORT_WINDOW_MIN);
        const penaltyStep = envInt(env.POW_PENALTY_STEP_MIN, ADAPT_DEFAULTS.PENALTY_STEP_MIN);
        const maxPenalty = envInt(env.POW_MAX_PENALTY, ADAPT_DEFAULTS.MAX_PENALTY);
        const decayMin = envInt(env.POW_PENALTY_DECAY_MIN, ADAPT_DEFAULTS.PENALTY_DECAY_MIN);
        const shortThreshold = envInt(env.POW_SHORT_THRESHOLD, ADAPT_DEFAULTS.SHORT_THRESHOLD);

        const meta = (await this.state.storage.get('meta')) || {};
        const isNew = !meta.firstSeen;
        const firstSeen = meta.firstSeen || now;
        let events = Array.isArray(meta.events) ? meta.events : [];
        let penaltyLevel = meta.penaltyLevel || 0;
        let lastPenaltyAt = meta.lastPenaltyAt || 0;

        // Decay the penalty during quiet time (one level per decayMin minutes).
        if (penaltyLevel > 0 && lastPenaltyAt) {
            const drops = Math.floor((now - lastPenaltyAt) / (decayMin * MIN));
            if (drops > 0) {
                penaltyLevel = Math.max(0, penaltyLevel - drops);
                lastPenaltyAt = penaltyLevel > 0 ? lastPenaltyAt + drops * decayMin * MIN : 0;
            }
        }

        // Effective short window grows with penalty level (e.g. 10, 15, 30, 45 ...).
        const effWindowMin = Math.max(shortWin, penaltyLevel * penaltyStep);

        // Record this event and keep the last 24h (capped to bound memory).
        events.push(now);
        const dayAgo = now - 24 * 60 * MIN;
        events = events.filter((t) => t >= dayAgo);
        if (events.length > EVENTS_CAP) events = events.slice(events.length - EVENTS_CAP);

        const winStart = now - effWindowMin * MIN;
        let countShort = 0;
        for (const t of events) if (t >= winStart) countShort++;
        const count24h = events.length;

        // Keep breaching → lengthen the window (at most once per current window).
        if (countShort > shortThreshold && (now - lastPenaltyAt) > effWindowMin * MIN) {
            penaltyLevel = Math.min(maxPenalty, penaltyLevel + 1);
            lastPenaltyAt = now;
        }

        await this.state.storage.put('meta', { firstSeen, events, penaltyLevel, lastPenaltyAt });

        return new Response(JSON.stringify({ isNew, count24h, countShort, penaltyLevel, effWindowMin }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
