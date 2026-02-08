'use client';

import { useState } from 'react';
import { useDataSync } from '@/hooks/useDataSync';
import { CloudArrowUpIcon, CloudArrowDownIcon, KeyIcon } from '@heroicons/react/24/outline';

interface DataSyncDialogProps {
    isOpen: boolean;
    onClose: () => void;
    currentData: string; // JSON string of current data to sync
    onDataRestored: (data: string) => void; // Callback when data is restored
}

export default function DataSyncDialog({
    isOpen,
    onClose,
    currentData,
    onDataRestored,
}: DataSyncDialogProps) {
    const { syncToCloud, restoreFromCloud, generateUUID, isLoading, error } = useDataSync();

    const [uuid, setUuid] = useState(() => generateUUID());
    const [password, setPassword] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    if (!isOpen) return null;

    const handleSync = async () => {
        if (!password) {
            alert('パスワードを入力してください');
            return;
        }

        try {
            setSuccessMessage('');
            await syncToCloud(currentData, { uuid, password });
            setSuccessMessage('クラウドへの同期が完了しました');
        } catch (err) {
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
            const restoredData = await restoreFromCloud({ uuid, password });
            onDataRestored(restoredData);
            setSuccessMessage('データの復元が完了しました');
        } catch (err) {
            // Error is handled by the hook
        }
    };

    const handleGenerateNewUUID = () => {
        setUuid(generateUUID());
        setSuccessMessage('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 m-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">データ同期 (E2EE)</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4">
                    {/* UUID Field */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            共有ID (UUID)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={uuid}
                                onChange={(e) => setUuid(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                placeholder="自動生成されたUUID"
                                readOnly
                            />
                            <button
                                onClick={handleGenerateNewUUID}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors text-sm font-medium"
                                disabled={isLoading}
                            >
                                新規
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            公開情報: サーバーへの保存パスとして使用されます
                        </p>
                    </div>

                    {/* Password Field */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                            <KeyIcon className="w-4 h-4" />
                            合言葉 (Password)
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="秘密のパスワード"
                            disabled={isLoading}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            秘密情報: 暗号化鍵の生成にのみ使用されます (サーバー送信なし)
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleSync}
                            disabled={isLoading || !password}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            <CloudArrowUpIcon className="w-5 h-5" />
                            同期 (アップロード)
                        </button>
                        <button
                            onClick={handleRestore}
                            disabled={isLoading || !uuid || !password}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            <CloudArrowDownIcon className="w-5 h-5" />
                            復元 (ダウンロード)
                        </button>
                    </div>

                    {/* Status Messages */}
                    {isLoading && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                            処理中...
                        </div>
                    )}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                            ❌ {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
                            ✅ {successMessage}
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600">
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
