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
                // Encrypt data
                const encrypted = await encrypt(data, credentials.password);

                // Upload to server
                const response = await fetch(`${SYNC_API_URL}/${credentials.uuid}`, {
                    method: 'PUT',
                    body: encrypted,
                    headers: {
                        'Content-Type': 'text/plain',
                    },
                });

                if (!response.ok) {
                    throw new Error(`サーバーエラー: ${response.status}`);
                }

                setState({
                    isLoading: false,
                    error: null,
                    lastSyncTime: new Date(),
                });
            } catch (error) {
                setState({
                    isLoading: false,
                    error: error instanceof Error ? error.message : '同期に失敗しました',
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
                // Download from server
                const response = await fetch(`${SYNC_API_URL}/${credentials.uuid}`);

                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('データが見つかりません');
                    }
                    throw new Error(`サーバーエラー: ${response.status}`);
                }

                const encrypted = await response.text();

                // Decrypt data
                const decrypted = await decrypt(encrypted, credentials.password);

                setState({
                    isLoading: false,
                    error: null,
                    lastSyncTime: new Date(),
                });

                return decrypted;
            } catch (error) {
                setState({
                    isLoading: false,
                    error: error instanceof Error ? error.message : '復元に失敗しました',
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
