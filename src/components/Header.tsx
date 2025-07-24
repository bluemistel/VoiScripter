'use client';

import { useState, useEffect, useRef } from 'react';
import { SunIcon, MoonIcon, UsersIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, Cog6ToothIcon, PencilIcon } from '@heroicons/react/24/outline';
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
  onImportCSV: (file: File, options?: { mode: 'append' | 'new'; projectName?: string }) => void;
  onImportCharacterCSV: (file: File) => void;
  isDarkMode: boolean;
  saveDirectory: string;
  onSaveDirectoryChange: (directory: string) => void;
  groups: string[];
  onAddGroup: (group: string) => void;
  onDeleteGroup: (group: string) => void;
  onReorderCharacters?: (newOrder: Character[]) => void;
  onReorderGroups?: (newOrder: string[]) => void;
  projectName: string;
  onRenameProject: (newName: string) => void;
}

// CSVインポート時の選択ダイアログ
function ImportChoiceDialog({ isOpen, onClose, onImportToCurrent, onImportToNew }: { isOpen: boolean, onClose: () => void, onImportToCurrent: () => void, onImportToNew: (name: string) => void }) {
  const [newProjectName, setNewProjectName] = useState('');
  useEffect(() => {
    if (!isOpen) setNewProjectName('');
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">CSVインポート先の選択</h3>
        <div className="space-y-4">
          <button onClick={() => { setNewProjectName(''); onImportToCurrent(); }} className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-semibold">現在のプロジェクトに追加</button>
          <div>
            <div className="mb-2 text-foreground">新しいプロジェクトを作成してインポート</div>
            <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="プロジェクト名" className="w-full p-2 border rounded mb-2" />
            <button onClick={() => { onImportToNew(newProjectName); setNewProjectName(''); }} disabled={!newProjectName.trim()} className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 font-semibold disabled:opacity-50">新規作成してインポート</button>
          </div>
        </div>
        <button onClick={() => { setNewProjectName(''); onClose(); }} className="absolute top-2 right-4 text-2xl text-muted-foreground hover:text-foreground">×</button>
      </div>
    </div>
  );
}

// プロジェクト名変更ダイアログ
function ProjectRenameDialog({ isOpen, onClose, currentName, onRename }: { isOpen: boolean, onClose: () => void, currentName: string, onRename: (newName: string) => void }) {
  const [newName, setNewName] = useState(currentName);
  useEffect(() => { setNewName(currentName); }, [currentName, isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">プロジェクト名の変更</h3>
        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-2 border rounded mb-4" />
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 text-muted-foreground hover:bg-accent rounded">キャンセル</button>
          <button onClick={() => { onRename(newName); onClose(); }} disabled={!newName.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-semibold disabled:opacity-50">変更</button>
        </div>
      </div>
    </div>
  );
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
  onReorderGroups,
  projectName,
  onRenameProject
}: HeaderProps) {
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [isCSVExportDialogOpen, setIsCSVExportDialogOpen] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportChoiceDialogOpen, setIsImportChoiceDialogOpen] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File|null>(null);
  const [pendingImportType, setPendingImportType] = useState<'script'|'character'|null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  
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
      setPendingImportFile(file);
      setPendingImportType(type);
      setIsImportChoiceDialogOpen(true);
      setIsImportMenuOpen(false);
    }
    event.target.value = '';
  };

  return (
    <header className="bg-background shadow-sm sticky top-0 z-50 border-b">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <h1 className="text-2xl font-bold text-primary tracking-tight ">
          VoiScripter.
          <span className="ml-4 pr-6 text-lg font-normal text-foreground align-middle group relative">
            {projectName}
            <button
              onClick={() => setIsRenameDialogOpen(true)}
              className="ml-2 p-1 rounded hover:bg-accent align-middle hidden group-hover:inline-block absolute top-1/2 -translate-y-1/2"
              title="プロジェクト名を変更"
            >
              <PencilIcon className="w-5 h-5 inline-block" />
            </button>
          </span>
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
          <div className="bg-card border rounded-lg p-6 w-full max-w-3xl mx-4 shadow-xl transition-opacity duration-300">
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
      <ImportChoiceDialog
         isOpen={isImportChoiceDialogOpen && !!pendingImportFile && !!pendingImportType}
         onClose={() => {
           setIsImportChoiceDialogOpen(false);
           setPendingImportFile(null);
           setPendingImportType(null);
         }}
         onImportToCurrent={() => {
           if (pendingImportFile && pendingImportType === 'script') {
             onImportCSV(pendingImportFile, { mode: 'append' });
           } else if (pendingImportFile && pendingImportType === 'character') {
             onImportCharacterCSV(pendingImportFile);
           }
           setIsImportChoiceDialogOpen(false);
           setPendingImportFile(null);
           setPendingImportType(null);
         }}
         onImportToNew={(name) => {
           if (pendingImportFile && pendingImportType === 'script') {
             onImportCSV(pendingImportFile, { mode: 'new', projectName: name });
           } else if (pendingImportFile && pendingImportType === 'character') {
             onImportCharacterCSV(pendingImportFile);
           }
           setIsImportChoiceDialogOpen(false);
           setPendingImportFile(null);
           setPendingImportType(null);
         }}
       />
      <ProjectRenameDialog
        isOpen={isRenameDialogOpen}
        onClose={() => setIsRenameDialogOpen(false)}
        currentName={projectName}
        onRename={onRenameProject}
      />
    </header>
  );
}