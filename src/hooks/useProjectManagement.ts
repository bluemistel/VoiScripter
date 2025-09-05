import { useState, useEffect, useRef } from 'react';
import { Project, Scene } from '@/types';
import { DataManagementHook } from './useDataManagement';

export interface ProjectManagementHook {
  project: Project;
  setProject: (project: Project) => void;
  projectId: string;
  setProjectId: (id: string) => void;
  projectList: string[];
  setProjectList: (list: string[]) => void;
  selectedSceneId: string | null;
  setSelectedSceneId: (id: string | null) => void;
  undoStack: ProjectHistory[];
  redoStack: ProjectHistory[];
  handleCreateProject: (name: string) => void;
  handleNewProject: (name: string) => Project;
  handleDeleteProject: () => void;
  handleRenameProject: (newName: string) => void;
  refreshProjectList: () => Promise<void>;
  handleAddScene: (name: string) => void;
  handleRenameScene: (sceneId: string, newName: string) => void;
  handleDeleteScene: (sceneId: string) => void;
  handleSelectScene: (sceneId: string) => void;
  isUndoRedoOperation: React.MutableRefObject<boolean>;
  projects: Project[];
}

export type ProjectHistory = { project: Project; selectedSceneId: string | null };

export const useProjectManagement = (
  dataManagement: DataManagementHook,
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void
): ProjectManagementHook => {
  const [project, setProject] = useState<Project>({ id: 'default', name: '新しいプロジェクト', scenes: [] });
  const [projectId, setProjectId] = useState<string>('default');
  const [projectList, setProjectList] = useState<string[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  
  // Undo/Redoスタック
  const [undoStack, setUndoStack] = useState<ProjectHistory[]>([{ project: { id: 'default', name: '新しいプロジェクト', scenes: [] }, selectedSceneId: null }]);
  const [redoStack, setRedoStack] = useState<ProjectHistory[]>([]);
  const isUndoRedoOperation = useRef(false);

  // 初回マウント時にデータを読み込み
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadInitialData = async () => {
      // プロジェクトリストを先に取得（存在チェック用）
      let availableProjects: string[] = [];
      if (dataManagement.saveDirectory === '') {
        const keys = Object.keys(localStorage)
          .filter(k => k.startsWith('voiscripter_project_') &&
            !k.endsWith('_lastScene') &&
            !k.endsWith('_undo') &&
            !k.endsWith('_redo') &&
            !k.endsWith('_characters') &&
            !k.endsWith('_groups') &&
            !k.endsWith('_lastSaved'));
        availableProjects = keys.map(k => k.replace('voiscripter_project_', ''));
      } else if (window.electronAPI) {
        try {
          const keys = await dataManagement.listDataKeys();
          availableProjects = keys.filter(k => k.startsWith('voiscripter_project_') &&
            !k.endsWith('_lastScene') &&
            !k.endsWith('_undo') &&
            !k.endsWith('_redo') &&
            !k.endsWith('_characters') &&
            !k.endsWith('_groups') &&
            !k.endsWith('_lastSaved'));
          availableProjects = availableProjects.map(k => k.replace('voiscripter_project_', ''));
        } catch (error) {
          console.error('プロジェクトリスト取得エラー:', error);
          availableProjects = [];
        }
      }
      
      setProjectList(availableProjects);
      
      // 最後に開いていたプロジェクトを読み込み
      const lastProject = await dataManagement.loadData('voiscripter_lastProject');
      let validProjectId = 'default';
      if (lastProject && lastProject !== 'lastProject' && lastProject.trim() !== '') {
        if (availableProjects.includes(lastProject)) {
          validProjectId = lastProject;
        }
      }
      
      setProjectId(validProjectId);
      
      // 選択されたプロジェクトのデータを読み込み
      const selectedProjectData = await dataManagement.loadData(`voiscripter_project_${validProjectId}`);
      if (selectedProjectData) {
        try {
          const parsed = JSON.parse(selectedProjectData);
          if (parsed && Array.isArray(parsed.scenes)) {
            setProject(parsed);
            
            // シーンID復元
            const lastSceneId = await dataManagement.loadData(`voiscripter_project_${validProjectId}_lastScene`);
            if (lastSceneId && parsed.scenes.some((s: any) => s.id === lastSceneId)) {
              setSelectedSceneId(lastSceneId);
            } else if (parsed.scenes.length > 0) {
              setSelectedSceneId(parsed.scenes[0].id);
            } else {
              setSelectedSceneId(null);
            }
          }
        } catch (e) {
          console.error('プロジェクトデータのパースエラー', e);
          // エラーの場合はデフォルトプロジェクトを作成
          const defaultProject = {
            id: validProjectId,
            name: validProjectId,
            scenes: [{
              id: Date.now().toString(),
              name: '新しいシーン',
              scripts: [{ id: Date.now().toString(), title: '新しいシーン', blocks: [], characters: [] }]
            }]
          };
          setProject(defaultProject);
          setSelectedSceneId(defaultProject.scenes[0].id);
          dataManagement.saveData(`voiscripter_project_${validProjectId}`, JSON.stringify(defaultProject));
        }
      } else {
        // プロジェクトが存在しない場合はデフォルトプロジェクトを作成
        const defaultProject = {
          id: validProjectId,
          name: validProjectId,
          scenes: [{
            id: Date.now().toString(),
            name: '新しいシーン',
            scripts: [{ id: Date.now().toString(), title: '新しいシーン', blocks: [], characters: [] }]
          }]
        };
        setProject(defaultProject);
        setSelectedSceneId(defaultProject.scenes[0].id);
        dataManagement.saveData(`voiscripter_project_${validProjectId}`, JSON.stringify(defaultProject));
      }
    };
    
    loadInitialData();
  }, [dataManagement.saveDirectory]);

  // Undo/Redoスタックの保存（遅延実行）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!project.id || undoStack.length === 0) return;
    
    const timeoutId = setTimeout(() => {
      dataManagement.saveData(`voiscripter_project_${project.id}_undo`, JSON.stringify(undoStack));
    }, 1000); // 1秒後に保存
    
    return () => clearTimeout(timeoutId);
  }, [undoStack, project.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!project.id || redoStack.length === 0) return;
    
    const timeoutId = setTimeout(() => {
      dataManagement.saveData(`voiscripter_project_${project.id}_redo`, JSON.stringify(redoStack));
    }, 1000); // 1秒後に保存
    
    return () => clearTimeout(timeoutId);
  }, [redoStack, project.id]);

  // Undo/Redoスタックの復元（プロジェクト切替時）
  useEffect(() => {
    const loadUndoRedo = async () => {
      const undoJson = await dataManagement.loadData(`voiscripter_project_${projectId}_undo`);
      const redoJson = await dataManagement.loadData(`voiscripter_project_${projectId}_redo`);
      
      if (undoJson) {
        try {
          const parsed = JSON.parse(undoJson);
          if (Array.isArray(parsed)) setUndoStack(parsed);
        } catch {}
      } else {
        setUndoStack([]);
      }
      
      if (redoJson) {
        try {
          const parsed = JSON.parse(redoJson);
          if (Array.isArray(parsed)) setRedoStack(parsed);
        } catch {}
      } else {
        setRedoStack([]);
      }
    };
    
    loadUndoRedo();
  }, [projectId]);

  // Undo/Redoスタックに積む（project変更時）
  useEffect(() => {
    if (isUndoRedoOperation.current) {
      isUndoRedoOperation.current = false;
      return;
    }
    
    // 前回の状態と比較して、実際に変更があった場合のみ保存
    const currentState = { project, selectedSceneId };
    const lastState = undoStack[undoStack.length - 1];
    
    if (lastState && 
        JSON.stringify(lastState.project) === JSON.stringify(currentState.project) &&
        lastState.selectedSceneId === currentState.selectedSceneId) {
      return; // 変更がない場合は保存しない
    }
    
    setUndoStack(prev => {
      const newStack = [...prev, currentState];
      const trimmedStack = newStack.length > 50 ? newStack.slice(newStack.length - 50) : newStack;
      // 保存処理は別のuseEffectで行う
      return trimmedStack;
    });
    
    setRedoStack([]);
  }, [project, selectedSceneId]); // undoStackを依存配列から削除

  // プロジェクト保存・復元（遅延実行）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const timeoutId = setTimeout(() => {
      const saveProject = () => {
        const key = `voiscripter_project_${project.id}`;
        dataManagement.saveData(key, JSON.stringify(project));
        if (selectedSceneId) {
          dataManagement.saveData(`voiscripter_project_${project.id}_lastScene`, selectedSceneId);
        }
      };
      
      saveProject();
    }, 2000); // 2秒後に保存
    
    return () => clearTimeout(timeoutId);
  }, [project.id, selectedSceneId]); // project.idのみを依存配列に含める

  // プロジェクト切替時の復元
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadProject = async () => {
      const key = `voiscripter_project_${projectId}`;
      const saved = await dataManagement.loadData(key);
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.scenes)) {
            setProject(parsed);
            
            // シーンID復元
            let lastSceneId: string | null = null;
            lastSceneId = await dataManagement.loadData(`voiscripter_project_${parsed.id}_lastScene`);
            
            if (lastSceneId && parsed.scenes.some((s: any) => s.id === lastSceneId)) {
              setSelectedSceneId(lastSceneId);
            } else if (parsed.scenes.length > 0) {
              setSelectedSceneId(parsed.scenes[0].id);
            } else {
              setSelectedSceneId(null);
            }
          }
        } catch (e) {
          console.error('プロジェクトデータのパースエラー', e);
          setProject({ id: projectId, name: projectId, scenes: [] });
          setSelectedSceneId(null);
        }
      } else {
        // 新規プロジェクトが空の場合は初期シーンを作成
        const newSceneId = Date.now().toString();
        const newScene = {
          id: newSceneId,
          name: projectId,
          scripts: [{ id: Date.now().toString(), title: projectId, blocks: [], characters: [] }]
        };
        const newProject = { id: projectId, name: projectId, scenes: [newScene] };
        setProject(newProject);
        setSelectedSceneId(newSceneId);
        
        dataManagement.saveData(`voiscripter_project_${projectId}`, JSON.stringify(newProject));
      }
    };
    
    loadProject();
  }, [projectId]);



  // プロジェクトリスト再取得関数
  const refreshProjectList = async () => {
    if (dataManagement.saveDirectory === '') {
      const keys = Object.keys(localStorage)
        .filter(k => k.startsWith('voiscripter_project_') &&
          !k.endsWith('_lastScene') &&
          !k.endsWith('_undo') &&
          !k.endsWith('_redo'));
      const projectKeys = keys.map(k => k.replace('voiscripter_project_', ''));
      setProjectList(projectKeys);
    } else if (window.electronAPI) {
      try {
        const keys = await dataManagement.listDataKeys();
        const projectKeys = keys.filter(k => k.startsWith('voiscripter_project_') &&
          !k.endsWith('_lastScene') &&
          !k.endsWith('_undo') &&
          !k.endsWith('_redo'));
        const projectNames = projectKeys.map(k => k.replace('voiscripter_project_', ''));
        setProjectList(projectNames);
      } catch (error) {
        setProjectList([]);
      }
    }
  };

  // プロジェクト新規作成時にリスト更新
  const handleCreateProject = (name: string) => {
    const newSceneId = Date.now().toString();
    const newScene = {
      id: newSceneId,
      name: name,
      scripts: [{ id: Date.now().toString(), title: name, blocks: [], characters: [] }]
    };
    const newProject = {
      id: name,
      name: name,
      scenes: [newScene]
    };
    
    setProject(newProject);
    setSelectedSceneId(newSceneId);
    setProjectId(name);
    setUndoStack([]);
    setRedoStack([]);
    
    dataManagement.saveData('voiscripter_lastProject', name);
    onNotification(`プロジェクト「${name}」を作成しました`, 'success');
    
    setTimeout(refreshProjectList, 200);
  };

  // プロジェクト削除
  const handleDeleteProject = async () => {
    if (projectId === 'default') {
      onNotification('デフォルトプロジェクトは削除できません', 'error');
      return;
    }
    
    try {
      // プロジェクトデータを削除
      await dataManagement.deleteData(`voiscripter_project_${projectId}`);
      await dataManagement.deleteData(`voiscripter_project_${projectId}_lastScene`);
      await dataManagement.deleteData(`voiscripter_project_${projectId}_undo`);
      await dataManagement.deleteData(`voiscripter_project_${projectId}_redo`);
      await dataManagement.deleteData(`voiscripter_project_${projectId}_characters`);
      await dataManagement.deleteData(`voiscripter_project_${projectId}_groups`);
      await dataManagement.deleteData(`voiscripter_project_${projectId}_lastSaved`);
      
      // localStorageからも削除（SSR対応のため）
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`voiscripter_project_${projectId}_undo_lastSaved`);
        localStorage.removeItem(`voiscripter_project_${projectId}_redo_lastSaved`);
        localStorage.removeItem(`voiscripter_project_${projectId}_lastSaved`);
      }
      
      // プロジェクトリストから削除
      setProjectList(prev => prev.filter(p => p !== projectId));
      
      // デフォルトプロジェクトに切り替え
      setProjectId('default');
      
      // 最後に開いていたプロジェクトを更新
      await dataManagement.saveData('voiscripter_lastProject', 'default');
      
      onNotification(`プロジェクト「${projectId}」を削除しました`, 'success');
    } catch (error) {
      console.error('プロジェクト削除エラー:', error);
      onNotification('プロジェクトの削除に失敗しました', 'error');
      throw error;
    }
  };

  // プロジェクト名変更
  const handleRenameProject = (newName: string) => {
    if (!newName.trim() || newName === project.name) return;
    
    const oldProjectId = project.id;
    setProject(prev => {
      const updatedScenes = prev.scenes.map((scene, idx) => {
        if (idx === 0 && scene.name === prev.name) {
          return {
            ...scene,
            name: newName,
            scripts: scene.scripts.map((script, sidx) =>
              sidx === 0 && script.title === prev.name ? { ...script, title: newName } : script
            )
          };
        }
        return scene;
      });
      return {
        ...prev,
        id: newName,
        name: newName,
        scenes: updatedScenes
      };
    });
    
    setProjectList(prev => prev.map(p => p === oldProjectId ? newName : p));
    setProjectId(newName);
    
    dataManagement.saveData(`voiscripter_project_${newName}`, JSON.stringify({ ...project, id: newName, name: newName }));
    dataManagement.saveData('voiscripter_lastProject', newName);
    
    // 古いプロジェクトデータ削除
    dataManagement.deleteData(`voiscripter_project_${oldProjectId}`);
    dataManagement.deleteData(`voiscripter_project_${oldProjectId}_lastScene`);
    dataManagement.deleteData(`voiscripter_project_${oldProjectId}_undo`);
    dataManagement.deleteData(`voiscripter_project_${oldProjectId}_redo`);
    
    onNotification(`プロジェクト名を「${newName}」に変更しました`, 'success');
  };

  // 新しいプロジェクト作成
  const handleNewProject = (name: string): Project => {
    const newProject: Project = {
      id: name,
      name: name,
      scenes: [{
        id: Date.now().toString(),
        name: '新しいシーン',
        scripts: [{ id: Date.now().toString(), title: '新しいシーン', blocks: [], characters: [] }]
      }]
    };
    
    // プロジェクトリストに追加
    setProjectList(prev => [...prev, name]);
    setProjectId(name);
    setProject(newProject);
    setSelectedSceneId(newProject.scenes[0].id);
    
    // データを保存
    dataManagement.saveData(`voiscripter_project_${name}`, JSON.stringify(newProject));
    dataManagement.saveData('voiscripter_lastProject', name);
    
    return newProject;
  };

  // シーン操作関数
  const handleAddScene = (name: string) => {
    if (!name.trim()) return;
    if (project.scenes.length >= 30) return;
    if (project.scenes.some(s => s.name === name.trim())) return;
    
    const newSceneId = Date.now().toString();
    const newScene = {
      id: newSceneId,
      name: name.trim(),
      scripts: [{ id: Date.now().toString(), title: name.trim(), blocks: [], characters: [] }]
    };
    
    setProject(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
    setSelectedSceneId(newSceneId);
  };

  const handleRenameScene = (sceneId: string, newName: string) => {
    if (!newName.trim()) return;
    if (project.scenes.some(s => s.name === newName.trim() && s.id !== sceneId)) return;
    
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, name: newName.trim() } : s)
    }));
  };

  const handleDeleteScene = (sceneId: string) => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.filter(s => s.id !== sceneId)
    }));
    
    setTimeout(() => {
      setSelectedSceneId(p => {
        const remain = project.scenes.filter(s => s.id !== sceneId);
        return remain.length > 0 ? remain[0].id : null;
      });
    }, 0);
  };

  const handleSelectScene = (sceneId: string) => {
    setSelectedSceneId(sceneId);
  };

  return {
    project,
    setProject,
    projectId,
    setProjectId,
    projectList,
    setProjectList,
    selectedSceneId,
    setSelectedSceneId,
    undoStack,
    redoStack,
    handleCreateProject,
    handleNewProject,
    handleDeleteProject,
    handleRenameProject,
    refreshProjectList,
    handleAddScene,
    handleRenameScene,
    handleDeleteScene,
    handleSelectScene,
    isUndoRedoOperation,
    projects: [project] // 現在のプロジェクトのみを含む配列
  };
};
