import { useState, useEffect, useRef, useCallback } from 'react';
import { ExplorerTreeData } from '@/types';
import {
  EXPLORER_TREE_KEY,
  EXPLORER_EXPANDED_KEY,
  createEmptyTree,
  normalizeTree,
  generateFolderId,
  addFolderToTree,
  renameFolderInTree,
  removeFolderFromTree,
  moveProjectInTree,
  moveFolderInTree,
  renameProjectInTree,
  removeProjectFromTree,
  isDescendantFolder,
  pruneTree,
} from '@/utils/explorerTree';
import { DataManagementHook } from './useDataManagement';

export interface ProjectExplorerHook {
  tree: ExplorerTreeData;
  expandedFolderIds: Set<string>;
  toggleFolderExpanded: (folderId: string) => void;
  setFolderExpanded: (folderId: string, expanded: boolean) => void;
  reloadTree: () => Promise<void>;
  createFolder: (parentId: string | null, name: string) => string;
  renameFolder: (folderId: string, name: string) => void;
  moveProject: (projectId: string, folderId: string | null) => void;
  moveFolder: (folderId: string, newParentId: string | null) => void;
  removeFolder: (folderId: string) => void;
  notifyProjectRenamed: (oldId: string, newId: string) => void;
  notifyProjectDeleted: (projectId: string) => void;
}

const loadExpandedIds = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(EXPLORER_EXPANDED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
};

export const useProjectExplorer = (
  dataManagement: DataManagementHook,
  projectList: string[]
): ProjectExplorerHook => {
  const [tree, setTree] = useState<ExplorerTreeData>(createEmptyTree);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(loadExpandedIds);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectListRef = useRef(projectList);
  useEffect(() => {
    projectListRef.current = projectList;
  }, [projectList]);

  const reloadTree = useCallback(async () => {
    try {
      const raw = await dataManagement.loadData(EXPLORER_TREE_KEY);
      setTree(normalizeTree(raw ? JSON.parse(raw) : null));
    } catch (error) {
      console.error('エクスプローラーツリー読み込みエラー:', error);
      setTree(createEmptyTree());
    }
  }, [dataManagement.loadData]);

  // 初期化完了後と保存先変更時にツリーを読み込む
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!dataManagement.isInitialized) return;
    reloadTree();
  }, [dataManagement.isInitialized, dataManagement.saveDirectory]);

  // ツリー変更をデバウンス保存（ユーザー操作起点のミューテーションでのみ呼ばれる）
  const applyTreeChange = useCallback((updater: (prev: ExplorerTreeData) => ExplorerTreeData) => {
    setTree(prev => {
      // 操作時のみ存在しないプロジェクトのマッピングを掃除（ロード時には行わない）
      const next = updater(pruneTree(prev, projectListRef.current));
      if (next === prev) return prev;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        dataManagement.saveData(EXPLORER_TREE_KEY, JSON.stringify(next));
      }, 500);
      return next;
    });
  }, [dataManagement.saveData]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const persistExpanded = (ids: Set<string>) => {
    try {
      localStorage.setItem(EXPLORER_EXPANDED_KEY, JSON.stringify([...ids]));
    } catch {
      // localStorageが使えない環境では折りたたみ状態の保存をあきらめる
    }
  };

  const setFolderExpanded = useCallback((folderId: string, expanded: boolean) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (expanded) next.add(folderId); else next.delete(folderId);
      persistExpanded(next);
      return next;
    });
  }, []);

  const toggleFolderExpanded = useCallback((folderId: string) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      persistExpanded(next);
      return next;
    });
  }, []);

  const createFolder = useCallback((parentId: string | null, name: string): string => {
    const id = generateFolderId();
    applyTreeChange(prev => addFolderToTree(prev, { id, name: name.trim(), parentId }));
    if (parentId) setFolderExpanded(parentId, true);
    return id;
  }, [applyTreeChange, setFolderExpanded]);

  const renameFolder = useCallback((folderId: string, name: string) => {
    applyTreeChange(prev => renameFolderInTree(prev, folderId, name.trim()));
  }, [applyTreeChange]);

  const moveProject = useCallback((projectId: string, folderId: string | null) => {
    applyTreeChange(prev => moveProjectInTree(prev, projectId, folderId));
    if (folderId) setFolderExpanded(folderId, true);
  }, [applyTreeChange, setFolderExpanded]);

  const moveFolder = useCallback((folderId: string, newParentId: string | null) => {
    applyTreeChange(prev => {
      if (newParentId !== null && isDescendantFolder(prev, folderId, newParentId)) return prev;
      return moveFolderInTree(prev, folderId, newParentId);
    });
    if (newParentId) setFolderExpanded(newParentId, true);
  }, [applyTreeChange, setFolderExpanded]);

  const removeFolder = useCallback((folderId: string) => {
    applyTreeChange(prev => removeFolderFromTree(prev, folderId));
  }, [applyTreeChange]);

  const notifyProjectRenamed = useCallback((oldId: string, newId: string) => {
    applyTreeChange(prev => renameProjectInTree(prev, oldId, newId));
  }, [applyTreeChange]);

  const notifyProjectDeleted = useCallback((projectId: string) => {
    applyTreeChange(prev => removeProjectFromTree(prev, projectId));
  }, [applyTreeChange]);

  return {
    tree,
    expandedFolderIds,
    toggleFolderExpanded,
    setFolderExpanded,
    reloadTree,
    createFolder,
    renameFolder,
    moveProject,
    moveFolder,
    removeFolder,
    notifyProjectRenamed,
    notifyProjectDeleted,
  };
};
