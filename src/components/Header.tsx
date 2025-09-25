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
  PlusIcon,
  TrashIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CharacterManager from './CharacterManager';
import Settings from './Settings';
import CSVExportDialog from './CSVExportDialog';
import { Character, Project, Scene } from '@/types';

// ロゴパスを取得するカスタムフック
const useLogoPath = () => {
  const [logoPath, setLogoPath] = useState('./rogo.png');

  useEffect(() => {
    // Electron環境でロゴパスを取得
    if (typeof window !== 'undefined' && window.getLogoPath) {
      setLogoPath(window.getLogoPath());
    }
  }, []);

  return logoPath;
};

// ソート可能なシーンタブコンポーネント
function SortableSceneTab({ 
  scene, 
  isSelected, 
  onSelect, 
  onRename, 
  onDelete, 
  children 
}: {
  scene: Scene;
  isSelected: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  // ドラッグ状態を管理
  const [isDragStarted, setIsDragStarted] = useState(false);
  const [mouseDownTime, setMouseDownTime] = useState<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setMouseDownTime(Date.now());
    setIsDragStarted(false);
  };

  const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
    const currentTime = Date.now();
    const timeDiff = mouseDownTime ? currentTime - mouseDownTime : 0;
    
    // ドラッグが開始されていない、かつ短時間のクリック/タップの場合のみシーン切り替え
    if (!isDragStarted && timeDiff < 200) {
      onSelect();
    }
    
    setMouseDownTime(null);
    setIsDragStarted(false);
  };

  const handleDragStart = () => {
    setIsDragStarted(true);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, minWidth: 100, maxWidth: 120 }}
      className={`relative rounded text-foreground text-sm font-medium mr-1 whitespace-nowrap flex-shrink-0 group ${isSelected ? 'bg-secondary text-secondary-foreground' : 'bg-muted hover:bg-accent'}`}
    >
      {/* ドラッグ可能なメイン領域 */}
      <div
        className="px-4 py-1 cursor-pointer flex items-center"
        {...attributes}
        {...listeners}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onDragStart={handleDragStart}
        onDoubleClick={onRename}
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap block max-w-[80px]" title={scene.name}>
          {scene.name}
        </span>
      </div>
      
      {/* ×ボタン領域（ドラッグイベントを無効化） */}
      <div className="absolute right-0 top-0 bottom-0 w-6 flex items-center justify-center">
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          onMouseDown={e => { e.stopPropagation(); }}
          onMouseUp={e => { e.stopPropagation(); }}
          onTouchStart={e => { e.stopPropagation(); }}
          onTouchEnd={e => { e.stopPropagation(); }}
          className="p-1 rounded hover:bg-destructive/20 text-destructive sm:hidden sm:group-hover:inline-block md:hidden md:group-hover:inline-block inline-block"
          title="シーンを削除"
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}

