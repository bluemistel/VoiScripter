'use client';

import { useState, useEffect } from 'react';
import { Character } from '@/types';

interface CSVExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Character[];
  groups: string[];
  selectedBlockIds: string[];
  onExportCSV: (includeTogaki?: boolean, selectedOnly?: boolean) => void;
  onExportSerifOnly: (selectedOnly?: boolean) => void;
  onExportByGroups: (selectedGroups: string[], exportType: 'full' | 'serif-only', includeTogaki?: boolean, selectedOnly?: boolean) => void;
  onExportCharacterCSV: () => void;
  onExportToClipboard: (serifOnly?: boolean, selectedOnly?: boolean) => void;
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
  onExportToClipboard
}: CSVExportDialogProps) {
  type ExportType = 'full' | 'serif-only' | 'character-setting';
  const [exportType, setExportType] = useState<ExportType>('full');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [useGroupExport, setUseGroupExport] = useState(false);
  const [includeTogaki, setIncludeTogaki] = useState(false);
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false);
  const [exportToClipboard, setExportToClipboard] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'character'>('script');

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
    if (activeTab === 'character') {
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

  const handleExport = (exportType: 'full' | 'serif-only', includeTogaki: boolean) => {
    if (exportToClipboard) {
      // クリップボードに出力
      onExportToClipboard(exportType === 'serif-only', exportSelectedOnly);
    } else if (useGroupExport && selectedGroups.length > 0) {
      onExportByGroups(selectedGroups, exportType, includeTogaki, exportSelectedOnly);
    } else if (!useGroupExport) {
      if (exportType === 'full') {
        onExportCSV(includeTogaki, exportSelectedOnly);
      } else {
        onExportSerifOnly(exportSelectedOnly);
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
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6 transition-opacity duration-300">
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
            onClick={() => setActiveTab('character')}
            className={`flex-1 px-4 py-2 font-medium transition-colors ${
              activeTab === 'character'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            キャラクター設定
          </button>
        </div>

        {/* 台本タブの内容 */}
        {activeTab === 'script' && (
          <>
            {/* エクスポートタイプ選択 */}
            <div className="mb-4">
              <span className="text-foreground mb-2 font-semibold">CSVのエクスポート形式(UTF-8)</span>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="exportType"
                    value="full"
                    checked={exportType === 'full'}
                    onChange={(e) => setExportType(e.target.value as ExportType)}
                    className="text-primary"
                  />
                  <span className="text-foreground">話者とセリフの両方をエクスポート</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="exportType"
                    value="serif-only"
                    checked={exportType === 'serif-only'}
                    onChange={(e) => setExportType(e.target.value as ExportType)}
                    className="text-primary"
                  />
                  <span className="text-foreground">セリフのみをエクスポート</span>
                </label>
              </div>
            </div>

            {/* エクスポート用のオプション選択チェックボックス */}            
            <span className="text-foreground mb-2 font-semibold">エクスポートオプション</span>
            <div className="p-2 mr-4">
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
              <label className={`flex items-center space-x-2 cursor-pointer mb-2 ${selectedBlockIds.length === 0 ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={exportSelectedOnly}
                  onChange={e => setExportSelectedOnly(e.target.checked)}
                  className="text-primary"
                  disabled={selectedBlockIds.length === 0}
                />
                <span className={`font-medium ${selectedBlockIds.length === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
                  選択ブロックのみエクスポート {selectedBlockIds.length > 0 && `(${selectedBlockIds.length}個)`}
                </span>
              </label>

              {/* クリップボードに出力 */}
              <label className="flex items-center space-x-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={exportToClipboard}
                  onChange={e => setExportToClipboard(e.target.checked)}
                  className="text-primary"
                />
                <span className="font-medium text-foreground">
                  クリップボードに出力(Ctrl+Vで貼り付け)
                </span>
              </label>

              {/* グループごとにエクスポートオプション */}
              <label className="flex items-center space-x-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={useGroupExport}
                  onChange={(e) => setUseGroupExport(e.target.checked)}
                  className="text-primary"
                />
                <span className="font-medium text-foreground">
                  グループごとにエクスポート
                </span>
              </label>

              {/* グループ選択 */}
              {useGroupExport && (
                <div className="mb-4 border border text-foreground-muted rounded-lg p-2">                  
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
                  
                  <div className="max-h-40 overflow-y-auto text-foreground-muted rounded p-2 space-y-1">
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
              } else if (exportType === 'full' || exportType === 'serif-only') {
                handleExport(exportType as 'full' | 'serif-only', includeTogaki);
              }
            }}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-semibold"
          >
            {exportToClipboard ? 'クリップボードに出力' : 'エクスポート'}
          </button>
        </div>
      </div>
    </div>
  );
} 