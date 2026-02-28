'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDataSync } from '@/hooks/useDataSync';
import {
    CloudArrowUpIcon,
    CloudArrowDownIcon,
    KeyIcon,
    ClipboardDocumentIcon,
    QrCodeIcon,
    CameraIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { QRCodeSVG } from 'qrcode.react';
import jsQR from 'jsqr';
import { CHARACTER_SYNC_KEY_SUFFIX } from '@/utils/characterSync';

/** QRコードスキャナーコンポーネント（カメラ利用） */
function QRScanner({ onScan, onClose }: { onScan: (data: string) => void; onClose: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number>(0);
    const [error, setError] = useState<string | null>(null);

    const stopCamera = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = 0;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                });
                if (!mounted) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                }
            } catch {
                if (mounted) {
                    setError('カメラへのアクセスが許可されていません');
                }
            }
        };

        startCamera();

        return () => {
            mounted = false;
            stopCamera();
        };
    }, [stopCamera]);

    // フレームごとにQRコードをスキャン
    useEffect(() => {
        const scan = () => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
                animFrameRef.current = requestAnimationFrame(scan);
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                animFrameRef.current = requestAnimationFrame(scan);
                return;
            }

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code && code.data) {
                stopCamera();
                onScan(code.data);
                return;
            }

            animFrameRef.current = requestAnimationFrame(scan);
        };

        animFrameRef.current = requestAnimationFrame(scan);
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [onScan, stopCamera]);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">QRコードをカメラにかざしてください</span>
                <button
                    onClick={() => {
                        stopCamera();
                        onClose();
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                    title="スキャナーを閉じる"
                >
                    <XMarkIcon className="w-5 h-5" />
                </button>
            </div>
            {error ? (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                    {error}
                </div>
            ) : (
                <div className="relative rounded-md overflow-hidden border border-border bg-black">
                    <video
                        ref={videoRef}
                        className="w-full"
                        playsInline
                        muted
                        style={{ maxHeight: 240 }}
                    />
                    {/* スキャン領域のオーバーレイ */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-40 h-40 border-2 border-primary/60 rounded-lg" />
                    </div>
                </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}

interface DataSyncDialogProps {
    isOpen: boolean;
    onClose: () => void;
    currentData: string;
    currentCharacterData?: string;
    syncId?: string;
    lastSyncedAt?: string;
    onDataRestored: (data: string, syncId: string, remoteUpdatedAt?: string, password?: string) => void;
    onSyncSuccess?: (syncId: string, password?: string, remoteUpdatedAt?: string) => void;
    onCharactersRestored?: (data: string) => void;
}

export default function DataSyncDialog({
    isOpen,
    onClose,
    currentData,
    currentCharacterData,
    syncId,
    lastSyncedAt,
    onDataRestored,
    onSyncSuccess,
    onCharactersRestored,
}: DataSyncDialogProps) {
    const { syncToCloud, restoreFromCloud, generateUUID, isLoading, error } = useDataSync();

    const [uuid, setUuid] = useState('');
    const [password, setPassword] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [showQRCode, setShowQRCode] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setUuid(syncId || '');
        setSuccessMessage('');
        setShowQRCode(false);
        setShowScanner(false);
    }, [isOpen, syncId]);

    if (!isOpen) return null;

    const handleSync = async () => {
        if (!password) {
            alert('パスワードを入力してください');
            return;
        }

        try {
            setSuccessMessage('');
            if (syncId && syncId !== uuid && lastSyncedAt) {
                const shouldSwitch = window.confirm(
                    `このプロジェクトは現在「${syncId}」で同期管理されています。\n` +
                    `最後の同期日時: ${new Date(lastSyncedAt).toLocaleString()}\n\n` +
                    `入力中の共有ID「${uuid}」に切り替えて同期しますか？\n` +
                    `キャンセルすると現在の共有IDに戻します。`
                );
                if (!shouldSwitch) {
                    setUuid(syncId);
                    return;
                }
            }
            const result = await syncToCloud(currentData, { uuid, password });
            onSyncSuccess?.(uuid, password, result.remoteUpdatedAt);
            setSuccessMessage('クラウドへの同期が完了しました');
        } catch {
            // Error is handled by the hook
        }
    };

    const handleRestore = async () => {
        if (!uuid || !password) {
            alert('UUIDとパスワードを入力してください');
            return;
        }

        try {
            setSuccessMessage('');
            if (syncId && syncId !== uuid && lastSyncedAt) {
                const shouldSwitch = window.confirm(
                    `このプロジェクトは現在「${syncId}」で同期管理されています。\n` +
                    `最後の同期日時: ${new Date(lastSyncedAt).toLocaleString()}\n\n` +
                    `入力中の共有ID「${uuid}」を復元対象にしますか？\n` +
                    `キャンセルすると現在の共有IDに戻します。`
                );
                if (!shouldSwitch) {
                    setUuid(syncId);
                    return;
                }
            }
            const restored = await restoreFromCloud({ uuid, password });
            onDataRestored(restored.data, uuid, restored.remoteUpdatedAt, password);
            setSuccessMessage('データの復元が完了しました');
        } catch {
            // Error is handled by the hook
        }
    };

    const handleCharacterSync = async () => {
        if (!password) {
            alert('パスワードを入力してください');
            return;
        }
        if (!currentCharacterData) {
            alert('同期対象のキャラクターデータがありません');
            return;
        }

        try {
            setSuccessMessage('');
            await syncToCloud(currentCharacterData, { uuid: `${uuid}${CHARACTER_SYNC_KEY_SUFFIX}`, password });
            setSuccessMessage('キャラクター設定の同期が完了しました（アイコン除外）');
        } catch {
            // Error is handled by the hook
        }
    };

    const handleCharacterRestore = async () => {
        if (!uuid || !password) {
            alert('UUIDとパスワードを入力してください');
            return;
        }
        try {
            setSuccessMessage('');
            const restored = await restoreFromCloud({ uuid: `${uuid}${CHARACTER_SYNC_KEY_SUFFIX}`, password });
            onCharactersRestored?.(restored.data);
            setSuccessMessage('キャラクター設定の復元が完了しました（アイコン除外）');
        } catch {
            // Error is handled by the hook
        }
    };

    const handleGenerateNewUUID = () => {
        setUuid(generateUUID());
        setSuccessMessage('');
        setShowQRCode(false);
        setShowScanner(false);
    };

    const handleCopyUUID = async () => {
        try {
            await navigator.clipboard.writeText(uuid);
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        } catch {
            // fallback: select input
            const input = document.querySelector<HTMLInputElement>('#uuid-input');
            if (input) {
                input.select();
                document.execCommand('copy');
            }
        }
    };

    const handleQRScan = (data: string) => {
        setUuid(data);
        setShowScanner(false);
        setSuccessMessage('QRコードから共有IDを読み取りました');
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-background border rounded-lg shadow-lg w-full max-w-lg p-6 mx-4">
                {/* ヘッダー */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-foreground">データ同期 (E2EE)</h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* UUID Field */}
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                            共有ID (UUID)
                        </label>
                        <div className="flex gap-2">
                            <input
                                id="uuid-input"
                                type="text"
                                value={uuid}
                                onChange={(e) => {
                                    setUuid(e.target.value);
                                    setShowQRCode(false);
                                }}
                                className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent font-mono text-sm"
                                placeholder="共有IDを入力またはQRコードから読み取り"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleGenerateNewUUID}
                                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors text-sm font-semibold disabled:opacity-50"
                                disabled={isLoading}
                            >
                                新規
                            </button>
                        </div>

                        {/* UUID操作ボタン */}
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={handleCopyUUID}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-md bg-muted text-foreground hover:bg-accent transition-colors"
                                title="共有IDをクリップボードにコピー"
                            >
                                <ClipboardDocumentIcon className="w-4 h-4" />
                                {copyFeedback ? 'コピーしました！' : 'コピー'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowQRCode(!showQRCode);
                                    setShowScanner(false);
                                }}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-md transition-colors ${
                                    showQRCode
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-foreground hover:bg-accent'
                                }`}
                                title="QRコードを表示"
                            >
                                <QrCodeIcon className="w-4 h-4" />
                                QR表示
                            </button>
                            <button
                                onClick={() => {
                                    setShowScanner(!showScanner);
                                    setShowQRCode(false);
                                }}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-md transition-colors ${
                                    showScanner
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-foreground hover:bg-accent'
                                }`}
                                title="QRコードをカメラで読み取り"
                            >
                                <CameraIcon className="w-4 h-4" />
                                QR読取
                            </button>
                        </div>

                        {/* QRコード表示 */}
                        {showQRCode && uuid && (
                            <div className="mt-3 flex flex-col items-center p-4 bg-white rounded-md border border-border">
                                <QRCodeSVG
                                    value={uuid}
                                    size={180}
                                    level="M"
                                    marginSize={2}
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    別デバイスでこのQRコードをスキャンしてください
                                </p>
                            </div>
                        )}

                        {/* QRスキャナー */}
                        {showScanner && (
                            <div className="mt-3">
                                <QRScanner
                                    onScan={handleQRScan}
                                    onClose={() => setShowScanner(false)}
                                />
                            </div>
                        )}

                        <p className="text-xs text-muted-foreground mt-1">
                            公開情報: サーバーへの保存パスとして使用されます
                        </p>
                    </div>

                    {/* Password Field */}
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2 items-center gap-1">
                            <KeyIcon className="w-4 h-4" />
                            合言葉 (Password)
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                            placeholder="秘密のパスワード"
                            disabled={isLoading}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            秘密情報: 暗号化鍵の生成にのみ使用されます (サーバー送信なし)
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleSync}
                            disabled={isLoading || !password}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                        >
                            <CloudArrowUpIcon className="w-5 h-5" />
                            同期 (アップロード)
                        </button>
                        <button
                            onClick={handleRestore}
                            disabled={isLoading || !uuid || !password}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                        >
                            <CloudArrowDownIcon className="w-5 h-5" />
                            復元 (ダウンロード)
                        </button>
                    </div>

                    {/* Character Sync Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleCharacterSync}
                            disabled={isLoading || !password || !currentCharacterData}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-md bg-muted text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
                        >
                            キャラ同期(軽量)
                        </button>
                        <button
                            onClick={handleCharacterRestore}
                            disabled={isLoading || !uuid || !password}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-md bg-muted text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
                        >
                            キャラ復元(軽量)
                        </button>
                    </div>

                    {/* Status Messages */}
                    {isLoading && (
                        <div className="p-3 bg-primary/10 border border-primary/30 rounded-md text-sm text-foreground">
                            処理中...
                        </div>
                    )}
                    {error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                            ❌ {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="p-3 bg-primary/10 border border-primary/30 rounded-md text-sm text-foreground">
                            ✅ {successMessage}
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="p-3 bg-muted border border-border rounded-md text-xs text-muted-foreground">
                        <strong>セキュリティ情報:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                            <li>データはクライアント側で暗号化されます (E2EE)</li>
                            <li>パスワードはメモリ上のみに保持され、保存されません</li>
                            <li>サーバーには暗号化されたデータのみが送信されます</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
