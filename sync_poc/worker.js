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

export default {
    async fetch(request, env, ctx) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const url = new URL(request.url);
        const pathParts = url.pathname.split('/');

        // Route: /data/:uuid (API)
        if (pathParts[1] === 'data' && pathParts[2]) {
            const uuid = pathParts[2];

            if (request.method === 'GET') {
                const data = await env.SYNC_KV.get(uuid);
                if (!data) {
                    return new Response('Not Found', { status: 404, headers: corsHeaders });
                }
                return new Response(data, {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (request.method === 'PUT') {
                const body = await request.text();
                await env.SYNC_KV.put(uuid, body, { expirationTtl: 7776000 });
                return new Response('OK', { status: 200, headers: corsHeaders });
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
    }
};
