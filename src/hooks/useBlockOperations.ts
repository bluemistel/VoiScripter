import { Project, ScriptBlock, Character } from '@/types';

export interface BlockOperationsHook {
  handleAddBlock: (project: Project, selectedSceneId: string | null, characters: Character[]) => Project;
  handleDeleteBlock: (project: Project, selectedSceneId: string | null, blockId: string) => Project;
  handleDuplicateBlock: (project: Project, selectedSceneId: string | null, blockId: string) => Project;
  handleInsertBlock: (project: Project, selectedSceneId: string | null, block: ScriptBlock, index: number) => Project;
  handleMoveBlock: (project: Project, selectedSceneId: string | null, blockId: string, direction: 'up' | 'down') => Project;
  handleMoveBlockByIndex: (project: Project, selectedSceneId: string | null, fromIndex: number, toIndex: number) => Project;
  handleUpdateBlock: (project: Project, selectedSceneId: string | null, blockId: string, updates: Partial<ScriptBlock>) => Project;
  handleSelectAllBlocks: (project: Project, selectedSceneId: string | null) => string[];
  handleDeselectAllBlocks: () => string[];
  handleToggleBlockSelection: (blockId: string, selectedBlockIds: string[]) => string[];
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
      text: blockToDuplicate.text + ' (コピー)'
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
    handleDuplicateBlock,
    handleInsertBlock,
    handleMoveBlock,
    handleMoveBlockByIndex,
    handleUpdateBlock,
    handleSelectAllBlocks,
    handleDeselectAllBlocks,
    handleToggleBlockSelection
  };
};
