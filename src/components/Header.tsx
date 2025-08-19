'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowUpTrayIcon, 
  ArrowDownTrayIcon, 
  UsersIcon, 
  SunIcon, 
  MoonIcon, 
  Cog6ToothIcon,
  PencilIcon,
  Bars3Icon,
  PlusIcon
} from '@heroicons/react/24/outline';
import CharacterManager from './CharacterManager';
import Settings from './Settings';
import CSVExportDialog from './CSVExportDialog';
import { Character, Project, Scene } from '@/types';

// ロゴパスを取得するカスタムフック
const useLogoPath = () => {
  const [logoPath, setLogoPath] = useState('/rogo.png');

  useEffect(() => {
    // Electron環境でロゴパスを取得
    if (typeof window !== 'undefined' && window.getLogoPath) {
      setLogoPath(window.getLogoPath());
    }
  }, []);

  return logoPath;
};

interface HeaderProps {
  characters: Character[];
  onAddCharacter: (character: Character) => void;
  onUpdateCharacter: (character: Character) => void;
  onDeleteCharacter: (id: string) => void;
  onThemeChange: (isDark: boolean) => void;
  onExportCSV: (includeTogaki?: boolean, selectedOnly?: boolean) => void;
  onExportSerifOnly: (selectedOnly?: boolean) => void;
  onExportCharacterCSV: () => void;
  onExportByGroups: (selectedGroups: string[], exportType: 'full' | 'serif-only', includeTogaki?: boolean, selectedOnly?: boolean) => void;
  onExportToClipboard: (serifOnly?: boolean, selectedOnly?: boolean, includeTogaki?: boolean) => void;
  onImportCSV: (file: File, options?: { mode: 'append' | 'new'; projectName?: string }) => void;
  onImportCharacterCSV: (file: File) => void;
  onImportJson: (file: File) => void;
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
  selectedBlockIds: string[];
  scenes: Scene[];
  selectedSceneId: string | null;
  onAddScene: (name: string) => void;
  onRenameScene: (sceneId: string, newName: string) => void;
  onDeleteScene: (sceneId: string) => void;
  onSelectScene: (sceneId: string) => void;
  onExportSceneCSV: (sceneIds: string[], exportType: 'full' | 'serif-only', includeTogaki: boolean, selectedOnly: boolean) => void;
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
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6 relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-foreground">CSVインポート先の選択</h3>
          <button
            onClick={() => { setNewProjectName(''); onClose(); }}
            className="text-muted-foreground hover:text-foreground text-2xl"
            title="キャンセル"
          >
            ×
          </button>
        </div>
        <div className="space-y-4">
          <button onClick={() => { setNewProjectName(''); onImportToCurrent(); }} className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-semibold">現在のプロジェクトのシーンに追加</button>
          <div>
            <div className="mb-2 text-foreground">新しいプロジェクトを作成してインポート</div>
            <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="プロジェクト名" className="w-full p-2 border rounded mb-2" />
            <button onClick={() => { onImportToNew(newProjectName); setNewProjectName(''); }} disabled={!newProjectName.trim()} className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 font-semibold disabled:opacity-50">新規作成してインポート</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// プロジェクト名変更ダイアログ
function ProjectRenameDialog({ isOpen, onClose, currentName, onRename }: { isOpen: boolean, onClose: () => void, currentName: string, onRename: (newName: string) => void }) {
  const [newName, setNewName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => { 
    setNewName(currentName); 
  }, [currentName, isOpen]);
  
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // ダイアログが開いた時にフォーカスを設定
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">プロジェクト名の変更</h3>
        <input 
          ref={inputRef}
          type="text" 
          value={newName} 
          onChange={e => setNewName(e.target.value)} 
          className="w-full p-2 border rounded mb-4" 
        />
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 text-muted-foreground hover:bg-accent rounded">キャンセル</button>
          <button onClick={() => { onRename(newName); onClose(); }} disabled={!newName.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-semibold disabled:opacity-50">変更</button>
        </div>
      </div>
    </div>
  );
}

export default function Header(props: HeaderProps) {
  const {
    characters,
    onAddCharacter,
    onUpdateCharacter,
    onDeleteCharacter,
    onThemeChange,
    onExportCSV,
    onExportSerifOnly,
    onExportCharacterCSV,
    onExportByGroups,
    onExportToClipboard,
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
    onRenameProject,
    selectedBlockIds,
    scenes,
    selectedSceneId,
    onAddScene,
    onRenameScene,
    onDeleteScene,
    onSelectScene,
    onImportJson,
    onExportSceneCSV
  } = props;
  const logoPath = useLogoPath();
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

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>, type: 'script' | 'character') => {
    const file = event.target.files?.[0];
    if (file) {
      // ファイルの内容を読み込んでヘッダー行をチェック
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        const firstLine = lines[0] || '';
        const firstColumn = firstLine.split(',')[0]?.trim() || '';
        
        // 1列目の1カラム目が「名前」ならキャラクター設定のインポート
        const isCharacterImport = firstColumn === '名前';
        
        if (isCharacterImport) {
          // キャラクター設定のインポート
          onImportCharacterCSV(file);
        } else {
          // 台本のインポート
          setPendingImportFile(file);
          setPendingImportType('script');
          setIsImportChoiceDialogOpen(true);
          setIsImportMenuOpen(false);
        }
      } catch (error) {
        console.error('ファイル読み込みエラー:', error);
        alert('ファイルの読み込みに失敗しました。');
      }
    }
    event.target.value = '';
  };

  // シーン管理用state（仮実装）
  // const [scenes, setScenes] = useState<Scene[]>([]); // 削除
  // const [isAddSceneDialogOpen, setIsAddSceneDialogOpen] = useState(false); // 削除
  // const [newSceneName, setNewSceneName] = useState(''); // 削除
  // const [sceneError, setSceneError] = useState(''); // 削除

  // シーン名変更用state
  const [isRenameSceneDialogOpen, setIsRenameSceneDialogOpen] = useState(false);
  const [renameTargetSceneId, setRenameTargetSceneId] = useState<string | null>(null);
  const [renameSceneName, setRenameSceneName] = useState('');
  const [renameSceneError, setRenameSceneError] = useState('');

  // シーン削除用state
  const [isDeleteSceneDialogOpen, setIsDeleteSceneDialogOpen] = useState(false);
  const [deleteTargetSceneId, setDeleteTargetSceneId] = useState<string | null>(null);
  const [deleteTargetSceneName, setDeleteTargetSceneName] = useState('');

  // シーン追加ハンドラ
  // const handleAddScene = () => { // 削除
  //   if (!newSceneName.trim()) { // 削除
  //     setSceneError('シーン名を入力してください'); // 削除
  //     return; // 削除
  //   } // 削除
  //   if (scenes.length >= 30) { // 削除
  //     setSceneError('シーンは最大30個までです'); // 削除
  //     return; // 削除
  //   } // 削除
  //   if (scenes.some(s => s.name === newSceneName.trim())) { // 削除
  //     setSceneError('同名のシーンが既に存在します'); // 削除
  //     return; // 削除
  //   } // 削除
  //   setScenes([...scenes, { id: Date.now().toString(), name: newSceneName.trim(), scripts: [] }]); // 削除
  //   setNewSceneName(''); // 削除
  //   setSceneError(''); // 削除
  //   setIsAddSceneDialogOpen(false); // 削除
  // }; // 削除

  // シーン名変更ダイアログを開く
  const openRenameSceneDialog = (sceneId: string, currentName: string) => {
    setRenameTargetSceneId(sceneId);
    setRenameSceneName(currentName);
    setRenameSceneError('');
    setIsRenameSceneDialogOpen(true);
  };
  // シーン名変更処理
  const handleRenameSceneLocal = () => {
    if (!renameSceneName.trim()) {
      setRenameSceneError('シーン名を入力してください');
      return;
    }
    if (scenes.some(s => s.name === renameSceneName.trim() && s.id !== renameTargetSceneId)) {
      setRenameSceneError('同名のシーンが既に存在します');
      return;
    }
    if (renameTargetSceneId) {
      onRenameScene(renameTargetSceneId, renameSceneName.trim());
    }
    setIsRenameSceneDialogOpen(false);
    setRenameTargetSceneId(null);
    setRenameSceneName('');
    setRenameSceneError('');
  };

  // シーン削除ダイアログを開く
  const openDeleteSceneDialog = (sceneId: string, sceneName: string) => {
    setDeleteTargetSceneId(sceneId);
    setDeleteTargetSceneName(sceneName);
    setIsDeleteSceneDialogOpen(true);
  };
  // シーン削除処理
  const handleDeleteSceneLocal = () => {
    if (deleteTargetSceneId) {
      onDeleteScene(deleteTargetSceneId);
    }
    setIsDeleteSceneDialogOpen(false);
    setDeleteTargetSceneId(null);
    setDeleteTargetSceneName('');
  };

  // シーンタブの横スクロール用ref
  const sceneTabContainerRef = useRef<HTMLDivElement>(null);

  // マウスホイールで横スクロール
  useEffect(() => {
    const container = sceneTabContainerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [scenes.length]);

  // 表示できる最大タブ数を計算（最大12個）
  const [maxVisibleTabs, setMaxVisibleTabs] = useState(12);
  useEffect(() => {
    const updateMaxTabs = () => {
      // 1タブ約120px+余白で計算
      const width = window.innerWidth;
      const tabWidth = 120;
      const margin = 60; // 余白
      const maxTabs = Math.max(1, Math.min(12, Math.floor((width - margin) / tabWidth)));
      setMaxVisibleTabs(maxTabs);
    };
    updateMaxTabs();
    window.addEventListener('resize', updateMaxTabs);
    return () => window.removeEventListener('resize', updateMaxTabs);
  }, []);

  // jsonインポート用ハンドラ
  const handleJsonImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportJson(file);
    }
    event.target.value = '';
  };

  // シーン追加ダイアログ用state
  const [isAddSceneDialogOpen, setIsAddSceneDialogOpen] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [sceneError, setSceneError] = useState('');
  const handleAddSceneLocal = () => {
    if (!newSceneName.trim()) {
      setSceneError('シーン名を入力してください');
      return;
    }
    if (scenes.length >= 30) {
      setSceneError('シーンは最大30個までです');
      return;
    }
    if (scenes.some(s => s.name === newSceneName.trim())) {
      setSceneError('同名のシーンが既に存在します');
      return;
    }
    onAddScene(newSceneName.trim());
    setNewSceneName('');
    setSceneError('');
    setIsAddSceneDialogOpen(false);
  };

  return (
    <header className="bg-background shadow-sm sticky top-0 z-50 border-b">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <h1 className="text-2xl font-bold text-primary tracking-tight flex items-center">
          <img src={logoPath} alt="VoiScripter" className="h-8 mr-2" />
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
                <label className="block w-full text-left px-4 py-2 hover:bg-accent text-foreground cursor-pointer">
                  プロジェクトのインポート（json）
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleJsonImport}
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
      {/* headerとmainの間にシーンタブ＋追加ボタン */}
      <div className="flex items-center space-x-2 px-4 py-2 border-b bg-background">
        {scenes.length > 1 && (
          <div
            ref={sceneTabContainerRef}
            className="flex overflow-x-auto no-scrollbar max-w-full"
            style={{ maxWidth: `calc(${maxVisibleTabs} * 120px)` }}
          >
            {scenes.map((scene, idx) => (
              <div
                key={scene.id}
                className={`relative px-4 py-1 rounded text-foreground text-sm font-medium mr-1 whitespace-nowrap flex-shrink-0 cursor-pointer group ${selectedSceneId === scene.id ? 'bg-secondary text-secondary-foreground' : 'bg-muted hover:bg-accent'}`}
                style={{ minWidth: 100, maxWidth: 120 }}
                onClick={() => onSelectScene(scene.id)}
                onDoubleClick={() => openRenameSceneDialog(scene.id, scene.name)}
              >
                <span className="overflow-hidden text-ellipsis whitespace-nowrap block max-w-[80px]" title={scene.name}>
                  {scene.name}
                </span>
                {/* ×ボタン（ホバー時のみ表示） */}
                <button
                  onClick={e => { e.stopPropagation(); openDeleteSceneDialog(scene.id, scene.name); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-destructive/20 text-destructive hidden group-hover:inline-block"
                  title="シーンを削除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {/* シーン追加ボタン */}
        {scenes.length < 30 && (
          <button
            onClick={() => setIsAddSceneDialogOpen(true)}
            className="p-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition flex-shrink-0"
            title="シーンを追加"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      {/* シーン追加ダイアログ */}
      {isAddSceneDialogOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">シーンを追加</h3>
            <input
              type="text"
              value={newSceneName}
              onChange={e => { setNewSceneName(e.target.value); setSceneError(''); }}
              className="w-full p-2 border rounded mb-2"
              placeholder="シーン名"
              autoFocus
            />
            {sceneError && <p className="text-sm text-destructive mb-2">{sceneError}</p>}
            <div className="flex justify-end space-x-2">
              <button onClick={() => { setIsAddSceneDialogOpen(false); setSceneError(''); setNewSceneName(''); }} className="px-4 py-2 text-muted-foreground hover:bg-accent rounded">キャンセル</button>
              <button onClick={handleAddSceneLocal} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-semibold">OK</button>
            </div>
          </div>
        </div>
      )}
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
        selectedBlockIds={selectedBlockIds}
        onExportCSV={onExportCSV}
        onExportSerifOnly={onExportSerifOnly}
        onExportByGroups={onExportByGroups}
        onExportCharacterCSV={onExportCharacterCSV}
        onExportToClipboard={onExportToClipboard}
        scenes={scenes}
        selectedSceneId={selectedSceneId}
        onExportSceneCSV={onExportSceneCSV}
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
      {/* シーン名変更ダイアログ */}
      {isRenameSceneDialogOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">シーン名の変更</h3>
            <input
              type="text"
              value={renameSceneName}
              onChange={e => { setRenameSceneName(e.target.value); setRenameSceneError(''); }}
              className="w-full p-2 border rounded mb-2"
              placeholder="新しいシーン名"
              autoFocus
            />
            {renameSceneError && <p className="text-sm text-destructive mb-2">{renameSceneError}</p>}
            <div className="flex justify-end space-x-2">
              <button onClick={() => { setIsRenameSceneDialogOpen(false); setRenameSceneError(''); }} className="px-4 py-2 text-muted-foreground hover:bg-accent rounded">キャンセル</button>
              <button onClick={handleRenameSceneLocal} className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-semibold">変更</button>
            </div>
          </div>
        </div>
      )}
      {/* シーン削除ダイアログ */}
      {isDeleteSceneDialogOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">シーンの削除</h3>
            <p className="mb-4 text-foreground">「{deleteTargetSceneName}」を削除しますか？<br/>この操作は元に戻せません。</p>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setIsDeleteSceneDialogOpen(false)} className="px-4 py-2 text-muted-foreground hover:bg-accent rounded">キャンセル</button>
              <button onClick={handleDeleteSceneLocal} className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/80 font-semibold">削除</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}