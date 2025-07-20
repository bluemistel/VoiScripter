'use client';

import { useState } from 'react';
import { XMarkIcon, Cog6ToothIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

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
  const [activeTab, setActiveTab] = useState<'settings' | 'help'>('settings');
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);

  const handleDirectorySelect = async () => {
    if (typeof window === 'undefined' || !window.electronAPI) {
      alert('この機能はElectron環境でのみ利用できます');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-2xl mx-4 h-[600px] overflow-hidden">
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
          <div className="w-48 border-r bg-muted/30 h-[600px]">
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
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">VoiScripter ヘルプ</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-foreground mb-2">基本的な使い方</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                        <li>• キャラクターを追加して、アイコンを設定してください</li>
                        <li>• 「＋ブロックを追加」ボタンでセリフを追加できます</li>
                        <li>• キャラクターを選択してセリフを入力してください</li>
                        <li>• ドラッグ&ドロップでブロックの順序を変更できます</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-foreground mb-2">キーボードショートカット</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                        <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+B</kbd> 新規ブロック追加</li>
                        <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Alt+B</kbd> ト書き追加</li>
                        <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Alt+B</kbd> ブロック削除</li>
                        <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Z</kbd> 元に戻す</li>
                        <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Y</kbd> やり直し</li>
                        <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+↑/↓</kbd> ブロック移動</li>
                        <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Alt+↑/↓</kbd> キャラクター選択</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-foreground mb-2">プロジェクト管理</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                        <li>• 複数のプロジェクトを作成・管理できます</li>
                        <li>• プロジェクトは自動的に保存されます</li>
                        <li>• 設定でデータの保存先を変更できます</li>
                      </ul>
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