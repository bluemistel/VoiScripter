import { Project, ScriptBlock, Character } from '@/types';

export interface BlockOperationsHook {
  handleAddBlock: (project: Project, selectedSceneId: string | null, characters: Character[]) => Project;
  handleDeleteBlock: (project: Project, selectedSceneId: string | null, blockId: string) => Project;
  handleDeleteBlocks: (project: Project, selectedSceneId: string | null, blockIds: string[]) => Project;
  handleDuplicateBlock: (project: Project, selectedSceneId: string | null, blockId: string) => Project;
  handleDuplicateBlocks: (project: Project, selectedSceneId: string | null, blockIds: string[]) => { project: Project; newBlockIds: string[] };
  handleInsertBlock: (project: Project, selectedSceneId: string | null, block: ScriptBlock, index: number) => Project;
  handleMoveBlock: (project: Project, selectedSceneId: string | null, blockId: string, direction: 'up' | 'down') => Project;
  handleMoveBlocks: (project: Project, selectedSceneId: string | null, blockIds: string[], direction: 'up' | 'down') => Project;
  handleMoveBlockByIndex: (project: Project, selectedSceneId: string | null, fromIndex: number, toIndex: number) => Project;
  handleMoveBlocksByIndex: (project: Project, selectedSceneId: string | null, blockIds: string[], toIndex: number) => Project;
  handleUpdateBlock: (project: Project, selectedSceneId: string | null, blockId: string, updates: Partial<ScriptBlock>) => Project;
  handleSelectAllBlocks: (project: Project, selectedSceneId: string | null) => string[];
  handleDeselectAllBlocks: () => string[];
  handleToggleBlockSelection: (blockId: string, selectedBlockIds: string[]) => string[];
  handleMoveBlocksToScene: (project: Project, fromSceneId: string, toSceneId: string, blockIds: string[], insertIndex: number) => Project;
}

