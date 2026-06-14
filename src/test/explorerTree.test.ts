/**
 * Unit tests for project explorer tree utilities
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyTree,
  normalizeTree,
  buildTreeNodes,
  isDescendantFolder,
  collectFolderContents,
  addFolderToTree,
  renameFolderInTree,
  removeFolderFromTree,
  moveProjectInTree,
  moveFolderInTree,
  renameProjectInTree,
  removeProjectFromTree,
  pruneTree,
  validateProjectName,
  validateFolderName,
} from '../utils/explorerTree';
import { ExplorerTreeData, ExplorerNode } from '../types';

const makeTree = (overrides: Partial<ExplorerTreeData> = {}): ExplorerTreeData => ({
  version: 1,
  folders: [],
  projectLocations: {},
  updatedAt: 0,
  ...overrides,
});

describe('normalizeTree', () => {
  it('returns empty tree for garbage input', () => {
    expect(normalizeTree(null).folders).toEqual([]);
    expect(normalizeTree('not json').folders).toEqual([]);
    expect(normalizeTree(42).projectLocations).toEqual({});
    expect(normalizeTree([]).folders).toEqual([]);
  });

  it('keeps valid folders and drops invalid entries', () => {
    const tree = normalizeTree({
      folders: [
        { id: 'a', name: 'A', parentId: null },
        { id: '', name: 'empty-id', parentId: null },
        { id: 'a', name: 'dup', parentId: null },
        { id: 'b', name: '', parentId: null },
        null,
        { id: 'c', name: 'C', parentId: 'a' },
      ],
    });
    expect(tree.folders.map(f => f.id)).toEqual(['a', 'c']);
  });

  it('detaches folders with missing parents to root', () => {
    const tree = normalizeTree({
      folders: [{ id: 'a', name: 'A', parentId: 'missing' }],
    });
    expect(tree.folders[0].parentId).toBeNull();
  });

  it('breaks parent cycles by detaching to root', () => {
    const tree = normalizeTree({
      folders: [
        { id: 'a', name: 'A', parentId: 'b' },
        { id: 'b', name: 'B', parentId: 'a' },
      ],
    });
    expect(tree.folders.some(f => f.parentId === null)).toBe(true);
  });

  it('drops project mappings to nonexistent folders', () => {
    const tree = normalizeTree({
      folders: [{ id: 'a', name: 'A', parentId: null }],
      projectLocations: { p1: 'a', p2: 'missing' },
    });
    expect(tree.projectLocations).toEqual({ p1: 'a' });
  });
});

describe('buildTreeNodes', () => {
  it('places unmapped projects at root', () => {
    const nodes = buildTreeNodes(makeTree(), ['p1', 'p2']);
    expect(nodes).toHaveLength(2);
    expect(nodes.every(n => n.type === 'project')).toBe(true);
  });

  it('excludes the default project', () => {
    const nodes = buildTreeNodes(makeTree(), ['default', 'p1']);
    expect(nodes).toHaveLength(1);
    expect((nodes[0] as { projectId: string }).projectId).toBe('p1');
  });

  it('places projects mapped to nonexistent folders at root', () => {
    const tree = makeTree({ projectLocations: { p1: 'missing' } });
    const nodes = buildTreeNodes(tree, ['p1']);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('project');
  });

  it('nests folders and projects correctly', () => {
    const tree = makeTree({
      folders: [
        { id: 'f1', name: 'Folder1', parentId: null },
        { id: 'f2', name: 'Sub', parentId: 'f1' },
      ],
      projectLocations: { p1: 'f1', p2: 'f2' },
    });
    const nodes = buildTreeNodes(tree, ['p1', 'p2', 'p3']);
    expect(nodes).toHaveLength(2); // f1, p3
    const f1 = nodes[0] as Extract<ExplorerNode, { type: 'folder' }>;
    expect(f1.type).toBe('folder');
    expect(f1.children).toHaveLength(2); // f2, p1
    const f2 = f1.children[0] as Extract<ExplorerNode, { type: 'folder' }>;
    expect(f2.folder.id).toBe('f2');
    expect(f2.children).toEqual([{ type: 'project', projectId: 'p2' }]);
  });

  it('sorts folders before projects, each alphabetically', () => {
    const tree = makeTree({
      folders: [
        { id: 'f1', name: 'んフォルダ', parentId: null },
        { id: 'f2', name: 'あフォルダ', parentId: null },
      ],
    });
    const nodes = buildTreeNodes(tree, ['んプロジェクト', 'あプロジェクト']);
    expect(nodes.map(n => (n.type === 'folder' ? n.folder.name : n.projectId))).toEqual([
      'あフォルダ',
      'んフォルダ',
      'あプロジェクト',
      'んプロジェクト',
    ]);
  });
});

describe('isDescendantFolder', () => {
  const tree = makeTree({
    folders: [
      { id: 'a', name: 'A', parentId: null },
      { id: 'b', name: 'B', parentId: 'a' },
      { id: 'c', name: 'C', parentId: 'b' },
      { id: 'x', name: 'X', parentId: null },
    ],
  });

  it('returns true for self', () => {
    expect(isDescendantFolder(tree, 'a', 'a')).toBe(true);
  });

  it('returns true for deep descendants', () => {
    expect(isDescendantFolder(tree, 'a', 'c')).toBe(true);
  });

  it('returns false for unrelated folders', () => {
    expect(isDescendantFolder(tree, 'a', 'x')).toBe(false);
    expect(isDescendantFolder(tree, 'c', 'a')).toBe(false);
  });
});

describe('collectFolderContents', () => {
  const tree = makeTree({
    folders: [
      { id: 'a', name: 'A', parentId: null },
      { id: 'b', name: 'B', parentId: 'a' },
      { id: 'c', name: 'C', parentId: 'b' },
      { id: 'x', name: 'X', parentId: null },
    ],
    projectLocations: { p1: 'a', p2: 'b', p3: 'c', p4: 'x' },
  });

  it('collects nested folders and projects', () => {
    const result = collectFolderContents(tree, 'a', ['p1', 'p2', 'p3', 'p4', 'root']);
    expect(result.folderIds.sort()).toEqual(['b', 'c']);
    expect(result.projectIds.sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('returns empty for an empty folder', () => {
    const result = collectFolderContents(tree, 'x', ['root']);
    expect(result.folderIds).toEqual([]);
    expect(result.projectIds).toEqual([]);
  });

  it('ignores stale mappings of deleted projects', () => {
    const result = collectFolderContents(tree, 'a', ['p1']);
    expect(result.projectIds).toEqual(['p1']);
  });
});

describe('tree mutations', () => {
  it('addFolderToTree appends a folder', () => {
    const tree = addFolderToTree(makeTree(), { id: 'f1', name: 'F', parentId: null });
    expect(tree.folders).toHaveLength(1);
  });

  it('renameFolderInTree renames only the target', () => {
    const tree = renameFolderInTree(
      makeTree({ folders: [{ id: 'f1', name: 'Old', parentId: null }, { id: 'f2', name: 'Keep', parentId: null }] }),
      'f1',
      'New'
    );
    expect(tree.folders.find(f => f.id === 'f1')?.name).toBe('New');
    expect(tree.folders.find(f => f.id === 'f2')?.name).toBe('Keep');
  });

  it('removeFolderFromTree removes descendants and their project mappings', () => {
    const tree = removeFolderFromTree(
      makeTree({
        folders: [
          { id: 'a', name: 'A', parentId: null },
          { id: 'b', name: 'B', parentId: 'a' },
          { id: 'x', name: 'X', parentId: null },
        ],
        projectLocations: { p1: 'a', p2: 'b', p3: 'x' },
      }),
      'a'
    );
    expect(tree.folders.map(f => f.id)).toEqual(['x']);
    expect(tree.projectLocations).toEqual({ p3: 'x' });
  });

  it('moveProjectInTree moves to folder and back to root', () => {
    let tree = moveProjectInTree(makeTree({ folders: [{ id: 'f1', name: 'F', parentId: null }] }), 'p1', 'f1');
    expect(tree.projectLocations.p1).toBe('f1');
    tree = moveProjectInTree(tree, 'p1', null);
    expect('p1' in tree.projectLocations).toBe(false);
  });

  it('moveFolderInTree rejects moving into self or descendant', () => {
    const base = makeTree({
      folders: [
        { id: 'a', name: 'A', parentId: null },
        { id: 'b', name: 'B', parentId: 'a' },
      ],
    });
    expect(moveFolderInTree(base, 'a', 'a')).toBe(base);
    expect(moveFolderInTree(base, 'a', 'b')).toBe(base);
    const moved = moveFolderInTree(base, 'b', null);
    expect(moved.folders.find(f => f.id === 'b')?.parentId).toBeNull();
  });

  it('renameProjectInTree carries the mapping to the new id', () => {
    const tree = renameProjectInTree(
      makeTree({ folders: [{ id: 'f1', name: 'F', parentId: null }], projectLocations: { old: 'f1' } }),
      'old',
      'new'
    );
    expect(tree.projectLocations).toEqual({ new: 'f1' });
  });

  it('renameProjectInTree is a no-op for unmapped (root) projects', () => {
    const tree = makeTree();
    expect(renameProjectInTree(tree, 'old', 'new')).toBe(tree);
  });

  it('removeProjectFromTree deletes the mapping', () => {
    const tree = removeProjectFromTree(
      makeTree({ folders: [{ id: 'f1', name: 'F', parentId: null }], projectLocations: { p1: 'f1' } }),
      'p1'
    );
    expect(tree.projectLocations).toEqual({});
  });

  it('pruneTree removes only stale mappings', () => {
    const tree = pruneTree(
      makeTree({ folders: [{ id: 'f1', name: 'F', parentId: null }], projectLocations: { live: 'f1', gone: 'f1' } }),
      ['live']
    );
    expect(tree.projectLocations).toEqual({ live: 'f1' });
  });
});

describe('validateProjectName', () => {
  const existing = ['既存プロジェクト'];

  it('accepts a normal name', () => {
    expect(validateProjectName('新しい台本', existing)).toBeNull();
  });

  it('rejects empty and whitespace-only names', () => {
    expect(validateProjectName('', existing)).not.toBeNull();
    expect(validateProjectName('   ', existing)).not.toBeNull();
  });

  it('rejects leading/trailing whitespace', () => {
    expect(validateProjectName(' 名前', existing)).not.toBeNull();
    expect(validateProjectName('名前 ', existing)).not.toBeNull();
  });

  it('rejects duplicates', () => {
    expect(validateProjectName('既存プロジェクト', existing)).not.toBeNull();
  });

  it('rejects the reserved default name', () => {
    expect(validateProjectName('default', existing)).not.toBeNull();
  });

  it('rejects Windows-invalid filename characters', () => {
    for (const ch of ['\\', '/', ':', '*', '?', '"', '<', '>', '|']) {
      expect(validateProjectName(`a${ch}b`, existing)).not.toBeNull();
    }
  });

  it('rejects trailing dot and reserved device names', () => {
    expect(validateProjectName('name.', existing)).not.toBeNull();
    expect(validateProjectName('CON', existing)).not.toBeNull();
    expect(validateProjectName('com1', existing)).not.toBeNull();
  });
});

describe('validateFolderName', () => {
  it('accepts a normal name and rejects empty/duplicate', () => {
    expect(validateFolderName('資料', ['他'])).toBeNull();
    expect(validateFolderName('', [])).not.toBeNull();
    expect(validateFolderName('重複', ['重複'])).not.toBeNull();
  });
});
