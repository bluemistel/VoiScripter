import { ExplorerFolder, ExplorerTreeData, ExplorerNode } from '@/types';

// プロジェクト本体キーに付随するサフィックスキー一覧（リネーム時の移行・削除時の掃除に使用）
export const PROJECT_KEY_SUFFIXES = ['_lastScene', '_undo', '_redo', '_characters', '_groups', '_lastSaved'] as const;

export const EXPLORER_TREE_KEY = 'voiscripter_explorer_tree';
export const EXPLORER_EXPANDED_KEY = 'voiscripter_explorer_expanded';

export const createEmptyTree = (): ExplorerTreeData => ({
  version: 1,
  folders: [],
  projectLocations: {},
  updatedAt: Date.now(),
});

export const generateFolderId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

// 永続化されたJSONを防御的にパースする。壊れたデータ・循環親はルートへ退避
export const normalizeTree = (raw: unknown): ExplorerTreeData => {
  const tree = createEmptyTree();
  if (!raw || typeof raw !== 'object') return tree;

  const data = raw as Partial<ExplorerTreeData>;

  if (Array.isArray(data.folders)) {
    const seen = new Set<string>();
    for (const f of data.folders) {
      if (!f || typeof f !== 'object') continue;
      const folder = f as Partial<ExplorerFolder>;
      if (typeof folder.id !== 'string' || folder.id === '' || seen.has(folder.id)) continue;
      if (typeof folder.name !== 'string' || folder.name === '') continue;
      seen.add(folder.id);
      tree.folders.push({
        id: folder.id,
        name: folder.name,
        parentId: typeof folder.parentId === 'string' ? folder.parentId : null,
      });
    }
    // 親が存在しない・親チェーンが循環しているフォルダはルートへ退避
    const byId = new Map(tree.folders.map(f => [f.id, f]));
    for (const folder of tree.folders) {
      const visited = new Set<string>([folder.id]);
      let current = folder;
      while (current.parentId !== null) {
        const parent = byId.get(current.parentId);
        if (!parent || visited.has(parent.id)) {
          folder.parentId = null;
          break;
        }
        visited.add(parent.id);
        current = parent;
      }
    }
  }

  if (data.projectLocations && typeof data.projectLocations === 'object' && !Array.isArray(data.projectLocations)) {
    const folderIds = new Set(tree.folders.map(f => f.id));
    for (const [projectId, folderId] of Object.entries(data.projectLocations)) {
      if (typeof folderId === 'string' && folderIds.has(folderId)) {
        tree.projectLocations[projectId] = folderId;
      }
    }
  }

  tree.updatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : Date.now();
  return tree;
};

// フォルダメタデータと実プロジェクト一覧をマージして描画用ツリーを構築
// マッピングがない・無効なプロジェクトはルートに表示（自己修復）。'default' は除外
export const buildTreeNodes = (tree: ExplorerTreeData, projectList: string[]): ExplorerNode[] => {
  const folderIds = new Set(tree.folders.map(f => f.id));
  const childFolders = new Map<string | null, ExplorerFolder[]>();
  for (const folder of tree.folders) {
    const key = folder.parentId !== null && folderIds.has(folder.parentId) ? folder.parentId : null;
    const list = childFolders.get(key) ?? [];
    list.push(folder);
    childFolders.set(key, list);
  }

  const childProjects = new Map<string | null, string[]>();
  for (const projectId of projectList) {
    if (projectId === 'default') continue;
    const folderId = tree.projectLocations[projectId];
    const key = folderId !== undefined && folderIds.has(folderId) ? folderId : null;
    const list = childProjects.get(key) ?? [];
    list.push(projectId);
    childProjects.set(key, list);
  }

  const compare = (a: string, b: string) => a.localeCompare(b, 'ja');

  const buildChildren = (parentId: string | null): ExplorerNode[] => {
    const folders = (childFolders.get(parentId) ?? [])
      .slice()
      .sort((a, b) => compare(a.name, b.name))
      .map<ExplorerNode>(folder => ({ type: 'folder', folder, children: buildChildren(folder.id) }));
    const projects = (childProjects.get(parentId) ?? [])
      .slice()
      .sort(compare)
      .map<ExplorerNode>(projectId => ({ type: 'project', projectId }));
    return [...folders, ...projects];
  };

  return buildChildren(null);
};

// maybeDescendantId が ancestorId 自身またはその子孫かどうか（フォルダ移動の循環ガード）
export const isDescendantFolder = (tree: ExplorerTreeData, ancestorId: string, maybeDescendantId: string): boolean => {
  if (ancestorId === maybeDescendantId) return true;
  const byId = new Map(tree.folders.map(f => [f.id, f]));
  let current = byId.get(maybeDescendantId);
  const visited = new Set<string>();
  while (current && current.parentId !== null && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.parentId === ancestorId) return true;
    current = byId.get(current.parentId);
  }
  return false;
};

// フォルダ配下の全フォルダ・全プロジェクトを再帰収集（削除確認ダイアログと再帰削除に使用）
export const collectFolderContents = (
  tree: ExplorerTreeData,
  folderId: string,
  projectList: string[]
): { folderIds: string[]; projectIds: string[] } => {
  const folderIds: string[] = [];
  const stack = [folderId];
  const all = new Set(tree.folders.map(f => f.id));
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const folder of tree.folders) {
      if (folder.parentId === current && all.has(folder.id) && !folderIds.includes(folder.id) && folder.id !== folderId) {
        folderIds.push(folder.id);
        stack.push(folder.id);
      }
    }
  }
  const targetSet = new Set([folderId, ...folderIds]);
  const projectIds = projectList.filter(projectId => {
    if (projectId === 'default') return false;
    const location = tree.projectLocations[projectId];
    return location !== undefined && targetSet.has(location);
  });
  return { folderIds, projectIds };
};

