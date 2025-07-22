'use client';

import { useState } from 'react';
import { Character } from '@/types';

interface CSVExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Character[];
  groups: string[];
  onExportCSV: () => void;
  onExportSerifOnly: () => void;
  onExportByGroups: (selectedGroups: string[], exportType: 'full' | 'serif-only') => void;
  onExportCharacterCSV: () => void;
}

export default function CSVExportDialog({
  isOpen,
  onClose,
  characters,
  groups,
  onExportCSV,
  onExportSerifOnly,
  onExportByGroups,
  onExportCharacterCSV
}: CSVExportDialogProps) {
  type ExportType = 'full' | 'serif-only' | 'character-setting';
  const [exportType, setExportType] = useState<ExportType>('full');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [useGroupExport, setUseGroupExport] = useState(false);

  const handleGroupToggle = (group: string) => {
    setSelectedGroups(prev => 
      prev.includes(group) 
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  const handleExport = (exportType: 'full' | 'serif-only') => {
    if (useGroupExport && selectedGroups.length > 0) {
      onExportByGroups(selectedGroups, exportType);
    } else if (!useGroupExport) {
      if (exportType === 'full') {
        onExportCSV();
      } else {
        onExportSerifOnly();
      }
    }
    onClose();
  };

  const handleClose = () => {
    setSelectedGroups([]);
    setUseGroupExport(false);
    setExportType('full');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6 transition-opacity duration-300">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-foreground">CSVエクスポート</h3>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground text-2xl"
            title="閉じる"
          >
            ×
          </button>
        </div>

        {/* エクスポートタイプ選択 */}
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
            <span className="text-foreground mb-2 font-semibold">台本のエクスポート</span>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="exportType"
                value="full"
                checked={exportType === 'full'}
                onChange={(e) => setExportType(e.target.value as ExportType)}
                className="text-primary"
              />
              <span className="text-foreground">CSVエクスポート（話者, セリフ）</span>
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
              <span className="text-foreground">セリフだけエクスポート</span>
            </label>
          </div>
        </div>

        {/* グループエクスポートオプション */}
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useGroupExport}
            onChange={(e) => setUseGroupExport(e.target.checked)}
            className="text-primary"
            disabled={exportType === 'character-setting'}
          />
          <span className="text-foreground font-medium">グループごとにエクスポート</span>
        </label>

        {/* グループ選択 */}
        {useGroupExport && exportType !== 'character-setting' && (
          <div className="mb-4">
            <h4 className="font-medium text-foreground mb-2">エクスポートするグループを選択</h4>
            <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
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

        {/* エクスポートボタン */}
        <div className="flex flex-col space-y-2 mt-4">
          <button
            onClick={() => {
              if (exportType === 'character-setting') {
                onExportCharacterCSV();
                handleClose();
              } else if (exportType === 'full' || exportType === 'serif-only') {
                handleExport(exportType as 'full' | 'serif-only');
              }
            }}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-semibold"
          >
            エクスポート
          </button>
        </div>
      </div>
    </div>
  );
} 