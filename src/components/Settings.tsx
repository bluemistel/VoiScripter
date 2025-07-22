'use client';

import { useState } from 'react';
import { XMarkIcon, Cog6ToothIcon, QuestionMarkCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  saveDirectory: string;
  onSaveDirectoryChange: (directory: string) => void;
}

export default function Settings({
  isOpen,
  onClose,
  saveDirectory,
  onSaveDirectoryChange
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'help' | 'license'>('settings');
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);

  const handleDirectorySelect = async () => {
    if (typeof window === 'undefined' || !window.electronAPI) {
      alert('この機能はデスクトップアプリ版でのみ利用できます(開発中)');
      return;
    }

    setIsSelectingDirectory(true);
    try {
      const directory = await window.electronAPI.selectDirectory();
      if (directory) {
        onSaveDirectoryChange(directory);
      }
    } catch (error) {
      console.error('ディレクトリ選択エラー:', error);
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  const handleClearDirectory = () => {
    onSaveDirectoryChange('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-2xl mx-4 h-[750px] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-foreground">設定</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-foreground" />
          </button>
        </div>
        
        <div className="flex">
          {/* サイドバー */}
          <div className="w-48 border-r bg-muted/30 h-[750px]">
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full p-3 text-left flex items-center space-x-2 transition-colors ${
                activeTab === 'settings' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent'
              }`}
            >
              <Cog6ToothIcon className="w-5 h-5" />
              <span>設定</span>
            </button>
            <button
              onClick={() => setActiveTab('help')}
              className={`w-full p-3 text-left flex items-center space-x-2 transition-colors ${
                activeTab === 'help' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent'
              }`}
            >
              <QuestionMarkCircleIcon className="w-5 h-5" />
              <span>ヘルプ</span>
            </button>
            <button
              onClick={() => setActiveTab('license')}
              className={`w-full p-3 text-left flex items-center space-x-2 transition-colors ${
                activeTab === 'license' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent'
              }`}
            >
              <InformationCircleIcon className="w-5 h-5" />
              <span>ライセンス</span>
            </button>
          </div>
          
          {/* メインコンテンツ */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">データの保存先</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        現在の保存先
                      </label>
                      <div className="p-3 bg-muted rounded border">
                        {saveDirectory || 'localStorage（ブラウザ）'}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={handleDirectorySelect}
                        disabled={isSelectingDirectory}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {isSelectingDirectory ? '選択中...' : 'ディレクトリを選択'}
                      </button>
                      {saveDirectory && (
                        <button
                          onClick={handleClearDirectory}
                          className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
                        >
                          localStorageに戻す
                        </button>
                      )}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      <p>• ディレクトリを選択すると、データがファイルとして保存されます</p>
                      <p>• 保存先を変更すると、既存のデータが自動的に移動されます</p>
                      <p>• 未設定の場合はlocalStorageに保存されます</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'help' && (
              <div className="flex flex-col max-h-[60vh] overflow-y-auto pr-2">
                <h4 className="font-medium text-foreground mb-2">VoiScripter ヘルプ</h4>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-foreground mb-2">基本的な使い方</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• 右上のキャラクターのアイコンから話者を追加してください。</li>
                      <li>• Alt+↑ ↓、またはキャラクターを変更してセリフを入力してください。</li>
                      <li>• Ctrl+Enter、または「＋ブロックを追加」ボタンでセリフを追加できます。</li>
                      <li>• Ctrl+↑ ↓、またはドラッグ&ドロップでブロックの順序を変更できます。</li>
                      <li>• 右上のエクスポートからCSVのテキストファイルとして出力できます。</li>
                      <li>• エクスポートしたファイルは、VoiScripterでも読み込むことができます。</li>
                      <li>• 作業状態は随時保存されており、閉じても前回の状態から再開できます。</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-foreground mb-2">キーボードショートカット</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Z</kbd> 元に戻す</li>
                      <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Y</kbd> やり直し</li>
                      <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Enter</kbd> 直下に新規ブロック追加</li>
                      <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+B</kbd> 最下段に新規ブロック追加</li>
                      <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Alt+B</kbd> ト書きブロックを追加</li>
                      <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Alt+B</kbd>選択ブロック削除</li>
                      <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+↑/↓</kbd> ブロック移動</li>
                      <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Alt+↑/↓</kbd> キャラクターを選択</li>
                      <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+,</kbd> 最下段へ移動する</li>
                      <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Alt+,</kbd> 最上段へ移動する</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-foreground mb-2">プロジェクト管理</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• 複数のプロジェクトを作成・管理できます。</li>
                      <li>• プロジェクトは自動的に保存されます。</li>
                      <li>• 設定でデータの保存先を変更できます。</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

              {activeTab === 'license' && (
                <div className="mt-6">
                  <h4 className="font-medium text-foreground mb-2">このアプリについて</h4>
                  <div className="text-sm text-muted-foreground space-y-1 ml-4">
                    <div className="mb-2">
                      <span className="font-bold text-foreground">VoiScripter</span> v0.1.0
                    </div>
                    <div className="ml-2">
                        <span>本アプリの不具合により何らかの損害が発生した場合でも、作者は一切の責任を負いません。自己責任でのご使用をお願いいたします。
                        </span>
                      </div>
                    <h4 className="font-medium text-foreground mb-2">使用技術</h4>
                    <div className="mb-2">
                      <ul className="list-disc ml-6">
                        <li>Next.js (MIT)</li>
                        <li>React (MIT)</li>
                        <li>TypeScript (Apache-2.0)</li>
                        <li>Tailwind CSS (MIT)</li>
                        <li>@dnd-kit/core, @dnd-kit/sortable (MIT)</li>
                        <li>Heroicons (MIT)</li>
                        <li>Electron (MIT)</li>
                      </ul>
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold text-foreground">ライセンス:</span>
                      <div className="ml-2">
                        <span>本アプリおよび上記ライブラリはMITまたはApache-2.0ライセンスに基づき配布されています。</span>
                      </div>
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold text-foreground">Copyright:</span>
                      <div className="ml-2">
                        <span>© 2025 VoiScripter Authors</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
} 