'use client';

import { CSSProperties } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import { ExplorerFolder, ExplorerNode } from '@/types';

export type MenuTarget =
  | { type: 'project'; projectId: string }
  | { type: 'folder'; folder: ExplorerFolder };

interface CommonRowProps {
  depth: number;
  currentProjectId: string;
  expandedFolderIds: Set<string>;
  onToggleFolder: (folderId: string) => void;
  onSelectProject: (projectId: string) => void;
  onOpenMenu: (anchor: DOMRect, target: MenuTarget) => void;
  dropTargetFolderId: string | null;
  isDragging: boolean;
}

const rowBaseClass =
  'group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm select-none cursor-pointer hover:bg-accent transition-colors';

const dropTargetClass = 'ring-2 ring-primary ring-inset bg-primary/10';

function KebabButton({ onOpen }: { onOpen: (anchor: DOMRect) => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onOpen((e.currentTarget as HTMLElement).getBoundingClientRect());
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-muted transition-opacity"
      title="メニュー"
    >
      <EllipsisVerticalIcon className="w-4 h-4 text-foreground" />
    </button>
  );
}

function ProjectRow({
  projectId,
  depth,
  currentProjectId,
  onSelectProject,
  onOpenMenu,
}: { projectId: string } & Pick<CommonRowProps, 'depth' | 'currentProjectId' | 'onSelectProject' | 'onOpenMenu'>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drag-project:${projectId}`,
    data: { type: 'project', projectId },
  });

  const isCurrent = projectId === currentProjectId;
  const style: CSSProperties = {
    paddingLeft: `${8 + depth * 20}px`,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={`${rowBaseClass} ${isCurrent ? 'font-bold' : ''}`}
      onClick={() => onSelectProject(projectId)}
      title={projectId}
    >
      <span className="w-[18px] shrink-0" />
      <DocumentTextIcon className="w-5 h-5 shrink-0 text-primary" />
      <span className="flex-1 truncate text-foreground">{projectId}</span>
      {isCurrent && (
        <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
          編集中
        </span>
      )}
      <KebabButton onOpen={(anchor) => onOpenMenu(anchor, { type: 'project', projectId })} />
    </div>
  );
}

function FolderRow({
  node,
  ...rest
}: { node: Extract<ExplorerNode, { type: 'folder' }> } & CommonRowProps) {
  const { folder, children } = node;
  const { depth, expandedFolderIds, onToggleFolder, onOpenMenu, dropTargetFolderId, isDragging: someDragActive } = rest;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `drag-folder:${folder.id}`,
    data: { type: 'folder', folderId: folder.id },
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `folder:${folder.id}`,
    data: { type: 'folder', folderId: folder.id },
  });

  const isExpanded = expandedFolderIds.has(folder.id);
  const isDropTarget = dropTargetFolderId === folder.id;
  const style: CSSProperties = {
    paddingLeft: `${8 + depth * 20}px`,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div>
      <div
        ref={(el) => {
          setDragRef(el);
          setDropRef(el);
        }}
        {...attributes}
        {...listeners}
        style={style}
        className={`${rowBaseClass} ${isDropTarget ? dropTargetClass : ''}`}
        onClick={() => onToggleFolder(folder.id)}
        title={folder.name}
      >
        <span className="w-[18px] shrink-0 flex items-center justify-center text-muted-foreground">
          {isExpanded ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
        </span>
        {isExpanded ? (
          <FolderOpenIcon className="w-5 h-5 shrink-0 text-secondary" />
        ) : (
          <FolderIcon className="w-5 h-5 shrink-0 text-secondary" />
        )}
        <span className="flex-1 truncate text-foreground">{folder.name}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground opacity-60 group-hover:opacity-0">
          {children.length > 0 ? children.length : ''}
        </span>
        <KebabButton onOpen={(anchor) => onOpenMenu(anchor, { type: 'folder', folder })} />
      </div>
      {isExpanded && !isDragging && (
        <ExplorerTreeList {...rest} nodes={children} depth={depth + 1} isDragging={someDragActive} />
      )}
    </div>
  );
}

export function ExplorerTreeList({
  nodes,
  ...rest
}: { nodes: ExplorerNode[] } & CommonRowProps) {
  return (
    <div>
      {nodes.map((node) =>
        node.type === 'folder' ? (
          <FolderRow key={node.folder.id} node={node} {...rest} />
        ) : (
          <ProjectRow
            key={node.projectId}
            projectId={node.projectId}
            depth={rest.depth}
            currentProjectId={rest.currentProjectId}
            onSelectProject={rest.onSelectProject}
            onOpenMenu={rest.onOpenMenu}
          />
        )
      )}
    </div>
  );
}
