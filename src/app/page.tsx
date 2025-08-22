'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import ScriptEditor from '@/components/ScriptEditor';
import Settings from '@/components/Settings';
import ProjectDialog from '@/components/ProjectDialog';
import CSVExportDialog from '@/components/CSVExportDialog'; // CSVExportDialogを追加
import { Script, Character, ScriptBlock, Emotion, Project, Scene } from '@/types';

export default function Home() {
  // useState宣言を最初にまとめる
  const [characters, setCharacters] = useState<Character[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<string>('default');
  const [project, setProject] = useState<Project>({ id: 'default', name: '新しいプロジェクト', scenes: [] });
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [saveDirectory, setSaveDirectory] = useState<string>('');
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ projectId: string; confirmed: boolean | null } | null>(null);
  // Undo/Redoスタックの型を定義
  type ProjectHistory = { project: Project; selectedSceneId: string | null };
  const [undoStack, setUndoStack] = useState<ProjectHistory[]>([{ project: { id: 'default', name: '新しいプロジェクト', scenes: [] }, selectedSceneId: null }]);
  const [redoStack, setRedoStack] = useState<ProjectHistory[]>([]);

  // showNotification関数をここに
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const last = localStorage.getItem('voiscripter_lastProject');
      if (last && last !== 'lastProject') setProjectId(last);
    }
  }, []);
  const [projectList, setProjectList] = useState<string[]>([]);

  // Undo/Redoスタックの保存
  useEffect(() => {
    if (!project.id) return;
    saveData(`voiscripter_project_${project.id}_undo`, JSON.stringify(undoStack));
  }, [undoStack, project.id, saveDirectory]);
  useEffect(() => {
    if (!project.id) return;
    saveData(`voiscripter_project_${project.id}_redo`, JSON.stringify(redoStack));
  }, [redoStack, project.id, saveDirectory]);

  // Undo/Redoスタックの復元（プロジェクト切替時）
  useEffect(() => {
    const loadUndoRedo = async () => {
      const undoJson = await loadData(`voiscripter_project_${projectId}_undo`);
      const redoJson = await loadData(`voiscripter_project_${projectId}_redo`);
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
  }, [projectId, saveDirectory]);

  // Undo/Redo操作中かどうかのフラグ
  const isUndoRedoOperation = useRef(false);

  // Undo/Redoスタックに積む（project変更時）
  useEffect(() => {
    if (isUndoRedoOperation.current) {
      isUndoRedoOperation.current = false;
      return;
    }
    setUndoStack(prev => {
      const newStack = [...prev, { project, selectedSceneId }];
      saveData(`voiscripter_project_${project.id}_undo`, JSON.stringify(newStack));
      return newStack.length > 50 ? newStack.slice(newStack.length - 50) : newStack;
    });
    setRedoStack([]);
    saveData(`voiscripter_project_${project.id}_redo`, JSON.stringify([]));
  }, [project, selectedSceneId]);

  // Undo/Redoキーハンドラ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (undoStack.length > 1) {
          isUndoRedoOperation.current = true;
          const newRedo = [{ project, selectedSceneId }, ...redoStack];
          setRedoStack(newRedo);
          saveData(`voiscripter_project_${project.id}_redo`, JSON.stringify(newRedo));
          const prev = undoStack[undoStack.length - 2];
          setUndoStack(u => {
            const newUndo = u.slice(0, -1);
            saveData(`voiscripter_project_${project.id}_undo`, JSON.stringify(newUndo));
            return newUndo;
          });
          setProject(prev.project);
          setSelectedSceneId(prev.selectedSceneId);
        }
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (redoStack.length > 0) {
          isUndoRedoOperation.current = true;
          const next = redoStack[0];
          const newUndo = [...undoStack, next];
          setUndoStack(newUndo);
          saveData(`voiscripter_project_${project.id}_undo`, JSON.stringify(newUndo));
          const newRedo = redoStack.slice(1);
          setRedoStack(newRedo);
          saveData(`voiscripter_project_${project.id}_redo`, JSON.stringify(newRedo));
          setProject(next.project);
          setSelectedSceneId(next.selectedSceneId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, project, selectedSceneId]);

  // データ保存関数
  const saveData = (key: string, data: string) => {
    if (saveDirectory === '') {
      // localStorageに保存
      try {
        localStorage.setItem(key, data);
      } catch (error) {
        console.error('localStorage save error:', error);
        // QuotaExceededErrorの場合、古いデータを削除して再試行
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          try {
            // 古いundo/redoデータを削除
            const keys = Object.keys(localStorage);
            const undoRedoKeys = keys.filter(k => k.includes('_undo') || k.includes('_redo'));
            undoRedoKeys.forEach(k => localStorage.removeItem(k));
            // 再試行
            localStorage.setItem(key, data);
          } catch (retryError) {
            console.error('Retry save failed:', retryError);
          }
        }
      }
    } else if (window.electronAPI) {
      // ファイルに保存
      window.electronAPI?.saveData(key, data);
    }
  };

  // データ読み込み関数
  const loadData = async (key: string): Promise<string | null> => {
    if (saveDirectory === '') {
      // localStorageから読み込み
      return localStorage.getItem(key);
    } else if (window.electronAPI) {
      // ファイルから読み込み
      return await window.electronAPI?.loadData(key) || null;
    }
    return null;
  };

  // グループ保存フラグ
  const isFirstGroups = useRef(true);

  // 初回マウント時にデータを読み込み
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadInitialData = async () => {
      // 保存先設定を読み込み
      let savedDirectory = '';
      if (window.electronAPI) {
        try {
          const settings = await window.electronAPI.loadSettings();
          savedDirectory = settings.saveDirectory || '';
          setSaveDirectory(savedDirectory);
          console.log('設定から読み込んだ保存先:', savedDirectory);
        } catch (error) {
          console.error('設定読み込みエラー:', error);
        }
      } else {
        savedDirectory = localStorage.getItem('voiscripter_saveDirectory') || '';
        setSaveDirectory(savedDirectory);
        console.log('localStorageから読み込んだ保存先:', savedDirectory);
      }
      
      // saveDirectoryの設定が完了するまで少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // データ読み込み関数（現在のsaveDirectory値を使用）
      const loadDataWithDirectory = async (key: string): Promise<string | null> => {
        if (savedDirectory === '') {
          // localStorageから読み込み
          return localStorage.getItem(key);
        } else if (window.electronAPI) {
          // ファイルから読み込み
          return await window.electronAPI?.loadData(key) || null;
        }
        return null;
      };
      
      console.log('データ読み込み開始 - 保存先:', savedDirectory);
      console.log('loadDataWithDirectory関数が使用する保存先:', savedDirectory);
      
      // characters
      const savedChars = await loadDataWithDirectory('voiscripter_characters');
      if (savedChars) {
        try {
          const parsedChars = JSON.parse(savedChars);
          // 既存のキャラクターにグループプロパティを追加
          const charsWithGroups = parsedChars.map((char: any) => ({
            ...char,
            group: char.group || 'なし',
            backgroundColor: char.backgroundColor || '#e5e7eb'
          }));
          setCharacters(charsWithGroups);
          console.log('キャラクター設定読み込み成功:', charsWithGroups.length, '個');
        } catch (error) {
          console.error('キャラクター設定パースエラー:', error);
          setCharacters([]);
        }
      } else {
        console.log('キャラクター設定が見つかりません');
        setCharacters([]);
      }
      
      // groups
      const savedGroups = await loadDataWithDirectory('voiscripter_groups');
      if (savedGroups !== null && savedGroups !== undefined) {
        try {
          const parsedGroups = JSON.parse(savedGroups);
          if (Array.isArray(parsedGroups)) {
            setGroups(parsedGroups); // 空配列でも必ずセット
            isFirstGroups.current = false;
            console.log('グループ設定読み込み成功:', parsedGroups.length, '個');
          } else {
            console.warn('Invalid groups data format:', parsedGroups);
            setGroups([]);
            isFirstGroups.current = false;
          }
        } catch (error) {
          console.error('Groups parse error:', error);
          setGroups([]);
          isFirstGroups.current = false;
        }
      } else {
        console.log('グループ設定が見つかりません');
        setGroups([]);
        isFirstGroups.current = false;
      }
      
      // グループデータが一度も保存されていない場合のみ、キャラクターからグループを抽出
      // （この分岐は初回のみ実行される）
      const savedCharsForGroups = await loadDataWithDirectory('voiscripter_characters');
      if (savedCharsForGroups) {
        try {
          const parsedChars = JSON.parse(savedCharsForGroups);
          const extractedGroups = parsedChars
            .map((char: any) => char.group || 'なし')
            .filter((group: string) => group !== 'なし')
            .filter((group: string, index: number, arr: string[]) => arr.indexOf(group) === index);
          setGroups(extractedGroups);
          isFirstGroups.current = false;
        } catch (error) {
          console.error('Failed to extract groups from characters:', error);
          setGroups([]);
          isFirstGroups.current = false;
        }
      } else {
        setGroups([]);
        isFirstGroups.current = false;
      }
      
      // projectId（最後に開いていたプロジェクト）
      const lastProject = await loadDataWithDirectory('voiscripter_lastProject');
      console.log('読み込まれたvoiscripter_lastProject:', lastProject);
      
      // プロジェクトリストを先に取得（存在チェック用）
      let availableProjects: string[] = [];
      if (savedDirectory === '') {
        // localStorageから読み込み
        const keys = Object.keys(localStorage)
          .filter(k => k.startsWith('voiscripter_project_') &&
            !k.endsWith('_lastScene') &&
            !k.endsWith('_undo') &&
            !k.endsWith('_redo'));
        availableProjects = keys.map(k => k.replace('voiscripter_project_', ''));
        console.log('localStorageから利用可能なプロジェクト:', availableProjects);
      } else if (window.electronAPI) {
        // ファイルから読み込み
        try {
          const keys = await window.electronAPI.listDataKeys() || [];
          console.log('ファイルから取得したキー一覧:', keys);
          availableProjects = keys.filter(k => k.startsWith('voiscripter_project_') &&
            !k.endsWith('_lastScene') &&
            !k.endsWith('_undo') &&
            !k.endsWith('_redo'));
          availableProjects = availableProjects.map(k => k.replace('voiscripter_project_', ''));
          console.log('ファイルから利用可能なプロジェクト:', availableProjects);
        } catch (error) {
          console.error('プロジェクトリスト取得エラー:', error);
          availableProjects = [];
        }
      }
      
      // lastProjectが有効なプロジェクト名かチェック
      let validProjectId = 'default';
      if (lastProject && lastProject !== 'lastProject' && lastProject.trim() !== '') {
        // プロジェクトリストに存在するかチェック
        if (availableProjects.includes(lastProject)) {
          validProjectId = lastProject;
          console.log('最後に開いていたプロジェクトが有効です:', validProjectId);
        } else {
          console.log('最後に開いていたプロジェクトが存在しません:', lastProject);
          // 存在しないプロジェクトIDの場合は、voiscripter_lastProjectをクリア
          if (savedDirectory === '') {
            localStorage.removeItem('voiscripter_lastProject');
          } else if (window.electronAPI) {
            window.electronAPI.deleteData('voiscripter_lastProject');
          }
        }
      } else {
        console.log('voiscripter_lastProjectが見つからないか無効です');
      }
      
      setProjectId(validProjectId);
      console.log('設定されたprojectId:', validProjectId);
      
      // projectListを設定
      setProjectList(availableProjects);
      
      // デフォルトプロジェクトの初期化（存在しない場合）
      const defaultProjectExists = await loadDataWithDirectory('voiscripter_project_default');
      if (!defaultProjectExists) {
        const defaultProject = {
          id: 'default',
          name: '新しいプロジェクト',
          scenes: [{
            id: Date.now().toString(),
            name: '新しいシーン',
            scripts: [{ id: Date.now().toString(), title: '新しいシーン', blocks: [], characters: [] }]
          }]
        };
        // 現在のsaveDirectoryに保存
        if (savedDirectory === '') {
          localStorage.setItem('voiscripter_project_default', JSON.stringify(defaultProject));
          console.log('localStorageにデフォルトプロジェクトを保存');
        } else if (window.electronAPI) {
          await window.electronAPI.saveData('voiscripter_project_default', JSON.stringify(defaultProject));
          console.log('ファイルにデフォルトプロジェクトを保存');
        }
        console.log('デフォルトプロジェクトを初期化しました');
      } else {
        console.log('デフォルトプロジェクトは既に存在します');
      }
      
      // undo/redo（projectId設定後に実行）
      const u = await loadDataWithDirectory(`voiscripter_project_${validProjectId}_undo`);
      if (u) {
        try {
          const parsedUndo = JSON.parse(u);
          if (Array.isArray(parsedUndo)) {
            setUndoStack(parsedUndo);
          } else {
            console.error('Invalid undo stack format');
            setUndoStack([]);
          }
        } catch (error) {
          console.error('Undo stack parse error:', error);
          setUndoStack([]);
        }
      }
      
      const r = await loadDataWithDirectory(`voiscripter_project_${validProjectId}_redo`);
      if (r) {
        try {
          const parsedRedo = JSON.parse(r);
          if (Array.isArray(parsedRedo)) {
            setRedoStack(parsedRedo);
          } else {
            console.error('Invalid redo stack format');
            setRedoStack([]);
          }
        } catch (error) {
          console.error('Redo stack parse error:', error);
          setRedoStack([]);
        }
      }
    };
    
    loadInitialData();
  }, []);

  // characters保存（初回マウント時の復元直後は保存しない）
  const isFirstCharacters = useRef(true);
  useEffect(() => {
    if (isFirstCharacters.current) {
      isFirstCharacters.current = false;
      return;
    }
    if (typeof window === 'undefined') return;
    
    // キャラクター設定が空でない場合のみ保存
    if (characters.length > 0) {
      saveData('voiscripter_characters', JSON.stringify(characters));
      console.log('キャラクター設定を保存:', characters.length, '個');
    }
  }, [characters, saveDirectory]);

  // groups保存
  useEffect(() => {
    if (isFirstGroups.current) return;
    if (typeof window === 'undefined') return;
    
    // グループ設定が空でない場合のみ保存
    if (groups.length > 0) {
      saveData('voiscripter_groups', JSON.stringify(groups));
      console.log('グループ設定を保存:', groups.length, '個');
    }
  }, [groups, saveDirectory]);

  // saveDirectory変更時のキャラクター・グループ設定の再保存
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (saveDirectory !== '') {
      // ファイル保存先に変更された場合、既存のキャラクター・グループ設定を保存
      if (characters.length > 0) {
        saveData('voiscripter_characters', JSON.stringify(characters));
        console.log('saveDirectory変更後、キャラクター設定を保存:', characters.length, '個');
      }
      if (groups.length > 0) {
        saveData('voiscripter_groups', JSON.stringify(groups));
        console.log('saveDirectory変更後、グループ設定を保存:', groups.length, '個');
      }
    } else {
      // localStorageに変更された場合、現在のデータをlocalStorageに保存
      if (characters.length > 0) {
        localStorage.setItem('voiscripter_characters', JSON.stringify(characters));
        console.log('localStorage変更後、キャラクター設定を保存:', characters.length, '個');
      }
      if (groups.length > 0) {
        localStorage.setItem('voiscripter_groups', JSON.stringify(groups));
        console.log('localStorage変更後、グループ設定を保存:', groups.length, '個');
      }
      if (project.id && project.scenes.length > 0) {
        localStorage.setItem(`voiscripter_project_${project.id}`, JSON.stringify(project));
        console.log('localStorage変更後、プロジェクトを保存');
      }
      if (selectedSceneId) {
        localStorage.setItem(`voiscripter_project_${project.id}_lastScene`, selectedSceneId);
        console.log('localStorage変更後、シーン選択を保存');
      }
      
    }
  }, [saveDirectory, characters, groups, project, selectedSceneId]);

  // プロジェクト保存・復元
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // プロジェクト保存
    const saveProject = () => {
      const key = `voiscripter_project_${project.id}`;
      saveData(key, JSON.stringify(project));
      // 最後に開いていたシーンIDも保存
      if (selectedSceneId) {
        saveData(`voiscripter_project_${project.id}_lastScene`, selectedSceneId);
      }
    };
    saveProject();
  }, [project, selectedSceneId, saveDirectory]);

  // 初回マウント時のフラグ
  const isInitialMount = useRef(true);

  // プロジェクト切替時の復元
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadProject = async () => {
      const key = `voiscripter_project_${projectId}`;
      
      // 現在のsaveDirectoryの状態に基づいてデータを読み込み
      let saved: string | null = null;
      if (saveDirectory === '') {
        // localStorageから読み込み
        saved = localStorage.getItem(key);
      } else if (window.electronAPI) {
        // ファイルから読み込み
        saved = await window.electronAPI?.loadData(key) || null;
      }
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.scenes)) {
            setProject(parsed);
            // シーンID復元
            let lastSceneId: string | null = null;
            if (saveDirectory === '') {
              lastSceneId = localStorage.getItem(`voiscripter_project_${parsed.id}_lastScene`);
            } else if (window.electronAPI) {
              lastSceneId = await window.electronAPI?.loadData(`voiscripter_project_${parsed.id}_lastScene`) || null;
            }
            
            if (lastSceneId && parsed.scenes.some((s: any) => s.id === lastSceneId)) {
              setSelectedSceneId(lastSceneId);
            } else if (parsed.scenes.length > 0) {
              setSelectedSceneId(parsed.scenes[0].id);
            } else {
              setSelectedSceneId(null);
            }
            
            // 初回マウント時は保存しない（voiscripter_lastProjectの値を保持するため）
            if (!isInitialMount.current) {
              saveData('voiscripter_lastProject', projectId);
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
        
        // 新規プロジェクトを保存
        saveData(`voiscripter_project_${projectId}`, JSON.stringify(newProject));
        
        // 初回マウント時は保存しない（voiscripter_lastProjectの値を保持するため）
        if (!isInitialMount.current) {
          saveData('voiscripter_lastProject', projectId);
        }
      }
      
      // デフォルトプロジェクトの確認と初期化
      if (projectId === 'default') {
        let defaultProjectData: string | null = null;
        if (saveDirectory === '') {
          defaultProjectData = localStorage.getItem(`voiscripter_project_default`);
        } else if (window.electronAPI) {
          defaultProjectData = await window.electronAPI?.loadData(`voiscripter_project_default`) || null;
        }
        
        if (!defaultProjectData) {
          const defaultProject = {
            id: 'default',
            name: '新しいプロジェクト',
            scenes: [{
              id: Date.now().toString(),
              name: '新しいシーン',
              scripts: [{ id: Date.now().toString(), title: '新しいシーン', blocks: [], characters: [] }]
            }]
          };
          saveData('voiscripter_project_default', JSON.stringify(defaultProject));
          console.log('デフォルトプロジェクトを初期化しました');
        }
      }
    };
    loadProject();
  }, [projectId, saveDirectory]);

  // 初回マウント完了フラグを設定
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 初期データ読み込みが完了したらフラグを設定
      const timer = setTimeout(() => {
        isInitialMount.current = false;
        console.log('初期マウント完了フラグを設定');
      }, 1000); // 1秒後にフラグを設定
      
      return () => clearTimeout(timer);
    }
  }, []);

  // プロジェクト削除時のscenes/selectedSceneIdリセット
  useEffect(() => {
    if (projectList.length === 0) {
      const defaultProject = {
        id: 'default',
        name: '新しいプロジェクト',
        scenes: [{
          id: Date.now().toString(),
          name: '新しいシーン',
          scripts: [{ id: Date.now().toString(), title: '新しいシーン', blocks: [], characters: [] }]
        }]
      };
      setProject(defaultProject);
      setSelectedSceneId(defaultProject.scenes[0].id);
      
      // デフォルトプロジェクトを保存
      saveData('voiscripter_project_default', JSON.stringify(defaultProject));
    }
  }, [projectList, saveDirectory]);

  // プロジェクト新規作成
  const handleNewProject = () => {
    setIsProjectDialogOpen(true);
  };

  // プロジェクトリスト再取得関数
  const refreshProjectList = async () => {
    if (saveDirectory === '') {
      const keys = Object.keys(localStorage)
        .filter(k => k.startsWith('voiscripter_project_') &&
          !k.endsWith('_lastScene') &&
          !k.endsWith('_undo') &&
          !k.endsWith('_redo'));
      const projectKeys = keys.map(k => k.replace('voiscripter_project_', ''));
      setProjectList(projectKeys);
    } else if (window.electronAPI) {
      try {
        const keys = await window.electronAPI.listDataKeys() || [];
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
    
    // 最後に開いていたプロジェクトとして保存
    saveData('voiscripter_lastProject', name);
    
    showNotification(`プロジェクト「${name}」を作成しました`, 'success');
    setTimeout(refreshProjectList, 200);
  };

  // プロジェクト削除時にリスト更新
  useEffect(() => {
    refreshProjectList();
  }, [projectId, saveDirectory]);

  // プロジェクト削除
  const handleDeleteProject = () => {
    if (projectId === 'default') {
      showNotification('デフォルトプロジェクトは削除できません', 'error');
      return;
    }

    // 削除確認を開始（confirmedはnullで初期化）
    setDeleteConfirmation({ projectId, confirmed: null });
  };

  // ダークモード管理
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const applyTheme = () => {
      const userTheme = localStorage.getItem('theme');
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = userTheme === 'dark' || (!userTheme && systemDark);
      setIsDarkMode(isDark);
      document.documentElement.classList.toggle('dark', isDark);
    };

    applyTheme();

    // システムテーマ変更時のリスナー
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (!localStorage.getItem('theme')) {
        applyTheme();
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const handleThemeChange = (isDark: boolean) => {
    setIsDarkMode(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDark);
  };

  // データ保存先変更
  const handleSaveDirectoryChange = async (directory: string) => {
    const previousDirectory = saveDirectory;
    setSaveDirectory(directory);
    
    // 設定を保存
    if (window.electronAPI) {
      try {
        await window.electronAPI.saveSettings({ saveDirectory: directory });
      } catch (error) {
        console.error('設定保存エラー:', error);
      }
    } else {
      localStorage.setItem('voiscripter_saveDirectory', directory);
    }
    
    // 保存先が変更された場合、既存データを移動
    if (directory !== '' && previousDirectory === '') {
      // localStorageからファイルに移動
      if (window.electronAPI) {
        try {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('voiscripter_'));
          console.log('移動するキー:', keys);
          
          for (const key of keys) {
            const data = localStorage.getItem(key);
            if (data) {
              try {
                await window.electronAPI.saveData(key, data);
                console.log(`データ移動成功: ${key}`);
              } catch (error) {
                console.error(`データ移動エラー (${key}):`, error);
              }
            }
          }
          
          // キャラクター設定を明示的に保存
          if (characters.length > 0) {
            try {
              await window.electronAPI.saveData('voiscripter_characters', JSON.stringify(characters));
              console.log('キャラクター設定保存成功');
            } catch (error) {
              console.error('キャラクター設定保存エラー:', error);
            }
          }
          
          // グループ設定を明示的に保存
          if (groups.length > 0) {
            try {
              await window.electronAPI.saveData('voiscripter_groups', JSON.stringify(groups));
              console.log('グループ設定保存成功');
            } catch (error) {
              console.error('グループ設定保存エラー:', error);
            }
          }
          
          showNotification('データの移動が完了しました', 'success');
        } catch (error) {
          console.error('データ移動処理エラー:', error);
          showNotification('データの移動に失敗しました', 'error');
        }
      }
    } else if (directory === '' && previousDirectory !== '') {
      // ファイルからlocalStorageに移動
      if (window.electronAPI) {
        try {
          const keys = await window.electronAPI.listDataKeys() || [];
          console.log('読み込むキー:', keys);
          
          for (const key of keys) {
            const data = await window.electronAPI.loadData(key);
            if (data) {
              localStorage.setItem(key, data);
              console.log(`データ読み込み成功: ${key}`);
            }
          }
          
          // 現在のメモリ上のデータもlocalStorageに保存
          if (characters.length > 0) {
            localStorage.setItem('voiscripter_characters', JSON.stringify(characters));
            console.log('現在のキャラクター設定をlocalStorageに保存');
          }
          if (groups.length > 0) {
            localStorage.setItem('voiscripter_groups', JSON.stringify(groups));
            console.log('現在のグループ設定をlocalStorageに保存');
          }
          if (project.id && project.scenes.length > 0) {
            localStorage.setItem(`voiscripter_project_${project.id}`, JSON.stringify(project));
            console.log('現在のプロジェクトをlocalStorageに保存');
          }
          if (selectedSceneId) {
            localStorage.setItem(`voiscripter_project_${project.id}_lastScene`, selectedSceneId);
            console.log('現在のシーン選択をlocalStorageに保存');
          }
          
          // プロジェクトリストを再読み込み
          setTimeout(async () => {
            try {
              const keys = Object.keys(localStorage)
                .filter(k => k.startsWith('voiscripter_project_') &&
                  !k.endsWith('_lastScene') &&
                  !k.endsWith('_undo') &&
                  !k.endsWith('_redo'));
              const projectKeys = keys.map(k => k.replace('voiscripter_project_', ''));
              setProjectList(projectKeys);
              console.log('localStorageからプロジェクトリスト再読み込み:', projectKeys);
            } catch (error) {
              console.error('プロジェクトリスト再読み込みエラー:', error);
            }
          }, 500);
          
          showNotification('データの移動が完了しました', 'success');
        } catch (error) {
          console.error('データ移動エラー:', error);
          showNotification('データの移動に失敗しました', 'error');
        }
      }
    } else if (directory !== '' && previousDirectory !== '' && directory !== previousDirectory) {
      // 異なるディレクトリ間でのデータ移動
      if (window.electronAPI) {
        try {
          console.log(`ディレクトリ間データ移動: ${previousDirectory} → ${directory}`);
          
          // 現在のプロジェクトIDを保存
          const currentProjectId = projectId;
          console.log('データ移動前のプロジェクトID:', currentProjectId);
          
          // 新しいディレクトリ間データ移動機能を使用
          const result = await window.electronAPI.moveDataBetweenDirectories(previousDirectory, directory);
          
          if (result.success) {
            console.log(`${result.movedCount}個のファイルを移動しました`);
            
            // プロジェクトリストを再読み込み
            setTimeout(async () => {
              try {
                if (window.electronAPI) {
                  const keys = await window.electronAPI.listDataKeys() || [];
                  const projectKeys = keys.filter(k => k.startsWith('voiscripter_') && !k.endsWith('_undo') && !k.endsWith('_redo') && k !== 'voiscripter_characters' && k !== 'voiscripter_lastProject' && k !== 'voiscripter_saveDirectory' && k !== 'voiscripter_groups');
                  const projectNames = projectKeys.map(k => k.replace('voiscripter_', ''));
                  setProjectList(projectNames);
                  console.log('ディレクトリ移動後のプロジェクトリスト:', projectNames);
                  
                  // データ移動後はdefaultプロジェクトに切り替え
                  console.log('データ移動後、defaultプロジェクトに切り替え');
                  setProjectId('default');
                  setProject({
                    id: 'default',
                    name: '新しいプロジェクト',
                    scenes: []
                  });
                  setUndoStack([]);
                  setRedoStack([]);
                  
                  // defaultプロジェクトのデータを空にする
                  try {
                    await window.electronAPI.saveData('voiscripter_project_default', JSON.stringify({
                      id: 'default',
                      name: '新しいプロジェクト',
                      scenes: []
                    }));
                    console.log('defaultプロジェクトを空にしました');
                  } catch (error) {
                    console.error('defaultプロジェクトの初期化エラー:', error);
                  }
                  
                  // キャラクター設定も再読み込み
                  const charactersData = await window.electronAPI.loadData('voiscripter_characters');
                  if (charactersData) {
                    try {
                      const parsedCharacters = JSON.parse(charactersData);
                      const charsWithGroups = parsedCharacters.map((char: any) => ({
                        ...char,
                        group: char.group || 'なし',
                        backgroundColor: char.backgroundColor || '#e5e7eb'
                      }));
                      setCharacters(charsWithGroups);
                      console.log('キャラクター設定再読み込み成功:', charsWithGroups.length, '個');
                    } catch (error) {
                      console.error('キャラクター設定再読み込みエラー:', error);
                    }
                  }
                  
                  // グループ設定も再読み込み
                  const groupsData = await window.electronAPI.loadData('voiscripter_groups');
                  if (groupsData) {
                    try {
                      const parsedGroups = JSON.parse(groupsData);
                      if (Array.isArray(parsedGroups)) {
                        setGroups(parsedGroups);
                        console.log('グループ設定再読み込み成功:', parsedGroups.length, '個');
                      }
                    } catch (error) {
                      console.error('グループ設定再読み込みエラー:', error);
                    }
                  }
                }
              } catch (error) {
                console.error('プロジェクトリスト取得エラー:', error);
              }
            }, 1000); // タイミングを調整
            
            showNotification('データの移動が完了しました', 'success');
          } else {
            throw new Error('データ移動に失敗しました');
          }
        } catch (error) {
          console.error('ディレクトリ間データ移動エラー:', error);
          showNotification('データの移動に失敗しました', 'error');
        }
      }
    }
  };

  // キャラクター追加
  const handleAddCharacter = (character: Character) => {
    setCharacters(prev => ([...prev, character]));
  };
  // キャラクター編集
  const handleUpdateCharacter = (updated: Character) => {
    setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c));
  };
  // キャラクター削除
  const handleDeleteCharacter = (id: string) => {
    setCharacters(prev => prev.filter(c => c.id !== id));
    // blocks内のcharacterIdも空にする（現在のプロジェクトの選択中シーン）
    if (selectedSceneId) {
      setProject(prev => ({
        ...prev,
        scenes: prev.scenes.map(scene =>
          scene.id === selectedSceneId
            ? {
                ...scene,
                scripts: scene.scripts.map(script => ({
                  ...script,
                  blocks: script.blocks.map(b => b.characterId === id ? { ...b, characterId: '' } : b)
                }))
              }
            : scene
        )
      }));
    }
  };

  // グループ追加
  const handleAddGroup = (group: string) => {
    setGroups(prev => [...prev, group]);
  };

  // グループ削除
  const handleDeleteGroup = (group: string) => {
    setGroups(prev => prev.filter(g => g !== group));
    // 削除されたグループのキャラクターを「なし」に変更
    setCharacters(prev => prev.map(char => 
      char.group === group ? { ...char, group: 'なし' } : char
    ));
  };

  // ブロック編集
  const handleUpdateBlock = (blockId: string, updates: Partial<ScriptBlock>) => {
    if (!selectedSceneId) return;
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene =>
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
    }));
  };
  
  // ブロック追加
  const handleAddBlock = () => {
    if (!selectedSceneId) return;
    const currentScript = project.scenes.find(s => s.id === selectedSceneId)?.scripts[0];
    if (!currentScript) return;
    
    const lastSerif = [...currentScript.blocks].reverse().find(b => b.characterId);
    const charId = lastSerif?.characterId || characters[0]?.id || '';
    const emotion = lastSerif?.emotion || 'normal';
    const newBlock: ScriptBlock = {
      id: Date.now().toString(),
      characterId: charId,
      emotion,
      text: ''
    };
    
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene =>
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
    }));
  };

  // ブロック削除
  const handleDeleteBlock = (blockId: string) => {
    if (!selectedSceneId) return;
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene =>
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
    }));
  };

  // ブロック挿入（ト書き用）
  const handleInsertBlock = (block: ScriptBlock, index: number) => {
    if (!selectedSceneId) return;
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene =>
        scene.id === selectedSceneId
          ? {
              ...scene,
              scripts: scene.scripts.map(script => {
                const newBlocks = [...script.blocks];
                newBlocks.splice(index, 0, block);
                return { ...script, blocks: newBlocks };
              })
            }
          : scene
      )
    }));
  };

  // ブロック移動
  const handleMoveBlock = (fromIndex: number, toIndex: number) => {
    if (!selectedSceneId) return;
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene =>
        scene.id === selectedSceneId
          ? {
              ...scene,
              scripts: scene.scripts.map(script => {
                const newBlocks = [...script.blocks];
                const [movedBlock] = newBlocks.splice(fromIndex, 1);
                newBlocks.splice(toIndex, 0, movedBlock);
                return { ...script, blocks: newBlocks };
              })
            }
          : scene
      )
    }));
  };

  // CSVエクスポート（話者,セリフ）
  const handleExportCSV = async (includeTogaki?: boolean, selectedOnly?: boolean) => {
    // 現在選択中のシーンのスクリプトを使用
    const currentScript = selectedScene?.scripts[0] || { id: '', title: '', blocks: [], characters: [] };
    let targetBlocks = currentScript.blocks;
    
    // 選択ブロックのみの場合
    if (selectedOnly && selectedBlockIds.length > 0) {
      targetBlocks = currentScript.blocks.filter(block => selectedBlockIds.includes(block.id));
    }
    
    const rows = targetBlocks
      .filter(block => includeTogaki ? true : block.characterId)
      .map(block => {
        if (!block.characterId) {
          return ['ト書き', block.text.replace(/\n/g, '\\n')];
        }
        const char = characters.find(c => c.id === block.characterId);
        return [char ? char.name : '', block.text.replace(/\n/g, '\\n')];
      });
    
    // CSVエンコード関数
    const encodeCSV = (rows: string[][]) => {
      return rows.map(row => 
        row.map(cell => {
          // セルにカンマ、改行、ダブルクォートが含まれる場合はダブルクォートで囲む
          if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',')
      ).join('\r\n');
    };

    const csv = encodeCSV(rows);
    const defaultName = `${project.name || 'project'}_${currentScript.title || 'script'}.csv`;
    
    if (window.electronAPI) {
      try {
        await window.electronAPI.saveCSVFile(defaultName, csv);
      } catch (error) {
        console.error('CSV保存エラー:', error);
        alert('CSVファイルの保存に失敗しました。');
      }
    } else {
      // ブラウザ環境では従来の方法
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // セリフだけエクスポート
  const handleExportSerifOnly = async (selectedOnly?: boolean) => {
    // 現在選択中のシーンのスクリプトを使用
    const currentScript = selectedScene?.scripts[0] || { id: '', title: '', blocks: [], characters: [] };
    let targetBlocks = currentScript.blocks;
    
    // 選択ブロックのみの場合
    if (selectedOnly && selectedBlockIds.length > 0) {
      targetBlocks = currentScript.blocks.filter(block => selectedBlockIds.includes(block.id));
    }
    
    const rows = targetBlocks
      .filter(block => block.characterId) // ト書きは除外
      .map(block => [block.text]);
    
    // CSVエンコード関数
    const encodeCSV = (rows: string[][]) => {
      return rows.map(row => 
        row.map(cell => {
          // セルにカンマ、改行、ダブルクォートが含まれる場合はダブルクォートで囲む
          if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',')
      ).join('\r\n');
    };

    const csv = encodeCSV(rows);
    const defaultName = `${project.name || 'project'}_${currentScript.title || 'serif'}.csv`;
    
    if (window.electronAPI) {
      try {
        await window.electronAPI.saveCSVFile(defaultName, csv);
      } catch (error) {
        console.error('CSV保存エラー:', error);
        alert('CSVファイルの保存に失敗しました。');
      }
    } else {
      // ブラウザ環境では従来の方法
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // グループ別エクスポート
  const handleExportByGroups = async (
    selectedGroups: string[],
    exportType: 'full' | 'serif-only',
    includeTogaki?: boolean,
    selectedOnly?: boolean,
    sceneIds?: string[]
  ) => {
    // デバッグ用出力
    console.log('handleExportByGroups sceneIds:', sceneIds);
    let targetScenes;
    if (Array.isArray(sceneIds) && sceneIds.length > 0) {
      targetScenes = project.scenes.filter(s => sceneIds.includes(s.id));
    } else {
      targetScenes = project.scenes;
    }
    console.log('targetScenes:', targetScenes.map(s => s.name));
    for (const scene of targetScenes) {
      const script = scene.scripts[0];
      console.log('selectedGroups in handleExportByGroups', selectedGroups);
      for (const group of selectedGroups) {
        // グループに属するキャラクターのIDを取得
        const groupCharacterIds = characters
          .filter(char => char.group === group)
          .map(char => char.id);
        // グループに属するキャラクターのブロックのみをフィルタリング
        let groupBlocks = script.blocks.filter(block =>
          (block.characterId && groupCharacterIds.includes(block.characterId))
        );
        // ト書きも含める場合
        if (includeTogaki) {
          groupBlocks = [
            ...groupBlocks,
            ...script.blocks.filter(block => !block.characterId)
          ];
        }
        // 選択ブロックのみの場合
        if (selectedOnly && selectedBlockIds.length > 0) {
          groupBlocks = groupBlocks.filter(block => selectedBlockIds.includes(block.id));
        }
        if (groupBlocks.length === 0) {
          console.log(`シーン「${scene.name}」グループ「${group}」にはセリフがありません`);
          continue;
        }
        let rows: string[][];
        let filename: string;
        if (exportType === 'full') {
          rows = groupBlocks.map(block => {
            if (!block.characterId) {
              return ['ト書き', block.text.replace(/\n/g, '\\n')];
            }
            const char = characters.find(c => c.id === block.characterId);
            return [char ? char.name : '', block.text.replace(/\n/g, '\\n')];
          });
        } else {
          rows = groupBlocks.map(block => [block.text.replace(/\n/g, '\\n')]);
        }
        filename = `${project.name || 'project'}_${scene.name}_${group}.csv`;
        // CSVエンコード関数
        const encodeCSV = (rows: string[][]) =>
          rows.map(row =>
            row.map(cell =>
              cell.includes(',') || cell.includes('\n') || cell.includes('"')
                ? `"${cell.replace(/"/g, '""')}"`
                : cell
            ).join(',')
          ).join('\r\n');
        const csv = encodeCSV(rows);
        if (window.electronAPI) {
          try {
            await window.electronAPI.saveCSVFile(filename, csv);
          } catch (error) {
            alert(`グループ「${group}」のCSVファイルの保存に失敗しました。`);
          }
        } else {
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    }
  };

  // キャラクター設定のCSVエクスポート
  const handleExportCharacterCSV = () => {
    const rows = [
      ['ID', '名前', 'アイコン', 'グループ', '背景色'],
      ...characters.map(char => [
        char.id,
        char.name,
        char.emotions.normal.iconUrl,
        char.group,
        char.backgroundColor || '#e5e7eb'
      ])
    ];
    
    // CSVエンコード関数
    const encodeCSV = (rows: string[][]) => {
      return rows.map(row => 
        row.map(cell => {
          // セルにカンマ、改行、ダブルクォートが含まれる場合はダブルクォートで囲む
          if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(',')
      ).join('\r\n');
    };

    const csv = encodeCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `characters.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // クリップボードに出力
  const handleExportToClipboard = async (serifOnly?: boolean, selectedOnly?: boolean, includeTogaki?: boolean) => {
    // プロジェクト全体の全シーン・全ブロックを対象
    let allBlocks = project.scenes.flatMap(scene => scene.scripts[0]?.blocks || []);
    
    // 選択ブロックのみの場合
    if (selectedOnly && selectedBlockIds.length > 0) {
      allBlocks = allBlocks.filter(block => selectedBlockIds.includes(block.id));
    }
    
    let text: string;
    if (serifOnly) {
      // セリフだけ
      text = allBlocks
        .filter(block => includeTogaki ? true : block.characterId)
        .map(block => block.text)
        .join('\n');
    } else {
      // 話者とセリフ
      text = allBlocks
        .filter(block => includeTogaki ? true : block.characterId)
        .map(block => {
          if (block.characterId) {
            const char = characters.find(c => c.id === block.characterId);
            return `${char ? char.name : ''}: ${block.text}`;
          } else {
            // ト書きの場合
            return block.text;
          }
        })
        .join('\n');
    }
    try {
      await navigator.clipboard.writeText(text);
      showNotification('クリップボードにコピーしました。', 'success');
    } catch (error) {
      showNotification('クリップボードへの出力に失敗しました。', 'error');
    }
  };

  // CSVインポート（話者,セリフ）
  const handleImportCSV = async (file: File, options?: { mode: 'append' | 'new'; projectName?: string }) => {
    try {
      const text = await file.text();
      
      // CSVパース関数
      const parseCSV = (csvText: string) => {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        return lines.map(line => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                // エスケープされたダブルクォート
                current += '"';
                i++; // 次のダブルクォートをスキップ
              } else {
                // クォートの開始/終了
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              // フィールドの区切り
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          // 最後のフィールド
          result.push(current.trim());
          return result;
        });
      };

      const rows = parseCSV(text);

      // 1行目が「ID」「名前」「アイコン」「グループ」などのヘッダーでなければ全行インポート
      let dataRows = rows;
      if (rows.length > 0 && (rows[0][0].includes('ID') || rows[0][1]?.includes('名前') || rows[0][0].toLowerCase().includes('id'))) {
        dataRows = rows.slice(1);
      }
      const newBlocks: ScriptBlock[] = dataRows
        .filter(row => row.length >= 2 && (row[0] || row[1])) // 空行を除外
        .map(([speaker, text]) => {
          const character = characters.find(c => c.name === speaker);
          
          if (character) {
            // キャラクターが存在する場合はセリフブロックとして追加
            return {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              characterId: character.id,
              emotion: 'normal',
              text: (text || '').replace(/\\n/g, '\n').replace(/\n/g, '\n')
            };
          } else if(speaker === 'ト書き'){
            // 話者がト書きの場合は話者情報を追加しない
            return {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              characterId: '',
              emotion: 'normal',
              text: (text || '').replace(/\\n/g, '\n').replace(/\n/g, '\n')
            };
          } else {
            // キャラクターが存在しない場合はト書きとして追加
            return {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              characterId: '',
              emotion: 'normal',
              text: `【${speaker}】${(text || '').replace(/\\n/g, '\n').replace(/\n/g, '\n')}`
            };
          }
        });

      if (options?.mode === 'new') {
        if (!options.projectName) return;
        // 新しいプロジェクト構造を作成
        const newSceneId = Date.now().toString();
        const newScriptId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const newProject = {
          id: options.projectName,
          name: options.projectName,
          scenes: [
            {
              id: newSceneId,
              name: options.projectName,
              scripts: [
                {
                  id: newScriptId,
                  title: options.projectName,
                  blocks: newBlocks,
                  characters: []
                }
              ]
            }
          ]
        };
        saveData(`voiscripter_project_${options.projectName}`, JSON.stringify(newProject));
        setProjectList((prev: string[]) => {
          const name = options.projectName as string;
          return prev.includes(name) ? prev : [...prev, name];
        });
        setProject(newProject);
        setProjectId(options.projectName);
        setSelectedSceneId(newSceneId);
        showNotification(`${newBlocks.length}個のブロックを新規プロジェクト「${options.projectName}」にインポートしました。`, 'success');
      } else {
        // 選択中シーンのscripts[0].blocksに追加
        if (!selectedSceneId) {
          // 選択中シーンが存在しない場合は、デフォルトシーンを作成
          const newSceneId = Date.now().toString();
          const newScene = {
            id: newSceneId,
            name: '新しいシーン',
            scripts: [{ id: Date.now().toString(), title: '新しいシーン', blocks: newBlocks, characters: [] }]
          };
          
          // 現在のプロジェクトにシーンを追加
          setProject(prev => {
            const updatedProject = {
              ...prev,
              scenes: [...prev.scenes, newScene]
            };
            
            // プロジェクトを保存
            saveData(`voiscripter_project_${prev.id}`, JSON.stringify(updatedProject));
            return updatedProject;
          });
          
          setSelectedSceneId(newSceneId);
          showNotification(`${newBlocks.length}個のブロックを新規シーンにインポートしました。`, 'success');
        } else {
          // 選択中シーンに追加
          setProject(prev => {
            const updatedProject = {
              ...prev,
              scenes: prev.scenes.map(scene =>
                scene.id === selectedSceneId
                  ? {
                      ...scene,
                      scripts: scene.scripts.length > 0
                        ? [{
                            ...scene.scripts[0],
                            blocks: [...scene.scripts[0].blocks, ...newBlocks]
                          }]
                        : [{ id: Date.now().toString(), title: scene.name, blocks: newBlocks, characters: [] }]
                    }
                  : scene
              )
            };
            
            // プロジェクトを保存
            saveData(`voiscripter_project_${prev.id}`, JSON.stringify(updatedProject));
            return updatedProject;
          });
          
          showNotification(`${newBlocks.length}個のブロックを現在のシーンにインポートしました。`, 'success');
        }
      }
      
      // CSVインポート後に最後のブロックにフォーカス
      setTimeout(() => {
        const lastBlockIndex = newBlocks.length - 1;
        if (lastBlockIndex >= 0) {
          const textareaRefs = document.querySelectorAll('textarea');
          const lastTextarea = textareaRefs[textareaRefs.length - 1] as HTMLTextAreaElement;
          if (lastTextarea) {
            // Electron版でのフォーカス問題を解決するため、より確実なフォーカス処理
            lastTextarea.focus();
            lastTextarea.setSelectionRange(lastTextarea.value.length, lastTextarea.value.length);
            
            // Electron版での追加処理
            if (typeof window !== 'undefined' && window.electronAPI) {
              // フォーカスイベントを強制的に発火
              setTimeout(() => {
                lastTextarea.focus();
                lastTextarea.click();
                // さらに確実にするため、もう一度フォーカス
                setTimeout(() => {
                  lastTextarea.focus();
                  lastTextarea.setSelectionRange(lastTextarea.value.length, lastTextarea.value.length);
                }, 100);
              }, 50);
            }
          }
        }
      }, 200); // タイミングを調整
    } catch (error) {
      console.error('CSVインポートエラー:', error);
      showNotification('無効な台本形式です。または台本が壊れています。', 'error');
      // エラー時は何もしない（既存のプロジェクトを維持）
    }
  };

  // キャラクター設定のCSVインポート
  const handleImportCharacterCSV = async (file: File) => {
    try {
      const text = await file.text();
      
      // CSVパース関数
      const parseCSV = (csvText: string) => {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        return lines.map(line => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                // エスケープされたダブルクォート
                current += '"';
                i++; // 次のダブルクォートをスキップ
              } else {
                // クォートの開始/終了
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              // フィールドの区切り
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          // 最後のフィールド
          result.push(current.trim());
          return result;
        });
      };

      const rows = parseCSV(text);

      // 1行目が「名前」「アイコン」「グループ」などのヘッダーでなければ全行インポート
      let dataRows = rows;
      if (rows.length > 0 && (rows[0][0].includes('ID') || rows[0][0].toLowerCase().includes('id'))) {
        dataRows = rows.slice(1);
      }

      const newCharacters: Character[] = [];
      const newGroups: string[] = [];

      dataRows.forEach((row, index) => {
        if (row.length >= 4) { // ID, 名前, アイコン, グループ, 背景色（オプション）
          const characterId = row[0]?.trim() || '';
          const characterName = row[1]?.trim() || '';
          const iconUrl = row[2]?.trim() || '';
          const characterGroup = row[3]?.trim() || 'なし';
          const backgroundColor = row[4]?.trim() || '#e5e7eb'; // 背景色を追加

          if (characterName) {
            const existingCharacter = characters.find(c => c.name === characterName);
            
            if (existingCharacter) {
              // 既存のキャラクターが存在する場合
              if (existingCharacter.group !== characterGroup || existingCharacter.emotions.normal.iconUrl !== iconUrl || existingCharacter.backgroundColor !== backgroundColor || existingCharacter.id !== characterId) {
                // 設定が異なる場合は更新
                setCharacters(prev => prev.map(char => 
                  char.name === characterName 
                    ? { 
                        ...char, 
                        id: characterId,
                        group: characterGroup, 
                        emotions: { ...char.emotions, normal: { iconUrl } },
                        backgroundColor 
                      }
                    : char
                ));
                console.log(`「${characterName}」の設定を更新しました（characterId: ${existingCharacter.id}）`);
              }
            } else {
              // 新しいキャラクターを追加
              // 新しいグループを追加
              if (characterGroup && characterGroup !== 'なし' && !groups.includes(characterGroup)) {
                newGroups.push(characterGroup);
              }

              const emotions = {
                normal: { iconUrl }
              };

              newCharacters.push({
                id: characterId || Date.now().toString() + Math.random().toString(36).substr(2, 9),
                name: characterName,
                group: characterGroup,
                emotions,
                backgroundColor // 背景色を追加
              });
            }
          }
        }
      });

      // 新しいグループを追加（重複を除去）
      let actuallyAddedGroups: string[] = [];
      if (newGroups.length > 0) {
        const uniqueNewGroups = newGroups.filter((group, index) => newGroups.indexOf(group) === index);
        setGroups(prev => {
          const groupsToAdd = uniqueNewGroups.filter(group => !prev.includes(group));
          actuallyAddedGroups = groupsToAdd;
          const newGroups = [...prev, ...groupsToAdd];
          // グループ設定を永続化
          saveData('voiscripter_groups', JSON.stringify(newGroups));
          return newGroups;
        });
      }

      // 新しいキャラクターを追加
      if (newCharacters.length > 0) {
        setCharacters(prev => {
          const newCharactersList = [...prev, ...newCharacters];
          // キャラクター設定を永続化
          saveData('voiscripter_characters', JSON.stringify(newCharactersList));
          return newCharactersList;
        });
        showNotification(`${newCharacters.length}個のキャラクターをインポートしました。${actuallyAddedGroups.length > 0 ? `\n新しいグループ「${actuallyAddedGroups.join(', ')}」が追加されました。` : ''}`, 'success');
      } else {
        showNotification('キャラクター設定のインポートが完了しました。', 'success');
      }
    } catch (error) {
      console.error('キャラクター設定のCSVインポートエラー:', error);
      showNotification('キャラクター設定のCSVファイルのインポートに失敗しました。', 'error');
    }
  };

  // JSONインポート（プロジェクト/シーン）
  const handleImportJson = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // バリデーション: Project型の最低限の構造チェック
      if (!data || typeof data !== 'object' || !Array.isArray(data.scenes) || !data.name || !data.id) {
        showNotification('無効な形式のためインポートできませんでした。', 'error');
        return;
      }
      // 各シーン・スクリプト・ブロックのcharacterIdを変換
      const mappedScenes = data.scenes.map((scene: any) => ({
        ...scene,
        scripts: scene.scripts.map((script: any) => ({
          ...script,
          blocks: script.blocks.map((block: any) => {
            let newCharId = '';
            
            // デバッグログ
            console.log('Block processing:', {
              blockId: block.id,
              originalCharacterId: block.characterId,
              currentCharacters: characters.map(c => ({ id: c.id, name: c.name }))
            });
            
            // シンプルな判定: block.characterIdがcharacters内のIDに存在するかチェック
            if (block.characterId && characters.some(c => c.id === block.characterId)) {
              newCharId = block.characterId;
              console.log('Character ID found:', {
                blockCharacterId: block.characterId,
                newCharId: newCharId
              });
            } else {
              // characterIdが存在しない、またはcharacters内に見つからない場合は空文字（ト書き）
              newCharId = '';
              console.log('Character ID not found, treating as stage direction:', {
                blockCharacterId: block.characterId
              });
            }
            
            console.log('Final result:', {
              blockId: block.id,
              originalCharacterId: block.characterId,
              newCharId: newCharId
            });
            
            return {
              ...block,
              characterId: newCharId,
            };
          })
        }))
      }));
      setProject({
        id: data.id,
        name: data.name,
        scenes: mappedScenes
      });
      setSelectedSceneId(mappedScenes[0]?.id || null);
      setProjectId(data.id); // インポート直後にプロジェクトIDを切り替え
      refreshProjectList(); // プロジェクトリストも即時更新
      showNotification('プロジェクトをインポートしました', 'success');
    } catch (e) {
      showNotification('無効な形式のためインポートできませんでした。', 'error');
    }
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
    // 削除後は先頭のシーンを選択
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

  // 選択中シーンの取得
  const selectedScene = project.scenes.find(s => s.id === selectedSceneId) || null;
  // 選択中シーンのスクリプト（現状は1シーン1スクリプト想定）
  const currentScript = selectedScene?.scripts[0] || { id: '', title: '', blocks: [], characters: [] };

  // ScriptEditorの編集内容をproject.scenesに反映
  const handleUpdateScript = (updates: Partial<Script>) => {
    if (!selectedSceneId) return;
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene =>
        scene.id === selectedSceneId
          ? { ...scene, scripts: scene.scripts.length > 0 ? [{ ...scene.scripts[0], ...updates }] : [{ ...updates, id: Date.now().toString(), title: scene.name, blocks: [], characters: [] }] }
          : scene
      )
    }));
  };

  // シーン単位でCSVエクスポート（複数シーン対応）
  const handleExportSceneCSV = async (
    sceneIds: string[],
    exportType: 'full' | 'serif-only',
    includeTogaki: boolean,
    selectedOnly: boolean
  ) => {
    sceneIds.forEach(async (sceneId) => {
      const scene = project.scenes.find(s => s.id === sceneId);
      if (!scene || scene.scripts.length === 0) {
        showNotification('シーンが見つかりません', 'error');
        return;
      }
      const script = scene.scripts[0];
      let targetBlocks = script.blocks;
      if (selectedOnly && selectedBlockIds.length > 0) {
        targetBlocks = script.blocks.filter(block => selectedBlockIds.includes(block.id));
      }
      if (!targetBlocks || targetBlocks.length === 0) {
        showNotification('エクスポート対象のブロックがありません', 'info');
        return;
      }
      let rows: string[][] = [];
      if (exportType === 'full') {
        rows = targetBlocks
          .filter(block => includeTogaki ? true : block.characterId)
          .map(block => {
            if (!block.characterId) {
              return ['ト書き', block.text.replace(/\n/g, '\\n')];
            }
            const char = characters.find(c => c.id === block.characterId);
            return [char ? char.name : '', block.text.replace(/\n/g, '\\n')];
          });
      } else if (exportType === 'serif-only') {
        rows = targetBlocks
          .filter(block => block.characterId)
          .map(block => [block.text.replace(/\n/g, '\\n')]);
      }
      if (!rows || rows.length === 0) {
        showNotification('エクスポート対象のデータがありません', 'info');
        return;
      }
      // CSVエンコード
      const encodeCSV = (rows: string[][]) =>
        rows.map(row =>
          row.map(cell =>
            cell.includes(',') || cell.includes('\n') || cell.includes('"')
              ? `"${cell.replace(/"/g, '""')}"`
              : cell
          ).join(',')
        ).join('\r\n');
      const csv = encodeCSV(rows);
      const filename = `${project.name || 'project'}_${scene.name}_${exportType}.csv`;
      if (window.electronAPI) {
        try {
          await window.electronAPI.saveCSVFile(filename, csv);
          showNotification('CSVファイルを保存しました', 'success');
        } catch (error) {
          showNotification('CSVファイルの保存に失敗しました', 'error');
        }
      } else {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('CSVファイルをダウンロードしました', 'success');
      }
    });
  };

  // プロジェクト削除ダイアログの確定・キャンセル処理
  useEffect(() => {
    if (!deleteConfirmation) return;
    if (deleteConfirmation.confirmed === true) {
      // プロジェクト削除処理
      if (deleteConfirmation.projectId === 'default') {
        showNotification('デフォルトプロジェクトは削除できません', 'error');
        setDeleteConfirmation(null);
        return;
      }
      
      // 削除処理を非同期で実行
      const deleteProjectAsync = async () => {
        // 削除されるプロジェクトが最後に開いていたプロジェクトかチェック
        let isLastProject = false;
        if (saveDirectory === '') {
          const lastProject = localStorage.getItem('voiscripter_lastProject');
          isLastProject = lastProject === deleteConfirmation.projectId;
        } else if (window.electronAPI) {
          try {
            const lastProject = await window.electronAPI.loadData('voiscripter_lastProject');
            isLastProject = lastProject === deleteConfirmation.projectId;
          } catch (error) {
            console.error('最後のプロジェクト確認エラー:', error);
          }
        }
        
        // localStorageまたはファイルから削除
        if (saveDirectory === '') {
          localStorage.removeItem(`voiscripter_project_${deleteConfirmation.projectId}`);
          localStorage.removeItem(`voiscripter_project_${deleteConfirmation.projectId}_lastScene`);
          localStorage.removeItem(`voiscripter_project_${deleteConfirmation.projectId}_undo`);
          localStorage.removeItem(`voiscripter_project_${deleteConfirmation.projectId}_redo`);
        } else if (window.electronAPI) {
          window.electronAPI.deleteData(`voiscripter_project_${deleteConfirmation.projectId}`);
          window.electronAPI.deleteData(`voiscripter_project_${deleteConfirmation.projectId}_lastScene`);
          window.electronAPI.deleteData(`voiscripter_project_${deleteConfirmation.projectId}_undo`);
          window.electronAPI.deleteData(`voiscripter_project_${deleteConfirmation.projectId}_redo`);
        }
        
        // 削除されたプロジェクトが最後に開いていたプロジェクトだった場合、defaultに設定
        if (isLastProject) {
          if (saveDirectory === '') {
            localStorage.setItem('voiscripter_lastProject', 'default');
          } else if (window.electronAPI) {
            window.electronAPI.saveData('voiscripter_lastProject', 'default');
          }
        }
        
        showNotification(`プロジェクト「${deleteConfirmation.projectId}」を削除しました`, 'success');
        setProjectId('default');
        setDeleteConfirmation(null);
      };
      
      deleteProjectAsync();
    } else if (deleteConfirmation.confirmed === false) {
      setDeleteConfirmation(null);
    }
  }, [deleteConfirmation, saveDirectory]);

  // プロジェクトのJSONエクスポート
  const handleExportProjectJson = () => {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('プロジェクトをエクスポートしました', 'success');
  };

  return (
    <div id="root">
      <div className="min-h-auto bg-background text-foreground transition-colors duration-300">
        {/* 通知システム */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 p-2 rounded-lg shadow-lg max-w-md transition-all duration-300 ${
            notification.type === 'success' ? 'bg-green-500 text-white' :
            notification.type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm">{notification.message}</span>
              <button
                onClick={() => setNotification(null)}
                className="ml-4 text-white hover:text-gray-200"
              >
                ×
              </button>
            </div>
          </div>
        )}
        
        {/* プロジェクト切替UI */}
        <div className="flex items-center gap-2 p-2">
          <label>プロジェクト: </label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className="border rounded p-1">
            {projectList.map(name => (
              <option key={name} value={name} className="dark:text-gray-900">{name}</option>
            ))}
          </select>
          <button onClick={handleNewProject} className="px-2 py-1 bg-primary text-primary-foreground rounded">新規作成</button>
          {projectId !== 'default' && (
            <button onClick={handleDeleteProject} className="px-2 py-1 bg-destructive text-destructive-foreground rounded">削除</button>
          )}
        </div>
        <Header
          characters={characters}
          onAddCharacter={handleAddCharacter}
          onUpdateCharacter={handleUpdateCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          onThemeChange={handleThemeChange}
          onExportCSV={handleExportCSV}
          onExportSerifOnly={handleExportSerifOnly}
          onExportCharacterCSV={handleExportCharacterCSV}
          onExportByGroups={handleExportByGroups}
          onExportToClipboard={handleExportToClipboard}
          onExportProjectJson={handleExportProjectJson}
          onImportCSV={handleImportCSV}
          onImportCharacterCSV={handleImportCharacterCSV}
          onImportJson={handleImportJson}
          isDarkMode={isDarkMode}
          saveDirectory={saveDirectory}
          onSaveDirectoryChange={handleSaveDirectoryChange}
          groups={groups}
          onAddGroup={handleAddGroup}
          onDeleteGroup={handleDeleteGroup}
          onReorderCharacters={setCharacters}
          onReorderGroups={setGroups}
          projectName={project.name}
          selectedBlockIds={selectedBlockIds}
          onRenameProject={(newName) => {
            if (!newName.trim() || newName === project.name) return;
            const oldProjectId = project.id;
            // 1シーン目・1スクリプト目がプロジェクト名と同じ場合は同時に変更
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
            saveData(`voiscripter_project_${newName}`, JSON.stringify({ ...project, id: newName, name: newName, scenes: project.scenes.map((scene, idx) => idx === 0 && scene.name === project.name ? { ...scene, name: newName, scripts: scene.scripts.map((script, sidx) => sidx === 0 && script.title === project.name ? { ...script, title: newName } : script) } : scene) }));
            saveData('voiscripter_lastProject', newName);
            // 古いプロジェクトデータ削除
            if (saveDirectory === '') {
              localStorage.removeItem(`voiscripter_project_${oldProjectId}`);
              localStorage.removeItem(`voiscripter_project_${oldProjectId}_lastScene`);
              localStorage.removeItem(`voiscripter_project_${oldProjectId}_undo`);
              localStorage.removeItem(`voiscripter_project_${oldProjectId}_redo`);
            } else if (window.electronAPI) {
              window.electronAPI.deleteData(`voiscripter_project_${oldProjectId}`);
              window.electronAPI.deleteData(`voiscripter_project_${oldProjectId}_lastScene`);
              window.electronAPI.deleteData(`voiscripter_project_${oldProjectId}_undo`);
              window.electronAPI.deleteData(`voiscripter_project_${oldProjectId}_redo`);
            }
            showNotification(`プロジェクト名を「${newName}」に変更しました`, 'success');
          }}
          scenes={project.scenes}
          selectedSceneId={selectedSceneId}
          onAddScene={handleAddScene}
          onRenameScene={handleRenameScene}
          onDeleteScene={handleDeleteScene}
          onSelectScene={handleSelectScene}
          onExportSceneCSV={handleExportSceneCSV}
        />
        <main className="p-4">
          <div className="max-w-6xl mx-auto">
            {selectedScene ? (
              <ScriptEditor
                script={{ ...currentScript, characters }}
                onUpdateBlock={(blockId, updates) => {
                  const blocks = currentScript.blocks.map(b => b.id === blockId ? { ...b, ...updates, id: b.id ?? Date.now().toString(), characterId: typeof updates.characterId === 'string' ? updates.characterId : b.characterId || '', emotion: typeof updates.emotion === 'string' ? updates.emotion : b.emotion || 'normal' } : b);
                  handleUpdateScript({ blocks });
                }}
                onAddBlock={() => {
                  const newBlock = { id: Date.now().toString(), characterId: characters[0]?.id ?? '', emotion: 'normal' as const, text: '' };
                  handleUpdateScript({ blocks: [...currentScript.blocks, newBlock] });
                }}
                onDeleteBlock={blockId => {
                  handleUpdateScript({ blocks: currentScript.blocks.filter(b => b.id !== blockId) });
                }}
                onInsertBlock={(block, index) => {
                  const blocks = [...currentScript.blocks];
                  blocks.splice(index, 0, { ...block, id: block.id ?? Date.now().toString(), characterId: block.characterId ?? '', emotion: block.emotion ?? 'normal' });
                  handleUpdateScript({ blocks });
                }}
                onMoveBlock={(from, to) => {
                  const blocks = [...currentScript.blocks];
                  const [moved] = blocks.splice(from, 1);
                  blocks.splice(to, 0, moved);
                  handleUpdateScript({ blocks });
                }}
                selectedBlockIds={selectedBlockIds}
                onSelectedBlockIdsChange={setSelectedBlockIds}
                onOpenCSVExport={() => {
                  // CSVエクスポートダイアログを開く処理
                  const csvExportButton = document.querySelector('[title="CSVエクスポート"]') as HTMLButtonElement;
                  if (csvExportButton) csvExportButton.click();
                }}
              />
            ) : (
              <div className="text-center text-muted-foreground py-12">シーンがない古いプロジェクトが読み込まれています。<br />+ボタンから新しいシーンを作成してください。<br />または、新規作成から新しいプロジェクトを作成してください。</div>
            )}
          </div>
        </main>
        <CSVExportDialog
          isOpen={false}
          onClose={() => {}}
          characters={characters}
          groups={groups}
          selectedBlockIds={selectedBlockIds}
          onExportCSV={(includeTogaki, selectedOnly) => {
            // 全シーンのセリフを結合して出力
            const allBlocks = project.scenes.flatMap(scene => scene.scripts[0]?.blocks || []);
            if (allBlocks.length === 0) return;
            const rows = allBlocks
              .filter(block => includeTogaki ? true : block.characterId)
              .map(block => {
                if (!block.characterId) {
                  return ['ト書き', block.text.replace(/\n/g, '\n')];
                }
                const char = characters.find(c => c.id === block.characterId);
                return [char ? char.name : '', block.text.replace(/\n/g, '\n')];
              });
            const encodeCSV = (rows: string[][]) => rows.map(row => row.map(cell => cell.includes(',') || cell.includes('\n') || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell).join(',')).join('\r\n');
            const csv = encodeCSV(rows);
            const defaultName = `${project.name || 'project'}.csv`;
            if (window.electronAPI) {
              window.electronAPI.saveCSVFile(defaultName, csv);
            } else {
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = defaultName;
              a.click();
              URL.revokeObjectURL(url);
            }
          }}
          onExportSerifOnly={() => {}}
          onExportByGroups={() => {}}
          onExportCharacterCSV={() => {}}
          onExportToClipboard={() => {}}
          scenes={project.scenes}
          selectedSceneId={selectedSceneId}
          onExportSceneCSV={(sceneIds, exportType, includeTogaki, selectedOnly) => {
            // 特定シーンごとに分割出力
            sceneIds.forEach(sceneId => {
              const scene = project.scenes.find(s => s.id === sceneId);
              if (!scene || scene.scripts.length === 0) return;
              const script = scene.scripts[0];
              let targetBlocks = script.blocks;
              if (selectedOnly && selectedBlockIds.length > 0) {
                targetBlocks = script.blocks.filter(block => selectedBlockIds.includes(block.id));
              }
              let rows;
              if (exportType === 'full') {
                rows = targetBlocks
                  .filter(block => includeTogaki ? true : block.characterId)
                  .map(block => {
                    if (!block.characterId) {
                      return ['ト書き', block.text.replace(/\n/g, '\n')];
                    }
                    const char = characters.find(c => c.id === block.characterId);
                    return [char ? char.name : '', block.text.replace(/\n/g, '\n')];
                  });
              } else {
                rows = targetBlocks
                  .filter(block => block.characterId)
                  .map(block => [block.text.replace(/\n/g, '\n')]);
              }
              if (!rows || rows.length === 0) return;
              const encodeCSV = (rows: string[][]) => rows.map(row => row.map(cell => cell.includes(',') || cell.includes('\n') || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell).join(',')).join('\r\n');
              const csv = encodeCSV(rows);
              const filename = `${project.name || 'project'}_${scene.name}.csv`;
              if (window.electronAPI) {
                window.electronAPI.saveCSVFile(filename, csv);
              } else {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
              }
            });
          }}
          onExportProjectJson={handleExportProjectJson}
        />
      </div>
      <ProjectDialog
        isOpen={isProjectDialogOpen}
        onClose={() => setIsProjectDialogOpen(false)}
        onConfirm={handleCreateProject}
        existingProjects={projectList}
      />
      {/* 削除確認ダイアログ */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">プロジェクト削除の確認</h3>
            <p className="text-muted-foreground mb-6">
              プロジェクト「{deleteConfirmation.projectId}」を削除しますか？<br />
              この操作は元に戻せません。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmation({ ...deleteConfirmation, confirmed: false })}
                className="px-4 py-2 text-sm border border-border rounded hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                onClick={() => setDeleteConfirmation({ ...deleteConfirmation, confirmed: true })}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}