interface HeaderProps {
  characters: Character[];
  onAddCharacter: (character: Character) => void;
  onUpdateCharacter: (character: Character) => void;
  onDeleteCharacter: (id: string) => void;
  onThemeChange: (isDark: boolean) => void;
  onExportCSV: (includeTogaki?: boolean, selectedOnly?: boolean, fileFormat?: 'csv' | 'txt') => void;
  onExportSerifOnly: (selectedOnly?: boolean, fileFormat?: 'csv' | 'txt', includeTogaki?: boolean) => void;
  onExportCharacterCSV: () => void;
  onExportByGroups: (selectedGroups: string[], exportType: 'full' | 'serif-only', includeTogaki?: boolean, selectedOnly?: boolean, sceneIds?: string[], fileFormat?: 'csv' | 'txt') => void;
  onExportToClipboard: (serifOnly?: boolean, selectedOnly?: boolean, includeTogaki?: boolean) => void;
  onExportProjectJson: () => void;
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
  onReorderScenes?: (newOrder: Scene[]) => void;
  onExportSceneCSV: (sceneIds: string[], exportType: 'full' | 'serif-only', includeTogaki: boolean, selectedOnly: boolean, fileFormat?: 'csv' | 'txt') => void;
  onNewProject: () => void;
  project: Project;
  onOpenSettings: () => void;
  projectList: string[];
  onProjectChange: (projectId: string) => void;
  onDeleteProject: () => void;
  getCharacterProjectStates: (currentProjectId: string, projectList?: string[]) => {[characterId: string]: boolean};
  saveCharacterProjectStates: (currentProjectId: string, characterStates: {[characterId: string]: boolean}, projectList?: string[]) => void;
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
    onExportProjectJson,
    onImportCSV,
    onImportCharacterCSV,
    onImportJson,
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
    onReorderScenes,
    onExportSceneCSV,
    onNewProject,
    project,
    onOpenSettings,
    projectList,
    onProjectChange,
    onDeleteProject,
    getCharacterProjectStates,
    saveCharacterProjectStates
  } = props;
  const logoPath = useLogoPath();
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [isCSVExportDialogOpen, setIsCSVExportDialogOpen] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportChoiceDialogOpen, setIsImportChoiceDialogOpen] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File|null>(null);
  const [pendingImportType, setPendingImportType] = useState<'script'|'character'|null>(null);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  
  const importMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // シーンのドラッグ&ドロップ用センサー（タッチデバイス対応）
  const sceneSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    })
  );
  
  // シーンの並び替えハンドラー
  const handleSceneDragStart = (event: DragStartEvent) => {
    // ドラッグ開始時の処理
    //console.log('Drag started:', event.active.id);
  };

  const handleSceneDragEnd = (event: DragEndEvent) => {
    if (!onReorderScenes) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex(s => s.id === active.id);
      const newIndex = scenes.findIndex(s => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...scenes];
        const [removed] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, removed);
        onReorderScenes(newOrder);
      }
    }
  };

  // メニュー外クリックでメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
        setIsImportMenuOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
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
        
        // 1列目の1カラム目が「ID」または2カラム目が「名前」ならキャラクター設定のインポート
        const isCharacterImport = firstColumn === 'ID' || firstColumn === '名前' || firstLine.split(',')[1]?.trim() === '名前';
        
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

  // シーン名変更用state
  const [isRenameSceneDialogOpen, setIsRenameSceneDialogOpen] = useState(false);
  const [renameTargetSceneId, setRenameTargetSceneId] = useState<string | null>(null);
  const [renameSceneName, setRenameSceneName] = useState('');
  const [renameSceneError, setRenameSceneError] = useState('');

  // シーン削除用state
  const [isDeleteSceneDialogOpen, setIsDeleteSceneDialogOpen] = useState(false);
  const [deleteTargetSceneId, setDeleteTargetSceneId] = useState<string | null>(null);
  const [deleteTargetSceneName, setDeleteTargetSceneName] = useState('');

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
    <header className="bg-background shadow-sm  sticky top-0 z-50 border-b">
      {/* 上部ヘッダー（スクロールで非表示） */}
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <h1 className="text-2xl font-bold text-primary tracking-tight flex items-center">
          <img src={logoPath} alt="VoiScripter" className="hidden sm:block h-8 mr-2" />
          <div className="ml-2 text-lg font-normal text-foreground align-middle group relative">
            <select
              value={projectName}
              onChange={(e) => onProjectChange(e.target.value)}
              className="bg-background border-none text-foreground cursor-pointer hover:bg-accent rounded px-2 py-1 focus:bg-background focus:outline-none max-w-[200px] truncate"
              title={projectName}
            >
              {projectList.filter(projectId => projectId !== 'default').map(projectId => (
                <option key={projectId} value={projectId}>
                  {projectId}
                </option>
              ))}
            </select>
          </div>
          {/* プロジェクト操作ボタン */}
          <div className="flex items-center space-x-1 ml-2">
            <button
              onClick={() => setIsRenameDialogOpen(true)}
              className="p-1 text-primary hover:bg-accent rounded-lg transition"
              title="プロジェクト名を変更"
            >
              <PencilIcon className="w-7 h-7" />
            </button>
            <button
              onClick={onNewProject}
              className="p-1 text-primary hover:bg-accent rounded-lg transition"
              title="新しいプロジェクト"
            >
              <DocumentTextIcon className="w-7 h-7"/>
            </button>
            <button
              onClick={onDeleteProject}
              className="p-1 text-destructive hover:bg-destructive/10 rounded-lg transition"
              title="プロジェクトを削除"
            >
              <TrashIcon className="w-7 h-7" />
            </button>
          </div>
        </h1>
        {/* Desktop menu - hidden on mobile */}
        <div className="hidden md:flex items-center space-x-2">
          <button
            onClick={() => setIsCSVExportDialogOpen(true)}
            className="p-1 text-primary hover:bg-accent rounded-lg transition"
            title="エクスポート"
          >
            <ArrowUpTrayIcon className="w-7 h-7"/>
          </button>
          <div className="relative" ref={importMenuRef}>
            <button
              onClick={() => setIsImportMenuOpen(v => !v)}
              className="p-1 text-primary hover:bg-accent rounded-lg transition"
              title="インポート"
            >
              <ArrowDownTrayIcon className="w-7 h-7"/>
            </button>
            {isImportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-popover border rounded-lg shadow-lg z-50">
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
            className="p-1 text-primary hover:bg-accent rounded-lg transition"
            title="キャラクター設定"
          >
            <UsersIcon className="w-7 h-7" />
          </button>
          <button
            onClick={toggleTheme}
            className="p-1 text-primary hover:bg-accent rounded-lg transition"
            title="ダークモード切替"
          >
            {isDarkMode ? (
              <SunIcon className="w-7 h-7" />
            ) : (
              <MoonIcon className="w-7 h-7" />
            )}
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1 text-primary hover:bg-accent rounded-lg transition"
            title="設定"
          >
            <Cog6ToothIcon className="w-7 h-7" />
          </button>
        </div>

        {/* Mobile hamburger menu - visible on mobile only */}
        <div className="md:hidden relative" ref={mobileMenuRef}>
          <button
            onClick={() => setIsMobileMenuOpen(v => !v)}
            className="p-1 text-primary hover:bg-accent rounded-lg transition"
            title="メニュー"
          >
            <Bars3Icon className="w-7 h-7" />
          </button>
          
          {isMobileMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-popover border rounded-lg shadow-lg z-50">
              <button
                onClick={() => {
                  setIsCSVExportDialogOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-3 hover:bg-accent text-foreground"
              >
                <div className="flex items-center space-x-3">
                  <ArrowUpTrayIcon className="w-5 h-5" />
                  <span>エクスポート</span>
                </div>
              </button>
              
              <div className="border-t">
                <label className="block w-full text-left px-4 py-3 hover:bg-accent text-foreground cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    <span>CSVインポート（話者,セリフ）</span>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      handleFileImport(e, 'script');
                      setIsMobileMenuOpen(false);
                    }}
                  />
                </label>
                <label className="block w-full text-left px-4 py-3 hover:bg-accent text-foreground cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    <span>キャラクター設定のインポート</span>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      handleFileImport(e, 'character');
                      setIsMobileMenuOpen(false);
                    }}
                  />
                </label>
                <label className="block w-full text-left px-4 py-3 hover:bg-accent text-foreground cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    <span>プロジェクトのインポート（json）</span>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      handleJsonImport(e);
                      setIsMobileMenuOpen(false);
                    }}
                  />
                </label>
              </div>
              
              <div className="border-t">
                <button
                  onClick={() => {
                    setIsCharacterModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 hover:bg-accent text-foreground"
                >
                  <div className="flex items-center space-x-3">
                    <UsersIcon className="w-5 h-5" />
                    <span>キャラクター設定</span>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    toggleTheme();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 hover:bg-accent text-foreground"
                >
                  <div className="flex items-center space-x-3">
                    {isDarkMode ? (
                      <SunIcon className="w-5 h-5" />
                    ) : (
                      <MoonIcon className="w-5 h-5" />
                    )}
                    <span>ダークモード切替</span>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    onOpenSettings();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 hover:bg-accent text-foreground"
                >
                  <div className="flex items-center space-x-3">
                    <Cog6ToothIcon className="w-5 h-5" />
                    <span>設定</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* 下部ヘッダー（シーンタブ、固定表示） */}
      <div className="sticky top-0 z-40 flex items-center space-x-2 px-4 py-2 border-b bg-background">
        {scenes.length > 1 && (
          <DndContext 
            sensors={sceneSensors} 
            collisionDetection={closestCenter}
            onDragStart={handleSceneDragStart}
            onDragEnd={handleSceneDragEnd}
          >
            <SortableContext 
              items={scenes.map(s => s.id)} 
              strategy={horizontalListSortingStrategy}
            >
              <div
                ref={sceneTabContainerRef}
                className="flex overflow-x-auto no-scrollbar"
              >
                {scenes.map((scene, idx) => (
                  <SortableSceneTab
                    key={scene.id}
                    scene={scene}
                    isSelected={selectedSceneId === scene.id}
                    onSelect={() => onSelectScene(scene.id)}
                    onRename={() => openRenameSceneDialog(scene.id, scene.name)}
                    onDelete={() => openDeleteSceneDialog(scene.id, scene.name)}
                  >
                    {/* childrenは空でOK */}
                  </SortableSceneTab>
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
        <CharacterManager
          isOpen={true}
          onClose={() => setIsCharacterModalOpen(false)}
          characters={characters}
          onAddCharacter={onAddCharacter}
          onUpdateCharacter={onUpdateCharacter}
          onDeleteCharacter={onDeleteCharacter}
          groups={groups}
          onAddGroup={onAddGroup}
          onDeleteGroup={onDeleteGroup}
          onReorderCharacters={onReorderCharacters}
          onReorderGroups={onReorderGroups}
          currentProjectId={project.id} projectList={projectList} getCharacterProjectStates={getCharacterProjectStates} saveCharacterProjectStates={saveCharacterProjectStates}              />
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
        onExportProjectJson={onExportProjectJson}
        project={project}
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