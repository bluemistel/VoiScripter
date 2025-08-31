import { Project, Script } from '@/types';

export interface ScriptManagementHook {
  handleUpdateScript: (project: Project, selectedSceneId: string | null, updates: Partial<Script>) => Project;
  handleUpdateScriptTitle: (project: Project, selectedSceneId: string | null, newTitle: string) => Project;
}

export const useScriptManagement = (): ScriptManagementHook => {
  
  // スクリプト更新
  const handleUpdateScript = (project: Project, selectedSceneId: string | null, updates: Partial<Script>): Project => {
    if (!selectedSceneId) return project;
    
    return {
      ...project,
      scenes: project.scenes.map(scene =>
        scene.id === selectedSceneId
          ? {
              ...scene,
              scripts: scene.scripts.length > 0 
                ? [{ ...scene.scripts[0], ...updates }] 
                : [{ ...updates, id: Date.now().toString(), title: scene.name, blocks: [], characters: [] }]
            }
          : scene
      )
    };
  };

  // スクリプトタイトル更新
  const handleUpdateScriptTitle = (project: Project, selectedSceneId: string | null, newTitle: string): Project => {
    if (!selectedSceneId) return project;
    
    return {
      ...project,
      scenes: project.scenes.map(scene =>
        scene.id === selectedSceneId
          ? {
              ...scene,
              scripts: scene.scripts.map(script => ({
                ...script,
                title: newTitle
              }))
            }
          : scene
      )
    };
  };

  return {
    handleUpdateScript,
    handleUpdateScriptTitle
  };
};
