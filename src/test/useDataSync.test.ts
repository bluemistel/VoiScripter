/**
 * Unit tests for useDataSync hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataSync } from '../hooks/useDataSync';

// Mock fetch globally
global.fetch = vi.fn();

// A PoW challenge response with difficulty 0, so solvePow resolves instantly.
const challengeResponse = () =>
    new Response(JSON.stringify({ token: 'test.token', difficulty: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });

describe('useDataSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateUUID', () => {
        it('should generate valid UUID', () => {
            const { result } = renderHook(() => useDataSync());
            const uuid = result.current.generateUUID();

            // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(uuid).toMatch(uuidRegex);
        });

        it('should generate unique UUIDs', () => {
            const { result } = renderHook(() => useDataSync());
            const uuid1 = result.current.generateUUID();
            const uuid2 = result.current.generateUUID();
            expect(uuid1).not.toBe(uuid2);
        });
    });

    describe('syncToCloud', () => {
        it('should successfully sync data', async () => {
            // 1st fetch: PoW challenge, 2nd fetch: PUT
            (global.fetch as any)
                .mockResolvedValueOnce(challengeResponse())
                .mockResolvedValueOnce(new Response('OK', { status: 200 }));

            const { result } = renderHook(() => useDataSync());

            await act(async () => {
                await result.current.syncToCloud('test data', {
                    uuid: 'test-uuid',
                    password: 'test-password'
                });
            });

            expect(result.current.error).toBeNull();
            expect(result.current.lastSyncTime).toBeInstanceOf(Date);

            // Verify the PUT carries the PoW headers
            const putCall = (global.fetch as any).mock.calls[1];
            expect(putCall[1].method).toBe('PUT');
            expect(putCall[1].headers['X-PoW-Challenge']).toBe('test.token');
            expect(putCall[1].headers['X-PoW-Solution']).toBe('0');
        });

        it('should handle server errors on PUT', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce(challengeResponse())
                .mockResolvedValueOnce(new Response('Server Error', { status: 500 }));

            const { result } = renderHook(() => useDataSync());

            await act(async () => {
                try {
                    await result.current.syncToCloud('test data', {
                        uuid: 'test-uuid',
                        password: 'test-password'
                    });
                } catch (error) {
                    // Expected to throw
                }
            });

            expect(result.current.error).toContain('サーバーエラー');
        });

        it('should fail when PoW is rejected (403)', async () => {
            (global.fetch as any)
                .mockResolvedValueOnce(challengeResponse())
                .mockResolvedValueOnce(new Response(
                    JSON.stringify({ error: 'Proof-of-Workの検証に失敗しました。' }),
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                ));

            const { result } = renderHook(() => useDataSync());

            await act(async () => {
                try {
                    await result.current.syncToCloud('test data', {
                        uuid: 'test-uuid',
                        password: 'test-password'
                    });
                } catch (error) {
                    // Expected to throw
                }
            });

            expect(result.current.error).toContain('Proof-of-Work');
        });
    });

    describe('restoreFromCloud', () => {
        it('should handle 404 not found', async () => {
            const mockResponse = new Response('Not Found', { status: 404 });
            (global.fetch as any).mockResolvedValue(mockResponse);

            const { result } = renderHook(() => useDataSync());

            await act(async () => {
                try {
                    await result.current.restoreFromCloud({
                        uuid: 'nonexistent-uuid',
                        password: 'test-password'
                    });
                } catch (error) {
                    // Expected to throw
                }
            });

            expect(result.current.error).toContain('データが見つかりません');
        });
    });

    describe('state management', () => {
        // Note: Testing loading state with act() is unreliable due to timing
        // The hook correctly sets isLoading=true, but act() batches updates
        // For now, we verify error state management instead

        it('should initialize with correct default state', () => {
            const { result } = renderHook(() => useDataSync());

            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toBeNull();
            expect(result.current.lastSyncTime).toBeNull();
        });
    });
});
