/**
 * React hook for E2EE data synchronization
 * Handles encryption, API communication, and state management
 */

import { useState, useCallback } from 'react';
import { encrypt, decrypt } from '@/utils/crypto';
import { sha256Hex, solvePow, PowTimeoutError } from '@/utils/pow';
import packageJson from '../../package.json';

// Max time the client spends solving a PoW challenge. The server challenge TTL
// is 120s; once adaptive difficulty escalates a UUID (throttling), solving would
// exceed this and the submission would expire anyway, so we bail early and show
// a "please wait a while" message instead of hanging or wasting the round trip.
const POW_SOLVE_BUDGET_MS = 90_000;

// Shown when the user is being throttled by the anti-abuse mechanism (PoW solve
// budget exceeded, or the server rejected the PoW). Deliberately vague about the
// exact thresholds/timing so attackers can't infer the limits.
const THROTTLE_MESSAGE =
    'しばらく待ってからもう一度お試しください。※短時間にアクセスが集中した場合、一定時間同期機能をご利用いただけないことがあるため、ご注意ください。';

/** Error carrying the user-facing throttle guidance. */
class SyncThrottleError extends Error {
    constructor() {
        super(THROTTLE_MESSAGE);
        this.name = 'SyncThrottleError';
    }
}

const SYNC_ENV = process.env.NEXT_PUBLIC_SYNC_ENV ||
    (process.env.NODE_ENV === 'development' ? 'dev' : 'prd');
const SYNC_API_URL_DEV = process.env.NEXT_PUBLIC_SYNC_API_URL_DEV || 'http://localhost:8787/data';
const SYNC_API_URL_PRD = process.env.NEXT_PUBLIC_SYNC_API_URL_PRD || 'https://voiscripter-sync-prd.bluemist02.workers.dev/data';
const SYNC_API_URL = process.env.NEXT_PUBLIC_SYNC_API_URL ||
    (SYNC_ENV === 'dev' ? SYNC_API_URL_DEV : SYNC_API_URL_PRD);
// Base URL without the trailing `/data` segment (used for the /challenge endpoint).
const SYNC_API_BASE = SYNC_API_URL.replace(/\/data$/, '');

interface PowChallenge {
    token: string;
    difficulty: number;
}

/**
 * Obtain a PoW challenge for (uuid, bodyHash) and solve it.
 * Returns the headers to attach to the subsequent PUT request.
 */
async function obtainPowHeaders(uuid: string, encrypted: string): Promise<Record<string, string>> {
    const bodyHash = sha256Hex(encrypted);
    const challengeUrl = `${SYNC_API_BASE}/challenge?uuid=${encodeURIComponent(uuid)}&hash=${bodyHash}`;
    const res = await fetch(challengeUrl, {
        headers: { 'X-App-Version': packageJson.version },
    });
    if (!res.ok) {
        let detail = `${res.status}`;
        try {
            const body = await res.json();
            if (body.error) detail = body.error;
        } catch { /* ignore */ }
        throw new Error(`認証チャレンジの取得に失敗しました: ${detail}`);
    }
    const challenge = (await res.json()) as PowChallenge;
    let solution: number;
    try {
        solution = await solvePow(challenge.token, challenge.difficulty, POW_SOLVE_BUDGET_MS);
    } catch (e) {
        if (e instanceof PowTimeoutError) throw new SyncThrottleError();
        throw e;
    }
    return {
        'X-PoW-Challenge': challenge.token,
        'X-PoW-Solution': String(solution),
    };
}

interface SyncState {
    isLoading: boolean;
    error: string | null;
    lastSyncTime: Date | null;
}

interface SyncCredentials {
    uuid: string;
    password: string;
}

interface SyncUploadResult {
    remoteUpdatedAt?: string;
}

interface SyncRestoreResult {
    data: string;
    remoteUpdatedAt?: string;
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
        async (data: string, credentials: SyncCredentials): Promise<SyncUploadResult> => {
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

                // Proof-of-Work: spend CPU before the write so automated tools
                // cannot cheaply hammer the endpoint.
                const powHeaders = await obtainPowHeaders(credentials.uuid, encrypted);

                const response = await fetch(`${SYNC_API_URL}/${credentials.uuid}`, {
                    method: 'PUT',
                    body: encrypted,
                    headers: {
                        'Content-Type': 'text/plain',
                        'X-App-Version': packageJson.version,
                        ...powHeaders,
                    },
                });

                if (!response.ok) {
                    let detail = `${response.status}`;
                    try {
                        const body = await response.json();
                        if (body.error) detail = body.error;
                    } catch { /* ignore */ }
                    // A PoW rejection (e.g. expired because solving took too long)
                    // means the anti-abuse mechanism is throttling this UUID.
                    if (response.status === 403 && detail.includes('Proof-of-Work')) {
                        throw new SyncThrottleError();
                    }
                    throw new Error(`サーバーエラー: ${detail}`);
                }
                const remoteUpdatedAt = response.headers.get('X-Sync-Updated-At') || undefined;

                setState({
                    isLoading: false,
                    error: null,
                    lastSyncTime: new Date(),
                });
                return { remoteUpdatedAt };
            } catch (error) {
                const url = `${SYNC_API_URL}/${credentials.uuid}`;
                const detail = error instanceof Error ? error.message : '不明なエラー';
                // Throttle guidance is already user-facing; show it as-is (no URL/prefix noise).
                const errorMsg = error instanceof SyncThrottleError
                    ? detail
                    : `同期に失敗しました: ${detail} (URL: ${url})`;
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
        async (credentials: SyncCredentials): Promise<SyncRestoreResult> => {
            setState({ isLoading: true, error: null, lastSyncTime: null });

            try {
                const url = `${SYNC_API_URL}/${credentials.uuid}`;
                console.log('[DataSync] restoreFromCloud URL:', url);
                const response = await fetch(url, {
                    headers: {
                        'X-App-Version': packageJson.version,
                    },
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('データが見つかりません');
                    }
                    throw new Error(`サーバーエラー: ${response.status}`);
                }

                const encrypted = await response.text();
                const remoteUpdatedAt = response.headers.get('X-Sync-Updated-At') || undefined;

                const decrypted = await decrypt(encrypted, credentials.password);

                setState({
                    isLoading: false,
                    error: null,
                    lastSyncTime: new Date(),
                });

                return {
                    data: decrypted,
                    remoteUpdatedAt
                };
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