export const useBlockOperations = (): BlockOperationsHook => {
  
  // ブロック追加
  const handleAddBlock = (project: Project, selectedSceneId: string | null, characters: Character[]): Project => {
    if (!selectedSceneId) return project;
    
    const currentScript = project.scenes.find(s => s.id === selectedSceneId)?.scripts[0];
    if (!currentScript) return project;
    
    const lastSerif = [...currentScript.blocks].reverse().find(b => b.characterId);
    const charId = lastSerif?.characterId || characters[0]?.id || '';
    const emotion = lastSerif?.emotion || 'normal';
    
    const newBlock: ScriptBlock = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      characterId: charId,
      emotion,
      text: ''
    };
    
    return {
      ...project,
      scenes: project.scenes.map(scene =>
        scene.id === selectedSceneId
          ? {
              ...scene,
              scripts: scene.scripts.map(script => ({
                ...script,
                blocks: [...script.blocks, newBlock]
              }))
            }
          : scene
      )
    };
  };

  // ブロック削除
  const handleDeleteBlock = (project: Project, selectedSceneId: string | null, blockId: string): Project => {
    if (!selectedSceneId) return project;
    
    return {
      ...project,
      scenes: project.scenes.map(scene =>
        scene.id === selectedSceneId
          ? {
              ...scene,
              scripts: scene.scripts.map(script => ({
                ...script,
                blocks: script.blocks.filter(block => block.id !== blockId)
              }))
            }
          : scene
      )
    };
  };

  // 複数ブロック削除
  const handleDeleteBlocks = (project: Project, selectedSceneId: string | null, blockIds: string[]): Project => {
    if (!selectedSceneId || blockIds.length === 0) return project;
    const idSet = new Set(blockIds);
    return {
      ...project,
      scenes: project.scenes.map(scene =>
        scene.id === selectedSceneId
          ? {
              ...scene,
              scripts: scene.scripts.map(script => ({
                ...script,
                blocks: script.blocks.filter(block => !idSet.has(block.id))
              }))
            }
          : scene
      )
    };
  };

  // ブロック複製
  const handleDuplicateBlock = (project: Project, selectedSceneId: string | null, blockId: string): Project => {
    if (!selectedSceneId) return project;
    
    const currentScript = project.scenes.find(s => s.id === selectedSceneId)?.scripts[0];
    if (!currentScript) return project;
    
    const blockToDuplicate = currentScript.blocks.find(b => b.id === blockId);
    if (!blockToDuplicate) return project;
    
    const duplicatedBlock: ScriptBlock = {
      ...blockToDuplicate,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: blockToDuplicate.text + ''
    };
    
    const blockIndex = currentScript.blocks.findIndex(b => b.id === blockId);
    const newBlocks = [...currentScript.blocks];
    newBlocks.splice(blockIndex + 1, 0, duplicatedBlock);
    
    return {
      ...project,
      scenes: project.scenes.map(scene =>
        scene.id === selectedSceneId
          ? {
              ...scene,
              scripts: scene.scripts.map(script => ({
                ...script,
                blocks: newBlocks
              }))
            }
          : scene
      )
    };
  };

  // 複数ブロック複製
  const handleDuplicateBlocks = (project: Project, selectedSceneId: string | null, blockIds: string[]): { project: Project; newBlockIds: string[] } => {
    if (!selectedSceneId || blockIds.length === 0) return { project, newBlockIds: [] };
    const currentScript = project.scenes.find(s => s.id === selectedSceneId)?.scripts[0];
    if (!currentScript) return { project, newBlockIds: [] };

    const newBlocks = [...currentScript.blocks];
    const newBlockIds: string[] = [];
    // ブロックIDの出現順でソート
    const sortedIds = blockIds.filter(id => currentScript.blocks.some(b => b.id === id))
      .sort((a, b) => currentScript.blocks.findIndex(bl => bl.id === a) - currentScript.blocks.findIndex(bl => bl.id === b));

    // 最後の選択ブロックの後に全てまとめて挿入
    const lastIdx = Math.max(...sortedIds.map(id => newBlocks.findIndex(b => b.id === id)));
    const duplicates = sortedIds.map(id => {
      const original = currentScript.blocks.find(b => b.id === id)!;
      const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      newBlockIds.push(newId);
      return { ...original, id: newId };
    });
    newBlocks.splice(lastIdx + 1, 0, ...duplicates);

    return {
      project: {
        ...project,
        scenes: project.scenes.map(scene =>
          scene.id === selectedSceneId
            ? { ...scene, scripts: scene.scripts.map(script => ({ ...script, blocks: newBlocks })) }
            : scene
        )
      },
      newBlockIds
    };
  };

  // ブロック挿入
  const handleInsertBlock = (project: Project, selectedSceneId: string | null, block: ScriptBlock, index: number): Project => {
    if (!selectedSceneId) return project;
    
    const currentScript = project.scenes.find(s => s.id === selectedSceneId)?.scripts[0];
    if (!currentScript) return project;
    
    const newBlocks = [...currentScript.blocks];
    newBlocks.splice(index, 0, block);
    
    return {
      ...project,
      scenes: project.scenes.map(scene =>
        scene.id === selectedSceneId
          ? {
              ...scene,
              scripts: scene.scripts.map(script => ({
                ...script,
                blocks: newBlocks
              }))
            }
          : scene
      )
    };
  };

  // ブロック移動
  const handleMoveBlock = (project: Project, selectedSceneId: string | null, blockId: string, direction: 'up' | 'down'): Project => {
    if (!selectedSceneId) return project;
    
    const currentScript = project.scenes.find(s => s.id === selectedSceneId)?.scripts[0];
    if (!currentScript) return project;
    
    const blockIndex = currentScript.blocks.findIndex(b => b.id === blockId);
    if (blockIndex === -1) return project;
    
    const newBlocks = [...currentScript.blocks];
    
    if (direction === 'up' && blockIndex > 0) {
      [newBlocks[blockIndex], newBlocks[blockIndex - 1]] = [newBlocks[blockIndex - 1], newBlocks[blockIndex]];
    } else if (direction === 'down' && blockIndex < newBlocks.length - 1) {
      [newBlocks[blockIndex], newBlocks[blockIndex + 1]] = [newBlocks[blockIndex + 1], newBlocks[blockIndex]];
    }
    
    return {
      ...project,
      scenes: project.scenes.map(scene =>
        scene.id === selectedSceneId
          ? {
              ...scene,
              scripts: scene.scripts.map(script => ({
                ...script,
                blocks: newBlocks
              }))
            }
          : scene
      )
    };
  };

  // 複数ブロック移動（方向ベース）
  const handleMoveBlocks = (project: Project, selectedSceneId: string | null, blockIds: string[], direction: 'up' | 'down'): Project => {
    if (!selectedSceneId || blockIds.length === 0) return project;
    const currentScript = project.scenes.find(s => s.id === selectedSceneId)?.scripts[0];
    if (!currentScript) return project;

    const newBlocks = [...currentScript.blocks];
    const idSet = new Set(blockIds);
    const indices = newBlocks
      .map((b, i) => idSet.has(b.id) ? i : -1)
      .filter(i => i >= 0)
      .sort((a, b) => a - b);

    if (indices.length === 0) return project;

    if (direction === 'up') {
      for (const idx of indices) {
        if (idx === 0 || idSet.has(newBlocks[idx - 1].id)) continue;
        [newBlocks[idx], newBlocks[idx - 1]] = [newBlocks[idx - 1], newBlocks[idx]];
      }
    } else {
      for (let i = indices.length - 1; i >= 0; i--) {
        const idx = indices[i];
        if (idx >= newBlocks.length - 1 || idSet.has(newBlocks[idx + 1].id)) continue;
        [newBlocks[idx], newBlocks[idx + 1]] = [newBlocks[idx + 1], newBlocks[idx]];
      }
    }

    return {
      ...project,
      scenes: project.scenes.map(scene =>
        scene.id === selectedSceneId
          ? { ...scene, scripts: scene.scripts.map(script => ({ ...script, blocks: newBlocks })) }
          : scene
      )
    };
  };

  // ブロック移動（インデックスベース）
  const handleMoveBlockByIndex = (project: Project, selectedSceneId: string | null, fromIndex: number, toIndex: number): Project => {
    if (!selectedSceneId) return project;
    
    const currentScript = project.scenes.find(s => s.id === selectedSceneId)?.scripts[0];
    if (!currentScript) return project;
    
    if (fromIndex < 0 || fromIndex >= currentScript.blocks.length || 
        toIndex < 0 || toIndex >= currentScript.blocks.length) {
      return project;
    }
    
    const newBlocks = [...currentScript.blocks];
    const [movedBlock] = newBlocks.splice(fromIndex, 1);
    newBlocks.splice(toIndex, 0, movedBlock);
    
    return {
      ...project,
      scenes: project.scenes.map(scene =>
        scene.id === selectedSceneId
          ? {
              ...scene,
              scripts: scene.scripts.map(script => ({
                ...script,
                blocks: newBlocks
              }))
            }
          : scene
      )
    };
  };

  // 複数ブロック移動（インデックスベース - DnDグループ移動用）
  const handleMoveBlocksByIndex = (project: Project, selectedSceneId: string | null, blockIds: string[], toIndex: number): Project => {
    if (!selectedSceneId || blockIds.length === 0) return project;
    const currentScript = project.scenes.find(s => s.id === selectedSceneId)?.scripts[0];
    if (!currentScript) return project;

    const idSet = new Set(blockIds);
    const selectedBlocks = currentScript.blocks.filter(b => idSet.has(b.id));
    const remaining = currentScript.blocks.filter(b => !idSet.has(b.id));
    const clampedIndex = Math.min(toIndex, remaining.length);
    remaining.splice(clampedIndex, 0, ...selectedBlocks);

    return {
      ...project,
      scenes: project.scenes.map(scene =>
        scene.id === selectedSceneId
          ? { ...scene, scripts: scene.scripts.map(script => ({ ...script, blocks: remaining })) }
          : scene
      )
    };
  };

  // クロスシーンブロック移動
  const handleMoveBlocksToScene = (project: Project, fromSceneId: string, toSceneId: string, blockIds: string[], insertIndex: number): Project => {
    if (fromSceneId === toSceneId || blockIds.length === 0) return project;
    const fromScript = project.scenes.find(s => s.id === fromSceneId)?.scripts[0];
    if (!fromScript) return project;

    const idSet = new Set(blockIds);
    const movedBlocks = fromScript.blocks.filter(b => idSet.has(b.id));
    const remainingBlocks = fromScript.blocks.filter(b => !idSet.has(b.id));

    return {
      ...project,
      scenes: project.scenes.map(scene => {
        if (scene.id === fromSceneId) {
          return { ...scene, scripts: scene.scripts.map(script => ({ ...script, blocks: remainingBlocks })) };
        }
        if (scene.id === toSceneId) {
          return {
            ...scene,
            scripts: scene.scripts.map(script => {
              const newBlocks = [...script.blocks];
              const clampedIdx = Math.min(insertIndex, newBlocks.length);
              newBlocks.splice(clampedIdx, 0, ...movedBlocks);
              return { ...script, blocks: newBlocks };
            })
          };
        }
        return scene;
      })
    };
  };

  // ブロック更新
  const handleUpdateBlock = (project: Project, selectedSceneId: string | null, blockId: string, updates: Partial<ScriptBlock>): Project => {
    if (!selectedSceneId) return project;
    
    return {
      ...project,
      scenes: project.scenes.map(scene =>
        scene.id === selectedSceneId
          ? {
              ...scene,
              scripts: scene.scripts.map(script => ({
                ...script,
                blocks: script.blocks.map(block =>
                  block.id === blockId ? { ...block, ...updates } : block
                )
              }))
            }
          : scene
      )
    };
  };

  // 全ブロック選択
  const handleSelectAllBlocks = (project: Project, selectedSceneId: string | null): string[] => {
    if (!selectedSceneId) return [];
    
    const currentScript = project.scenes.find(s => s.id === selectedSceneId)?.scripts[0];
    if (!currentScript) return [];
    
    return currentScript.blocks.map(block => block.id);
  };

  // 全選択解除
  const handleDeselectAllBlocks = (): string[] => {
    return [];
  };

  // ブロック選択切り替え
  const handleToggleBlockSelection = (blockId: string, selectedBlockIds: string[]): string[] => {
    if (selectedBlockIds.includes(blockId)) {
      return selectedBlockIds.filter(id => id !== blockId);
    } else {
      return [...selectedBlockIds, blockId];
    }
  };

  return {
    handleAddBlock,
    handleDeleteBlock,
    handleDeleteBlocks,
    handleDuplicateBlock,
    handleDuplicateBlocks,
    handleInsertBlock,
    handleMoveBlock,
    handleMoveBlocks,
    handleMoveBlockByIndex,
    handleMoveBlocksByIndex,
    handleUpdateBlock,
    handleSelectAllBlocks,
    handleDeselectAllBlocks,
    handleToggleBlockSelection,
    handleMoveBlocksToScene
  };
};
