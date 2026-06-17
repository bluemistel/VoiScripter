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

const encoder = new TextEncoder();

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
async function issueChallenge(uuid, bodyHash, env) {
    const difficulty = getDifficulty(env);
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
                const challenge = await issueChallenge(uuid, hash, env);
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
