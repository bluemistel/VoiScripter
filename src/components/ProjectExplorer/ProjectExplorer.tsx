'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  CollisionDetection,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  XMarkIcon,
  FolderPlusIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  FolderIcon,
  FolderOpenIcon,
  PencilIcon,
  TrashIcon,
  ArrowRightCircleIcon,
} from '@heroicons/react/24/outline';
import DialogFrame from '@/components/common/DialogFrame';
import { ExplorerFolder, ExplorerNode, ExplorerTreeData } from '@/types';
import {
  buildTreeNodes,
  collectFolderContents,
  isDescendantFolder,
  validateProjectName,
  validateFolderName,
} from '@/utils/explorerTree';
import { ProjectExplorerHook } from '@/hooks/useProjectExplorer';
import { ExplorerTreeList, MenuTarget } from './ExplorerRows';
import {
  NameInputDialog,
  DeleteProjectConfirmDialog,
  DeleteFolderConfirmDialog,
  MoveToFolderDialog,
  FolderOption,
} from './ExplorerDialogs';

type SubDialog =
  | { kind: 'newProject'; folderId: string | null }
  | { kind: 'newFolder'; parentId: string | null }
  | { kind: 'renameProject'; projectId: string }
  | { kind: 'renameFolder'; folder: ExplorerFolder }
  | { kind: 'deleteProject'; projectId: string }
  | { kind: 'deleteFolder'; folder: ExplorerFolder }
  | { kind: 'moveProject'; projectId: string }
  | { kind: 'moveFolder'; folder: ExplorerFolder };

interface MenuState {
  target: MenuTarget;
  position: { left: number; top: number };
}

interface ActiveDrag {
  type: 'project' | 'folder';
  id: string;
  name: string;
}

interface ProjectExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  projectList: string[];
  currentProjectId: string;
  explorer: ProjectExplorerHook;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string, folderId: string | null) => void;
  onRenameProject: (oldId: string, newName: string) => void;
  onDeleteProject: (projectId: string) => void;
  onDeleteFolderRecursive: (folderId: string) => void;
}

const MENU_WIDTH = 200;
const MENU_ITEM_HEIGHT = 38;

// ソート済みフォルダ一覧をインデント付きでフラット化（移動先選択用）
const flattenFolders = (tree: ExplorerTreeData): { folder: ExplorerFolder; depth: number }[] => {
  const result: { folder: ExplorerFolder; depth: number }[] = [];
  const walk = (nodes: ExplorerNode[], depth: number) => {
    for (const node of nodes) {
      if (node.type === 'folder') {
        result.push({ folder: node.folder, depth });
        walk(node.children, depth + 1);
      }
    }
  };
  walk(buildTreeNodes(tree, []), 0);
  return result;
};

// ルートよりフォルダ行を優先するカスタム衝突判定
const explorerCollisionDetection: CollisionDetection = (args) => {
  const collisions = pointerWithin(args);
  const folderHits = collisions.filter((c) => String(c.id).startsWith('folder:'));
  return folderHits.length > 0 ? folderHits : collisions;
};

