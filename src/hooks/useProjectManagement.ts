import { useState, useEffect, useRef } from 'react';
import { Project, Scene } from '@/types';
import { buildEmptyScript } from '@/utils/scriptDefaults';
import { DataManagementHook } from './useDataManagement';

export interface ProjectManagementHook {
  project: Project;
  setProject: (project: Project) => void;
  projectId: string;
  setProjectId: (id: string) => void;
  projectList: string[];
  setProjectList: (list: string[] | ((prev: string[]) => string[])) => void;
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
  handleReorderScenes: (newOrder: Scene[]) => void;
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
  // プロジェクトリストを更新する関数（関数型の更新にも対応）
  const updateProjectList = (updater: string[] | ((prev: string[]) => string[])) => {
    if (typeof updater === 'function') {
      setProjectList(updater);
    } else {
      setProjectList(updater);
    }
  };
  const [projectList, setProjectList] = useState<string[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  
  // Undo/Redoスタック
  const [undoStack, setUndoStack] = useState<ProjectHistory[]>([{ project: { id: 'default', name: '新しいプロジェクト', scenes: [] }, selectedSceneId: null }]);
  const [redoStack, setRedoStack] = useState<ProjectHistory[]>([]);
  const isUndoRedoOperation = useRef(false);
  const isInitialized = useRef<boolean>(false);

  // 初回マウント時にデータを読み込み
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadInitialData = async () => {
      if (isInitialized.current) return; // 既に初期化済みの場合はスキップ
      
      //console.log('🚀 プロジェクト管理の初期化開始 - 保存先:', dataManagement.saveDirectory);
      
      // 初回はlocalStorageから開始し、後で設定が読み込まれたら切り替える
      //console.log('🚀 初期化: localStorageから開始（設定読み込み完了後に切り替え）');
      ////console.log('useProjectManagement - Starting initialization');
      isInitialized.current = true;
      // プロジェクトリストを先に取得（存在チェック用）
      let availableProjects: string[] = [];
      if (dataManagement.saveDirectory === '') {
        //console.log('📦 初期化: localStorageからプロジェクトリストを取得');
        const keys = Object.keys(localStorage)
          .filter(k => k.startsWith('voiscripter_project_') &&
            !k.endsWith('_lastScene') &&
            !k.endsWith('_undo') &&
            !k.endsWith('_redo') &&
            !k.endsWith('_characters') &&
            !k.endsWith('_groups') &&
            !k.endsWith('_lastSaved'));
        availableProjects = keys.map(k => k.replace('voiscripter_project_', ''));
        //console.log('📦 初期化: localStorageのキー:', keys);
        //console.log('📦 初期化: 利用可能なプロジェクト:', availableProjects);
      } else if (window.electronAPI) {
        try {
          //console.log('📁 初期化: ディレクトリからプロジェクトリストを取得');
          const keys = await dataManagement.listDataKeys();
          //console.log('📁 初期化: ディレクトリ内の全キー:', keys);
          availableProjects = keys.filter(k => k.startsWith('voiscripter_project_') &&
            !k.endsWith('_lastScene') &&
            !k.endsWith('_undo') &&
            !k.endsWith('_redo') &&
            !k.endsWith('_characters') &&
            !k.endsWith('_groups') &&
            !k.endsWith('_lastSaved'));
          availableProjects = availableProjects.map(k => k.replace('voiscripter_project_', ''));
          //console.log('📁 初期化: プロジェクトキー:', keys.filter(k => k.startsWith('voiscripter_project_')));
          //console.log('📁 初期化: 利用可能なプロジェクト:', availableProjects);
        } catch (error) {
          console.error('プロジェクトリスト取得エラー:', error);
          availableProjects = [];
        }
      }
      
      //console.log('✅ 初期化: プロジェクトリストを設定 - 利用可能なプロジェクト:', availableProjects);
      setProjectList(availableProjects);
      
      // デバッグ用: プロジェクトリストの状態を確認
      setTimeout(() => {
        //console.log('🔍 デバッグ: プロジェクトリスト状態確認 - availableProjects:', availableProjects);
      }, 100);
      
      // 最後に開いていたプロジェクトを読み込み
      const lastProject = await dataManagement.loadData('voiscripter_lastProject');
      //console.log('🔍 初期化: 最後のプロジェクト:', lastProject);
      //console.log('🔍 初期化: 利用可能なプロジェクト一覧:', availableProjects);
      
      let validProjectId = 'default';
      if (lastProject && lastProject !== 'lastProject' && lastProject.trim() !== '') {
        if (availableProjects.includes(lastProject)) {
          validProjectId = lastProject;
          //console.log('✅ 初期化: 最後のプロジェクトを使用:', validProjectId);
        } else {
          //console.log('⚠️ 初期化: 最後のプロジェクトが見つからない、利用可能なプロジェクトから選択');
          // 利用可能なプロジェクトがある場合は、最初のプロジェクトを使用
          if (availableProjects.length > 0) {
            validProjectId = availableProjects[0];
            //console.log('✅ 初期化: 最初の利用可能なプロジェクトを使用:', validProjectId);
          } else {
            //console.log('⚠️ 初期化: 利用可能なプロジェクトがない、defaultを使用');
          }
        }
      } else {
        //console.log('⚠️ 初期化: 有効な最後のプロジェクトがない');
        // 利用可能なプロジェクトがある場合は、最初のプロジェクトを使用
        if (availableProjects.length > 0) {
          validProjectId = availableProjects[0];
          //console.log('✅ 初期化: 最初の利用可能なプロジェクトを使用:', validProjectId);
        } else {
          //console.log('⚠️ 初期化: 利用可能なプロジェクトがない、defaultを使用');
        }
      }
      
      //console.log('🎯 初期化: 最終的なプロジェクトID:', validProjectId);
      setProjectId(validProjectId);
      
      // 最後に開いたプロジェクトを保存
      dataManagement.saveData('voiscripter_lastProject', validProjectId);
      //console.log('💾 初期化: 最後のプロジェクトを保存:', validProjectId);
      
      // 選択されたプロジェクトのデータを読み込み
      //console.log(`🔍 初期化: プロジェクトデータを読み込み - key: voiscripter_project_${validProjectId}`);
      const selectedProjectData = await dataManagement.loadData(`voiscripter_project_${validProjectId}`);
      //console.log(`📁 初期化: プロジェクトデータ読み込み結果 - ${selectedProjectData ? '成功' : 'null'}`);
      
      if (selectedProjectData) {
        try {
          const parsed = JSON.parse(selectedProjectData);
          if (parsed && Array.isArray(parsed.scenes)) {
            //console.log(`✅ 初期化: プロジェクトデータを設定 - scenes: ${parsed.scenes.length}個`);
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
              scripts: [buildEmptyScript({ title: '新しいシーン' })]
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
            scripts: [buildEmptyScript({ title: '新しいシーン' })]
          }]
        };
        setProject(defaultProject);
        setSelectedSceneId(defaultProject.scenes[0].id);
        dataManagement.saveData(`voiscripter_project_${validProjectId}`, JSON.stringify(defaultProject));
      }
    };
    
