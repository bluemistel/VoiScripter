'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDataSync } from '@/hooks/useDataSync';
import {
    CloudArrowUpIcon,
    CloudArrowDownIcon,
    KeyIcon,
    InformationCircleIcon,
    ClipboardDocumentIcon,
    QrCodeIcon,
    CameraIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { QRCodeSVG } from 'qrcode.react';
import jsQR from 'jsqr';
import { CHARACTER_SYNC_KEY_SUFFIX } from '@/utils/characterSync';
import DialogFrame from '@/components/common/DialogFrame';
import DialogHeader from '@/components/common/DialogHeader';
import { buttonClass } from '@/components/common/Button';

/**
 * キャラクター設定（軽量版）を「前回の同期から変わったときだけ」送るための目印。
 * 共有IDごとにこの端末に保存する（updatedAt は毎回変わるので比較から外す）。
 */
const characterSignatureKey = (syncId: string) => `voiscripter_characterSyncSignature_${syncId}`;

const toCharacterSignature = (characterDataJson: string): string => {
    try {
        const { updatedAt: _updatedAt, ...rest } = JSON.parse(characterDataJson);
        return JSON.stringify(rest);
    } catch {
        return characterDataJson;
    }
};

const readCharacterSignature = (syncId: string): string | null => {
    try {
        return localStorage.getItem(characterSignatureKey(syncId));
    } catch {
        return null;
    }
};

const writeCharacterSignature = (syncId: string, signature: string) => {
    try {
        localStorage.setItem(characterSignatureKey(syncId), signature);
    } catch {
        // 保存できない環境では毎回送信する（動作には影響しない）
    }
};

/** QR表示・読取のトグル。ONのときは選択中の面（primary-tint＋primaryのリング） */
const toggleButtonClass = (on: boolean) => on
  ? 'inline-flex items-center justify-center whitespace-nowrap transition px-3 py-1.5 text-xs rounded-[11px] gap-1 font-semibold bg-primary-tint text-primary-text shadow-[inset_0_0_0_1.5px_var(--color-primary)]'
  : buttonClass('secondary', 'sm');

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
                <span className="text-sm font-medium text-fg">QRコードをカメラにかざしてください</span>
                <button
                    onClick={() => {
                        stopCamera();
                        onClose();
                    }}
                    className="p-1 text-fg-sub hover:text-fg rounded-lg transition-colors"
                    title="スキャナーを閉じる"
                >
                    <XMarkIcon className="w-5 h-5" />
                </button>
            </div>
            {error ? (
                <div className="px-3.5 py-3 bg-destructive-tint shadow-[inset_0_0_0_1.5px_var(--color-destructive-ring)] rounded-xl text-[13px] text-destructive">
                    {error}
                </div>
            ) : (
                <div className="relative rounded-2xl overflow-hidden ring-1 ring-hairline bg-black">
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
    /** 台本を反映したら true（確認で取り消された・失敗したときは false） */
    onDataRestored: (data: string, syncId: string, remoteUpdatedAt?: string, password?: string) => boolean | void | Promise<boolean | void>;
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
    const { syncToCloud, restoreFromCloud, restoreFromCloudIfExists, generateUUID, isLoading, error } = useDataSync();

    const [uuid, setUuid] = useState('');
    const [password, setPassword] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [showQRCode, setShowQRCode] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setUuid(syncId || '');
        setSuccessMessage('');
        setShowQRCode(false);
        setShowScanner(false);
        setShowGuide(false);
    }, [isOpen, syncId]);

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

            // キャラクター設定（軽量版）も続けて同期する。同期は回数に応じて待ち時間が伸びるため、
            // 前回の同期から変更があったときだけ送る。
            const characterSignature = currentCharacterData ? toCharacterSignature(currentCharacterData) : null;
            if (!characterSignature || readCharacterSignature(uuid) === characterSignature) {
                setSuccessMessage('クラウドへの同期が完了しました（キャラクター設定は前回から変更なし）');
                return;
            }
            try {
                await syncToCloud(currentCharacterData!, { uuid: `${uuid}${CHARACTER_SYNC_KEY_SUFFIX}`, password });
                writeCharacterSignature(uuid, characterSignature);
                setSuccessMessage('台本とキャラクター設定の同期が完了しました（アイコン画像は除く）');
            } catch {
                setSuccessMessage('台本の同期は完了しましたが、キャラクター設定の同期に失敗しました');
            }
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
            const applied = await onDataRestored(restored.data, uuid, restored.remoteUpdatedAt, password);
            if (applied === false) return;

            // キャラクター設定（軽量版）も続けて復元する（まだ同期されていなければ何もしない）
            try {
                const restoredCharacters = await restoreFromCloudIfExists({ uuid: `${uuid}${CHARACTER_SYNC_KEY_SUFFIX}`, password });
                if (restoredCharacters) {
                    onCharactersRestored?.(restoredCharacters.data);
                    writeCharacterSignature(uuid, toCharacterSignature(restoredCharacters.data));
                    setSuccessMessage('台本とキャラクター設定の復元が完了しました（アイコン画像はローカルのものを使用）');
                } else {
                    setSuccessMessage('データの復元が完了しました');
                }
            } catch {
                setSuccessMessage('台本の復元は完了しましたが、キャラクター設定の復元に失敗しました');
            }
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
        <>
        <DialogFrame
            isOpen={isOpen}
            onCancel={onClose}
            panelClassName="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        >
                <DialogHeader
                    icon={CloudArrowUpIcon}
                    title="データ同期 (E2EE)"
                    onClose={onClose}
                    actions={
                        <button
                            onClick={() => setShowGuide(true)}
                            className={buttonClass('secondary', 'sm')}
                            title="データ同期の使い方"
                        >
                            <InformationCircleIcon className="size-4" />
                            使い方
                        </button>
                    }
                />

                <div className="px-5 pb-5 space-y-5">
                    {/* UUID Field */}
                    <div>
                        <label htmlFor="uuid-input" className="block text-[13.5px] font-bold text-fg mb-2">
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
                                className="ui-input flex-1 min-w-0 font-mono"
                                placeholder="共有IDを入力またはQRコードから読み取り"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleGenerateNewUUID}
                                className={buttonClass('secondary')}
                                disabled={isLoading}
                            >
                                新規
                            </button>
                        </div>

                        {/* UUID操作ボタン */}
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={handleCopyUUID}
                                className={buttonClass('secondary', 'sm')}
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
                                className={toggleButtonClass(showQRCode)}
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
                                className={toggleButtonClass(showScanner)}
                                title="QRコードをカメラで読み取り"
                            >
                                <CameraIcon className="w-4 h-4" />
                                QR読取
                            </button>
                        </div>

                        {/* QRコード表示 */}
                        {showQRCode && uuid && (
                            <div className="mt-3 flex flex-col items-center p-4 bg-well rounded-2xl">
                                {/* QRコードは読み取りやすさのため常に白地 */}
                                <div className="p-2 bg-white rounded-xl">
                                    <QRCodeSVG
                                        value={uuid}
                                        size={180}
                                        level="M"
                                        marginSize={2}
                                    />
                                </div>
                                <p className="text-[11px] text-fg-sub mt-2">
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

                        <p className="text-[11px] leading-[1.55] text-fg-sub mt-2">
                            公開情報: サーバーへの保存パスとして使用されます
                        </p>
                    </div>

                    {/* Password Field */}
                    <div>
                        <label className="flex text-[13.5px] font-bold text-fg mb-2 items-center gap-1">
                            <KeyIcon className="size-4 text-primary-text" />
                            合言葉 (Password)
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="ui-input w-full"
                            placeholder="秘密のパスワード"
                            disabled={isLoading}
                        />
                        <p className="text-[11px] leading-[1.55] text-fg-sub mt-2">
                            秘密情報: 暗号化鍵の生成にのみ使用されます (サーバー送信なし)
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={handleSync}
                            disabled={isLoading || !password}
                            className={`${buttonClass('primary')} flex-1 py-3`}
                        >
                            <CloudArrowUpIcon className="w-5 h-5" />
                            同期 (アップロード)
                        </button>
                        <button
                            onClick={handleRestore}
                            disabled={isLoading || !uuid || !password}
                            className={`${buttonClass('secondary')} flex-1 py-3`}
                        >
                            <CloudArrowDownIcon className="w-5 h-5" />
                            復元 (ダウンロード)
                        </button>
                    </div>

                    {/* Status Messages */}
                    {isLoading && (
                        <div className="px-3.5 py-3 bg-primary-tint rounded-xl text-[13px] text-fg">
                            処理中...
                        </div>
                    )}
                    {error && (
                        <div className="px-3.5 py-3 bg-destructive-tint shadow-[inset_0_0_0_1.5px_var(--color-destructive-ring)] rounded-xl text-[13px] text-destructive">
                            ❌ {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="px-3.5 py-3 bg-primary-tint rounded-xl text-[13px] text-fg">
                            ✅ {successMessage}
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="px-4 py-3.5 bg-well rounded-2xl text-[11px] leading-[1.55] text-fg-sub">
                        <strong>セキュリティ情報:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                            <li>データはクライアント側で暗号化されます (E2EE)</li>
                            <li>パスワードはメモリ上のみに保持され、保存されません</li>
                            <li>サーバーには暗号化されたデータのみが送信されます</li>
                            <li>アクセス過多の抑制のため、短時間に連続して同期を行うと、同期にかかる時間が次第に長くなることがあります</li>
                            <li>短時間にアクセスが集中していると判断された場合、一定時間同期機能をご利用いただけないことがあります</li>
                        </ul>
                    </div>
                </div>
        </DialogFrame>
        {showGuide && (
            <DialogFrame
                isOpen={showGuide}
                onCancel={() => setShowGuide(false)}
                panelClassName="w-full max-w-2xl max-h-[85vh] overflow-y-auto"
                overlayClassName="z-60 bg-black/50 p-4"
                enableEnterShortcut={false}
            >
                    <div className="sticky top-0 z-10 bg-panel/95 backdrop-blur">
                        <DialogHeader icon={InformationCircleIcon} title="データ同期の使い方" onClose={() => setShowGuide(false)} />
                    </div>
                    <div className="px-5 pb-5 space-y-4 text-[13.5px] leading-relaxed text-fg">
                        <p>
                            別の VoiScripter へ現在の台本を同期して、作業を引き継ぐことができます。
                            <br />
                            同期対象は「プロジェクト本体の台本データ」です（ストーリーパネル画像は同期されません）。
                        </p>

                        <div>
                            <h4 className="font-semibold mb-1">同期元の操作（アップロード）</h4>
                            <ol className="list-decimal list-inside space-y-1 text-fg-sub">
                                <li>「新規」ボタンで共有IDを発行します。</li>
                                <li>任意の合言葉（Password）を入力します。</li>
                                <li>「同期（アップロード）」で台本データを送信します。</li>
                            </ol>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-1">復元側の操作（ダウンロード）</h4>
                            <ol className="list-decimal list-inside space-y-1 text-fg-sub">
                                <li>共有IDを入力するか、QR読取で取り込みます。</li>
                                <li>同期元と同じ合言葉（Password）を入力します。</li>
                                <li>「復元（ダウンロード）」で台本データを取得します。</li>
                            </ol>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-1">補足</h4>
                            <ul className="list-disc list-inside space-y-1 text-fg-sub">
                                <li>同期成功後は、同じ共有IDで5分間隔の自動同期が有効になります。</li>
                                <li>同期・復元では、キャラクター設定（アイコン画像を除く軽量版）もあわせて同期します。キャラクター設定は前回の同期から変更があったときだけ送信します。</li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-1">注意点</h4>
                            <ul className="list-disc list-inside space-y-1 text-fg-sub">
                                <li>共有IDと合言葉の両方が一致しないと復元できません。</li>
                                <li>データ破損を防ぐため、同じ台本を複数環境で同時編集しないでください。</li>
                                <li>ストーリーパネル画像は軽量化のため同期されません（各端末のローカル管理です）。</li>
                            </ul>
                        </div>
                    </div>
            </DialogFrame>
        )}
        </>
    );
}