function ExplorerBody({
  nodes,
  ...rest
}: {
  nodes: ExplorerNode[];
  currentProjectId: string;
  expandedFolderIds: Set<string>;
  onToggleFolder: (folderId: string) => void;
  onSelectProject: (projectId: string) => void;
  onOpenMenu: (anchor: DOMRect, target: MenuTarget) => void;
  dropTargetFolderId: string | null;
  isDragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'root' });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto p-2 ${rest.isDragging && isOver && rest.dropTargetFolderId === null ? 'bg-primary/5' : ''}`}
    >
      {nodes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">プロジェクトがありません</p>
      ) : (
        <ExplorerTreeList nodes={nodes} depth={0} {...rest} />
      )}
      {rest.isDragging && (
        <div className="mx-2 mt-3 mb-1 p-3 border-2 border-dashed rounded-lg text-xs text-muted-foreground text-center">
          ここにドロップでルート（最上位）へ移動
        </div>
      )}
    </div>
  );
}

export default function ProjectExplorer({
  isOpen,
  onClose,
  projectList,
  currentProjectId,
  explorer,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onDeleteFolderRecursive,
}: ProjectExplorerProps) {
  const [subDialog, setSubDialog] = useState<SubDialog | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const autoExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { tree, expandedFolderIds, toggleFolderExpanded, setFolderExpanded } = explorer;

  // 開くたびに最新ツリーを読み込み（クラウド同期などの変更を反映）
  useEffect(() => {
    if (isOpen) {
      explorer.reloadTree();
      setSubDialog(null);
      setMenu(null);
    }
  }, [isOpen]);

  const nodes = useMemo(() => buildTreeNodes(tree, projectList), [tree, projectList]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const clearAutoExpandTimer = () => {
    if (autoExpandTimerRef.current) {
      clearTimeout(autoExpandTimerRef.current);
      autoExpandTimerRef.current = null;
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { type: 'project' | 'folder'; projectId?: string; folderId?: string } | undefined;
    if (!data) return;
    setMenu(null);
    if (data.type === 'project' && data.projectId) {
      setActiveDrag({ type: 'project', id: data.projectId, name: data.projectId });
    } else if (data.type === 'folder' && data.folderId) {
      const folder = tree.folders.find((f) => f.id === data.folderId);
      setActiveDrag({ type: 'folder', id: data.folderId, name: folder?.name ?? '' });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over ? String(event.over.id) : null;
    const folderId = overId?.startsWith('folder:') ? overId.slice('folder:'.length) : null;

    // 自分自身・子孫フォルダはドロップ先として表示しない
    const isInvalidFolderTarget =
      folderId !== null &&
      activeDrag?.type === 'folder' &&
      isDescendantFolder(tree, activeDrag.id, folderId);

    const effectiveTarget = isInvalidFolderTarget ? null : folderId;
    setDropTargetFolderId(effectiveTarget);

    // 折りたたまれたフォルダに0.6秒ホバーで自動展開
    clearAutoExpandTimer();
    if (effectiveTarget && !expandedFolderIds.has(effectiveTarget)) {
      autoExpandTimerRef.current = setTimeout(() => {
        setFolderExpanded(effectiveTarget, true);
      }, 600);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    clearAutoExpandTimer();
    setDropTargetFolderId(null);
    const drag = activeDrag;
    setActiveDrag(null);
    if (!drag || !event.over) return;

    const overId = String(event.over.id);
    const targetFolderId = overId.startsWith('folder:') ? overId.slice('folder:'.length) : overId === 'root' ? null : undefined;
    if (targetFolderId === undefined) return;

    if (drag.type === 'project') {
      const currentLocation = tree.projectLocations[drag.id] ?? null;
      if (currentLocation === targetFolderId) return;
      explorer.moveProject(drag.id, targetFolderId);
    } else {
      if (targetFolderId !== null && isDescendantFolder(tree, drag.id, targetFolderId)) return;
      const folder = tree.folders.find((f) => f.id === drag.id);
      if (!folder || folder.parentId === targetFolderId) return;
      explorer.moveFolder(drag.id, targetFolderId);
    }
  };

  const handleDragCancel = () => {
    clearAutoExpandTimer();
    setDropTargetFolderId(null);
    setActiveDrag(null);
  };

  const openMenu = (anchor: DOMRect, target: MenuTarget) => {
    const itemCount = 4;
    const estHeight = itemCount * MENU_ITEM_HEIGHT + 16;
    const left = Math.max(8, Math.min(anchor.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const top =
      anchor.bottom + estHeight > window.innerHeight - 8
        ? Math.max(8, anchor.top - estHeight)
        : anchor.bottom + 4;
    setMenu({ target, position: { left, top } });
  };

  // Esc/外側クリック: メニュー → サブダイアログ → 本体 の順で1段ずつ閉じる
  const handleCancel = () => {
    if (menu) {
      setMenu(null);
      return;
    }
    if (subDialog) return; // サブダイアログ側のDialogFrameが自分で閉じる
    onClose();
  };

  const siblingFolderNames = (parentId: string | null, excludeId?: string) =>
    tree.folders.filter((f) => f.parentId === parentId && f.id !== excludeId).map((f) => f.name);

  // 移動先フォルダ選択肢を構築
  const buildMoveOptions = (target: SubDialog & ({ kind: 'moveProject' } | { kind: 'moveFolder' })): FolderOption[] => {
    const flat = flattenFolders(tree);
    if (target.kind === 'moveProject') {
      const currentLocation = tree.projectLocations[target.projectId] ?? null;
      return [
        { id: null, name: 'ルート（最上位）', depth: 0, disabled: currentLocation === null },
        ...flat.map(({ folder, depth }) => ({
          id: folder.id as string | null,
          name: folder.name,
          depth: depth + 1,
          disabled: folder.id === currentLocation,
        })),
      ];
    }
    return [
      { id: null, name: 'ルート（最上位）', depth: 0, disabled: target.folder.parentId === null },
      ...flat.map(({ folder, depth }) => ({
        id: folder.id as string | null,
        name: folder.name,
        depth: depth + 1,
        disabled:
          folder.id === target.folder.parentId ||
          isDescendantFolder(tree, target.folder.id, folder.id),
      })),
    ];
  };

  const menuItems = menu
    ? menu.target.type === 'project'
      ? [
          {
            label: '開く',
            icon: <DocumentTextIcon className="w-4 h-4" />,
            onClick: () => onSelectProject((menu.target as { type: 'project'; projectId: string }).projectId),
          },
          {
            label: '名前を変更',
            icon: <PencilIcon className="w-4 h-4" />,
            onClick: () => setSubDialog({ kind: 'renameProject', projectId: (menu.target as { type: 'project'; projectId: string }).projectId }),
          },
          {
            label: 'フォルダへ移動…',
            icon: <ArrowRightCircleIcon className="w-4 h-4" />,
            onClick: () => setSubDialog({ kind: 'moveProject', projectId: (menu.target as { type: 'project'; projectId: string }).projectId }),
          },
          {
            label: '削除',
            icon: <TrashIcon className="w-4 h-4" />,
            danger: true,
            onClick: () => setSubDialog({ kind: 'deleteProject', projectId: (menu.target as { type: 'project'; projectId: string }).projectId }),
          },
        ]
      : [
          {
            label: '名前を変更',
            icon: <PencilIcon className="w-4 h-4" />,
            onClick: () => setSubDialog({ kind: 'renameFolder', folder: (menu.target as { type: 'folder'; folder: ExplorerFolder }).folder }),
          },
          {
            label: 'プロジェクトを作成',
            icon: <DocumentPlusIcon className="w-4 h-4" />,
            onClick: () => setSubDialog({ kind: 'newProject', folderId: (menu.target as { type: 'folder'; folder: ExplorerFolder }).folder.id }),
          },
          {
            label: 'サブフォルダを作成',
            icon: <FolderPlusIcon className="w-4 h-4" />,
            onClick: () => setSubDialog({ kind: 'newFolder', parentId: (menu.target as { type: 'folder'; folder: ExplorerFolder }).folder.id }),
          },
          {
            label: 'フォルダへ移動…',
            icon: <ArrowRightCircleIcon className="w-4 h-4" />,
            onClick: () => setSubDialog({ kind: 'moveFolder', folder: (menu.target as { type: 'folder'; folder: ExplorerFolder }).folder }),
          },
          {
            label: '削除',
            icon: <TrashIcon className="w-4 h-4" />,
            danger: true,
            onClick: () => setSubDialog({ kind: 'deleteFolder', folder: (menu.target as { type: 'folder'; folder: ExplorerFolder }).folder }),
          },
        ]
    : [];

  const deleteFolderContents =
    subDialog?.kind === 'deleteFolder'
      ? collectFolderContents(tree, subDialog.folder.id, projectList)
      : null;

  return (
    <>
      <DialogFrame
        isOpen={isOpen}
        onCancel={handleCancel}
        enableEnterShortcut={false}
        panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-2xl mx-4 flex flex-col h-[80vh] max-h-[640px] overflow-hidden"
      >
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-foreground">新しい台本</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSubDialog({ kind: 'newProject', folderId: null })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              title="新しい台本を作成"
            >
              <DocumentPlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">新しい台本</span>
            </button>
            <button
              onClick={() => setSubDialog({ kind: 'newFolder', parentId: null })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg text-foreground hover:bg-accent transition-colors"
              title="新しいフォルダを作成"
            >
              <FolderPlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">フォルダ</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-accent rounded-lg transition-colors ml-1"
              title="閉じる"
            >
              <XMarkIcon className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={explorerCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <ExplorerBody
            nodes={nodes}
            currentProjectId={currentProjectId}
            expandedFolderIds={expandedFolderIds}
            onToggleFolder={toggleFolderExpanded}
            onSelectProject={onSelectProject}
            onOpenMenu={openMenu}
            dropTargetFolderId={dropTargetFolderId}
            isDragging={activeDrag !== null}
          />
          <DragOverlay>
            {activeDrag && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-popover border shadow-lg opacity-90">
                {activeDrag.type === 'folder' ? (
                  <FolderIcon className="w-5 h-5 text-secondary" />
                ) : (
                  <DocumentTextIcon className="w-5 h-5 text-primary" />
                )}
                <span className="text-foreground truncate max-w-[200px]">{activeDrag.name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </DialogFrame>

      {/* ケバブメニュー */}
      {isOpen && menu && (
        <>
          <div className="fixed inset-0 z-[60]" onPointerDown={() => setMenu(null)} />
          <div
            className="fixed z-[61] bg-popover border rounded-lg shadow-lg py-1"
            style={{ left: menu.position.left, top: menu.position.top, width: MENU_WIDTH }}
          >
            {menuItems.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  setMenu(null);
                  item.onClick();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${
                  'danger' in item && item.danger ? 'text-destructive' : 'text-foreground'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* サブダイアログ群 */}
      <NameInputDialog
        isOpen={subDialog?.kind === 'newProject'}
        title="新しいプロジェクト"
        label="プロジェクト名"
        placeholder="プロジェクト名を入力"
        submitButtonText="作成"
        validate={(name) => validateProjectName(name, projectList)}
        onSubmit={(name) => {
          const folderId = subDialog?.kind === 'newProject' ? subDialog.folderId : null;
          onCreateProject(name, folderId);
        }}
        onClose={() => setSubDialog(null)}
      />
      <NameInputDialog
        isOpen={subDialog?.kind === 'newFolder'}
        title="新しいフォルダ"
        label="フォルダ名"
        placeholder="フォルダ名を入力"
        submitButtonText="作成"
        validate={(name) =>
          validateFolderName(name, siblingFolderNames(subDialog?.kind === 'newFolder' ? subDialog.parentId : null))
        }
        onSubmit={(name) => {
          if (subDialog?.kind === 'newFolder') explorer.createFolder(subDialog.parentId, name);
        }}
        onClose={() => setSubDialog(null)}
      />
      <NameInputDialog
        isOpen={subDialog?.kind === 'renameProject'}
        title="プロジェクト名の変更"
        label="プロジェクト名"
        placeholder="新しいプロジェクト名"
        submitButtonText="変更"
        initialValue={subDialog?.kind === 'renameProject' ? subDialog.projectId : ''}
        validate={(name) => {
          const oldId = subDialog?.kind === 'renameProject' ? subDialog.projectId : '';
          if (name === oldId) return '名前が変更されていません';
          return validateProjectName(name, projectList.filter((p) => p !== oldId));
        }}
        onSubmit={(name) => {
          if (subDialog?.kind === 'renameProject') onRenameProject(subDialog.projectId, name);
        }}
        onClose={() => setSubDialog(null)}
      />
      <NameInputDialog
        isOpen={subDialog?.kind === 'renameFolder'}
        title="フォルダ名の変更"
        label="フォルダ名"
        placeholder="新しいフォルダ名"
        submitButtonText="変更"
        initialValue={subDialog?.kind === 'renameFolder' ? subDialog.folder.name : ''}
        validate={(name) => {
          if (subDialog?.kind !== 'renameFolder') return null;
          if (name.trim() === subDialog.folder.name) return '名前が変更されていません';
          return validateFolderName(name, siblingFolderNames(subDialog.folder.parentId, subDialog.folder.id));
        }}
        onSubmit={(name) => {
          if (subDialog?.kind === 'renameFolder') explorer.renameFolder(subDialog.folder.id, name);
        }}
        onClose={() => setSubDialog(null)}
      />
      <DeleteProjectConfirmDialog
        isOpen={subDialog?.kind === 'deleteProject'}
        projectId={subDialog?.kind === 'deleteProject' ? subDialog.projectId : ''}
        isCurrent={subDialog?.kind === 'deleteProject' && subDialog.projectId === currentProjectId}
        onConfirm={() => {
          if (subDialog?.kind === 'deleteProject') onDeleteProject(subDialog.projectId);
        }}
        onClose={() => setSubDialog(null)}
      />
      <DeleteFolderConfirmDialog
        isOpen={subDialog?.kind === 'deleteFolder'}
        folderName={subDialog?.kind === 'deleteFolder' ? subDialog.folder.name : ''}
        childFolderNames={
          deleteFolderContents
            ? deleteFolderContents.folderIds
                .map((id) => tree.folders.find((f) => f.id === id)?.name ?? '')
                .filter(Boolean)
            : []
        }
        childProjectIds={deleteFolderContents?.projectIds ?? []}
        onConfirm={() => {
          if (subDialog?.kind === 'deleteFolder') onDeleteFolderRecursive(subDialog.folder.id);
        }}
        onClose={() => setSubDialog(null)}
      />
      {(subDialog?.kind === 'moveProject' || subDialog?.kind === 'moveFolder') && (
        <MoveToFolderDialog
          isOpen
          targetName={
            subDialog.kind === 'moveProject' ? subDialog.projectId : subDialog.folder.name
          }
          options={buildMoveOptions(subDialog)}
          onMove={(folderId) => {
            if (subDialog.kind === 'moveProject') {
              explorer.moveProject(subDialog.projectId, folderId);
            } else {
              explorer.moveFolder(subDialog.folder.id, folderId);
            }
          }}
          onClose={() => setSubDialog(null)}
        />
      )}
    </>
  );
}
