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
}

export default function CSVExportDialog({
  isOpen,
  onClose,
  characters,
  groups,
  onExportCSV,
  onExportSerifOnly,
  onExportByGroups
}: CSVExportDialogProps) {
  const [exportType, setExportType] = useState<'full' | 'serif-only'>('full');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [useGroupExport, setUseGroupExport] = useState(false);

  const handleGroupToggle = (group: string) => {
    setSelectedGroups(prev => 
      prev.includes(group) 
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  const handleExport = () => {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
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
          <h4 className="font-medium text-foreground mb-2">エクスポートタイプ</h4>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="exportType"
                value="full"
                checked={exportType === 'full'}
                onChange={(e) => setExportType(e.target.value as 'full' | 'serif-only')}
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
                onChange={(e) => setExportType(e.target.value as 'full' | 'serif-only')}
                className="text-primary"
              />
              <span className="text-foreground">セリフだけエクスポート</span>
            </label>
          </div>
        </div>

        {/* グループエクスポートオプション */}
        <div className="mb-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useGroupExport}
              onChange={(e) => setUseGroupExport(e.target.checked)}
              className="text-primary"
            />
            <span className="text-foreground font-medium">グループごとにエクスポート</span>
          </label>
        </div>

        {/* グループ選択 */}
        {useGroupExport && (
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
        <div className="flex justify-end space-x-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded"
          >
            キャンセル
          </button>
          <button
            onClick={handleExport}
            disabled={useGroupExport && selectedGroups.length === 0}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            エクスポート
          </button>
        </div>
      </div>
    </div>
  );
} 