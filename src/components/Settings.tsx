'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, Cog6ToothIcon, QuestionMarkCircleIcon, InformationCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

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
  const [activeTab, setActiveTab] = useState<'settings' | 'help' | 'license' | 'changelog'>('settings');
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);
  const [fontFamily, setFontFamily] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fontFamily') || 'mplus';
    }
    return 'mplus';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fontFamily', fontFamily);
      document.body.classList.remove('font-mplus', 'font-noto', 'font-sawarabi');
      document.body.classList.add(`font-${fontFamily}`);
    }
  }, [fontFamily]);

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
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-3xl mx-4 h-[750px] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold text-foreground">設定</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-foreground" />
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* サイドバー */}
          <div className="w-48 border-r bg-muted/30 flex-shrink-0">
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
              onClick={() => setActiveTab('changelog')}
              className={`w-full p-3 text-left flex items-center space-x-2 transition-colors ${
                activeTab === 'changelog' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent'
              }`}
            >
              <DocumentTextIcon className="w-5 h-5" />
              <span>更新履歴</span>
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
                {/* フォント選択セクション */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">フォント</h3>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground mb-2">表示フォント</label>
                    <select
                      className="p-2 border rounded bg-background text-foreground"
                      value={fontFamily}
                      onChange={e => setFontFamily(e.target.value)}
                    >
                      <option value="mplus">M PLUS 1p（デフォルト）</option>
                      <option value="noto">Noto Sans JP</option>
                      <option value="sawarabi">Sawarabi Gothic</option>
                    </select>
                  </div>
                </div>
                {/* データの保存先セクション */}
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
              <div className="flex flex-col max-h-[60vh] pr-2">
                <h4 className="font-medium text-foreground mb-2">VoiScripter ヘルプ</h4>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-foreground mb-2">基本的な使い方</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• 左上の新規作成から新しいプロジェクトを作成してください。</li>
                      <li>• 右上のキャラクターのアイコンから話者を追加してください。</li>
                      <li>• 「+ブロックを追加」からテキストブロックを追加してください。</li>
                      <li>• テキストブロックのリストからキャラクターを変更するとセリフが入力できます。「ト書きを入力」ではメモを書けます。</li>
                      <li>• Ctrl+↑ ↓、またはドラッグ&ドロップでブロックの順序を変更できます。</li>
                      <li>• 右上のエクスポートからCSVのテキストファイルとして出力できます。グループ設定ごとにCSVファイルを分割出力することができます。</li>
                      <li>• セリフの入力エリア外をCtrl+クリック、またはShift+クリックすると複数ブロックを選択し、選択したブロックのみをエクスポートできます。</li>
                      <li>• エクスポートしたファイルは、VoiScripterでも読み込むことができ、対応合成音声ソフトにインポートすることができます。</li>
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
                      <li>• <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+M</kbd> CSVエクスポートダイアログを開く</li>
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

            {activeTab === 'changelog' && (
              <div className="flex flex-col max-h-[60vh] pr-2">
                <h4 className="font-medium text-foreground mb-4">更新履歴</h4>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium text-foreground mb-2">v0.1.9</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• エクスポート時のダイアログ、キャラクター設定のダイアログをウィンドウの表示領域が足りない場合にスクロールできるように改修</li>
                      <li>• エクスポート時、特定の組み合わせかつエクスポートの切り替えが行われた際、一部エクスポートオプションのチェックボックスが不正の組み合わせになってしまう不具合を修正</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-foreground mb-2">v0.1.8</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• デスクトップ版で最後に開いていたウィンドウのサイズと表示位置を記憶する機能を追加(ウィンドウ操作がちょっと重たくなります)</li>
                      <li>• 最後に開いていたプロジェクトが開かれなかった不具合を修正</li>
                      <li>• CSV形式とテキスト形式のエクスポートが選択できる機能を追加</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-foreground mb-2">v0.1.7</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• v0.1.6の機能をデスクトップアプリ版でも利用できるように改修</li>
                    <li>• プロジェクトのJSONエクスポート・インポート機能を改修しキャラクター設定のエクスポートと併用して別環境でも引き継げるように</li>
                    <li>• キャラクター設定のCSVエクスポートで別環境でも同じ設定を引き継げるように改修</li>
                    <li>• ライセンス情報にデスクトップアプリ版のダウンロード先を追加</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-foreground mb-2">v0.1.6</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• プロジェクト内サブプロジェクト作成機能(シーン機能)を追加し、タブ形式でシーンを管理できるように</li>
                      <li>• エクスポートメニューに「特定のシーンのみCSVを出力」する機能を追加</li>
                      <li>• CSVのインポート時に選択シーンに追加するように変更</li>
                      <li>• プロジェクト全体をJSONでエクスポート/インポートする機能を追加</li>
                      <li>• エクスポートメニューの各種UIを調整</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-foreground mb-2">v0.1.5</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• 新規プロジェクトを作成して次のデータを開くと、前のデータが消える場合がある不具合を修正</li>
                      <li>• 軽微な不具合を修正</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-foreground mb-2">v0.1.4</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• デスクトップアプリ化に伴い各種機能を実装</li>
                      <li>• デスクトップアプリ化に伴いダイアログ系のUIを変更、右上の通知システムを実装</li>
                      <li>• キャラクター設定のエクスポートに背景色を追加、インポート時にも背景色の変更内容が反映されるように改修</li>
                      <li>• アプリケーションのアイコン、タイトルを作成</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-foreground mb-2">v0.1.3</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• キャラクターアイコンの背景色をカラーピッカーで変更できる機能を追加<br />キャラクター管理画面でアイコンにホバーするとペンアイコンが表示されます</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-foreground mb-2">v0.1.2</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• マウス操作によるテキストブロックの複数選択機能を追加。<br />Ctrl+クリック、Shift+クリックでブロックを複数選択できます</li>
                      <li>• CSVエクスポートダイアログをタブ形式に変更（台本/キャラクター設定）キャラクター設定は別デバイスへの引き継ぎ用に使用できます</li>
                      <li>• エクスポート機能に「選択ブロックのみエクスポート」を追加</li>
                      <li>• エクスポート機能に「クリップボードへの出力」を追加</li>
                      <li>• グループごとにエクスポート機能を改善（全選択/部分選択UI）</li>
                      <li>• キャラクター設定のエクスポート/インポートにグループ設定を反映</li>
                      <li>• キャラクター設定のインポート時に重複チェック機能を追加</li>
                      <li>• キャラクター設定のインポート時に新しいグループの自動追加機能を追加</li>
                      <li>• CSVインポート時に台本またはキャラクター設定のインポートかを判定するように変更</li>
                      <li>• 無効なデータのインポート時のエラー処理を追加</li>
                      <li>• localStorageの容量(5MB)を超過した際のエラー処理を改善</li>
                      <li>• ショートカット(Ctrl+M)を追加。CSVエクスポートダイアログを直接開きます</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-foreground mb-2">v0.1.1</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• スクロール位置の補正機能を改善</li>
                      <li>• テキストブロックの挿入時のフォーカス処理を修正</li>
                      <li>• キーボードショートカットの動作を最適化</li>
                      <li>• 設定画面に更新履歴タブを追加</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-foreground mb-2">v0.1.0</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• 初回リリース</li>
                      <li>• 基本的なテキストブロック編集機能</li>
                      <li>• キャラクター管理機能</li>
                      <li>• CSVエクスポート/インポート機能</li>
                      <li>• プロジェクト管理機能</li>
                      <li>• ドラッグ&ドロップによるブロック並び替え</li>
                      <li>• キーボードショートカット対応</li>
                      <li>• ダークモード対応</li>
                      <li>• デスクトップアプリ対応(開発中)</li>
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
                      <span className="font-bold text-foreground">VoiScripter</span>
                    </div>
                    <div className="mb-2 ml-2">
                      <span className="text-foreground">デスクトップアプリ版(最新版もここから確認してください):</span>
                      <div className="ml-2">
                        <a href="https://bluemist.booth.pm/items/7272767" target="_blank" title="デスクトップアプリ版のダウンロード(booth)" className="text-blue-500 hover:underline">https://bluemist.booth.pm/items/7272767</a>
                      </div>
                    </div>
                    <div className="ml-2 mb-2">
                      <span>本アプリの不具合により何らかの損害が発生した場合でも、作者は一切の責任を負いません。自己責任でのご使用をお願いいたします。
                      </span>
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold text-foreground">使用技術</span>
                      <ul className="text-sm text-muted-foreground ml-6 list-disc space-y-1">
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