    loadInitialData();
  }, []); // 初回のみ実行
  
  // 保存先が変更された時にプロジェクトリストを更新
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isInitialized.current) return; // 初期化前はスキップ
    
    const updateProjectList = async () => {
      //console.log('🔄 プロジェクトリスト更新開始 - 保存先:', dataManagement.saveDirectory);
      let availableProjects: string[] = [];
      if (dataManagement.saveDirectory === '') {
        //console.log('📦 localStorageからプロジェクトリストを取得');
        const keys = Object.keys(localStorage)
          .filter(k => k.startsWith('voiscripter_project_') &&
            !k.endsWith('_lastScene') &&
            !k.endsWith('_undo') &&
            !k.endsWith('_redo') &&
            !k.endsWith('_characters') &&
            !k.endsWith('_groups') &&
            !k.endsWith('_lastSaved'));
        availableProjects = keys.map(k => k.replace('voiscripter_project_', ''));
        //console.log('📦 localStorageのキー:', keys);
        //console.log('📦 利用可能なプロジェクト:', availableProjects);
      } else if (window.electronAPI) {
        try {
          //console.log('📁 ディレクトリからプロジェクトリストを取得');
          const keys = await dataManagement.listDataKeys();
          //console.log('📁 ディレクトリ内の全キー:', keys);
          availableProjects = keys.filter(k => k.startsWith('voiscripter_project_') &&
            !k.endsWith('_lastScene') &&
            !k.endsWith('_undo') &&
            !k.endsWith('_redo') &&
            !k.endsWith('_characters') &&
            !k.endsWith('_groups') &&
            !k.endsWith('_lastSaved'));
          availableProjects = availableProjects.map(k => k.replace('voiscripter_project_', ''));
          //console.log('📁 プロジェクトキー:', keys.filter(k => k.startsWith('voiscripter_project_')));
          //console.log('📁 利用可能なプロジェクト:', availableProjects);
        } catch (error) {
          console.error('プロジェクトリスト取得エラー:', error);
          availableProjects = [];
        }
      }
      
      //console.log('✅ 最終的なプロジェクトリスト:', availableProjects);
      setProjectList(availableProjects);
      
      // 保存先変更時にも最後のプロジェクトを読み込んで選択
      const lastProject = await dataManagement.loadData('voiscripter_lastProject');
      //console.log('🔄 保存先変更: 最後のプロジェクト:', lastProject);
      
      let validProjectId = project.id; // 現在のプロジェクトIDを保持
      
      if (lastProject && lastProject !== 'lastProject' && lastProject.trim() !== '') {
        if (availableProjects.includes(lastProject)) {
          validProjectId = lastProject;
          //console.log('✅ 保存先変更: 最後のプロジェクトを使用:', validProjectId);
        } else {
          //console.log('⚠️ 保存先変更: 最後のプロジェクトが見つからない、現在のプロジェクトを維持');
        }
      } else {
        //console.log('⚠️ 保存先変更: 有効な最後のプロジェクトがない、現在のプロジェクトを維持');
      }
      
      // 現在のプロジェクトが利用可能なプロジェクトに含まれていない場合、最初のプロジェクトを選択
      if (!availableProjects.includes(validProjectId) && availableProjects.length > 0) {
        validProjectId = availableProjects[0];
        //console.log('⚠️ 保存先変更: 現在のプロジェクトが見つからない、最初のプロジェクトを使用:', validProjectId);
      }
      
      // プロジェクトIDが変更された場合のみ更新
      if (validProjectId !== project.id) {
        //console.log('🔄 保存先変更: プロジェクトIDを変更:', project.id, '→', validProjectId);
        setProjectId(validProjectId);
        
        // 最後に開いたプロジェクトを保存
        dataManagement.saveData('voiscripter_lastProject', validProjectId);
        //console.log('💾 保存先変更: 最後のプロジェクトを保存:', validProjectId);
        
        // 新しいプロジェクトのデータを読み込み
        const selectedProjectData = await dataManagement.loadData(`voiscripter_project_${validProjectId}`);
        if (selectedProjectData) {
          try {
            const parsed = JSON.parse(selectedProjectData);
            if (parsed && Array.isArray(parsed.scenes)) {
              //console.log(`✅ 保存先変更: プロジェクトデータを設定 - scenes: ${parsed.scenes.length}個`);
              setProject(parsed);
              
              // シーンID復元
              const lastSceneId = await dataManagement.loadData(`voiscripter_project_${validProjectId}_lastScene`);
              if (lastSceneId && parsed.scenes.some((s: any) => s.id === lastSceneId)) {
                setSelectedSceneId(lastSceneId);
                //console.log('✅ 保存先変更: 最後のシーンを復元:', lastSceneId);
              } else if (parsed.scenes.length > 0) {
                setSelectedSceneId(parsed.scenes[0].id);
                //console.log('✅ 保存先変更: 最初のシーンを選択:', parsed.scenes[0].id);
              }
            }
          } catch (error) {
            console.error('保存先変更: プロジェクトデータの解析エラー:', error);
          }
        }
      }
    };
    
    updateProjectList();
  }, [dataManagement.saveDirectory]);

  // プロジェクトIDが変更された時にプロジェクトデータを読み込み
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isInitialized.current) return; // 初期化前はスキップ
    
    const loadProjectData = async () => {
      //console.log(`🔄 プロジェクトID変更: ${projectId} のデータを読み込み`);
      
      // プロジェクトデータを読み込み
      const selectedProjectData = await dataManagement.loadData(`voiscripter_project_${projectId}`);
      if (selectedProjectData) {
        try {
          const parsed = JSON.parse(selectedProjectData);
          if (parsed && Array.isArray(parsed.scenes)) {
            //console.log(`✅ プロジェクトID変更: プロジェクトデータを設定 - scenes: ${parsed.scenes.length}個`);
            setProject(parsed);
            
            // シーンID復元
            const lastSceneId = await dataManagement.loadData(`voiscripter_project_${projectId}_lastScene`);
            if (lastSceneId && parsed.scenes.some((s: any) => s.id === lastSceneId)) {
              setSelectedSceneId(lastSceneId);
              //console.log('✅ プロジェクトID変更: 最後のシーンを復元:', lastSceneId);
            } else if (parsed.scenes.length > 0) {
              setSelectedSceneId(parsed.scenes[0].id);
              //console.log('✅ プロジェクトID変更: 最初のシーンを選択:', parsed.scenes[0].id);
            }
          }
        } catch (error) {
          console.error('プロジェクトID変更: プロジェクトデータの解析エラー:', error);
        }
      } else {
        //console.log(`⚠️ プロジェクトID変更: プロジェクトデータが見つからない - ${projectId}`);
      }
    };
    
    loadProjectData();
  }, [projectId, dataManagement.saveDirectory]);

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
          scripts: [buildEmptyScript({ title: projectId })]
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
      scripts: [buildEmptyScript({ title: name })]
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
        scripts: [buildEmptyScript({ title: '新しいシーン' })]
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
      scripts: [buildEmptyScript({ title: name.trim() })]
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

  // シーンの並び替え
  const handleReorderScenes = (newOrder: Scene[]) => {
    setProject(prev => ({ ...prev, scenes: newOrder }));
  };

  return {
    project,
    setProject,
    projectId,
    setProjectId,
    projectList,
    setProjectList: updateProjectList,
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
    handleReorderScenes,
    isUndoRedoOperation,
    projects: [project] // 現在のプロジェクトのみを含む配列
  };
};
