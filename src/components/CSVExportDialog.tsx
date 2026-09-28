'use client';

import { useState, useEffect, useMemo, ReactNode } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { Character, Scene, GroupCredits } from '@/types';
import DialogFrame from '@/components/common/DialogFrame';
import { DialogCloseButton } from '@/components/common/DialogHeader';
import TabBar from '@/components/common/TabBar';
import { buttonClass } from '@/components/common/Button';
import CreditExportPanel from '@/components/CreditExportPanel';
import { buildExportPreview } from '@/utils/exportPreview';

interface CSVExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Character[];
  groups: string[];
  selectedBlockIds: string[];
  onExportCSV: (includeTogaki?: boolean, selectedOnly?: boolean, fileFormat?: 'csv' | 'txt', includeUserPreset?: boolean) => void;
  onExportSerifOnly: (selectedOnly?: boolean, fileFormat?: 'csv' | 'txt', includeTogaki?: boolean, includeUserPreset?: boolean) => void;
  onExportByGroups: (selectedGroups: string[], exportType: 'full' | 'serif-only', includeTogaki?: boolean, selectedOnly?: boolean, sceneIds?: string[], fileFormat?: 'csv' | 'txt', includeUserPreset?: boolean) => void;
  onExportCharacterCSV: () => void;
  onExportToClipboard: (serifOnly?: boolean, selectedOnly?: boolean, includeTogaki?: boolean, selectedGroups?: string[]) => void;
  scenes: Scene[];
  selectedSceneId: string | null;
  onExportSceneCSV: (sceneIds: string[], exportType: 'full' | 'serif-only', includeTogaki: boolean, selectedOnly: boolean, fileFormat?: 'csv' | 'txt', includeUserPreset?: boolean) => void;
  onExportProjectJson: () => void;
  onExportPresetSeparator: (separator: string, includeTogaki: boolean, selectedOnly: boolean, fileFormat: 'csv' | 'txt', useGroupExport: boolean, selectedGroups: string[], useSceneExport: boolean, sceneIds: string[]) => void;
  project: any; // プロジェクトデータ
  groupCredits: GroupCredits;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

type ContentType = 'full' | 'serif-only' | 'clipboard';
type ExportTab = 'script' | 'backup' | 'credit';

/** 区切り文字の候補 */
const SEPARATOR_CANDIDATES = ['＞', '：', '＝', '／'];

/** 選択肢のカード化（docs/ui-guidelines.md §6）: 選択中は primary-tint＋primary のリング */
const selectedCardClass = 'bg-primary-tint shadow-[inset_0_0_0_1.5px_var(--color-primary)]';

/** ステップ番号と見出し（①② は必須、③ は任意） */
function StepHeading({ step, title, required, trailing }: { step: number; title: string; required: boolean; trailing?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`size-[21px] shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${required ? 'bg-primary text-on-primary' : 'bg-field text-fg-sub'}`}>
        {step}
      </span>
      <span className="text-[14.5px] font-bold text-fg">{title}</span>
      <span className={`text-[10px] font-bold px-2 py-px rounded-full ${required ? 'bg-primary-tint text-primary-text' : 'bg-field text-fg-sub'}`}>
        {required ? '必須' : '任意'}
      </span>
      {trailing && <span className="ml-auto">{trailing}</span>}
    </div>
  );
}

