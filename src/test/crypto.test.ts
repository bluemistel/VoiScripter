/**
 * Unit tests for crypto utilities
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, deriveKey } from '../utils/crypto';

describe('crypto utilities', () => {
    const testPassword = 'test-password-123';
    const testData = 'Hello, World!';
    const complexData = JSON.stringify({
        name: 'Test Project',
        characters: ['Alice', 'Bob'],
        scripts: [{ id: 1, text: 'テスト' }],
    });

    describe('encrypt and decrypt', () => {
        it('should encrypt and decrypt simple text correctly', async () => {
            const encrypted = await encrypt(testData, testPassword);
            const decrypted = await decrypt(encrypted, testPassword);
            expect(decrypted).toBe(testData);
        });

        it('should encrypt and decrypt complex JSON correctly', async () => {
            const encrypted = await encrypt(complexData, testPassword);
            const decrypted = await decrypt(encrypted, testPassword);
            expect(decrypted).toBe(complexData);
        });

        it('should produce different ciphertext for same plaintext (random salt/nonce)', async () => {
            const encrypted1 = await encrypt(testData, testPassword);
            const encrypted2 = await encrypt(testData, testPassword);
            expect(encrypted1).not.toBe(encrypted2);
        });

        it('should fail to decrypt with wrong password', async () => {
            const encrypted = await encrypt(testData, testPassword);
            await expect(
                decrypt(encrypted, 'wrong-password')
            ).rejects.toThrow('復号に失敗しました');
        });

        it('should fail to decrypt corrupted data', async () => {
            const encrypted = await encrypt(testData, testPassword);
            const corrupted = encrypted.slice(0, -10) + 'CORRUPTED';
            await expect(
                decrypt(corrupted, testPassword)
            ).rejects.toThrow();
        });

        it('should handle empty string', async () => {
            const encrypted = await encrypt('', testPassword);
            const decrypted = await decrypt(encrypted, testPassword);
            expect(decrypted).toBe('');
        });

        it('should handle Unicode characters', async () => {
            const unicode = '日本語テスト 🎌 émojis';
            const encrypted = await encrypt(unicode, testPassword);
            const decrypted = await decrypt(encrypted, testPassword);
            expect(decrypted).toBe(unicode);
        });
    });

    describe('deriveKey', () => {
        it('should derive consistent key for same password and salt', async () => {
            const salt = new Uint8Array(16).fill(1);
            const key1 = await deriveKey(testPassword, salt);
            const key2 = await deriveKey(testPassword, salt);

            const exported1 = await crypto.subtle.exportKey('raw', key1);
            const exported2 = await crypto.subtle.exportKey('raw', key2);

            expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2));
        });

        it('should derive different keys for different salts', async () => {
            const salt1 = new Uint8Array(16).fill(1);
            const salt2 = new Uint8Array(16).fill(2);

            const key1 = await deriveKey(testPassword, salt1);
            const key2 = await deriveKey(testPassword, salt2);

            const exported1 = await crypto.subtle.exportKey('raw', key1);
            const exported2 = await crypto.subtle.exportKey('raw', key2);

            expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
        });
    });

    describe('performance', () => {
        it('should complete PBKDF2 derivation in reasonable time', async () => {
            const startTime = Date.now();
            const salt = crypto.getRandomValues(new Uint8Array(16));
            await deriveKey(testPassword, salt);
            const duration = Date.now() - startTime;

            // PBKDF2 with 600k iterations should take < 2 seconds on modern hardware
            expect(duration).toBeLessThan(2000);
        });
    });
});
