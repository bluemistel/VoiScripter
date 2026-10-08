'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import { 
  ArrowUpTrayIcon, 
  ArrowDownTrayIcon, 
  UsersIcon, 
  SunIcon, 
  MoonIcon, 
  Cog6ToothIcon,
  Bars3Icon,
  PlusIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  CloudArrowUpIcon,
  FolderIcon,
  ChevronDownIcon,
  ChatBubbleBottomCenterTextIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  Modifier
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
import { Character, Project, Scene, GroupCredits } from '@/types';
import DialogFrame from '@/components/common/DialogFrame';
import DialogHeader from '@/components/common/DialogHeader';
import Button from '@/components/common/Button';
import { nextCopyName } from '@/utils/duplicateNaming';

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

/**
 * シーンタブのドラッグを横方向だけにし、タブ列（タブの親要素）の幅の中に収める。
 * 縦に動かしたり、タブ列の外へ持ち出したりして他のタブが画面外へずれないようにする。
 */
const restrictSceneTabDrag: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
  const restricted = { ...transform, y: 0 };
  if (!draggingNodeRect || !containerNodeRect) return restricted;
  const minX = containerNodeRect.left - draggingNodeRect.left;
  const maxX = containerNodeRect.right - draggingNodeRect.right;
  return { ...restricted, x: Math.min(Math.max(transform.x, minX), maxX) };
};

// ソート可能なシーンタブコンポーネント
function SortableSceneTab({
  scene,
  isSelected,
  onSelect,
  onRename,
  onDelete,
  isBlockDropTarget = false,
  children
}: {
  scene: Scene;
  isSelected: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  isBlockDropTarget?: boolean;
  children?: ReactNode;
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
    // 幅の違うタブと入れ替わるときの拡大縮小（scale）は使わず、移動だけにする。
    // scale がかかるとタブが横長になり、タブ列のはみ出しが広がって右へ際限なく動けてしまう
    transform: CSS.Translate.toString(transform),
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
      style={{ ...style, maxWidth: 120 }}
      data-scene-id={scene.id}
      // アクティブタブはエディタのキャンバスと同じ面にして地続きに見せ、上辺にアクセント罫を引く
      className={`relative shrink-0 rounded-t-xl text-[13px] whitespace-nowrap group transition-colors ${
        isSelected
          ? 'bg-canvas text-fg font-bold shadow-[inset_0_3px_0_var(--color-primary)]'
          : 'text-fg-sub hover:bg-well'
      } ${isBlockDropTarget ? 'ring-2 ring-inset ring-primary/60 bg-primary-tint' : ''}`}
    >
      {/* ドラッグ可能なメイン領域 */}
      <div
        // モバイルは×が常時出るため右側を少し広く取る。
        // 長押しで並び替えるため、文字選択・長押しメニューは出さない
        className={`pl-5 pr-6 sm:pr-5 ${isSelected ? 'py-2' : 'py-[7px]'} cursor-pointer flex items-center focus:outline-none select-none [-webkit-touch-callout:none]`}
        {...attributes}
        {...listeners}
        // dnd-kit のセンサー（listeners）の開始処理を上書きしないよう、両方呼ぶ
        onMouseDown={(e) => { listeners?.onMouseDown?.(e); handleMouseDown(e); }}
        onMouseUp={handleMouseUp}
        onTouchStart={(e) => { listeners?.onTouchStart?.(e); handleMouseDown(e); }}
        onTouchEnd={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={handleDragStart}
        onDoubleClick={onRename}
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap block max-w-[80px]" title={scene.name}>
          {scene.name}
        </span>
      </div>
      
      {/* ×ボタン領域（ドラッグイベントを無効化） */}
      <div className="absolute right-0.5 top-0 bottom-0 flex items-center justify-center">
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          onMouseDown={e => { e.stopPropagation(); }}
          onMouseUp={e => { e.stopPropagation(); }}
          onTouchStart={e => { e.stopPropagation(); }}
          onTouchEnd={e => { e.stopPropagation(); }}
          className="size-4 rounded-full items-center justify-center text-fg-faint hover:text-destructive hover:bg-destructive-tint sm:hidden sm:group-hover:flex md:hidden md:group-hover:flex flex"
          title="シーンを削除"
        >
          <XMarkIcon className="size-3" strokeWidth={2.5} />
        </button>
      </div>
      {children}
    </div>
  );
}

/** ヘッダー右側のアイコンボタン。開いている機能だけ primary-tint の面を敷く */
function HeaderIconButton({
  onClick,
  title,
  active = false,
  className = 'size-9',
  children
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  /** 大きさの上書き（モバイルのハンバーガーは44pxのタップ領域） */
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`${className} shrink-0 rounded-[10px] flex items-center justify-center text-primary transition-colors [&>svg]:size-5.5 ${
        active ? 'bg-primary-tint' : 'hover:bg-field'
      }`}
      title={title}
    >
      {children}
    </button>
  );
}

