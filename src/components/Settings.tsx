'use client';

import { useState, useEffect, useRef } from 'react';
import { Cog6ToothIcon, ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import DialogFrame from '@/components/common/DialogFrame';
import DialogHeader from '@/components/common/DialogHeader';
import TabBar from '@/components/common/TabBar';
import Button, { buttonClass } from '@/components/common/Button';
import {
  SHORTCUT_DEFS, ShortcutDef, ShortcutId, ShortcutBinding, ShortcutMap,
  defaultShortcuts, formatBinding, bindingsEqual, findConflictingDef, YIELDING_SHORTCUT_IDS
} from '@/types/shortcuts';
import type { BubbleTheme } from '@/hooks/useSettings';

type SettingsTab = 'settings' | 'shortcuts' | 'help' | 'license' | 'changelog' | 'bugreport' | 'latestdownload';

/** 設定のチェックボックス行（19pxのチェック＋13.5pxのラベル＋説明文） */
function SettingCheckbox({
  id,
  checked,
  onChange,
  label,
  children
}: {
  id: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-[11px] py-2.5">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="ui-checkbox"
      />
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="block text-[13.5px] font-semibold leading-[1.4] text-fg cursor-pointer">
          {label}
        </label>
        {children && <div className="text-[11px] leading-[1.55] text-fg-sub mt-[3px]">{children}</div>}
      </div>
    </div>
  );
}

// ===== キーボードショートカット編集UI =====

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock']);

function ShortcutRow({
  def,
  binding,
  allBindings,
  onUpdate,
  onReset,
}: {
  def: ShortcutDef;
  binding: ShortcutBinding;
  allBindings: ShortcutMap;
  onUpdate: (id: ShortcutId, binding: ShortcutBinding) => void;
  onReset: (id: ShortcutId) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [captured, setCaptured] = useState<ShortcutBinding | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const isDefault = bindingsEqual(binding, def.defaultBinding);

  // 他のショートカットと競合するか検査
  const conflict = captured
    ? SHORTCUT_DEFS.find(d => d.id !== def.id && bindingsEqual(captured, allBindings[d.id]))
    : null;

  // 互換のため後から追加したショートカットは、既存の割り当てと衝突していると発火しない
  const yieldedTo = YIELDING_SHORTCUT_IDS.includes(def.id)
    ? findConflictingDef(def.id, allBindings)
    : undefined;

  const startEditing = () => {
    setIsEditing(true);
    setCaptured(null);
    setTimeout(() => captureRef.current?.focus(), 0);
  };

  const handleCaptureKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') { setIsEditing(false); setCaptured(null); return; }
    if (MODIFIER_KEYS.has(e.key)) return;
    setCaptured({
      ctrl:  e.ctrlKey,
      shift: e.shiftKey,
      alt:   e.altKey,
      key:   e.key.length === 1 ? e.key.toLowerCase() : e.key,
    });
  };

  const handleConfirm = () => {
    if (captured) onUpdate(def.id, captured);
    setIsEditing(false);
    setCaptured(null);
  };

  const handleCancel = () => { setIsEditing(false); setCaptured(null); };

  return (
    <div className="py-2.5 px-3.5 shadow-[0_1px_0_var(--color-hairline)] last:shadow-none">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm text-fg flex-1 min-w-0">{def.label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <kbd className={`px-2.5 py-0.5 bg-field rounded-full text-[11px] min-w-[5.5rem] text-center whitespace-nowrap ${yieldedTo ? 'text-fg-faint line-through' : 'text-fg-sub'}`}>
            {formatBinding(binding)}
          </kbd>
          {!isDefault && (
            <button
              onClick={() => onReset(def.id)}
              className="text-xs text-fg-faint hover:text-fg px-1"
              title="デフォルトに戻す"
            >
              ↩
            </button>
          )}
          <button
            onClick={startEditing}
            className={buttonClass('secondary', 'sm')}
          >
            変更
          </button>
        </div>
      </div>
      {yieldedTo && (
        <p className="text-[11px] text-destructive mt-1">
          ⚠ 競合済み（無効）— 「{yieldedTo.label}」と同じキーです。別のキーに変更すると有効になります
        </p>
      )}
      {isEditing && (
        <div className="mt-2 p-2.5 bg-well rounded-xl space-y-2">
          <div
            ref={captureRef}
            tabIndex={0}
            className="ui-input text-center cursor-text select-none"
            onKeyDown={handleCaptureKeyDown}
          >
            {captured
              ? <span className="font-medium">{formatBinding(captured)}</span>
              : <span className="text-fg-sub text-xs">変更するキー操作を押してください（Escでキャンセル）</span>
            }
          </div>
          {conflict && (
            <p className="text-[11px] text-destructive">⚠ 「{conflict.label}」と競合しています</p>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={handleCancel} className={buttonClass('secondary', 'sm')}>キャンセル</button>
            <button
              onClick={handleConfirm}
              disabled={!captured}
              className={buttonClass('primary', 'sm')}
            >
              確定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShortcutEditor({
  shortcuts,
  onUpdateShortcut,
  onResetShortcuts,
}: {
  shortcuts: ShortcutMap;
  onUpdateShortcut: (id: ShortcutId, binding: ShortcutBinding) => void;
  onResetShortcuts: () => void;
}) {
  const globalDefs  = SHORTCUT_DEFS.filter(d => d.group === 'global');
  const editorDefs  = SHORTCUT_DEFS.filter(d => d.group === 'editor');

  const handleReset = (id: ShortcutId) => {
    const def = SHORTCUT_DEFS.find(d => d.id === id);
    if (def) onUpdateShortcut(id, { ...def.defaultBinding });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[14.5px] font-bold text-fg">キーボードショートカット</h4>
        <button
          onClick={onResetShortcuts}
          className={buttonClass('secondary', 'sm')}
        >
          すべてデフォルトに戻す
        </button>
      </div>

      <div>
        <p className="ui-section-label mb-2">グローバル（常時有効）</p>
        <div className="rounded-2xl bg-well">
          {globalDefs.map(def => (
            <ShortcutRow
              key={def.id}
              def={def}
              binding={shortcuts[def.id]}
              allBindings={shortcuts}
              onUpdate={onUpdateShortcut}
              onReset={handleReset}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="ui-section-label mb-2">エディター（テキスト入力中に有効）</p>
        <div className="rounded-2xl bg-well">
          {editorDefs.map(def => (
            <ShortcutRow
              key={def.id}
              def={def}
              binding={shortcuts[def.id]}
              allBindings={shortcuts}
              onUpdate={onUpdateShortcut}
              onReset={handleReset}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  saveDirectory: string;
  onSaveDirectoryChange: (directory: string) => void;
  enterOnlyBlockAdd?: boolean;
  onEnterOnlyBlockAddChange?: (enabled: boolean) => void;
  addBlockSpeakerPicker?: boolean;
  onAddBlockSpeakerPickerChange?: (enabled: boolean) => void;
  reverseToolbarOrder?: boolean;
  onReverseToolbarOrderChange?: (enabled: boolean) => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  simpleMode?: boolean;
  onSimpleModeChange?: (enabled: boolean) => void;
  bubbleTheme?: BubbleTheme;
  onBubbleThemeChange?: (theme: BubbleTheme) => void;
  stagePanelEnabled?: boolean;
  onStagePanelEnabledChange?: (enabled: boolean) => void;
  stagePanelSide?: 'left' | 'right';
  onStagePanelSideChange?: (side: 'left' | 'right') => void;
  showLatestDownloadMenu?: boolean;
  onOpenLatestDownload?: () => void;
  shortcuts?: ShortcutMap;
  onUpdateShortcut?: (id: ShortcutId, binding: ShortcutBinding) => void;
  onResetShortcuts?: () => void;
}

export default function Settings({
  isOpen,
  onClose,
  saveDirectory,
  onSaveDirectoryChange,
  enterOnlyBlockAdd = false,
  onEnterOnlyBlockAddChange,
  addBlockSpeakerPicker = false,
  onAddBlockSpeakerPickerChange,
  reverseToolbarOrder = false,
  onReverseToolbarOrderChange,
  fontSize = 16,
  onFontSizeChange,
  simpleMode = false,
  onSimpleModeChange,
  bubbleTheme = 'pop',
  onBubbleThemeChange,
  stagePanelEnabled = false,
  onStagePanelEnabledChange,
  stagePanelSide = 'right',
  onStagePanelSideChange,
  showLatestDownloadMenu = false,
  onOpenLatestDownload,
  shortcuts = defaultShortcuts,
  onUpdateShortcut,
  onResetShortcuts,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('settings');
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
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
      alert('この機能はデスクトップアプリ版でのみ利用できます');
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

  const handleResetApp = async () => {
    try {
      // localStorageのデータを削除
      if (typeof window !== 'undefined') {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('voiscripter_')) {
            localStorage.removeItem(key);
          }
        });
      }

      // Electronアプリの場合、ファイルシステムのデータも削除
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          // 保存ディレクトリが設定されている場合、そのディレクトリ内のVoiScripterデータを削除
          if (saveDirectory) {
            const keys = await window.electronAPI.listDataKeys();
            const voiscripterKeys = keys.filter(key => key.startsWith('voiscripter_'));
            for (const key of voiscripterKeys) {
              await window.electronAPI.deleteData(key);
            }
          }
        } catch (error) {
          console.error('ファイルシステムデータの削除エラー:', error);
        }
      }

      // アプリを再読み込み
      if (typeof window !== 'undefined') {
        // ブラウザ版・Electron版共通でページを再読み込み
        window.location.reload();
      }
    } catch (error) {
      console.error('アプリ初期化エラー:', error);
      alert('初期化中にエラーが発生しました。手動でページを再読み込みしてください。');
    }
  };

  if (!isOpen) return null;

  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={onClose}
      panelClassName="w-full max-w-2xl mx-2 sm:mx-4 h-[90vh] sm:h-[750px] overflow-hidden flex flex-col"
    >
        <DialogHeader icon={Cog6ToothIcon} title="設定" onClose={onClose} className="shrink-0" />
        {/* タブはシーンタブと同じ形状（上角丸＋上辺3pxのアクセント罫） */}
        <TabBar<SettingsTab>
          items={[
            { id: 'settings', label: '設定' },
            { id: 'shortcuts', label: 'ショートカット' },
            { id: 'help', label: 'ヘルプ' },
            { id: 'changelog', label: '更新履歴' },
            { id: 'bugreport', label: 'バグ報告' },
            { id: 'license', label: 'ライセンス' },
            ...(showLatestDownloadMenu ? [{ id: 'latestdownload' as const, label: '最新版のDL' }] : [])
          ]}
          activeId={activeTab}
          onChange={setActiveTab}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* メインコンテンツ */}
          <div className="flex-1 px-5 pt-5 pb-6 overflow-y-auto">
            {activeTab === 'settings' && (
              <div className="flex flex-col gap-[22px]">
                {/* データの保存先セクション */}
                <section>
                  <h3 className="text-[14.5px] font-bold text-fg mb-[11px]">データの保存先</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className="ui-input flex-1 min-w-48 truncate text-[13px]"
                      title={saveDirectory || 'ブラウザ内データベース'}
                    >
                      {saveDirectory || 'ブラウザ内データベース'}
                    </div>
                    <button
                      onClick={handleDirectorySelect}
                      disabled={isSelectingDirectory}
                      className={buttonClass('secondary')}
                      title="保存先のディレクトリを選択"
                    >
                      {isSelectingDirectory ? '選択中...' : '変更'}
                    </button>
                    {saveDirectory && (
                      // データの保存先が巻き戻る操作なので、弱い destructive で注意を促す
                      <Button variant="destructive-weak" onClick={handleClearDirectory}>
                        ブラウザ内データベースに戻す
                      </Button>
                    )}
                  </div>
                  <div className="text-[11px] leading-[1.7] text-fg-sub mt-[9px]">
                    <p>• ディレクトリを選択すると、データがファイルとして保存されます</p>
                    <p>• 保存先を変更すると、既存のデータが自動的に移動されます</p>
                    <p>• 未設定の場合はブラウザ内データベース（IndexedDB）に保存されます</p>
                    <p>• ブラウザ内データベースは大容量のデータを効率的に保存できます</p>
                  </div>
                </section>

                <div className="h-px bg-hairline" />

                {/* 動作モード */}
                <section>
                  <h3 className="text-[14.5px] font-bold text-fg mb-[11px]">動作モードの切り替え</h3>
                  <div className="flex flex-col">
                    <SettingCheckbox
                      id="enterOnlyBlockAdd"
                      checked={enterOnlyBlockAdd}
                      onChange={onEnterOnlyBlockAddChange}
                      label="Enterキーのみでブロックを追加"
                    >
                      <p>• チェックをONにすると、セリフ入力エリアでEnterキーを押すだけでテキストブロックが追加されるようになります</p>
                      <p>• 改行の入力はShift+Enterに変更されます</p>
                    </SettingCheckbox>
                    <div className="h-px bg-hairline" />
                    <SettingCheckbox
                      id="addBlockSpeakerPicker"
                      checked={addBlockSpeakerPicker}
                      onChange={onAddBlockSpeakerPickerChange}
                      label="ブロック追加時に話者選択を表示"
                    >
                      <p>• チェックをONにすると、セリフブロックを追加する前に話者を選ぶ画面が表示されます</p>
                      <p>• 話者選択は矢印キーでの移動と、数字キーでの直接選択に対応しています（1〜9がキャラクター、0がト書き）</p>
                    </SettingCheckbox>
                    <div className="h-px bg-hairline" />
                    <SettingCheckbox
                      id="reverseToolbarOrder"
                      checked={reverseToolbarOrder}
                      onChange={onReverseToolbarOrderChange}
                      label="左利き向け（1段ツールバーの並びを反転）"
                    >
                      <p>• チェックをONにすると、1段ツールバー内のボタン順序を左右反転します</p>
                    </SettingCheckbox>
                  </div>
                </section>

                <div className="h-px bg-hairline" />

                {/* 表示 */}
                <section>
                  <h3 className="text-[14.5px] font-bold text-fg mb-[11px]">表示の切り替え</h3>
                  <div className="rounded-[18px] bg-well px-[15px] py-3.5">
                    <div className="text-[12.5px] font-bold text-fg mb-3">フォント</div>
                    <div className="mb-3.5">
                      <label htmlFor="fontFamily" className="block ui-section-label mb-[9px]">表示フォント</label>
                      <select
                        id="fontFamily"
                        className="ui-input w-full"
                        value={fontFamily}
                        onChange={e => setFontFamily(e.target.value)}
                      >
                        <option value="mplus">M PLUS 1p（デフォルト）</option>
                        <option value="noto">Noto Sans JP</option>
                        <option value="sawarabi">Sawarabi Gothic</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="fontSize" className="block ui-section-label mb-[9px]">フォントサイズ</label>
                      <select
                        id="fontSize"
                        className="ui-input w-full"
                        value={fontSize}
                        onChange={e => onFontSizeChange?.(parseInt(e.target.value, 10))}
                      >
                        <option value={12}>12px</option>
                        <option value={14}>14px</option>
                        <option value={16}>16px（デフォルト）</option>
                        <option value={18}>18px</option>
                        <option value={20}>20px</option>
                        <option value={22}>22px</option>
                      </select>
                    </div>
                    <div className="flex flex-col mt-1">
                      <SettingCheckbox
                        id="simpleMode"
                        checked={simpleMode}
                        onChange={onSimpleModeChange}
                        label="シンプルモード"
                      >
                        <p>• ブロック内の操作ボタンを非表示にし、行間を縮小したアウトライナー風の表示になります</p>
                        <p>• 各種操作はショートカットキーまたは下部ツールバーから行えます</p>
                      </SettingCheckbox>
                      <div className="h-px bg-hairline" />
                      <div className="py-3">
                        <label htmlFor="bubbleTheme" className="block ui-section-label mb-[9px]">フキダシのデザイン</label>
                        <select
                          id="bubbleTheme"
                          value={bubbleTheme}
                          onChange={(e) => onBubbleThemeChange?.(e.target.value as BubbleTheme)}
                          disabled={simpleMode}
                          className="ui-input w-full"
                        >
                          <option value="pop">ポップ（キャラカラーの縁取り）</option>
                          <option value="cinema">シネマ（字幕・脚本風）</option>
                          <option value="chat">チャット（左右振り分け）</option>
                        </select>
                        <div className="text-[11px] leading-[1.55] text-fg-sub mt-2">
                          <p>• セリフブロックの見た目を切り替えます{simpleMode ? '（シンプルモード中は変更できません）' : ''}</p>
                          <p>• チャットはキャラクター編集の「チャットビュー: 左/右」で振り分けを変更できます</p>
                        </div>
                      </div>
                      <div className="h-px bg-hairline" />
                      <SettingCheckbox
                        id="stagePanelEnabled"
                        checked={stagePanelEnabled}
                        onChange={onStagePanelEnabledChange}
                        label="立ち絵ステージを表示"
                      >
                        <p>• 編集中のブロックの話者の立ち絵をエディタ横に大きく表示します（表情差分と連動）</p>
                        <p>• 立ち絵はキャラクター設定 &gt; 編集 &gt; 表情差分設定から登録できます</p>
                      </SettingCheckbox>
                      {/* 立ち絵ステージをONにしたときだけ、表示サイドをインデントして出す */}
                      {stagePanelEnabled && (
                        <div className="pl-[30px] pt-0.5 pb-3">
                          <label htmlFor="stagePanelSide" className="block ui-section-label mb-2">表示サイド</label>
                          <select
                            id="stagePanelSide"
                            value={stagePanelSide}
                            onChange={(e) => onStagePanelSideChange?.(e.target.value as 'left' | 'right')}
                            className="ui-input w-full"
                          >
                            <option value="right">右側</option>
                            <option value="left">左側</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <div className="h-px bg-hairline" />

                {/* アプリ初期化セクション */}
                <section>
                  <h3 className="text-[14.5px] font-bold text-fg mb-[11px]">アプリ初期化</h3>
                  <p className="text-[11px] leading-[1.7] text-fg-sub mb-3">
                    注意: この操作は元に戻せません。プロジェクト、キャラクター設定、アプリの設定など、すべてのデータが削除され、初回起動時の状態に戻ります。
                  </p>
                  <Button variant="destructive-weak" onClick={() => setShowResetDialog(true)}>
                    アプリを初期化する
                  </Button>
                </section>
              </div>
            )}

            {activeTab === 'help' && (
              <div className="flex flex-col">
                <h4 className="text-[14.5px] font-bold text-fg mb-2">VoiScripter ヘルプ</h4>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">基本的な使い方</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
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
                    <div className="mt-3 ml-4">
                      <a href="https://scrapbox.io/VoiScripter/" target="_blank" rel="noopener noreferrer" className="text-primary-text hover:underline text-sm">
                        詳しい使い方
                      </a>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">プロジェクト管理</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• 複数のプロジェクトを作成・管理できます。</li>
                      <li>• プロジェクトは自動的に保存されます。</li>
                      <li>• 設定でデータの保存先を変更できます。</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="flex flex-col">
                {onUpdateShortcut && onResetShortcuts ? (
                  <ShortcutEditor
                    shortcuts={shortcuts}
                    onUpdateShortcut={onUpdateShortcut}
                    onResetShortcuts={onResetShortcuts}
                  />
                ) : (
                  <>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">キーボードショートカット</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      {SHORTCUT_DEFS.map(def => (
                        <li key={def.id}>• <kbd className="px-2 py-0.5 bg-field rounded-full text-[11px]">{formatBinding(shortcuts[def.id])}</kbd> {def.label}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {activeTab === 'changelog' && (
              <div className="flex flex-col">
                <h4 className="text-[14.5px] font-bold text-fg mb-4">更新履歴</h4>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.3.4</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>
                        • 不具合の修正
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• シーンを切り替えた際に、改行を含むセリフ・ト書きの高さが切り替え前のままとなり、本文が見切れる問題を修正</li>
                          <li>• ト書きで終わるシーンから新しいシーンを追加すると、ブロックが作られず古い説明文が表示される問題を修正（直前のシーンの最後がト書きの場合はト書きブロックを作成します）</li>
                          <li>• 設定のバグ報告フォームのリンクが、外部から開けないURLになっていた問題を修正</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.3.3</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>
                        • ブロック追加時の話者選択を追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• 設定の「ブロック追加時に話者選択を表示」をONにすると、セリフブロックの追加前に話者を選ぶ画面が表示されます</li>
                          <li>• 矢印キーでの移動と、数字キーでの直接選択に対応しています（1〜9がキャラクター、0がト書き）</li>
                        </ul>
                      </li>
                      <li>
                        • ト書きブロックの追加ショートカットを追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• 従来の Ctrl+Alt+B に加えて Ctrl+Shift+Enter でもト書きブロックを追加できます</li>
                        </ul>
                      </li>
                      <li>
                        • キャラクター管理にグループタブを追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• 「全て」とグループ設定に応じたタブでキャラクター一覧を絞り込めます</li>
                        </ul>
                      </li>
                      <li>
                        • 設定画面を整理
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• 詳細設定を「動作モード」「表示」に分類し、独立していたフォント設定を 表示 &gt; フォント にまとめました</li>
                          <li>• キーボードショートカットをヘルプから独立させ、設定メニューの下に「ショートカット」項目を追加しました</li>
                        </ul>
                      </li>
                      <li>
                        • 不具合の修正
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• 「クリップボードにセリフをコピーする」の選択時に「グループごとにエクスポート」を利用できなかった問題を修正</li>
                          <li>• バグ報告フォームのリンクをアプリ共通フォームのものに更新</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.3.2</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>
                        • クレジット出力機能を追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• 台本で使用中のキャラクターから、動画概要欄用のクレジットを自動生成できます（エクスポート &gt; クレジット）</li>
                          <li>• 音声クレジットはグループ設定の「クレジット表記」、立ち絵クレジットはキャラクターの「素材クレジット」（制作者・素材ID・URL）を参照します</li>
                        </ul>
                      </li>
                      <li>
                        • 表情差分機能を追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• キャラクターにユーザープリセット単位の表情差分アイコンを登録し、ブロックごとに切り替えられます（アイコンと連動プリセットが同時に切り替わります）</li>
                          <li>• 画像選択時にドラッグ・ズームで切り抜けるアイコン切り抜きツールを内蔵</li>
                        </ul>
                      </li>
                      <li>
                        • 立ち絵ステージを追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• 編集中のブロックの話者の立ち絵をエディタ横に大きく表示します（表情差分と連動、設定でON）</li>
                          <li>• 立ち絵はキャラクターの表情差分設定から登録し、ズーム・位置の表示調整が可能です</li>
                        </ul>
                      </li>
                      <li>
                        • フキダシテーマを追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• セリフブロックの見た目をクラシック / ポップ / シネマ / チャットから選べます（設定 &gt; フキダシのデザイン）</li>
                          <li>• チャットはキャラクター編集の「チャットビュー」設定で左右の振り分けを変更できます</li>
                        </ul>
                      </li>
                      <li>
                        • ビュー機能を追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• チャット風の閲覧・推敲ビューと、キャラクター単位の台詞通し確認ビューをタブで切り替えて利用できます</li>
                          <li>• フキダシや台詞をクリックすると、エディタの該当ブロックへ移動します</li>
                        </ul>
                      </li>
                      <li>
                        • UI・操作性の改善
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• キャラクターにパーソナルカラーを設定できるように（フキダシテーマ・チャット・アイコン背景に反映）</li>
                          <li>• キャラクター管理に「現在の台本で使用する」の一括チェック/解除ボタンを追加</li>
                          <li>• エクスポートを 台本 / バックアップ / クレジット のタブに再編（バックアップはプロジェクト・キャラクターをトグルで切り替え）</li>
                          <li>• ヘッダーの新規作成アイコン横に台本全体の文字数を表示</li>
                          <li>• キャラクター編集で保存前に別キャラの編集やダイアログを閉じようとした場合に確認を表示</li>
                          <li>• ダイアログ表示中は背面のスクロールを停止（検索ウィンドウを除く）</li>
                          <li>• キャラクター設定CSVに素材クレジット・表情差分の列を追加</li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.3.1</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• データ同期機能のセキュリティ強化(2回目)
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• データ同期にProof-of-Work保護を導入し、ツールによる書き込み濫用への恒久対策を実施</li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.3.0</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>
                        • フォントサイズ設定を追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• エディターのフォントサイズを12〜22pxの範囲で変更可能</li>
                          <li>• 設定は保存され次回起動時に復元されます</li>
                        </ul>
                      </li>
                      <li>
                        • シンプルモードを追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• 操作ボタンを非表示にし、行間を縮小したアウトライナー風の表示モード</li>
                          <li>• 操作はショートカットキーとフローティングツールバーで行えます</li>
                        </ul>
                      </li>
                      <li>
                        • 複数ブロック選択操作の拡張
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• 複数ブロックの一括削除・一括上下移動・一括複製に対応</li>
                          <li>• 複数ブロックのドラッグ移動に対応（選択ブロックがまとめて移動します）</li>
                          <li>• ドラッグ中に全選択ブロックのプレビューを表示</li>
                        </ul>
                      </li>
                      <li>
                        • クロスシーンブロック移動を追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• ブロックをドラッグしてシーンタブ上に500msホバーすると、対象シーンへブロックを移動</li>
                          <li>• 複数選択状態のまま別シーンへ移動可能</li>
                        </ul>
                      </li>
                      <li>• Ctrl+D でブロック複製のショートカットを追加</li>
                      <li>• アップデート通知が機能してなかったのを修正(きっと次回から…)</li>
                      <li>• 最後に選択された話者のテキストブロックが作成されない不具合を修正</li>
                      <li>• シーン作成時にテキストブロックを作成するように仕様を変更</li>
                      <li>
                        • ストーリーパネルの改善
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• セパレートラインの検出位置を画面上端から画面の1/4の位置に変更</li>
                          <li>• 前/次の画像クリックで該当セグメントへジャンプする機能を追加</li>
                        </ul>
                      </li>
                      <li>
                        • プロジェクトエクスプローラーを追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• プロジェクト名をクリックするとエクスプローラーが表示され、台本が開けます。</li>
                          <li>• エクスプローラー内ではプロジェクト名の右端から削除や名称の変更が行えます。(ヘッダー領域から移動)</li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.2.9</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• データ同期機能のセキュリティ強化
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• 同一IPからの過剰なアクセスを制限するレートリミットを追加</li>
                          <li>• アプリバージョンの整合性チェックを追加（同期機能はアプリ版も最新版でないと同期が不可になりました）</li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.2.8</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>
                        • 感情プリセット機能を追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• セリフごとにキャラクターの感情プリセットを設定可能</li>
                          <li>• A.I.VOICEなど向けに「感情プリセット＞」付きでのテキスト出力を可能に</li>
                          <li>• CeVIO AIなど向けに感情プリセットを第3列に出力するオプションを追加</li>
                        </ul>
                      </li>
                      <li>• ショートカットキーの変更機能を追加（設定 &gt; ヘルプ &gt; キーボードショートカット）</li>
                      <li>• キャラクター管理内の文字入力中にフォーカスが外れて連続入力できなくなる不具合を修正</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.2.7</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• ストーリーパネルの画像保存がLocalStrageになっていたため現在の保存先（IndexedDB/任意ディレクトリ）に追従するよう変更し、旧localStorageにあるデータの自動移行処理を追加</li>
                      <li>• ダイアログを画面外のクリック・タップで閉じられるように操作性を改善</li>
                      <li>• ダイアログ表示のOK扱いのボタンをEnter、キャンセル扱いのボタンをEscキーでも閉じられるように操作性を改善</li>
                      <li>• 横幅が狭い画面の時に検索ダイアログの表示位置と幅を修正してレスポンシブ対応</li>
                      <li>• モバイル/タブレット環境の文字入力エリアにツールバーに隠れにくくなるよう自動スクロール補正を調整</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.2.6</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                    <li>• テキスト入力中にIME確定EnterやSpaceで並び替えモードへ誤遷移する不具合を修正</li>
                    <li>• 追加したテキストブロックがツールバーに被る事態が多いため自動スクロール補正位置を調整</li>
                    <li>• ツールバー複製で選択ブロックが一番下のものが選択される不具合を修正</li>
                    <li>• ツールバーの直追ボタンで追加されるブロックが「最後に追加した話者」ロジックから外れている不具合を修正</li>
                    <li>
                      • アップデート通知を追加(アプリ版のみ)
                      <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                        <li>• 最新版へのダウンロード導線を追加（Booth / GitHub Release）</li>
                        <li>• アップデート通知のスキップ設定と、再表示用の「最新版のDL」メニューを追加</li>
                      </ul>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.2.5</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>
                          • ストーリーパネル機能を追加
                          <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                            <li>• 任意の画像と見出しを追加し、視覚的にストーリーを管理できます(ある程度の横幅がないと有効になりません)</li>
                            <li>• テキストブロック間をホバーすると表示される「セパレートラインを追加」をクリックすると見出しを追加できます</li>
                            <li>• サイドバーのストーリーパネルには、一つの見出しに対して一枚の画像を設定できます</li>
                            <li>• 台本エリアをスクロールしていくと、ストーリーパネルが切り替わっていきます</li>
                            <li>• ストーリーパネルの表示時のみ、見出しも表示されます</li>
                          </ul>
                      </li>
                    </ul>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4 pt-2">
                      <li>
                        • データ同期機能を追加
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• 別の VoiScripter へ現在の台本を同期して、作業を引き継ぐことができます</li>
                          <li>• 同期対象は「プロジェクト本体の台本データ」です（ストーリーパネル画像は同期されません）</li>
                          <li>• 詳細はデータ同期ダイアログの「使い方」をご覧ください</li>
                        </ul>
                      </li>
                    </ul>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4 pt-2">
                      <li>
                        • モバイル環境を想定したUIの改修
                        <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                          <li>• 元に戻す/やり直し/移動/追加/削除などの主要操作を集約したツールバーを追加</li>
                          <li>• 話者選択UIをモバイル向けに改修。話者アイコンをタップするとキャラピッカーが表示</li>
                          <li>• ブロック並び替えアイコンを廃止し、テキストブロックの本体ドラッグへ統一</li>
                          <li>• 設定の詳細設定に左利きユーザー向けのツールバーの並び反転オプションを追加</li>
                          <li>• 台本の入力エリアのUIを調整し、shadowを使用した柔らかい区切りに</li>
                          <li>• シーン追加ボタンをアクセントカラー→背景色なしに変更して目立たなくした</li>
                        </ul>
                      </li>
                    </ul>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4 pt-2">
                      <li>• シンプルモード時のフォントサイズに応じたテキストブロック高さの自動調整</li>
                      <li>• シンプルモード時のテキスト入力エリアのフォーカス枠を非表示に変更</li>
                      <li>• シンプルモード時にプリセット選択中のプリセット名をテキスト表示</li>
                      <li>• 新規シーン追加時に直前の話者のテキストブロックを自動作成するように変更</li>
                      <li>• ストーリーパネル開閉ボタンがダイアログより手前に表示される不具合を修正</li>
                      <li>• Electronアプリのアップデートチェックがブロックされる不具合を修正</li>
                      <li>• その他、細かいUI調整、不具合修正</li>
                   </ul>
                  </div>

                <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.2.4</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• 検索機能を追加。Ctrl+Fで検索ダイアログを開きます</li>
                      <li>• 上下キーによるブロックの連続移動時に、画面外のブロックが選択された場合、スクロールがガタつく不具合を修正。また、連続キー入力時の入力間隔を抑制しています</li>
                      <li>• 起動時に読み込み中画面を追加</li>
                      <li>• Electron版で初期値がIndexedDBに正しく保存・読み出しされるように修正</li>
                      <li>• Next.js 16、React 19、Electron 39へアップデート、依存関係の更新</li>
                    </ul>
                  </div>
                  
                <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.2.3</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• ブラウザ版で再読み込み時にIndexedDBからデータが正しく読み込まれない不具合を暫定修正</li>
                    </ul>
                  </div>
                  
                <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.2.2</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• 台本データの保存先をlocalstrageからブラウザ内データベース(IndexedDB)に変更。ブラウザ版でも容量制限がなくなりました。</li>
                      <li>• シーン機能を使用するとエクスポートしたファイルが必ずシーンごとに分割されて出力される不具合を修正(シーンごとに分割する場合は「特定のシーンのみCSVを出力」をお使いください)</li>
                      <li>• Ctrl+Alt+Bのト書きブロックの追加、Ctrl+B/新規ブロックを追加ボタンでのブロック追加時、追加したテキストブロックが選択されない不具合を修正</li>
                      <li>• ト書きの入力時にブロックの輪郭線とセリフの輪郭線が同時に表示されていた不具合を修正</li>
                    </ul>
                  </div>
                  
                <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.2.1</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• 段階的にレスポンシブ対応を実施</li>
                      <li>• [レスポンシブ対応]ウィンドウサイズでメニュー折りたたみ、UI構成の調整</li>
                      <li>• 最下部のブロック編集がしづらいため画面下部に余白領域を設定</li>
                      <li>• Alt+↑/↓によるキャラクター選択がプロジェクトの有効無効を考慮するように修正</li>
                      <li>• その他軽微な不具合修正</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.2.0</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• 内部コードのリファクタリングを実施</li>
                      <li>• ヘッダーUIの一部アイコン化、細部調整を実施</li>
                      <li>• 設定画面にEnter入力のみでブロックを追加する詳細設定オプションを追加</li>
                      <li>• シーンタブの入れ替え機能を追加</li>
                      <li>• プロジェクトごとにキャラクターの有効無効を切り替えられる機能を追加</li>
                      <li>• キャラクター設定のエクスポートにプロジェクトごとの無効化設定を追加</li>
                      <li>• スタート画面を追加。初回起動時に表示されます。新規プロジェクトの作成やキャラクター設定をここから行えます</li>
                      <li>• 設定からアプリ初期化機能を追加。バックアップの上で動作が不安定になった場合にご利用ください</li>
                      <li>• ヘルプメニューにCosenseの<a href="https://scrapbox.io/VoiScripter/" target="_blank" rel="noopener noreferrer" className="text-primary-text hover:underline text-sm">
                        詳しい使い方
                      </a>を追加</li>
                      <li>• 設定に「バグ報告フォーム」を追加。不具合があればご報告いただければ幸いです</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.1.9</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• エクスポート時のダイアログ、キャラクター設定のダイアログをウィンドウの表示領域が足りない場合にスクロールできるように改修</li>
                      <li>• エクスポート時、特定の組み合わせかつエクスポートの切り替えが行われた際、一部エクスポートオプションのチェックボックスが不正の組み合わせになってしまう不具合を修正</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.1.8</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• デスクトップ版で最後に開いていたウィンドウのサイズと表示位置を記憶する機能を追加(ウィンドウ操作がちょっと重たくなります)</li>
                      <li>• 最後に開いていたプロジェクトが開かれなかった不具合を修正</li>
                      <li>• CSV形式とテキスト形式のエクスポートが選択できる機能を追加</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.1.7</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                    <li>• v0.1.6の機能をデスクトップアプリ版でも利用できるように改修</li>
                    <li>• プロジェクトのJSONエクスポート・インポート機能を改修しキャラクター設定のエクスポートと併用して別環境でも引き継げるように</li>
                    <li>• キャラクター設定のCSVエクスポートで別環境でも同じ設定を引き継げるように改修</li>
                    <li>• ライセンス情報にデスクトップアプリ版のダウンロード先を追加</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.1.6</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• プロジェクト内サブプロジェクト作成機能(シーン機能)を追加し、タブ形式でシーンを管理できるように</li>
                      <li>• エクスポートメニューに「特定のシーンのみCSVを出力」する機能を追加</li>
                      <li>• CSVのインポート時に選択シーンに追加するように変更</li>
                      <li>• プロジェクト全体をJSONでエクスポート/インポートする機能を追加</li>
                      <li>• エクスポートメニューの各種UIを調整</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.1.5</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• 新規プロジェクトを作成して次のデータを開くと、前のデータが消える場合がある不具合を修正</li>
                      <li>• 軽微な不具合を修正</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.1.4</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• デスクトップアプリ化に伴い各種機能を実装</li>
                      <li>• デスクトップアプリ化に伴いダイアログ系のUIを変更、右上の通知システムを実装</li>
                      <li>• キャラクター設定のエクスポートに背景色を追加、インポート時にも背景色の変更内容が反映されるように改修</li>
                      <li>• アプリケーションのアイコン、タイトルを作成</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.1.3</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• キャラクターアイコンの背景色をカラーピッカーで変更できる機能を追加<br />キャラクター管理画面でアイコンにホバーするとペンアイコンが表示されます</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.1.2</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
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
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.1.1</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                      <li>• スクロール位置の補正機能を改善</li>
                      <li>• テキストブロックの挿入時のフォーカス処理を修正</li>
                      <li>• キーボードショートカットの動作を最適化</li>
                      <li>• 設定画面に更新履歴タブを追加</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-[14.5px] font-bold text-fg mb-2">v0.1.0</h4>
                    <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
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

            {activeTab === 'bugreport' && (
              <div className="flex flex-col">
                <h4 className="text-[14.5px] font-bold text-fg mb-4">バグ報告</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-fg-sub mb-4">
                      不具合の内容を以下のフォームから記載して送信してください。<br />
                      不具合の内容は確認でき次第修正いたしますが、すぐに修正されるわけではありません。
                    </p>
                    <p className="text-sm text-fg-sub mb-4">
                      可能な限り「何をしたら発生するか」「必ず発生するか」「ブラウザ版かデスクトップ版か」「表示されたエラー情報」など情報を頂けると助かります。
                    </p>
                    <p className="text-sm text-fg-sub mb-4">
                      ご報告いただいた後に個別に連絡を差し上げることは難しいためご了承ください。
                    </p>
                    <div className="mt-4">
                      <a 
                        href="https://ionian-gallimimus-e47.notion.site/32b8c5bf8aa481978f37e470a25e1e01"
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={buttonClass('primary')}
                      >
                        <QuestionMarkCircleIcon className="size-[18px]" />
                        バグ報告フォーム
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'license' && (
                <div className="mt-6">
                  <h4 className="text-[14.5px] font-bold text-fg mb-2">このアプリについて</h4>
                  <div className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                    <div className="mb-2">
                      <span className="font-bold text-fg">VoiScripter</span>
                    </div>
                    <div className="mb-2 ml-2">
                      <span className="text-fg">デスクトップアプリ版(最新版もここから確認してください):</span>
                      <div className="ml-2">
                        <a href="https://bluemist.booth.pm/items/7272767" target="_blank" title="デスクトップアプリ版のダウンロード(booth)" className="text-primary-text hover:underline">https://bluemist.booth.pm/items/7272767</a>
                      </div>
                    </div>
                    <div className="ml-2 mb-2">
                      <span>本アプリの不具合により何らかの損害が発生した場合でも、作者は一切の責任を負いません。自己責任でのご使用をお願いいたします。
                      </span>
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold text-fg">使用技術</span>
                      <ul className="text-sm text-fg-sub ml-6 list-disc space-y-1">
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
                      <span className="font-semibold text-fg">ライセンス:</span>
                      <div className="ml-2">
                        <span>本アプリはMITライセンスで配布されています。上記ライブラリはそれぞれMITまたはApache-2.0ライセンスに基づき配布されています。</span>
                      </div>
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold text-fg">Copyright:</span>
                      <div className="ml-2">
                        <span>© 2025-2026 VoiScripter Authors</span>
                      </div>
                    </div>
                    <div className="mb-2">
                      <span className="font-semibold text-fg">MIT License（本文）:</span>
                      <pre className="ml-2 mt-1 p-3 rounded-xl bg-well text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-fg-sub">{`MIT License

Copyright (c) 2025-2026 VoiScripter Authors (Bluemist)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`}</pre>
                    </div>
                  </div>
                </div>
              )}
            {activeTab === 'latestdownload' && showLatestDownloadMenu && (
              <div className="space-y-4">
                <h4 className="text-[14.5px] font-bold text-fg mb-2">最新版のダウンロード</h4>
                <p className="text-sm text-fg-sub">
                  通知をスキップ中のため、ここから最新バージョンの案内を再表示できます。
                </p>
                <button
                  onClick={() => onOpenLatestDownload?.()}
                  className={buttonClass('primary')}
                >
                  アップデート案内を開く
                </button>
              </div>
            )}
          </div>
        </div>

      {/* 初期化確認ダイアログ */}
      {showResetDialog && (
        <DialogFrame
          isOpen={showResetDialog}
          onCancel={() => setShowResetDialog(false)}
          panelClassName="w-full max-w-md mx-4"
          overlayClassName="z-60 bg-black/60"
        >
            <DialogHeader icon={ExclamationTriangleIcon} title="アプリを初期化しますか？" onClose={() => setShowResetDialog(false)} />
            <div className="px-5 pb-5">
              <div className="space-y-4">
                <div className="px-4 py-3.5 bg-destructive-tint shadow-[inset_0_0_0_1.5px_var(--color-destructive-ring)] rounded-2xl">
                  <p className="text-[13px] text-destructive font-bold mb-2">
                    削除されるデータ:
                  </p>
                  <ul className="text-[13px] leading-relaxed text-fg-sub space-y-1 ml-4">
                    <li>• すべてのプロジェクト</li>
                    <li>• キャラクター設定</li>
                    <li>• アプリの設定</li>
                    <li>• その他の保存データ</li>
                  </ul>
                </div>
                <p className="text-[13px] text-fg-sub">
                  この操作は元に戻せません。本当に初期化を実行しますか？
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setShowResetDialog(false)}
                  className={buttonClass('secondary')}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleResetApp}
                  className={buttonClass('destructive')}
                >
                  初期化を実行
                </button>
              </div>
            </div>
        </DialogFrame>
      )}
    </DialogFrame>
  );
} 