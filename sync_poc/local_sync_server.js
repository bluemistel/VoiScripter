const http = require('http'); // Node.js standard module
const crypto = require('crypto');

const PORT = 8787;
const kvStore = new Map(); // In-memory storage

// Dev-only PoW config. Difficulty is intentionally low so local syncs are fast
// while still exercising the full challenge/verify path. Set POW_DIFFICULTY=0 to
// effectively bypass. POW_SECRET defaults to a fixed dev value.
const POW_DIFFICULTY = parseInt(process.env.POW_DIFFICULTY ?? '12', 10) || 0;
const POW_SECRET = process.env.POW_SECRET || 'dev-secret';
const POW_TTL_SECONDS = 120;

// Adaptive difficulty (mirror of worker.js). In-memory per-UUID meter.
const ADAPT = {
    SHORT_WINDOW_MIN: parseInt(process.env.POW_SHORT_WINDOW_MIN ?? '10', 10),
    SHORT_THRESHOLD: parseInt(process.env.POW_SHORT_THRESHOLD ?? '3', 10),
    SHORT_BITS: parseInt(process.env.POW_SHORT_BITS ?? '4', 10),
    PENALTY_STEP_MIN: parseInt(process.env.POW_PENALTY_STEP_MIN ?? '15', 10),
    MAX_PENALTY: parseInt(process.env.POW_MAX_PENALTY ?? '8', 10),
    PENALTY_DECAY_MIN: parseInt(process.env.POW_PENALTY_DECAY_MIN ?? '60', 10),
    ESC_THRESHOLD: parseInt(process.env.POW_ESC_THRESHOLD ?? '50', 10),
    ESC_STEP: parseInt(process.env.POW_ESC_STEP ?? '10', 10),
    ESC_BITS: parseInt(process.env.POW_ESC_BITS ?? '2', 10),
    MAX_DIFFICULTY: parseInt(process.env.POW_MAX_DIFFICULTY ?? '30', 10),
    NEW_UUID_DIFFICULTY: parseInt(process.env.POW_NEW_UUID_DIFFICULTY ?? '22', 10),
};
const uuidMeter = new Map(); // uuid -> { firstSeen, events:[ms], penaltyLevel, lastPenaltyAt }

const meterUuid = (uuid) => {
    const now = Date.now();
    const MIN = 60 * 1000;
    const EVENTS_CAP = 2000;
    const meta = uuidMeter.get(uuid) || {};
    const isNew = !meta.firstSeen;
    const firstSeen = meta.firstSeen || now;
    let events = Array.isArray(meta.events) ? meta.events : [];
    let penaltyLevel = meta.penaltyLevel || 0;
    let lastPenaltyAt = meta.lastPenaltyAt || 0;

    if (penaltyLevel > 0 && lastPenaltyAt) {
        const drops = Math.floor((now - lastPenaltyAt) / (ADAPT.PENALTY_DECAY_MIN * MIN));
        if (drops > 0) {
            penaltyLevel = Math.max(0, penaltyLevel - drops);
            lastPenaltyAt = penaltyLevel > 0 ? lastPenaltyAt + drops * ADAPT.PENALTY_DECAY_MIN * MIN : 0;
        }
    }

    const effWindowMin = Math.max(ADAPT.SHORT_WINDOW_MIN, penaltyLevel * ADAPT.PENALTY_STEP_MIN);

    events.push(now);
    const dayAgo = now - 24 * 60 * MIN;
    events = events.filter((t) => t >= dayAgo);
    if (events.length > EVENTS_CAP) events = events.slice(events.length - EVENTS_CAP);

    const winStart = now - effWindowMin * MIN;
    let countShort = 0;
    for (const t of events) if (t >= winStart) countShort++;
    const count24h = events.length;

    if (countShort > ADAPT.SHORT_THRESHOLD && (now - lastPenaltyAt) > effWindowMin * MIN) {
        penaltyLevel = Math.min(ADAPT.MAX_PENALTY, penaltyLevel + 1);
        lastPenaltyAt = now;
    }

    uuidMeter.set(uuid, { firstSeen, events, penaltyLevel, lastPenaltyAt });
    return { isNew, count24h, countShort, penaltyLevel, effWindowMin };
};

const computeAdaptiveDifficulty = (base, isNew, count24h, countShort) => {
    let escalation = 0;
    if (countShort > ADAPT.SHORT_THRESHOLD) {
        escalation = Math.max(escalation, (countShort - ADAPT.SHORT_THRESHOLD) * ADAPT.SHORT_BITS);
    }
    if (count24h > ADAPT.ESC_THRESHOLD) {
        escalation = Math.max(escalation, Math.ceil((count24h - ADAPT.ESC_THRESHOLD) / Math.max(1, ADAPT.ESC_STEP)) * ADAPT.ESC_BITS);
    }
    let d = base + escalation;
    if (isNew) d = Math.max(d, ADAPT.NEW_UUID_DIFFICULTY);
    return Math.min(d, ADAPT.MAX_DIFFICULTY);
};

