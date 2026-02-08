/**
 * Advanced tests for E2EE data synchronization
 * Covers large payloads, concurrency, and security sanity.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encrypt, decrypt } from '../utils/crypto';
import { renderHook, act } from '@testing-library/react';
import { useDataSync } from '../hooks/useDataSync';

describe('Advanced Data Sync Tests', () => {
    describe('Large Payload Handling', () => {
        it('should handle large data (approx 1MB of text)', async () => {
            // Generate 1MB of text (1024 * 1024 characters)
            const largeData = 'A'.repeat(1024 * 1024);
            const password = 'secure-password';

            const encrypted = await encrypt(largeData, password);
            expect(encrypted.length).toBeGreaterThan(1024 * 1024); // Base64 should be larger

            const decrypted = await decrypt(encrypted, password);
            expect(decrypted).toBe(largeData);
        });

        it('should handle many Unicode characters in large data', async () => {
            const complexUnit = 'あいうえお🎌é'; // 7 chars
            const largeData = complexUnit.repeat(100000); // 700k chars
            const password = 'secure-password';

            const encrypted = await encrypt(largeData, password);
            const decrypted = await decrypt(encrypted, password);
            expect(decrypted).toBe(largeData);
        });
    });

    describe('Concurrency & Race Conditions', () => {
        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
        });

        it('should maintain state consistency even if multiple syncToCloud calls are made', async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

            const { result } = renderHook(() => useDataSync());

            // Concurrent calls
            await act(async () => {
                const p1 = result.current.syncToCloud('data 1', { uuid: 'u', password: 'p' });
                const p2 = result.current.syncToCloud('data 2', { uuid: 'u', password: 'p' });
                await Promise.all([p1, p2]);
            });

            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toBeNull();
            expect(result.current.lastSyncTime).toBeInstanceOf(Date);
        });
    });

    describe('Security Sanity', () => {
        it('should not include the password in the error message when decryption fails', async () => {
            const password = 'MY_SECRET_PASSWORD';
            const data = 'some data';
            const encrypted = await encrypt(data, password);

            try {
                await decrypt(encrypted, 'WRONG_PASS');
            } catch (error) {
                const message = (error as Error).message;
                expect(message).not.toContain(password);
                expect(message).not.toContain('MY_SECRET_PASSWORD');
            }
        });

        it('should not leak internal crypto error details to the surface message', async () => {
            try {
                await decrypt('not-base64-at-all!', 'password');
            } catch (error) {
                // Should throw the generic Japanese error we defined
                expect((error as Error).message).toBe('復号に失敗しました。パスワードが間違っているか、データが破損しています。');
            }
        });
    });
});