/** ドロップダウンメニューの面（枠線を使わず、ヘアラインのリングと落ち影で浮かせる） */
const MENU_PANEL_CLASS = 'bg-panel rounded-xl ring-1 ring-hairline shadow-(--shadow-popover) py-1 overflow-hidden';

interface HeaderProps {
  characters: Character[];
  onAddCharacter: (character: Character) => void;
  onUpdateCharacter: (character: Character) => void;
  onDeleteCharacter: (id: string) => void;
  onThemeChange: (isDark: boolean) => void;
  onExportCSV: (includeTogaki?: boolean, selectedOnly?: boolean, fileFormat?: 'csv' | 'txt', includeUserPreset?: boolean) => void;
  onExportSerifOnly: (selectedOnly?: boolean, fileFormat?: 'csv' | 'txt', includeTogaki?: boolean, includeUserPreset?: boolean) => void;
  onExportCharacterCSV: () => void;
  onExportByGroups: (selectedGroups: string[], exportType: 'full' | 'serif-only', includeTogaki?: boolean, selectedOnly?: boolean, sceneIds?: string[], fileFormat?: 'csv' | 'txt', includeUserPreset?: boolean) => void;
  onExportToClipboard: (serifOnly?: boolean, selectedOnly?: boolean, includeTogaki?: boolean) => void;
  onExportProjectJson: () => void;
  onExportPresetSeparator: (separator: string, includeTogaki: boolean, selectedOnly: boolean, fileFormat: 'csv' | 'txt', useGroupExport: boolean, selectedGroups: string[], useSceneExport: boolean, sceneIds: string[]) => void;
  onImportCSV: (file: File, options?: { mode: 'append' | 'new'; projectName?: string }) => void;
  onImportCharacterCSV: (file: File) => void;
  onImportJson: (file: File) => void;
  isDarkMode: boolean;
  saveDirectory: string;
  onSaveDirectoryChange: (directory: string) => void;
  groups: string[];
  onAddGroup: (group: string) => void;
  onDeleteGroup: (group: string) => void;
  onRenameGroup?: (oldName: string, newName: string) => boolean;
  groupCredits: GroupCredits;
  onSetGroupCredit: (group: string, credit: string) => void;
  onReorderCharacters?: (newOrder: Character[]) => void;
  onReorderGroups?: (newOrder: string[]) => void;
  projectName: string;
  onOpenProjectExplorer: () => void;
  selectedBlockIds: string[];
  scenes: Scene[];
  selectedSceneId: string | null;
  onAddScene: (name: string) => void;
  /** 表示中のシーンを複製して追加する */
  onDuplicateScene: (sceneId: string, name: string) => void;
  onRenameScene: (sceneId: string, newName: string) => void;
  onDeleteScene: (sceneId: string) => void;
  onSelectScene: (sceneId: string) => void;
  onReorderScenes?: (newOrder: Scene[]) => void;
  onExportSceneCSV: (sceneIds: string[], exportType: 'full' | 'serif-only', includeTogaki: boolean, selectedOnly: boolean, fileFormat?: 'csv' | 'txt', includeUserPreset?: boolean) => void;
  onNewProject: () => void;
  project: Project;
  onOpenSettings: () => void;
  projectList: string[];
  getCharacterProjectStates: (currentProjectId: string, projectList?: string[]) => {[characterId: string]: boolean};
  saveCharacterProjectStates: (currentProjectId: string, characterStates: {[characterId: string]: boolean}, projectList?: string[]) => void;
  onOpenSearch: () => void;
  onOpenDataSync: () => void;
  onOpenScriptView: () => void;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  showLatestDownloadMenu?: boolean;
  onOpenLatestDownload?: () => void;
  blockDropTargetSceneId?: string | null;
  /** 開いている機能のアイコンを強調するための状態（page 側で管理しているもの） */
  isSearchOpen?: boolean;
  isScriptViewOpen?: boolean;
  isDataSyncOpen?: boolean;
  isSettingsDialogOpen?: boolean;
}

