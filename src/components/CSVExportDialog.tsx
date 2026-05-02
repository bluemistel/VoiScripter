'use client';

import { useState, useEffect } from 'react';
import { Character, Scene } from '@/types';
import DialogFrame from '@/components/common/DialogFrame';

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
  onExportToClipboard: (serifOnly?: boolean, selectedOnly?: boolean, includeTogaki?: boolean) => void;
  scenes: Scene[];
  selectedSceneId: string | null;
  onExportSceneCSV: (sceneIds: string[], exportType: 'full' | 'serif-only', includeTogaki: boolean, selectedOnly: boolean, fileFormat?: 'csv' | 'txt', includeUserPreset?: boolean) => void;
  onExportProjectJson: () => void;
  onExportPresetSeparator: (separator: string, includeTogaki: boolean, selectedOnly: boolean, fileFormat: 'csv' | 'txt', useGroupExport: boolean, selectedGroups: string[], useSceneExport: boolean, sceneIds: string[]) => void;
  project: any; // プロジェクトデータ
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
  project
}: CSVExportDialogProps) {
  type ExportType = 'full' | 'serif-only' | 'character-setting' | 'project' | 'preset-separator';
  const [exportType, setExportType] = useState<ExportType>('full');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [useGroupExport, setUseGroupExport] = useState(false);
  const [includeTogaki, setIncludeTogaki] = useState(false);
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false);
  const [exportToClipboard, setExportToClipboard] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'project' | 'character'>('script');
  const [useSceneExport, setUseSceneExport] = useState(false);
  const [sceneCheckboxes, setSceneCheckboxes] = useState<string[]>([]);
  const [fileFormat, setFileFormat] = useState<'csv' | 'txt'>('csv');
  const [presetSeparator, setPresetSeparator] = useState<string>('＞');
  const [includeUserPreset, setIncludeUserPreset] = useState(false);

  // このuseEffectを削除して、ト書き含めるの切り替えでグループごとエクスポートがリセットされないようにする

  // キャラクター設定選択時にト書き含めるをリセット
  useEffect(() => {
    if (exportType === 'character-setting') {
      setIncludeTogaki(false);
      setExportSelectedOnly(false);
      setExportToClipboard(false);
    }
  }, [exportType]);

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
  }, [useGroupExport, groups]);

  // シーンエクスポートのチェックボックス制御
  useEffect(() => {
    if (useSceneExport && sceneCheckboxes.length === 0 && scenes.length > 0) {
      setSceneCheckboxes(scenes.map(s => s.id));
    }
    if (!useSceneExport) {
      setSceneCheckboxes([]);
    }
  }, [useSceneExport, scenes]);

  // グループ選択状態に基づいて「すべて選択」チェックボックスの状態を計算
  const getSelectAllState = () => {
    if (selectedGroups.length === 0) return false;
    if (selectedGroups.length === groups.length) return true;
    return 'indeterminate'; // 部分選択状態
  };

  // 「すべて選択」チェックボックスのクリック処理
  const handleSelectAllToggle = () => {
    const currentState = getSelectAllState();
    if (currentState === true) {
      // すべて選択済みの場合、すべての選択を解除
      setSelectedGroups([]);
    } else {
      // 部分選択または未選択の場合、すべて選択
      setSelectedGroups([...groups]);
    }
  };

  // タブ切り替え時にエクスポートタイプをリセット
  useEffect(() => {
    if (activeTab === 'project') {
      setExportType('project');
    } else if (activeTab === 'character') {
      setExportType('character-setting');
    } else {
      setExportType('full');
    }
  }, [activeTab]);

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

  const handleExport = (exportType: 'full' | 'serif-only', includeTogaki: boolean) => {
    if (exportToClipboard) {
      onExportToClipboard(exportType === 'serif-only', exportSelectedOnly, includeTogaki);
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
    setExportType('full');
    setExportSelectedOnly(false);
    setExportToClipboard(false);
    setActiveTab('script');
    setFileFormat('csv');
    setPresetSeparator('＞');
    setIncludeUserPreset(false);
    onClose();
  };

  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={handleClose}
      panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col transition-opacity duration-300"
      overlayClassName="transition-opacity duration-300 p-4"
    >
        <div className="flex-shrink-0 p-6 pb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-foreground">エクスポート</h3>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground text-2xl"
              title="閉じる"
            >
              ×
            </button>
          </div>

          {/* タブ切り替え */}
          <div className="flex border-b mb-4">
            <button
              onClick={() => setActiveTab('script')}
              className={`flex-1 px-4 py-2 font-medium transition-colors ${
                activeTab === 'script'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              台本
            </button>
            <button
              onClick={() => setActiveTab('project')}
              className={`flex-1 px-4 py-2 font-medium transition-colors ${
                activeTab === 'project'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              プロジェクト
            </button>
            <button
              onClick={() => setActiveTab('character')}
              className={`flex-1 px-4 py-2 font-medium transition-colors ${
                activeTab === 'character'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              キャラクター
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">

        {/* 台本タブの内容 */}
        {activeTab === 'script' && (
          <>
            {/* エクスポートタイプ選択 */}
            <div className="mb-4">
              <span className="text-foreground mb-2 font-semibold">エクスポート形式(UTF-8)</span>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="exportType"
                    value="full"
                    checked={exportType === 'full' && !exportToClipboard}
                    onChange={(e) => {
                      setExportType(e.target.value as ExportType);
                      setExportToClipboard(false);
                    }}
                    className="text-primary"
                  />
                  <span className="text-foreground">話者とセリフの両方をエクスポート<br /><span className="text-xs text-muted-foreground">〈話者,セリフ〉のカンマ区切りの形式で出力します。</span></span>
                  
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="exportType"
                    value="serif-only"
                    checked={exportType === 'serif-only' && !exportToClipboard}
                    onChange={(e) => {
                      setExportType(e.target.value as ExportType);
                      setExportToClipboard(false);
                    }}
                    className="text-primary"
                  />
                  <span className="text-foreground">セリフのみをエクスポート<br /><span className="text-xs text-muted-foreground">セリフのみ出力します。インポート未対応のソフト向け。</span></span>
                </label>
                                 <label className="flex items-center space-x-2 cursor-pointer">
                   <input
                     type="radio"
                     name="exportType"
                     value="clipboard"
                     checked={exportToClipboard}
                     onChange={(e) => {
                       setExportToClipboard(e.target.checked);
                       if (e.target.checked) {
                         setExportType('serif-only');
                         setUseGroupExport(false);
                         setUseSceneExport(false);
                       }
                     }}
                     className="text-primary"
                   />
                   <span className="text-foreground">クリップボードにセリフをコピーする<br /><span className="text-xs text-muted-foreground">別のソフトへ貼り付ける場合に使用します。</span></span>
                 </label>
                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="exportType"
                    value="preset-separator"
                    checked={exportType === 'preset-separator' && !exportToClipboard}
                    onChange={(e) => {
                      setExportType(e.target.value as ExportType);
                      setExportToClipboard(false);
                      setIncludeUserPreset(false);
                    }}
                    className="text-primary mt-0.5"
                  />
                  <span className="text-foreground">
                    プリセット名とユーザー指定の区切り文字で出力
                    <br /><span className="text-xs text-muted-foreground">※VOICEROID、A.I.VOICEのテキスト読み込みを想定した形式です</span>
                    {exportType === 'preset-separator' && !exportToClipboard && (
                      <span className="flex items-center space-x-2 mt-1" onClick={e => e.stopPropagation()}>
                        <span className="text-xs text-foreground">区切り文字:</span>
                        <input
                          type="text"
                          value={presetSeparator}
                          onChange={e => setPresetSeparator(e.target.value)}
                          onPointerDown={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          className="w-16 p-1 border rounded bg-background text-foreground text-sm focus:ring-1 focus:ring-primary/50 focus:outline-none"
                          maxLength={5}
                        />
                      </span>
                    )}
                  </span>
                </label>
              </div>
            </div>

            {/* ファイル形式選択 */}
            {!exportToClipboard && (
              <div className="mb-4">
                <label className="block text-foreground mb-2 font-semibold">
                  ファイル形式
                </label>
                <select
                  value={fileFormat}
                  onChange={(e) => setFileFormat(e.target.value as 'csv' | 'txt')}
                  className="w-full p-2 border rounded bg-background text-foreground border-border focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="csv">.csv (CSV形式で保存)</option>
                  <option value="txt">.txt (テキスト形式で保存)</option>
                </select>
              </div>
            )}

            {/* エクスポート用のオプション選択チェックボックス */}            
            <span className="text-foreground mb-2 font-semibold">エクスポートオプション</span>
            <div className="p-2 mr-4">
              {/* シーン単位エクスポートオプション */}
              <label className={`flex items-center space-x-2 cursor-pointer mb-2 ${exportToClipboard ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={useSceneExport}
                  onChange={(e) => {
                    setUseSceneExport(e.target.checked);
                    if (e.target.checked) {
                      setExportSelectedOnly(false);
                    }
                  }}
                  className="text-primary"
                  disabled={exportToClipboard}
                />
                <span className={`font-medium ${exportToClipboard ? 'text-muted-foreground' : 'text-foreground'}`}>特定のシーンのみCSVを出力</span>
                {exportToClipboard && (
                  <span className="ml-2 text-xs text-muted-foreground">※クリップボード出力時は未対応</span>
                )}
              </label>
              {useSceneExport && !exportToClipboard && (
                <div className="mb-1 border rounded-lg p-2">
                  <label className="flex items-center space-x-2 cursor-pointer mb-1">
                    <input
                      type="checkbox"
                      checked={sceneCheckboxes.length === scenes.length}
                      onChange={handleSelectAllScenes}
                      className="text-primary"
                    />
                    <span className="text-foreground text-sm font-medium">すべてのシーンにチェック</span>
                  </label>
                  <div className="max-h-25 overflow-y-auto text-foreground-muted rounded p-2 space-y-0.5">
                    {scenes.map(scene => {
                      // シーン内のグループ名を抽出
                      const sceneGroups = Array.from(new Set((scene.scripts[0]?.blocks || [])
                        .map(b => {
                          const char = characters.find(c => c.id === b.characterId);
                          return char?.group || null;
                        })
                        .filter(g => g && g !== 'なし')));
                      return (
                        <label key={scene.id} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-accent rounded">
                          <input
                            type="checkbox"
                            checked={sceneCheckboxes.includes(scene.id)}
                            onChange={() => handleSceneToggle(scene.id)}
                            className="text-primary"
                          />
                          <span className="text-foreground text-sm">{scene.name}
                            {sceneGroups.length > 0 && (
                              <span className="ml-2 text-xs text-muted-foreground">（{sceneGroups.join(',')}）</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {sceneCheckboxes.length === 0 && (
                    <p className="text-destructive text-xs mt-1">シーンを選択してください</p>
                  )}
                </div>
              )}

              {/* ト書きを含めて出力チェックボックス */}            
              <label className="flex items-center space-x-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={includeTogaki}
                  onChange={e => setIncludeTogaki(e.target.checked)}
                  className="text-primary"
                />
                <span className="font-medium text-foreground">
                  ト書きを含めて出力
                </span>
              </label>

              {/* 選択ブロックのみエクスポート */}
              <label className={`flex items-center space-x-2 cursor-pointer mb-2 ${(selectedBlockIds.length === 0 || useSceneExport) ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={exportSelectedOnly}
                  onChange={e => setExportSelectedOnly(e.target.checked)}
                  className="text-primary"
                  disabled={selectedBlockIds.length === 0 || useSceneExport}
                />
                <span className={`font-medium ${(selectedBlockIds.length === 0 || useSceneExport) ? 'text-muted-foreground' : 'text-foreground'}`}>
                  選択ブロックのみエクスポート {selectedBlockIds.length > 0 && `(${selectedBlockIds.length}個)`}
                  {useSceneExport && (
                    <span className="ml-2 text-xs text-muted-foreground"><br />※特定のシーン出力時は未対応</span>
                  )}
                </span>
              </label>



              {/* ユーザープリセット名をエクスポートに追加する */}
              {!exportToClipboard && (
                <label className={`flex items-start space-x-2 cursor-pointer mb-2 ${exportType === 'preset-separator' ? 'opacity-50' : ''}`}>
                  <input
                    type="checkbox"
                    checked={includeUserPreset}
                    onChange={e => setIncludeUserPreset(e.target.checked)}
                    className="text-primary mt-0.5"
                    disabled={exportType === 'preset-separator'}
                  />
                  <span className={`font-medium ${exportType === 'preset-separator' ? 'text-muted-foreground' : 'text-foreground'}`}>
                    ユーザープリセット名をエクスポートに追加する
                    <br /><span className="text-xs text-muted-foreground font-normal">
                      CSVの3列目にプリセット名を出力します。CeVIO AI等での読み込みを想定した形式です。
                      {exportType === 'preset-separator' && '（区切り文字出力時は選択不可）'}
                    </span>
                  </span>
                </label>
              )}

              {/* グループごとにエクスポートオプション */}
              <label className={`flex items-center space-x-2 cursor-pointer mb-2 ${exportToClipboard ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={useGroupExport}
                  onChange={(e) => setUseGroupExport(e.target.checked)}
                  className="text-primary"
                  disabled={exportToClipboard}
                />
                <span className={`font-medium ${exportToClipboard ? 'text-muted-foreground' : 'text-foreground'}`}>
                  グループごとにエクスポート
                </span>
              </label>

              {/* グループ選択 */}
              {useGroupExport && (
                <div className="mb-1 border text-foreground-muted rounded-lg p-2">                  
                  {/* すべて選択チェックボックス */}
                  {groups.length > 0 && (
                    <label className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-accent rounded pb-2">
                      <input
                        type="checkbox"
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = getSelectAllState() === 'indeterminate';
                          }
                        }}
                        checked={getSelectAllState() === true}
                        onChange={handleSelectAllToggle}
                        className="text-primary"
                      />
                      <span className="text-foreground text-sm font-medium">エクスポートするグループを選択</span>
                    </label>
                  )}
                  
                  <div className="max-h-25 overflow-y-auto text-foreground-muted rounded p-2 space-y-0.5">
                    {groups.length === 0 ? (
                      <p className="text-muted-foreground text-sm">グループがありません</p>
                    ) : (
                      groups.map(group => (
                        <label key={group} className="flex items-center space-x-2 cursor-pointer p-1 hover:bg-accent rounded">
                          <input
                            type="checkbox"
                            checked={selectedGroups.includes(group)}
                            onChange={() => handleGroupToggle(group)}
                            className="text-primary"
                          />
                          <span className="text-foreground text-sm">{group}</span>
                          <span className="text-muted-foreground text-xs">
                            ({characters.filter(c => c.group === group).length}人)
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedGroups.length === 0 && useGroupExport && (
                    <p className="text-destructive text-xs mt-1">グループを選択してください</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

{/* プロジェクト設定タブの内容 */}
        {activeTab === 'project' && (
          <div className="mb-4">
            <span className="text-foreground mb-2 font-semibold">プロジェクト</span>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="exportType"
                  value="project"
                  checked={exportType === 'project'}
                  onChange={() => setExportType('project')}
                  className="text-primary"
                />
                <span className="text-foreground">プロジェクト全体をJSONでエクスポート</span>
              </label>
              <span className="block text-sm text-muted-foreground">現在選択中のプロジェクト全体をJSONファイルとしてエクスポートします。インポートで復元できます。</span>
            </div>
          </div>
        )}

{/* キャラクター設定タブの内容 */}
        {activeTab === 'character' && (
          <div className="mb-4">
            <span className="text-foreground mb-2 font-semibold">キャラクター設定</span>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="exportType"
                  value="character-setting"
                  checked={exportType === 'character-setting'}
                  onChange={(e) => setExportType(e.target.value as ExportType)}
                  className="text-primary"
                />
                <span className="text-foreground">キャラクター設定のエクスポート</span>
              </label>
            </div>
          </div>
        )}

        {/* エクスポートボタン */}
        <div className="flex flex-col space-y-2 mt-4">
          <button
            onClick={() => {
              if (exportType === 'character-setting') {
                onExportCharacterCSV();
                handleClose();
              } else if (exportType === 'project') {
                onExportProjectJson();
                handleClose();
              } else if (exportType === 'preset-separator' && !exportToClipboard) {
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
                handleExport(exportType as 'full' | 'serif-only', includeTogaki);
              } else if (useSceneExport && sceneCheckboxes.length > 0 && !exportToClipboard) {
                onExportSceneCSV(sceneCheckboxes, exportType as 'full' | 'serif-only', includeTogaki, exportSelectedOnly, fileFormat, includeUserPreset);
                handleClose();
              } else if (exportType === 'full' || exportType === 'serif-only' || exportToClipboard) {
                handleExport(exportType as 'full' | 'serif-only', includeTogaki);
              }
            }}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-semibold"
          >
            {exportToClipboard ? 'クリップボードに出力' : 'エクスポート'}
          </button>
        </div>
        </div>
    </DialogFrame>
  );
} 