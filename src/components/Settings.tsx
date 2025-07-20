'use client';

import { useState, useEffect } from 'react';
import { 
  Cog6ToothIcon, 
  QuestionMarkCircleIcon,
  FolderIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDirectoryChange: (directory: string) => void;
  currentSaveDirectory: string;
}

export default function Settings({
  isOpen,
  onClose,
  onSaveDirectoryChange,
  currentSaveDirectory
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'help'>('settings');
  const [saveDirectory, setSaveDirectory] = useState(currentSaveDirectory);

  useEffect(() => {
    setSaveDirectory(currentSaveDirectory);
  }, [currentSaveDirectory]);

  const handleDirectorySelect = async () => {
    try {
      // Electron環境でのディレクトリ選択
      if (window.electronAPI) {
        const result = await window.electronAPI.selectDirectory();
        if (result) {
          setSaveDirectory(result);
        }
      } else {
        // ブラウザ環境ではlocalStorageのみ
        alert('ディレクトリ選択はデスクトップアプリでのみ利用可能です。');
      }
    } catch (error) {
      console.error('ディレクトリ選択エラー:', error);
    }
  };

  const handleSave = () => {
    onSaveDirectoryChange(saveDirectory);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Cog6ToothIcon className="w-6 h-6 text-foreground" />
            <h2 className="text-lg font-semibold text-foreground">設定</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            設定
          </button>
          <button
            onClick={() => setActiveTab('help')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'help'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ヘルプ
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'settings' ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">データの保存先</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="localStorage"
                      name="saveLocation"
                      checked={saveDirectory === ''}
                      onChange={() => setSaveDirectory('')}
                      className="text-primary"
                    />
                    <label htmlFor="localStorage" className="text-foreground">
                      localStorage（ブラウザ内）
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="customDirectory"
                      name="saveLocation"
                      checked={saveDirectory !== ''}
                      onChange={() => setSaveDirectory('custom')}
                      className="text-primary"
                    />
                    <label htmlFor="customDirectory" className="text-foreground">
                      カスタムディレクトリ
                    </label>
                  </div>
                  
                  {saveDirectory !== '' && (
                    <div className="ml-6 space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={saveDirectory === 'custom' ? '' : saveDirectory}
                          onChange={(e) => setSaveDirectory(e.target.value)}
                          placeholder="ディレクトリパスを入力"
                          className="flex-1 p-2 border rounded bg-background text-foreground"
                        />
                        <button
                          onClick={handleDirectorySelect}
                          className="p-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                          title="ディレクトリを選択"
                        >
                          <FolderIcon className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        デスクトップアプリでのみ利用可能です。ブラウザではlocalStorageが使用されます。
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <QuestionMarkCircleIcon className="w-6 h-6 text-foreground" />
                <h3 className="text-lg font-medium text-foreground">ヘルプ</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">主な機能</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                    <li>キャラクター管理（追加、編集、削除）</li>
                    <li>感情設定とアイコン表示(ローカルPC・WEBの画像を指定可能)</li>
                    <li>ブロックベースの編集</li>
                    <li>ドラッグ&ドロップによるブロック並び替え</li>
                    <li>CSVインポート/エクスポート</li>
                    <li>ダークモード対応</li>
                    <li>台詞の入れ替えをショートカットでできる</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-foreground mb-2">技術スタック</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                    <li>Next.js 14</li>
                    <li>TypeScript</li>
                    <li>TailwindCSS v4</li>
                    <li>React DnD Kit</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-foreground mb-2">ショートカット一覧</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                    <li><b>Ctrl+B</b>：新規セリフブロックを作成</li>
                    <li><b>Ctrl+Alt+B</b>：新規ト書きブロックを作成</li>
                    <li><b>Alt+B</b>：選択中のブロックを削除</li>
                    <li><b>Ctrl+↑/Ctrl+↓</b>：ブロックの上下移動</li>
                    <li><b>↑/↓</b>：テキストエリアの最上段/最下段にいる場合は前後のブロックに移動</li>
                    <li><b>Alt+↑/Alt+↓</b>：キャラクター選択（ト書き以外）</li>
                    <li><b>Ctrl+Enter</b>：キャラクター引き継ぎ新規ブロックを作成</li>
                    <li><b>Ctrl+Z</b>：元に戻す(アンドゥ)</li>
                    <li><b>Ctrl+Y</b>：やり直し(リドゥ)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-foreground mb-2">デプロイ</h4>
                  <p className="text-sm text-foreground">このプロジェクトはVercelにデプロイされています。</p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground mb-2">ライセンス</h4>
                  <p className="text-sm text-foreground">MIT License</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        {activeTab === 'settings' && (
          <div className="flex justify-end space-x-2 p-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              保存
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 