// CSVインポート時の選択ダイアログ
function ImportChoiceDialog({ isOpen, onClose, onImportToCurrent, onImportToNew }: { isOpen: boolean, onClose: () => void, onImportToCurrent: () => void, onImportToNew: (name: string) => void }) {
  const [newProjectName, setNewProjectName] = useState('');
  const handleCancel = () => {
    setNewProjectName('');
    onClose();
  };
  useEffect(() => {
    if (!isOpen) setNewProjectName('');
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={handleCancel}
      panelClassName="w-full max-w-md mx-4"
    >
        <DialogHeader icon={ArrowDownTrayIcon} title="CSVインポート先の選択" onClose={handleCancel} />
        <div className="px-5 pb-5 space-y-5">
          <Button variant="secondary-outline" className="w-full" onClick={() => { setNewProjectName(''); onImportToCurrent(); }}>
            現在のプロジェクトのシーンに追加
          </Button>
          <div>
            <div className="text-[14.5px] font-bold text-fg mb-2.5">新しいプロジェクトを作成してインポート</div>
            <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="プロジェクト名" className="ui-input w-full mb-2.5" />
            <Button variant="primary" className="w-full" onClick={() => { onImportToNew(newProjectName); setNewProjectName(''); }} disabled={!newProjectName.trim()}>
              新規作成してインポート
            </Button>
          </div>
        </div>
    </DialogFrame>
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
    onRenameGroup,
    groupCredits,
    onSetGroupCredit,
    onReorderCharacters,
    onReorderGroups,
    projectName,
    onOpenProjectExplorer,
    selectedBlockIds,
    scenes,
    selectedSceneId,
    onAddScene,
    onDuplicateScene,
    onRenameScene,
    onDeleteScene,
    onSelectScene,
    onReorderScenes,
    onExportSceneCSV,
    onExportPresetSeparator,
    onNewProject,
    project,
    onOpenSettings,
    projectList,
    getCharacterProjectStates,
    saveCharacterProjectStates,
    onOpenSearch,
    onOpenDataSync,
    onOpenScriptView,
    onNotification,
    showLatestDownloadMenu = false,
    onOpenLatestDownload,
    blockDropTargetSceneId = null,
    isSearchOpen = false,
    isScriptViewOpen = false,
    isDataSyncOpen = false,
    isSettingsDialogOpen = false
  } = props;
  const logoPath = useLogoPath();

  // 台本全体（全シーン）の台詞の合計文字数（ト書き・改行を除く）
  const totalScriptChars = useMemo(() => {
    let total = 0;
    project?.scenes?.forEach(scene => {
      scene.scripts.forEach(script => {
        script.blocks.forEach(block => {
          if (block.characterId) total += block.text.replace(/\n/g, '').length;
        });
      });
    });
    return total;
  }, [project]);

  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [isCSVExportDialogOpen, setIsCSVExportDialogOpen] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportChoiceDialogOpen, setIsImportChoiceDialogOpen] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File|null>(null);
  const [pendingImportType, setPendingImportType] = useState<'script'|'character'|null>(null);
  
  const importMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // シーンのドラッグ&ドロップ用センサー。
  // タッチは長押し（250ms）で並び替え、すばやいスワイプはタブ列の横スクロールにする。
  // PointerSensor はタッチにも反応してスクロールと競合するため、マウスとタッチを分けて扱う。
  const sceneSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
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
  // 空のシーンを追加するか、表示中のシーンを複製するか
  const [addSceneMode, setAddSceneMode] = useState<'empty' | 'duplicate'>('empty');
  const currentScene = scenes.find(s => s.id === selectedSceneId) ?? null;
  const copySceneName = currentScene ? nextCopyName(currentScene.name, scenes.map(s => s.name)) : '';

  const closeAddSceneDialog = () => {
    setIsAddSceneDialogOpen(false);
    setSceneError('');
    setNewSceneName('');
    setAddSceneMode('empty');
  };

  // 複製を選んだら、名前が未入力か自動入力のままのときだけ「元の名前 (1)」を入れる
  const changeAddSceneMode = (mode: 'empty' | 'duplicate') => {
    setAddSceneMode(mode);
    setSceneError('');
    if (mode === 'duplicate' && !newSceneName.trim()) {
      setNewSceneName(copySceneName);
    } else if (mode === 'empty' && newSceneName === copySceneName) {
      setNewSceneName('');
    }
  };

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
    if (addSceneMode === 'duplicate' && currentScene) {
      onDuplicateScene(currentScene.id, newSceneName.trim());
    } else {
      onAddScene(newSceneName.trim());
    }
    closeAddSceneDialog();
  };

  return (
    <header className="bg-panel shadow-[0_1px_0_var(--color-hairline)] sticky top-0 z-50">
      {/* 上部ヘッダー（スクロールで非表示） */}
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-15">
        <h1 className="flex items-center gap-2.5 min-w-0">
          <img src={logoPath} alt="VoiScripter" className="hidden sm:block h-8" />
          <button
            onClick={onOpenProjectExplorer}
            className="flex items-center gap-[7px] min-w-0 px-3 py-1.5 rounded-full text-fg cursor-pointer transition-colors hover:bg-field"
            title="プロジェクトを開く"
          >
            <FolderIcon className="size-4.5 shrink-0 text-secondary" />
            <span className="max-w-[200px] truncate text-[15px] font-medium">{projectName}</span>
            <ChevronDownIcon className="size-[13px] shrink-0 opacity-50" />
          </button>
          {/* 新しいプロジェクトはよく使うため、モバイルでもメニューに畳まずヘッダーに出す（タップ領域44px） */}
          <span className="flex shrink-0">
            <HeaderIconButton onClick={onNewProject} title="新しいプロジェクト" className="size-11 md:size-9">
              <DocumentTextIcon />
            </HeaderIconButton>
          </span>
          <span
            className="hidden sm:inline text-[11px] text-fg-faint whitespace-nowrap select-none"
            title="台本全体の文字数（全シーンの台詞の合計。ト書き・改行は含みません）"
          >
            {totalScriptChars.toLocaleString()}字
          </span>
        </h1>
        {/* Desktop menu - hidden on mobile */}
        <div className="hidden md:flex items-center gap-0.5">
          <HeaderIconButton
            onClick={() => setIsCSVExportDialogOpen(true)}
            title="エクスポート"
            active={isCSVExportDialogOpen}
          >
            <ArrowUpTrayIcon />
          </HeaderIconButton>
          <div className="relative" ref={importMenuRef}>
            <HeaderIconButton
              onClick={() => setIsImportMenuOpen(v => !v)}
              title="インポート"
              active={isImportMenuOpen}
            >
              <ArrowDownTrayIcon />
            </HeaderIconButton>
            {isImportMenuOpen && (
              <div className={`absolute right-0 mt-2 w-60 z-50 ${MENU_PANEL_CLASS}`}>
                <label className="block w-full text-left px-4 py-2 text-[13.5px] hover:bg-field text-fg cursor-pointer">
                  CSVインポート（話者,セリフ）
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => handleFileImport(e, 'script')}
                  />
                </label>
                <label className="block w-full text-left px-4 py-2 text-[13.5px] hover:bg-field text-fg cursor-pointer">
                  キャラクター設定のインポート
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => handleFileImport(e, 'character')}
                  />
                </label>
                <label className="block w-full text-left px-4 py-2 text-[13.5px] hover:bg-field text-fg cursor-pointer">
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
          <HeaderIconButton onClick={onOpenSearch} title="検索 (Ctrl+F)" active={isSearchOpen}>
            <MagnifyingGlassIcon />
          </HeaderIconButton>
          <HeaderIconButton
            onClick={onOpenScriptView}
            title="ビュー（チャット / キャラ台詞）"
            active={isScriptViewOpen}
          >
            <ChatBubbleBottomCenterTextIcon />
          </HeaderIconButton>
          <HeaderIconButton
            onClick={() => setIsCharacterModalOpen(true)}
            title="キャラクター設定"
            active={isCharacterModalOpen}
          >
            <UsersIcon />
          </HeaderIconButton>
          <HeaderIconButton onClick={toggleTheme} title="ダークモード切替">
            {isDarkMode ? <SunIcon /> : <MoonIcon />}
          </HeaderIconButton>
          <HeaderIconButton onClick={onOpenDataSync} title="データ同期" active={isDataSyncOpen}>
            <CloudArrowUpIcon />
          </HeaderIconButton>
          {showLatestDownloadMenu && (
            <button
              onClick={onOpenLatestDownload}
              className="h-8 px-3 mx-1 text-xs font-bold text-primary-text bg-field rounded-full transition-shadow hover:shadow-[inset_0_0_0_1.5px_var(--color-hairline)]"
              title="最新版のダウンロード案内"
            >
              最新版のDL
            </button>
          )}
          <HeaderIconButton onClick={onOpenSettings} title="設定" active={isSettingsDialogOpen}>
            <Cog6ToothIcon />
          </HeaderIconButton>
        </div>

        {/* Mobile hamburger menu - visible on mobile only */}
        <div className="md:hidden relative" ref={mobileMenuRef}>
          <HeaderIconButton
            onClick={() => setIsMobileMenuOpen(v => !v)}
            title="メニュー"
            active={isMobileMenuOpen}
            className="size-11"
          >
            <Bars3Icon />
          </HeaderIconButton>

          {isMobileMenuOpen && (
            <div className={`absolute right-0 mt-2 w-72 z-50 ${MENU_PANEL_CLASS}`}>
              <button
                onClick={() => {
                  setIsCSVExportDialogOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-3 text-[13.5px] hover:bg-field text-fg"
              >
                <div className="flex items-center space-x-3">
                  <ArrowUpTrayIcon className="size-5 text-primary-text" />
                  <span>エクスポート</span>
                </div>
              </button>
              
              <div className="mt-1 pt-1 shadow-[0_-1px_0_var(--color-hairline)]">
                <label className="block w-full text-left px-4 py-3 text-[13.5px] hover:bg-field text-fg cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <ArrowDownTrayIcon className="size-5 text-primary-text" />
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
                <label className="block w-full text-left px-4 py-3 text-[13.5px] hover:bg-field text-fg cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <ArrowDownTrayIcon className="size-5 text-primary-text" />
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
                <label className="block w-full text-left px-4 py-3 text-[13.5px] hover:bg-field text-fg cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <ArrowDownTrayIcon className="size-5 text-primary-text" />
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
              
              <div className="mt-1 pt-1 shadow-[0_-1px_0_var(--color-hairline)]">
                <button
                  onClick={() => {
                    onOpenSearch();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-[13.5px] hover:bg-field text-fg"
                >
                  <div className="flex items-center space-x-3">
                    <MagnifyingGlassIcon className="size-5 text-primary-text" />
                    <span>検索</span>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    onOpenScriptView();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-[13.5px] hover:bg-field text-fg"
                >
                  <div className="flex items-center space-x-3">
                    <ChatBubbleBottomCenterTextIcon className="size-5 text-primary-text" />
                    <span>ビュー（チャット / キャラ台詞）</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsCharacterModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-[13.5px] hover:bg-field text-fg"
                >
                  <div className="flex items-center space-x-3">
                    <UsersIcon className="size-5 text-primary-text" />
                    <span>キャラクター設定</span>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    toggleTheme();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-[13.5px] hover:bg-field text-fg"
                >
                  <div className="flex items-center space-x-3">
                    {isDarkMode ? (
                      <SunIcon className="size-5 text-primary-text" />
                    ) : (
                      <MoonIcon className="size-5 text-primary-text" />
                    )}
                    <span>ダークモード切替</span>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    onOpenDataSync();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-[13.5px] hover:bg-field text-fg"
                >
                  <div className="flex items-center space-x-3">
                    <CloudArrowUpIcon className="size-5 text-primary-text" />
                    <span>データ同期</span>
                  </div>
                </button>
                {showLatestDownloadMenu && (
                  <button
                    onClick={() => {
                      onOpenLatestDownload?.();
                      setIsMobileMenuOpen(false);
                    }}
                    className="block w-full text-left px-4 py-3 text-[13.5px] hover:bg-field text-fg"
                  >
                    <div className="flex items-center space-x-3">
                      <DocumentTextIcon className="size-5 text-primary-text" />
                      <span>最新版のDL</span>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => {
                    onOpenSettings();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-[13.5px] hover:bg-field text-fg"
                >
                  <div className="flex items-center space-x-3">
                    <Cog6ToothIcon className="size-5 text-primary-text" />
                    <span>設定</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* 下部ヘッダー（シーンタブ、固定表示） */}
      {/* タブ行はヘッダーと同じ面。アクティブタブだけキャンバス色にして下のエディタとつなげる */}
      <div className="sticky top-0 z-40 flex items-end gap-[3px] px-4 min-h-8">
        {scenes.length > 1 && (
          <DndContext 
            sensors={sceneSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictSceneTabDrag]}
            // 自動スクロールは使わない。スクロール量は modifiers の制限の後に足されるため、
            // ページやタブ列が流れるとタブが縦方向・タブ列の外へ際限なく動いてしまう
            autoScroll={false}
            onDragStart={handleSceneDragStart}
            onDragEnd={handleSceneDragEnd}
          >
            <SortableContext 
              items={scenes.map(s => s.id)} 
              strategy={horizontalListSortingStrategy}
            >
              <div
                ref={sceneTabContainerRef}
                className="flex items-end gap-[3px] overflow-x-auto no-scrollbar"
              >
                {scenes.map((scene, idx) => (
                  <SortableSceneTab
                    key={scene.id}
                    scene={scene}
                    isSelected={selectedSceneId === scene.id}
                    onSelect={() => onSelectScene(scene.id)}
                    onRename={() => openRenameSceneDialog(scene.id, scene.name)}
                    onDelete={() => openDeleteSceneDialog(scene.id, scene.name)}
                    isBlockDropTarget={blockDropTargetSceneId === scene.id}
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
            className="size-6.5 shrink-0 mb-[5px] ml-1 rounded-full flex items-center justify-center text-fg-faint transition-colors hover:bg-field hover:text-fg"
            title="シーンを追加"
          >
            <PlusIcon className="size-[15px]" strokeWidth={2} />
          </button>
        )}
      </div>
      {/* シーン追加ダイアログ */}
      {isAddSceneDialogOpen && (
        <DialogFrame
          isOpen={isAddSceneDialogOpen}
          onCancel={closeAddSceneDialog}
          panelClassName="w-full max-w-md mx-4"
        >
            <DialogHeader icon={PlusIcon} title="シーンを追加" onClose={closeAddSceneDialog} />
            <div className="px-5 pb-5">
              {/* タブ行にボタンを増やさず、複製もここから選べるようにする（モバイルでも押しやすい） */}
              {currentScene && (
                <div className="space-y-1 mb-3" role="radiogroup" aria-label="追加の方法">
                  <label className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl cursor-pointer text-[13.5px] text-fg hover:bg-field">
                    <input
                      type="radio"
                      name="add-scene-mode"
                      className="ui-radio"
                      checked={addSceneMode === 'empty'}
                      onChange={() => changeAddSceneMode('empty')}
                    />
                    空のシーン
                  </label>
                  <label className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl cursor-pointer text-[13.5px] text-fg hover:bg-field min-w-0">
                    <input
                      type="radio"
                      name="add-scene-mode"
                      className="ui-radio"
                      checked={addSceneMode === 'duplicate'}
                      onChange={() => changeAddSceneMode('duplicate')}
                    />
                    <span className="truncate">表示中のシーン「{currentScene.name}」を複製</span>
                  </label>
                </div>
              )}
              <input
                type="text"
                value={newSceneName}
                onChange={e => { setNewSceneName(e.target.value); setSceneError(''); }}
                className="ui-input w-full"
                placeholder="シーン名"
                autoFocus
              />
              {sceneError && <p className="text-xs text-destructive mt-2">{sceneError}</p>}
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="secondary" onClick={closeAddSceneDialog}>キャンセル</Button>
                <Button variant="primary" onClick={handleAddSceneLocal}>OK</Button>
              </div>
            </div>
        </DialogFrame>
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
          onRenameGroup={onRenameGroup}
          groupCredits={groupCredits}
          onSetGroupCredit={onSetGroupCredit}
          onReorderCharacters={onReorderCharacters}
          onReorderGroups={onReorderGroups}
          currentProjectId={project.id} projectList={projectList} getCharacterProjectStates={getCharacterProjectStates} saveCharacterProjectStates={saveCharacterProjectStates}              />
      )}
      {isSettingsOpen && (
        <Settings
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          saveDirectory={saveDirectory}
          onSaveDirectoryChange={onSaveDirectoryChange}
        />
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
        onExportPresetSeparator={onExportPresetSeparator}
        project={project}
        groupCredits={groupCredits}
        onNotification={onNotification}
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
      {/* シーン名変更ダイアログ */}
      {isRenameSceneDialogOpen && (
        <DialogFrame
          isOpen={isRenameSceneDialogOpen}
          onCancel={() => { setIsRenameSceneDialogOpen(false); setRenameSceneError(''); }}
          panelClassName="w-full max-w-md mx-4"
        >
            <DialogHeader icon={PencilSquareIcon} title="シーン名の変更" onClose={() => { setIsRenameSceneDialogOpen(false); setRenameSceneError(''); }} />
            <div className="px-5 pb-5">
              <input
                type="text"
                value={renameSceneName}
                onChange={e => { setRenameSceneName(e.target.value); setRenameSceneError(''); }}
                className="ui-input w-full"
                placeholder="新しいシーン名"
                autoFocus
              />
              {renameSceneError && <p className="text-xs text-destructive mt-2">{renameSceneError}</p>}
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="secondary" onClick={() => { setIsRenameSceneDialogOpen(false); setRenameSceneError(''); }}>キャンセル</Button>
                <Button variant="primary" onClick={handleRenameSceneLocal}>変更</Button>
              </div>
            </div>
        </DialogFrame>
      )}
      {/* シーン削除ダイアログ */}
      {isDeleteSceneDialogOpen && (
        <DialogFrame
          isOpen={isDeleteSceneDialogOpen}
          onCancel={() => setIsDeleteSceneDialogOpen(false)}
          panelClassName="w-full max-w-md mx-4"
        >
            <DialogHeader icon={TrashIcon} title="シーンの削除" onClose={() => setIsDeleteSceneDialogOpen(false)} />
            <div className="px-5 pb-5">
              <p className="text-[13.5px] text-fg leading-relaxed">「{deleteTargetSceneName}」を削除しますか？<br/>この操作は元に戻せません。</p>
              <div className="flex justify-end gap-2 mt-5">
                <Button variant="secondary" onClick={() => setIsDeleteSceneDialogOpen(false)}>キャンセル</Button>
                <Button variant="destructive" onClick={handleDeleteSceneLocal}>削除</Button>
              </div>
            </div>
        </DialogFrame>
      )}
    </header>
  );
}