export const addFolderToTree = (tree: ExplorerTreeData, folder: ExplorerFolder): ExplorerTreeData => ({
  ...tree,
  folders: [...tree.folders, folder],
  updatedAt: Date.now(),
});

export const renameFolderInTree = (tree: ExplorerTreeData, folderId: string, newName: string): ExplorerTreeData => ({
  ...tree,
  folders: tree.folders.map(f => (f.id === folderId ? { ...f, name: newName } : f)),
  updatedAt: Date.now(),
});

// フォルダとその子孫フォルダ・配下プロジェクトのマッピングをツリーから除去
export const removeFolderFromTree = (tree: ExplorerTreeData, folderId: string): ExplorerTreeData => {
  const removeIds = new Set<string>([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of tree.folders) {
      if (folder.parentId !== null && removeIds.has(folder.parentId) && !removeIds.has(folder.id)) {
        removeIds.add(folder.id);
        changed = true;
      }
    }
  }
  const projectLocations: Record<string, string> = {};
  for (const [projectId, location] of Object.entries(tree.projectLocations)) {
    if (!removeIds.has(location)) projectLocations[projectId] = location;
  }
  return {
    ...tree,
    folders: tree.folders.filter(f => !removeIds.has(f.id)),
    projectLocations,
    updatedAt: Date.now(),
  };
};

// プロジェクトをフォルダ（null = ルート）へ移動
export const moveProjectInTree = (tree: ExplorerTreeData, projectId: string, folderId: string | null): ExplorerTreeData => {
  const projectLocations = { ...tree.projectLocations };
  if (folderId === null) {
    delete projectLocations[projectId];
  } else {
    projectLocations[projectId] = folderId;
  }
  return { ...tree, projectLocations, updatedAt: Date.now() };
};

// フォルダを別フォルダ（null = ルート）へ移動。自身・子孫への移動は無視
export const moveFolderInTree = (tree: ExplorerTreeData, folderId: string, newParentId: string | null): ExplorerTreeData => {
  if (newParentId !== null && isDescendantFolder(tree, folderId, newParentId)) return tree;
  return {
    ...tree,
    folders: tree.folders.map(f => (f.id === folderId ? { ...f, parentId: newParentId } : f)),
    updatedAt: Date.now(),
  };
};

export const renameProjectInTree = (tree: ExplorerTreeData, oldProjectId: string, newProjectId: string): ExplorerTreeData => {
  if (!(oldProjectId in tree.projectLocations)) return tree;
  const projectLocations = { ...tree.projectLocations };
  projectLocations[newProjectId] = projectLocations[oldProjectId];
  delete projectLocations[oldProjectId];
  return { ...tree, projectLocations, updatedAt: Date.now() };
};

export const removeProjectFromTree = (tree: ExplorerTreeData, projectId: string): ExplorerTreeData => {
  if (!(projectId in tree.projectLocations)) return tree;
  const projectLocations = { ...tree.projectLocations };
  delete projectLocations[projectId];
  return { ...tree, projectLocations, updatedAt: Date.now() };
};

// 存在しないプロジェクトのマッピングを除去（ユーザー操作時のみ呼ぶ。ロード時には呼ばない —
// クラウド同期の遅延でプロジェクトキーが未到着のままマッピングを消す事故を防ぐ）
export const pruneTree = (tree: ExplorerTreeData, projectList: string[]): ExplorerTreeData => {
  const existing = new Set(projectList);
  const stale = Object.keys(tree.projectLocations).filter(projectId => !existing.has(projectId));
  if (stale.length === 0) return tree;
  const projectLocations = { ...tree.projectLocations };
  for (const projectId of stale) delete projectLocations[projectId];
  return { ...tree, projectLocations, updatedAt: Date.now() };
};

// Windowsで使用できないファイル名（プロジェクト名はElectronでそのままファイル名になる）
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/;
const RESERVED_DEVICE_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

// プロジェクト名の検証。エラーメッセージ（日本語）を返し、問題なければ null
export const validateProjectName = (name: string, existingProjects: string[]): string | null => {
  const trimmed = name.trim();
  if (trimmed === '') return 'プロジェクト名を入力してください';
  if (trimmed !== name) return 'プロジェクト名の先頭・末尾に空白は使用できません';
  if (name === 'default') return 'この名前は使用できません';
  if (INVALID_FILENAME_CHARS.test(name)) return '次の文字は使用できません: \\ / : * ? " < > |';
  if (name.endsWith('.')) return 'プロジェクト名の末尾にピリオドは使用できません';
  if (RESERVED_DEVICE_NAMES.test(name)) return 'この名前はシステム予約語のため使用できません';
  if (existingProjects.includes(name)) return '同じ名前のプロジェクトが既に存在します';
  return null;
};

// フォルダ名の検証（フォルダはID管理なので同一階層内の重複だけ防ぐ）
export const validateFolderName = (name: string, siblingNames: string[]): string | null => {
  const trimmed = name.trim();
  if (trimmed === '') return 'フォルダ名を入力してください';
  if (siblingNames.includes(trimmed)) return '同じ名前のフォルダが既に存在します';
  return null;
};