/** ③ 絞り込みのカード。チェックしたものだけ詳細エリアが開く（開閉はチェック状態から導出する） */
function FilterCard({
  title,
  description,
  checked,
  disabled = false,
  onChange,
  children
}: {
  title: string;
  description: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  const isOpen = checked && !disabled;
  return (
    <div className={`rounded-2xl transition-colors ${isOpen ? selectedCardClass : 'bg-well'} ${disabled ? 'opacity-50' : ''}`}>
      <label className={`flex items-start gap-[11px] px-4 py-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          className="ui-checkbox mt-px"
          checked={isOpen}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
        />
        <span className="flex-1 min-w-0">
          <span className="block text-[13.5px] font-bold text-fg">{title}</span>
          <span className="block text-[11px] leading-[1.55] text-fg-sub mt-0.5">{description}</span>
        </span>
        {isOpen
          ? <ChevronUpIcon className="size-4 shrink-0 mt-0.5 text-fg-faint" />
          : <ChevronDownIcon className="size-4 shrink-0 mt-0.5 text-fg-faint" />}
      </label>
      {/* 下の余白はカード側の padding で取る（子の margin だとカードの外へ相殺され、詳細エリアが枠に接してしまう） */}
      {isOpen && children && (
        <div className="px-3 pb-3">
          <div className="rounded-xl bg-panel p-3.5">{children}</div>
        </div>
      )}
    </div>
  );
}

export default function CSVExportDialog({
  isOpen,
  onClose,
  characters,
  groups,
  selectedBlockIds,
  onExportCSV,
  onExportSerifOnly,
  onExportByGroups,
  onExportCharacterCSV,
  onExportToClipboard,
  scenes,
  selectedSceneId,
  onExportSceneCSV,
  onExportProjectJson,
  onExportPresetSeparator,
  project,
  groupCredits,
  onNotification
}: CSVExportDialogProps) {
  // ① 出力する内容 / ② ファイル形式 / ③ 出力範囲の絞り込み
  const [contentType, setContentType] = useState<ContentType>('full');
  const [fileFormat, setFileFormat] = useState<'csv' | 'txt'>('csv');
  const [useGroupExport, setUseGroupExport] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [useSceneExport, setUseSceneExport] = useState(false);
  const [sceneCheckboxes, setSceneCheckboxes] = useState<string[]>([]);
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false);
  const [usePresetSeparator, setUsePresetSeparator] = useState(false);
  const [presetSeparator, setPresetSeparator] = useState<string>('＞');
  // ①の内容に付随するオプション
  const [includeTogaki, setIncludeTogaki] = useState(false);
  const [includeUserPreset, setIncludeUserPreset] = useState(false);
  const [activeTab, setActiveTab] = useState<ExportTab>('script');
  const [backupTarget, setBackupTarget] = useState<'project' | 'character-setting'>('project');

  const exportToClipboard = contentType === 'clipboard';
  // 既存の出力処理に渡す形式（区切り文字形式はファイル出力のときだけ有効）
  const exportType: 'full' | 'serif-only' | 'preset-separator' =
    usePresetSeparator && !exportToClipboard ? 'preset-separator' : contentType === 'full' ? 'full' : 'serif-only';

  // 選択ブロックがない場合は選択ブロックのみエクスポートを無効化
  useEffect(() => {
    if (selectedBlockIds.length === 0) {
      setExportSelectedOnly(false);
    }
  }, [selectedBlockIds]);

  // グループごとにエクスポートが有効になった時、すべてのグループを選択済みにする
  useEffect(() => {
    if (useGroupExport && selectedGroups.length === 0) {
      setSelectedGroups([...groups]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGroupExport, groups]);

  // シーンエクスポートのチェックボックス制御
  useEffect(() => {
    if (useSceneExport && sceneCheckboxes.length === 0 && scenes.length > 0) {
      setSceneCheckboxes(scenes.map(s => s.id));
    }
    if (!useSceneExport) {
      setSceneCheckboxes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useSceneExport, scenes]);

  // グループ選択状態に基づいて「すべて選択」チェックボックスの状態を計算
  const getSelectAllState = () => {
    if (selectedGroups.length === 0) return false;
    if (selectedGroups.length === groups.length) return true;
    return 'indeterminate'; // 部分選択状態
  };

  // 「すべて選択」チェックボックスのクリック処理
  const handleSelectAllToggle = () => {
    if (getSelectAllState() === true) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups([...groups]);
    }
  };

  const handleGroupToggle = (group: string) => {
    setSelectedGroups(prev =>
      prev.includes(group)
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  const handleSceneToggle = (sceneId: string) => {
    setSceneCheckboxes(prev => prev.includes(sceneId) ? prev.filter(id => id !== sceneId) : [...prev, sceneId]);
  };
  const handleSelectAllScenes = () => {
    if (sceneCheckboxes.length === scenes.length) {
      setSceneCheckboxes([]);
    } else {
      setSceneCheckboxes(scenes.map(s => s.id));
    }
  };

  const handleContentChange = (next: ContentType) => {
    setContentType(next);
    // クリップボード出力はシーン単位・区切り文字形式に未対応
    if (next === 'clipboard') {
      setUseSceneExport(false);
      setUsePresetSeparator(false);
    }
  };

  const handleExport = (exportType: 'full' | 'serif-only', includeTogaki: boolean) => {
    if (exportToClipboard) {
      onExportToClipboard(exportType === 'serif-only', exportSelectedOnly, includeTogaki, useGroupExport ? selectedGroups : undefined);
    } else if (useGroupExport && selectedGroups.length > 0) {
      onExportByGroups(selectedGroups, exportType, includeTogaki, exportSelectedOnly, useSceneExport ? sceneCheckboxes : undefined, fileFormat, includeUserPreset);
    } else if (!useGroupExport) {
      if (exportType === 'full') {
        onExportCSV(includeTogaki, exportSelectedOnly, fileFormat, includeUserPreset);
      } else {
        onExportSerifOnly(exportSelectedOnly, fileFormat, includeTogaki, includeUserPreset);
      }
    }
    onClose();
  };

  const handleClose = () => {
    setSelectedGroups([]);
    setUseGroupExport(false);
    setContentType('full');
    setUsePresetSeparator(false);
    setExportSelectedOnly(false);
    setActiveTab('script');
    setBackupTarget('project');
    setFileFormat('csv');
    setPresetSeparator('＞');
    setIncludeUserPreset(false);
    onClose();
  };

  const handleScriptExport = () => {
    if (exportType === 'preset-separator') {
      onExportPresetSeparator(
        presetSeparator || '＞',
        includeTogaki,
        exportSelectedOnly,
        fileFormat,
        useGroupExport,
        selectedGroups,
        useSceneExport,
        sceneCheckboxes
      );
      handleClose();
    } else if (useGroupExport && selectedGroups.length > 0) {
      handleExport(exportType, includeTogaki);
    } else if (useSceneExport && sceneCheckboxes.length > 0 && !exportToClipboard) {
      onExportSceneCSV(sceneCheckboxes, exportType, includeTogaki, exportSelectedOnly, fileFormat, includeUserPreset);
      handleClose();
    } else {
      handleExport(exportType, includeTogaki);
    }
  };

  const handleBackupExport = () => {
    if (backupTarget === 'character-setting') {
      onExportCharacterCSV();
    } else {
      onExportProjectJson();
    }
    handleClose();
  };

  // 出力プレビューと件数（現在の設定に追従）
  const preview = useMemo(() => buildExportPreview({
    project: project || { scenes: [] },
    characters,
    content: contentType,
    includeTogaki,
    includeUserPreset: includeUserPreset && exportType !== 'preset-separator',
    presetSeparator: exportType === 'preset-separator' ? (presetSeparator || '＞') : undefined,
    sceneIds: useSceneExport && !exportToClipboard ? sceneCheckboxes : undefined,
    groups: useGroupExport ? selectedGroups : undefined,
    selectedBlockIds: exportSelectedOnly ? selectedBlockIds : undefined
  }), [project, characters, contentType, includeTogaki, includeUserPreset, exportType, presetSeparator, useSceneExport, exportToClipboard, sceneCheckboxes, useGroupExport, selectedGroups, exportSelectedOnly, selectedBlockIds]);

  // 区切り文字の「この設定での出力」例（常に区切り文字形式で2行）
  const separatorExample = useMemo(() => buildExportPreview({
    project: project || { scenes: [] },
    characters,
    content: 'full',
    includeTogaki: false,
    includeUserPreset: false,
    presetSeparator: presetSeparator || '＞'
  }, 2).lines, [project, characters, presetSeparator]);

  // 台本内で使われているキャラクター（グループ詳細のチップ表示用）
  const usedCharacterIds = useMemo(() => {
    const ids = new Set<string>();
    (project?.scenes || []).forEach((scene: Scene) => {
      (scene.scripts[0]?.blocks || []).forEach(block => { if (block.characterId) ids.add(block.characterId); });
    });
    return ids;
  }, [project]);

  const appliedFilterCount = [useGroupExport, useSceneExport && !exportToClipboard, exportSelectedOnly, usePresetSeparator && !exportToClipboard].filter(Boolean).length;
  const needsGroupSelection = useGroupExport && selectedGroups.length === 0;
  const needsSceneSelection = useSceneExport && !exportToClipboard && sceneCheckboxes.length === 0;

  const contentOptions: { id: ContentType; title: string; description: string }[] = [
    { id: 'full', title: '話者とセリフの両方', description: '〈話者,セリフ〉のカンマ区切り。合成音声ソフトにそのままインポートできます。' },
    { id: 'serif-only', title: 'セリフのみ', description: 'インポートに未対応のソフト向け。' },
    { id: 'clipboard', title: 'クリップボードにコピー', description: 'ファイルを作らず、別のソフトへ直接貼り付けます。' }
  ];

  const renderScriptTab = () => (
    <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden md:grid md:grid-cols-[384px_1fr]">
      {/* 左: 必須（出力する内容・ファイル形式）。下端のプレビューとエクスポートは固定し、上だけスクロールする */}
      <div className="md:flex md:flex-col md:min-h-0">
        <div className="p-5 md:flex-1 md:min-h-0 md:overflow-y-auto">
        <StepHeading step={1} title="出力する内容" required />
        <div className="space-y-1.5" role="radiogroup" aria-label="出力する内容">
          {contentOptions.map(option => {
            const isSelected = contentType === option.id;
            return (
              <label
                key={option.id}
                className={`flex items-start gap-[11px] px-3.5 py-3 rounded-2xl cursor-pointer transition-colors ${isSelected ? selectedCardClass : 'hover:bg-well'}`}
              >
                <input
                  type="radio"
                  name="exportContent"
                  className="ui-radio mt-px"
                  checked={isSelected}
                  onChange={() => handleContentChange(option.id)}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-bold text-fg">{option.title}</span>
                  <span className="block text-[11px] leading-[1.55] text-fg-sub mt-0.5">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        {/* 出力内容に付随するオプション（ラジオの選択肢と区別できるよう、ウェル面で1グループにまとめる） */}
        <div className="mt-2.5 px-3.5 py-3 rounded-2xl bg-well space-y-2.5">
          <label className="flex items-center gap-[11px] text-[13px] font-semibold text-fg cursor-pointer">
            <input type="checkbox" className="ui-checkbox" checked={includeTogaki} onChange={e => setIncludeTogaki(e.target.checked)} />
            ト書きを含めて出力
          </label>
          {!exportToClipboard && (
            <label className={`flex items-start gap-[11px] text-[13px] font-semibold text-fg ${exportType === 'preset-separator' ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                className="ui-checkbox mt-px"
                checked={includeUserPreset && exportType !== 'preset-separator'}
                disabled={exportType === 'preset-separator'}
                onChange={e => setIncludeUserPreset(e.target.checked)}
              />
              <span>
                ユーザープリセット名を3列目に追加
                <span className="block text-[11px] font-normal leading-[1.55] text-fg-sub mt-0.5">
                  CeVIO AI 等での読み込みを想定した形式です{exportType === 'preset-separator' && '（区切り文字出力時は選択不可）'}
                </span>
              </span>
            </label>
          )}
        </div>

        {!exportToClipboard && (
          <div className="mt-6">
            <StepHeading step={2} title="ファイル形式" required />
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'csv', label: '.csv', description: '表計算・合成音声ソフト' },
                { id: 'txt', label: '.txt', description: 'テキストエディタ' }
              ] as const).map(format => (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => setFileFormat(format.id)}
                  aria-pressed={fileFormat === format.id}
                  className={`text-left rounded-2xl px-3.5 py-3 transition-colors ${fileFormat === format.id ? selectedCardClass : 'bg-well hover:bg-field'}`}
                >
                  <span className="block font-mono text-[15px] font-bold text-fg">{format.label}</span>
                  <span className="block text-[11px] text-fg-sub mt-0.5">{format.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        </div>

        {/* 出力プレビューとエクスポートは左列の下端に固定 */}
        <div className="px-5 pb-5 pt-1 md:pt-4 md:shadow-[0_-1px_0_var(--color-hairline)]">
          <div className="ui-section-label mb-2">出力プレビュー</div>
          <pre className="rounded-[11px] bg-well px-3.5 py-2.5 font-mono text-[11.5px] leading-[1.7] text-fg-sub whitespace-pre overflow-x-auto min-h-[4.6rem]">
            {preview.lines.length > 0 ? preview.lines.join('\n') : '（出力対象のブロックがありません）'}
          </pre>
          <div className="flex items-center justify-between gap-3 mt-4">
            <span className="text-xs text-fg-faint">
              {preview.blockCount.toLocaleString()} ブロック ・ {preview.charCount.toLocaleString()} 字
            </span>
            <button
              type="button"
              onClick={handleScriptExport}
              disabled={needsGroupSelection || needsSceneSelection}
              className={`${buttonClass('primary')} px-6 py-3 text-sm`}
            >
              {exportToClipboard ? 'クリップボードに出力' : 'エクスポート'}
            </button>
          </div>
        </div>
      </div>

      {/* 右: 任意（出力範囲を絞り込む） */}
      <div className="p-5 md:overflow-y-auto md:shadow-[inset_1px_0_0_var(--color-hairline)]">
        <StepHeading
          step={3}
          title="出力範囲を絞り込む"
          required={false}
          trailing={<span className="text-[11px] text-fg-faint whitespace-nowrap">{appliedFilterCount} / 4 適用中</span>}
        />
        <p className="text-[11px] leading-[1.55] text-fg-sub -mt-1 mb-3">
          すべてオフのままで、台本全体が合成音声ソフト向けの形式で出力されます。
        </p>
        <div className="space-y-2">
          <FilterCard
            title="グループごとにエクスポート"
            description="グループ単位でファイルを分けて出力します"
            checked={useGroupExport}
            onChange={setUseGroupExport}
          >
            {groups.length === 0 ? (
              <p className="text-[13px] text-fg-sub">グループがありません</p>
            ) : (
              <>
                <label className="flex items-center gap-[11px] pb-2.5 mb-2.5 shadow-[0_1px_0_var(--color-hairline)] cursor-pointer">
                  <input
                    type="checkbox"
                    className="ui-checkbox"
                    ref={el => { if (el) el.indeterminate = getSelectAllState() === 'indeterminate'; }}
                    checked={getSelectAllState() === true}
                    onChange={handleSelectAllToggle}
                  />
                  <span className="flex-1 text-[13px] font-bold text-fg">出力するグループ</span>
                  <span className="text-[11px] text-fg-faint">{selectedGroups.length} / {groups.length}</span>
                </label>
                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {groups.map(group => {
                    const members = characters.filter(c => c.group === group);
                    const usedMembers = members.filter(c => usedCharacterIds.has(c.id));
                    return (
                      <label key={group} className="flex items-start gap-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          className="ui-checkbox mt-px"
                          checked={selectedGroups.includes(group)}
                          onChange={() => handleGroupToggle(group)}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="text-[13px] font-bold text-fg">{group}</span>
                          <span className="ml-1.5 text-[10.5px] text-fg-faint">{members.length}人</span>
                          {/* 台本内で使われているこのグループのキャラクター */}
                          <span className="flex flex-wrap gap-1 mt-1">
                            {usedMembers.length > 0 ? usedMembers.map(c => (
                              <span key={c.id} className="text-[10.5px] px-2 py-px rounded-full bg-field text-fg-sub">{c.name}</span>
                            )) : (
                              <span className="text-[10.5px] text-fg-faint">台本内で未使用</span>
                            )}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {needsGroupSelection && (
                  <p className="text-destructive text-[11px] mt-2">グループを選択してください</p>
                )}
              </>
            )}
          </FilterCard>

          <FilterCard
            title="特定のシーンのみ出力"
            description={exportToClipboard ? 'クリップボード出力時は使えません' : '選んだシーンだけを出力します'}
            checked={useSceneExport}
            disabled={exportToClipboard}
            onChange={checked => {
              setUseSceneExport(checked);
              if (checked) setExportSelectedOnly(false);
            }}
          >
            <label className="flex items-center gap-[11px] pb-2.5 mb-2.5 shadow-[0_1px_0_var(--color-hairline)] cursor-pointer">
              <input
                type="checkbox"
                className="ui-checkbox"
                checked={sceneCheckboxes.length === scenes.length}
                onChange={handleSelectAllScenes}
              />
              <span className="flex-1 text-[13px] font-bold text-fg">すべてのシーン</span>
              <span className="text-[11px] text-fg-faint">{sceneCheckboxes.length} / {scenes.length}</span>
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {scenes.map(scene => {
                // シーン内のグループ名を抽出
                const sceneGroups = Array.from(new Set((scene.scripts[0]?.blocks || [])
                  .map(b => characters.find(c => c.id === b.characterId)?.group || null)
                  .filter(g => g && g !== 'なし')));
                return (
                  <label key={scene.id} className="flex items-center gap-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      className="ui-checkbox"
                      checked={sceneCheckboxes.includes(scene.id)}
                      onChange={() => handleSceneToggle(scene.id)}
                    />
                    <span className="text-[13px] text-fg">
                      {scene.name}
                      {sceneGroups.length > 0 && (
                        <span className="ml-2 text-[11px] text-fg-faint">（{sceneGroups.join(',')}）</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            {needsSceneSelection && (
              <p className="text-destructive text-[11px] mt-2">シーンを選択してください</p>
            )}
          </FilterCard>

          <FilterCard
            title="選択中のブロックのみ出力"
            description={
              selectedBlockIds.length === 0
                ? 'エディタでブロックを選択すると使えます'
                : useSceneExport
                  ? '特定のシーン出力時は使えません'
                  : `エディタで選択している ${selectedBlockIds.length} ブロックが対象です`
            }
            checked={exportSelectedOnly}
            disabled={selectedBlockIds.length === 0 || useSceneExport}
            onChange={setExportSelectedOnly}
          />

          <FilterCard
            title="プリセット名と区切り文字で出力"
            description={exportToClipboard ? 'クリップボード出力時は使えません' : 'VOICEROID2・A.I.VOICE などのテキスト読み込み向け'}
            checked={usePresetSeparator}
            disabled={exportToClipboard}
            onChange={checked => {
              setUsePresetSeparator(checked);
              if (checked) setIncludeUserPreset(false);
            }}
          >
            <label htmlFor="presetSeparator" className="block ui-section-label mb-2">区切り文字</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <input
                id="presetSeparator"
                type="text"
                value={presetSeparator}
                onChange={e => setPresetSeparator(e.target.value)}
                maxLength={5}
                className="ui-input w-[52px] px-1 text-center text-[15px] font-bold"
              />
              {SEPARATOR_CANDIDATES.map(candidate => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setPresetSeparator(candidate)}
                  className={`size-8 rounded-[10px] text-[13px] font-bold transition-colors ${presetSeparator === candidate ? `${selectedCardClass} text-primary-text` : 'bg-field text-fg-sub hover:text-fg'}`}
                  title={`「${candidate}」を使う`}
                >
                  {candidate}
                </button>
              ))}
            </div>
            <div className="ui-section-label mt-3.5 mb-2">この設定での出力</div>
            <pre className="rounded-[11px] bg-well px-3.5 py-2.5 font-mono text-[11.5px] leading-[1.7] text-fg-sub whitespace-pre overflow-x-auto">
              {separatorExample.length > 0 ? separatorExample.join('\n') : '（出力対象のブロックがありません）'}
            </pre>
          </FilterCard>
        </div>
      </div>
    </div>
  );

  const renderBackupTab = () => (
    <div className="p-5 overflow-y-auto">
      <div className="grid grid-cols-2 gap-2 mb-4">
        {([
          { id: 'project', label: 'プロジェクト', description: 'JSON（台本全体）' },
          { id: 'character-setting', label: 'キャラクター', description: 'CSV（全キャラクター設定）' }
        ] as const).map(target => (
          <button
            key={target.id}
            type="button"
            onClick={() => setBackupTarget(target.id)}
            aria-pressed={backupTarget === target.id}
            className={`text-left rounded-2xl px-3.5 py-3 transition-colors ${backupTarget === target.id ? selectedCardClass : 'bg-well hover:bg-field'}`}
          >
            <span className="block text-[13.5px] font-bold text-fg">{target.label}</span>
            <span className="block text-[11px] text-fg-sub mt-0.5">{target.description}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-[1.7] text-fg-sub">
        {backupTarget === 'project'
          ? '現在選択中のプロジェクト全体をJSONファイルとしてエクスポートします。インポートで復元できます。'
          : '全キャラクターの設定（アイコン・グループ・プリセット・素材クレジット・表情差分）をCSVでエクスポートします。インポートで復元できます。'}
      </p>
      <button type="button" onClick={handleBackupExport} className={`${buttonClass('primary')} w-full mt-5 py-3 text-sm`}>
        エクスポート
      </button>
    </div>
  );

  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={handleClose}
      panelClassName={`w-full ${activeTab === 'script' ? 'max-w-[960px] md:h-[min(760px,90vh)]' : 'max-w-md'} max-h-[90vh] overflow-hidden flex flex-col`}
      overlayClassName="p-4"
    >
      {/* タブ行（台本 / バックアップ / クレジット）＋閉じる */}
      <TabBar<ExportTab>
        items={[
          { id: 'script', label: '台本' },
          { id: 'backup', label: 'バックアップ' },
          { id: 'credit', label: 'クレジット' }
        ]}
        activeId={activeTab}
        onChange={setActiveTab}
        className="pt-3"
        trailing={<DialogCloseButton onClick={handleClose} />}
      />

      {activeTab === 'script' && renderScriptTab()}
      {activeTab === 'backup' && renderBackupTab()}
      {activeTab === 'credit' && (
        <div className="p-5 overflow-y-auto">
          <CreditExportPanel
            project={project}
            characters={characters}
            groups={groups}
            groupCredits={groupCredits}
            selectedSceneId={selectedSceneId}
            onNotification={onNotification}
          />
        </div>
      )}
    </DialogFrame>
  );
}