// --- PoW helpers (mirror worker.js) ---

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlToBuf = (str) => Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const hmacSign = (payloadStr) =>
    b64url(crypto.createHmac('sha256', POW_SECRET).update(payloadStr).digest());

const sha256Hex = (str) => crypto.createHash('sha256').update(str).digest('hex');

const leadingZeroBits = (hexStr) => {
    let bits = 0;
    for (const ch of hexStr) {
        const v = parseInt(ch, 16);
        if (v === 0) { bits += 4; continue; }
        bits += Math.clz32(v) - 28;
        break;
    }
    return bits;
};

const issueChallenge = (uuid, hash) => {
    // POW_DIFFICULTY=0 means full dev bypass; skip adaptation in that case.
    let difficulty = 0;
    if (POW_DIFFICULTY !== 0) {
        const { isNew, count24h, countShort } = meterUuid(uuid);
        difficulty = computeAdaptiveDifficulty(POW_DIFFICULTY, isNew, count24h, countShort);
    }
    const payload = {
        n: b64url(crypto.randomBytes(12)),
        u: uuid,
        h: hash,
        d: difficulty,
        e: Math.floor(Date.now() / 1000) + POW_TTL_SECONDS,
    };
    const payloadStr = b64url(Buffer.from(JSON.stringify(payload)));
    return { token: `${payloadStr}.${hmacSign(payloadStr)}`, difficulty };
};

const verifyPow = (token, solution, uuid, body) => {
    if (!token || solution === null || solution === undefined || solution === '') {
        return { ok: false, error: 'Proof-of-Workが指定されていません。' };
    }
    const dot = token.indexOf('.');
    if (dot < 0) return { ok: false, error: 'Proof-of-Workの形式が不正です。' };
    const payloadStr = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (sig !== hmacSign(payloadStr)) return { ok: false, error: 'Proof-of-Workの署名が不正です。' };
    let payload;
    try {
        payload = JSON.parse(b64urlToBuf(payloadStr).toString('utf8'));
    } catch {
        return { ok: false, error: 'Proof-of-Workの復号に失敗しました。' };
    }
    if (typeof payload.e !== 'number' || payload.e < Math.floor(Date.now() / 1000)) {
        return { ok: false, error: 'Proof-of-Workの有効期限が切れています。' };
    }
    if (payload.u !== uuid) return { ok: false, error: 'Proof-of-Workの対象が一致しません。' };
    if (payload.h !== sha256Hex(body)) return { ok: false, error: 'Proof-of-Workとデータが一致しません。' };
    if (leadingZeroBits(sha256Hex(`${token}:${solution}`)) < payload.d) {
        return { ok: false, error: 'Proof-of-Workの検証に失敗しました。' };
    }
    return { ok: true };
};

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
        'Access-Control-Allow-Headers': 'Content-Type, X-App-Version, X-PoW-Challenge, X-PoW-Solution'
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

    // Route: /challenge
    if (pathParts[1] === 'challenge' && req.method === 'GET') {
        const cUuid = url.searchParams.get('uuid');
        const hash = url.searchParams.get('hash');
        if (!cUuid || !hash) return send(res, 400, { error: 'uuid と hash が必要です。' }, 'application/json');
        console.log(`[CHALLENGE] ${cUuid}`);
        return send(res, 200, issueChallenge(cUuid, hash), 'application/json');
    }

    // Route: /data/:uuid
    if (pathParts[1] === 'data' && uuid) {

        // GET: Retrieve data
        if (req.method === 'GET') {
            const data = kvStore.get(uuid);
            if (!data) return send(res, 404, 'Not Found');

            console.log(`[GET] ${uuid}`);
            return send(res, 200, data, 'application/json');
        }

        // PUT: Save data (requires PoW)
        if (req.method === 'PUT') {
            const body = await getBody(req);
            const pow = verifyPow(
                req.headers['x-pow-challenge'],
                req.headers['x-pow-solution'],
                uuid,
                body
            );
            if (!pow.ok) {
                console.log(`[PUT REJECTED] ${uuid}: ${pow.error}`);
                return send(res, 403, { error: pow.error }, 'application/json');
            }
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
   - GET /challenge?uuid=&hash=
   - PUT /data/:uuid (PoW required, difficulty=${POW_DIFFICULTY})
   - GET /data/:uuid
  `);
});
