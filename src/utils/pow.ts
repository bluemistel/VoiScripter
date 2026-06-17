/**
 * Proof-of-Work client utilities.
 *
 * Used by the sync feature to spend CPU before each cloud write, so automated
 * tools cannot cheaply hammer the Cloudflare Worker. The worker issues an
 * HMAC-signed challenge bound to (uuid, bodyHash); the client must find a
 * `counter` such that SHA-256("<token>:<counter>") has `difficulty` leading
 * zero bits.
 *
 * A synchronous SHA-256 is used (not Web Crypto's async `subtle.digest`) because
 * the solver runs a tight hashing loop and per-call Promise overhead would make
 * `subtle.digest` far too slow. Both client and worker compute real SHA-256, so
 * their results agree regardless of implementation.
 */

const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const textEncoder = new TextEncoder();
const W = new Uint32Array(64);

function rotr(x: number, n: number): number {
    return (x >>> n) | (x << (32 - n));
}

/** Synchronous SHA-256 of a UTF-8 string, returned as lowercase hex. */
export function sha256Hex(input: string): string {
    const data = textEncoder.encode(input);
    const l = data.length;
    const bitLen = l * 8;

    // Padding: append 0x80, then zeros, then 64-bit big-endian length.
    const withOne = l + 1;
    const pad = (56 - (withOne % 64) + 64) % 64;
    const total = withOne + pad + 8;
    const msg = new Uint8Array(total);
    msg.set(data);
    msg[l] = 0x80;
    const dv = new DataView(msg.buffer);
    dv.setUint32(total - 4, bitLen >>> 0, false);
    dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    for (let i = 0; i < total; i += 64) {
        for (let t = 0; t < 16; t++) W[t] = dv.getUint32(i + t * 4, false);
        for (let t = 16; t < 64; t++) {
            const w15 = W[t - 15];
            const w2 = W[t - 2];
            const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
            const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
            W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
        }

        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (let t = 0; t < 64; t++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) | 0;
            h = g; g = f; f = e; e = (d + temp1) | 0;
            d = c; c = b; b = a; a = (temp1 + temp2) | 0;
        }

        h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
        h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }

    const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
    return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) +
        toHex(h4) + toHex(h5) + toHex(h6) + toHex(h7);
}

/** Count leading zero bits in a hex digest string. */
export function leadingZeroBits(hexStr: string): number {
    let bits = 0;
    for (const ch of hexStr) {
        const v = parseInt(ch, 16);
        if (v === 0) { bits += 4; continue; }
        bits += Math.clz32(v) - 28; // leading zeros within the 4-bit nibble
        break;
    }
    return bits;
}

/** Thrown by solvePow when the search exceeds its time budget. */
export class PowTimeoutError extends Error {
    constructor() {
        super('PoW solving exceeded the time budget');
        this.name = 'PowTimeoutError';
    }
}

/**
 * Solve a PoW challenge: find a counter whose SHA-256("<token>:<counter>") has
 * at least `difficulty` leading zero bits. Yields to the event loop periodically
 * so the UI stays responsive during the search.
 *
 * If `budgetMs` is exceeded, throws PowTimeoutError instead of running for
 * minutes/hours. This happens when adaptive difficulty has escalated the UUID
 * (i.e. the caller is being throttled), so we bail early rather than submit a
 * solution that would already be expired server-side.
 */
export async function solvePow(token: string, difficulty: number, budgetMs = Infinity): Promise<number> {
    const CHUNK = 4096;
    const start = Date.now();
    let counter = 0;
    for (;;) {
        for (let i = 0; i < CHUNK; i++) {
            if (leadingZeroBits(sha256Hex(`${token}:${counter}`)) >= difficulty) {
                return counter;
            }
            counter++;
        }
        if (Date.now() - start > budgetMs) throw new PowTimeoutError();
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
}
