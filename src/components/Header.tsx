'use client';

import { useState, useEffect, useRef } from 'react';
import { SunIcon, MoonIcon, UsersIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import CharacterManager from './CharacterManager';
import Settings from './Settings';
import CSVExportDialog from './CSVExportDialog';
import { Character } from '@/types';

interface HeaderProps {
  characters: Character[];
  onAddCharacter: (character: Character) => void;
  onUpdateCharacter: (character: Character) => void;
  onDeleteCharacter: (id: string) => void;
  onThemeChange: (isDark: boolean) => void;
  onExportCSV: () => void;
  onExportSerifOnly: () => void;
  onExportCharacterCSV: () => void;
  onExportByGroups: (selectedGroups: string[], exportType: 'full' | 'serif-only') => void;
  onImportCSV: (file: File) => void;
  onImportCharacterCSV: (file: File) => void;
  isDarkMode: boolean;
  saveDirectory: string;
  onSaveDirectoryChange: (directory: string) => void;
  groups: string[];
  onAddGroup: (group: string) => void;
  onDeleteGroup: (group: string) => void;
  onReorderCharacters?: (newOrder: Character[]) => void;
  onReorderGroups?: (newOrder: string[]) => void;
}

export default function Header({
  characters,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  onThemeChange,
  onExportCSV,
  onExportSerifOnly,
  onExportCharacterCSV,
  onExportByGroups,
  onImportCSV,
  onImportCharacterCSV,
  isDarkMode,
  saveDirectory,
  onSaveDirectoryChange,
  groups,
  onAddGroup,
  onDeleteGroup,
  onReorderCharacters,
  onReorderGroups
}: HeaderProps) {
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [isCSVExportDialogOpen, setIsCSVExportDialogOpen] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const importMenuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックでメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
        setIsImportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleTheme = () => {
    onThemeChange(!isDarkMode);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>, type: 'script' | 'character') => {
    const file = event.target.files?.[0];
    if (file) {
      if (type === 'script') {
        onImportCSV(file);
      } else {
        onImportCharacterCSV(file);
      }
      setIsImportMenuOpen(false);
    }
    // ファイル選択をリセット
    event.target.value = '';
  };

  return (
    <header className="bg-background shadow-sm sticky top-0 z-50 border-b">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <h1 className="text-2xl font-bold text-primary tracking-tight ">
          VoiScripter.
        </h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsCSVExportDialogOpen(true)}
            className="p-2 text-primary hover:bg-accent rounded-lg transition"
            title="CSVエクスポート"
          >
            <ArrowUpTrayIcon className="w-7 h-7"/>
          </button>
          <div className="relative" ref={importMenuRef}>
            <button
              onClick={() => setIsImportMenuOpen(v => !v)}
              className="p-2 text-primary hover:bg-accent rounded-lg transition"
              title="インポート"
            >
              <ArrowDownTrayIcon className="w-7 h-7"/>
            </button>
            {isImportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-popover border rounded-lg shadow-lg z-10">
                <label className="block w-full text-left px-4 py-2 hover:bg-accent text-foreground cursor-pointer">
                  CSVインポート（話者,セリフ）
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => handleFileImport(e, 'script')}
                  />
                </label>
                <label className="block w-full text-left px-4 py-2 hover:bg-accent text-foreground cursor-pointer">
                  キャラクター設定のインポート
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => handleFileImport(e, 'character')}
                  />
                </label>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsCharacterModalOpen(true)}
            className="p-2 text-primary hover:bg-accent rounded-lg transition"
            title="キャラクター設定"
          >
            <UsersIcon className="w-7 h-7" />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 text-primary hover:bg-accent rounded-lg transition"
            title="ダークモード切替"
          >
            {isDarkMode ? (
              <SunIcon className="w-7 h-7" />
            ) : (
              <MoonIcon className="w-7 h-7" />
            )}
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-primary hover:bg-accent rounded-lg transition"
            title="設定"
          >
            <Cog6ToothIcon className="w-7 h-7" />
          </button>
        </div>
      </div>
      {isCharacterModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 transition-opacity duration-300">
          <div className="bg-card border rounded-lg p-6 w-full max-w-2xl mx-4 shadow-xl transition-opacity duration-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-card-foreground">キャラクター管理</h2>
              <button
                onClick={() => setIsCharacterModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-2xl"
                title="閉じる"
              >
                ×
              </button>
            </div>
            <CharacterManager
              characters={characters}
              onAddCharacter={onAddCharacter}
              onUpdateCharacter={onUpdateCharacter}
              onDeleteCharacter={onDeleteCharacter}
              groups={groups}
              onAddGroup={onAddGroup}
              onDeleteGroup={onDeleteGroup}
              onReorderCharacters={onReorderCharacters}
              onReorderGroups={onReorderGroups}
            />
          </div>
        </div>
      )}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 transition-opacity duration-300">
          <Settings
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            saveDirectory={saveDirectory}
            onSaveDirectoryChange={onSaveDirectoryChange}
          />
        </div>
      )}
      <CSVExportDialog
        isOpen={isCSVExportDialogOpen}
        onClose={() => setIsCSVExportDialogOpen(false)}
        characters={characters}
        groups={groups}
        onExportCSV={onExportCSV}
        onExportSerifOnly={onExportSerifOnly}
        onExportByGroups={onExportByGroups}
        onExportCharacterCSV={onExportCharacterCSV}
      />
    </header>
  );
}