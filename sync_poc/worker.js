/**
 * VoiScripter Sync Worker
 * Cloudflare Workers script for E2EE data sync
 *
 * Endpoints:
 *   GET  /           - Serve sync_poc.html
 *   GET  /data/:uuid - Retrieve encrypted data
 *   PUT  /data/:uuid - Store encrypted data (TTL: 90 days)
 */

// Inline HTML (sync_poc.html content)
import HTML_CONTENT from './public/index.html';

const MAX_VALUE_SIZE = 25 * 1024 * 1024; // Cloudflare KV limit: 25MB

const MIN_APP_VERSION = '0.2.9';

const RATE_LIMITS = {
    GET: 60,   // 60 requests per hour
    PUT: 12,   // 12 requests per hour
};
const RATE_LIMIT_TTL = 7200; // 2 hours (auto-cleanup)

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

/**
 * IP-based rate limiting using KV
 * Key format: rl:{ip}:{method}:{hourBucket}
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }
 */
async function checkRateLimit(ip, method, env) {
    const limit = RATE_LIMITS[method];
    if (!limit) return { allowed: true };

    const now = new Date();
    const hourBucket = now.getUTCFullYear().toString()
        + String(now.getUTCMonth() + 1).padStart(2, '0')
        + String(now.getUTCDate()).padStart(2, '0')
        + String(now.getUTCHours()).padStart(2, '0');
    const key = `rl:${ip}:${method}:${hourBucket}`;

    const current = parseInt(await env.SYNC_KV.get(key) || '0', 10);

    if (current >= limit) {
        const retryAfter = 3600 - (now.getUTCMinutes() * 60 + now.getUTCSeconds());
        return { allowed: false, retryAfter };
    }

    await env.SYNC_KV.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_TTL });
    return { allowed: true };
}

export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-App-Version',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        try {
            const url = new URL(request.url);
            const pathParts = url.pathname.split('/');

            // Route: /data/:uuid (API)
            if (pathParts[1] === 'data' && pathParts[2]) {
                const uuid = pathParts[2];

                // Version check
                const appVersion = request.headers.get('X-App-Version');
                if (!appVersion || !isVersionAllowed(appVersion, MIN_APP_VERSION)) {
                    return new Response(
                        JSON.stringify({ error: `アプリのバージョンが古いため同期できません。最新版(v${MIN_APP_VERSION}以上)にアップデートしてください。` }),
                        {
                            status: 426,
                            headers: {
                                ...corsHeaders,
                                'Content-Type': 'application/json',
                            }
                        }
                    );
                }

                // Rate limit check
                const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
                const rateLimit = await checkRateLimit(ip, request.method, env);
                if (!rateLimit.allowed) {
                    return new Response(
                        JSON.stringify({ error: 'リクエスト回数が制限を超えました。しばらく時間をおいてから再度お試しください。' }),
                        {
                            status: 429,
                            headers: {
                                ...corsHeaders,
                                'Content-Type': 'application/json',
                                'Retry-After': String(rateLimit.retryAfter),
                            }
                        }
                    );
                }

                if (request.method === 'GET') {
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
                    const body = await request.text();
                    if (body.length > MAX_VALUE_SIZE) {
                        return new Response(
                            JSON.stringify({ error: `データサイズが上限(25MB)を超えています (${(body.length / 1024 / 1024).toFixed(1)}MB)` }),
                            { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                        );
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
            return new Response(
                JSON.stringify({ error: err.message || 'Internal Server Error' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
    }
};
