/**
 * React hook for E2EE data synchronization
 * Handles encryption, API communication, and state management
 */

import { useState, useCallback } from 'react';
import { encrypt, decrypt } from '@/utils/crypto';

const SYNC_API_URL = process.env.NEXT_PUBLIC_SYNC_API_URL ||
    (process.env.NODE_ENV === 'development'
        ? 'http://localhost:8787/data'
        : 'https://voiscripter-sync.bluemist02.workers.dev/data');

interface SyncState {
    isLoading: boolean;
    error: string | null;
    lastSyncTime: Date | null;
}

interface SyncCredentials {
    uuid: string;
    password: string;
}

export function useDataSync() {
    const [state, setState] = useState<SyncState>({
        isLoading: false,
        error: null,
        lastSyncTime: null,
    });

    /**
     * Upload encrypted data to server
     */
    const syncToCloud = useCallback(
        async (data: string, credentials: SyncCredentials): Promise<void> => {
            setState({ isLoading: true, error: null, lastSyncTime: null });

            try {
                const rawSize = new Blob([data]).size;
                const rawSizeMB = (rawSize / 1024 / 1024).toFixed(1);
                console.log(`[DataSync] Raw data size: ${rawSizeMB}MB`);

                const encrypted = await encrypt(data, credentials.password);

                const encryptedSize = new Blob([encrypted]).size;
                const encryptedSizeMB = (encryptedSize / 1024 / 1024).toFixed(1);
                console.log(`[DataSync] Encrypted data size: ${encryptedSizeMB}MB`);

                if (encryptedSize > 25 * 1024 * 1024) {
                    throw new Error(
                        `データサイズが上限(25MB)を超えています (${encryptedSizeMB}MB)。画像を削除してデータサイズを削減してください。`
                    );
                }

                const response = await fetch(`${SYNC_API_URL}/${credentials.uuid}`, {
                    method: 'PUT',
                    body: encrypted,
                    headers: {
                        'Content-Type': 'text/plain',
                    },
                });

                if (!response.ok) {
                    let detail = `${response.status}`;
                    try {
                        const body = await response.json();
                        if (body.error) detail = body.error;
                    } catch { /* ignore */ }
                    throw new Error(`サーバーエラー: ${detail}`);
                }

                setState({
                    isLoading: false,
                    error: null,
                    lastSyncTime: new Date(),
                });
            } catch (error) {
                const url = `${SYNC_API_URL}/${credentials.uuid}`;
                const detail = error instanceof Error ? error.message : '不明なエラー';
                const errorMsg = `同期に失敗しました: ${detail} (URL: ${url})`;
                console.error('[DataSync] syncToCloud error:', error, 'URL:', url);
                setState({
                    isLoading: false,
                    error: errorMsg,
                    lastSyncTime: null,
                });
                throw error;
            }
        },
        []
    );

    /**
     * Download and decrypt data from server
     */
    const restoreFromCloud = useCallback(
        async (credentials: SyncCredentials): Promise<string> => {
            setState({ isLoading: true, error: null, lastSyncTime: null });

            try {
                const url = `${SYNC_API_URL}/${credentials.uuid}`;
                console.log('[DataSync] restoreFromCloud URL:', url);
                const response = await fetch(url);

                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('データが見つかりません');
                    }
                    throw new Error(`サーバーエラー: ${response.status}`);
                }

                const encrypted = await response.text();

                const decrypted = await decrypt(encrypted, credentials.password);

                setState({
                    isLoading: false,
                    error: null,
                    lastSyncTime: new Date(),
                });

                return decrypted;
            } catch (error) {
                const url = `${SYNC_API_URL}/${credentials.uuid}`;
                const detail = error instanceof Error ? error.message : '不明なエラー';
                const errorMsg = `復元に失敗しました: ${detail} (URL: ${url})`;
                console.error('[DataSync] restoreFromCloud error:', error, 'URL:', url);
                setState({
                    isLoading: false,
                    error: errorMsg,
                    lastSyncTime: null,
                });
                throw error;
            }
        },
        []
    );

    /**
     * Generate a new UUID for sync
     */
    const generateUUID = useCallback((): string => {
        return crypto.randomUUID();
    }, []);

    return {
        ...state,
        syncToCloud,
        restoreFromCloud,
        generateUUID,
    };
}
