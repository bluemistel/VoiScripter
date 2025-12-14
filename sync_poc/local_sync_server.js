const http = require('http'); // Node.js standard module

const PORT = 8787;
const kvStore = new Map(); // In-memory storage

// --- Helpers ---

// Async body parser
const getBody = async (req) => {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
    });
};

// Response helper
const send = (res, status, data, type = 'text/plain') => {
    res.writeHead(status, {
        'Content-Type': type,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(typeof data === 'object' ? JSON.stringify(data) : data);
};

// --- Router Logic ---

const handleRequest = async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') return send(res, 204, null);

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/'); // ['', 'data', ':uuid']
    const uuid = pathParts[2];

    // Route: /data/:uuid
    if (pathParts[1] === 'data' && uuid) {

        // GET: Retrieve data
        if (req.method === 'GET') {
            const data = kvStore.get(uuid);
            if (!data) return send(res, 404, 'Not Found');

            console.log(`[GET] ${uuid}`);
            return send(res, 200, data, 'application/json');
        }

        // PUT: Save data
        if (req.method === 'PUT') {
            const body = await getBody(req);
            kvStore.set(uuid, body);

            console.log(`[PUT] ${uuid} (${body.length} bytes)`);
            return send(res, 200, 'OK');
        }
    }

    return send(res, 404, 'Route Not Found');
};

// --- Server Startup ---

http.createServer(handleRequest).listen(PORT, () => {
    console.log(` Mock Worker running at http://localhost:${PORT}
   - PUT /data/:uuid
   - GET /data/:uuid
  `);
});
