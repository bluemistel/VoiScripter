/**
 * Unit tests for the Proof-of-Work client utilities.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { sha256Hex, leadingZeroBits, solvePow } from '../utils/pow';

const nodeSha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

describe('sha256Hex', () => {
    const cases = [
        '',
        'abc',
        'The quick brown fox jumps over the lazy dog',
        'a'.repeat(55),  // padding boundary
        'a'.repeat(56),  // forces an extra block
        'a'.repeat(64),
        'a'.repeat(200),
        'マルチバイト文字列テスト🎤',
    ];

    it('matches Node crypto SHA-256 for assorted inputs', () => {
        for (const c of cases) {
            expect(sha256Hex(c)).toBe(nodeSha(c));
        }
    });

    it('produces the known SHA-256 of "abc"', () => {
        expect(sha256Hex('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
        );
    });
});

describe('leadingZeroBits', () => {
    it('counts leading zero bits in a hex string', () => {
        expect(leadingZeroBits('ffff')).toBe(0);
        expect(leadingZeroBits('7fff')).toBe(1);
        expect(leadingZeroBits('0fff')).toBe(4);
        expect(leadingZeroBits('00ff')).toBe(8);
        expect(leadingZeroBits('01ff')).toBe(7);
        expect(leadingZeroBits('0000')).toBe(16);
    });
});

describe('solvePow', () => {
    it('returns 0 immediately for difficulty 0', async () => {
        await expect(solvePow('any.token', 0)).resolves.toBe(0);
    });

    it('finds a solution meeting a small difficulty', async () => {
        const difficulty = 8;
        const token = 'sample.token';
        const counter = await solvePow(token, difficulty);
        expect(leadingZeroBits(sha256Hex(`${token}:${counter}`))).toBeGreaterThanOrEqual(difficulty);
    });
});
