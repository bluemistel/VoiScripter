'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import ScriptEditor from '@/components/ScriptEditor';
import Settings from '@/components/Settings';
import ProjectDialog from '@/components/ProjectDialog';
import { Script, Character, ScriptBlock, Emotion } from '@/types';

export default function Home() {
  // グローバルキャラクター管理
  const [characters, setCharacters] = useState<Character[]>([]);
  // グループ管理
  const [groups, setGroups] = useState<string[]>([]);
  // プロジェクトID管理
  const [projectId, setProjectId] = useState<string>('default');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const last = localStorage.getItem('voiscripter_lastProject');
      if (last && last !== 'lastProject') setProjectId(last);
    }
  }, []);
  const [projectList, setProjectList] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<Omit<Script, 'characters'>[]>([]);
  const [redoStack, setRedoStack] = useState<Omit<Script, 'characters'>[]>([]);
  const [script, setScript] = useState<Omit<Script, 'characters'>>({
    id: '1',
    title: '新しい台本',
    blocks: []
  });
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  // データ保存先設定
  const [saveDirectory, setSaveDirectory] = useState<string>('');
  // プロジェクトダイアログ
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  
  // 通知システム
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // 削除確認用の状態
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ projectId: string; confirmed: boolean | null } | null>(null);
  
  // 通知表示関数
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // 削除確認の処理
  useEffect(() => {
    if (deleteConfirmation && deleteConfirmation.confirmed !== null) {
      const handleDelete = async () => {
        if (deleteConfirmation.confirmed) {
          // 削除実行
          const projectToDelete = deleteConfirmation.projectId;
          setDeleteConfirmation(null);
          
          try {
            // プロジェクトデータを削除
            if (saveDirectory === '') {
              localStorage.removeItem(`voiscripter_${projectToDelete}`);
              localStorage.removeItem(`voiscripter_${projectToDelete}_undo`);
              localStorage.removeItem(`voiscripter_${projectToDelete}_redo`);
            } else if (window.electronAPI) {
              await window.electronAPI.deleteData(`voiscripter_${projectToDelete}`);
              await window.electronAPI.deleteData(`voiscripter_${projectToDelete}_undo`);
              await window.electronAPI.deleteData(`voiscripter_${projectToDelete}_redo`);
            }

            // プロジェクトリストから削除
            setProjectList(prev => prev.filter(p => p !== projectToDelete));

            // 削除されたプロジェクトが現在のプロジェクトの場合、defaultに切り替え
            if (projectId === projectToDelete) {
              setProjectId('default');
              setScript({
                id: '1',
                title: '新しい台本',
                blocks: []
              });
              setUndoStack([]);
              setRedoStack([]);
            }

            showNotification(`プロジェクト「${projectToDelete}」を削除しました`, 'success');
          } catch (error) {
            console.error('プロジェクト削除エラー:', error);
            showNotification('プロジェクトの削除に失敗しました', 'error');
          }
        } else {
          // キャンセル
          setDeleteConfirmation(null);
          showNotification('削除をキャンセルしました', 'info');
        }
      };

      handleDelete();
    }
  }, [deleteConfirmation, projectId, saveDirectory]);

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
        } catch (error) {
          console.error('設定読み込みエラー:', error);
        }
      } else {
        savedDirectory = localStorage.getItem('voiscripter_saveDirectory') || '';
        setSaveDirectory(savedDirectory);
      }
      
      // characters
      const savedChars = await loadData('voiscripter_characters');
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
      const savedGroups = await loadData('voiscripter_groups');
      if (savedGroups !== null && savedGroups !== undefined) {
        try {
          const parsedGroups = JSON.parse(savedGroups);
          if (Array.isArray(parsedGroups)) {
            setGroups(parsedGroups); // 空配列でも必ずセット
            isFirstGroups.current = false;
            console.log('グループ設定読み込み成功:', parsedGroups.length, '個');
            return;
          } else {
            console.warn('Invalid groups data format:', parsedGroups);
            setGroups([]);
            isFirstGroups.current = false;
            return;
          }
        } catch (error) {
          console.error('Groups parse error:', error);
          setGroups([]);
          isFirstGroups.current = false;
          return;
        }
      } else {
        console.log('グループ設定が見つかりません');
        setGroups([]);
        isFirstGroups.current = false;
      }
      // グループデータが一度も保存されていない場合のみ、キャラクターからグループを抽出
      // （この分岐は初回のみ実行される）
      const savedCharsForGroups = await loadData('voiscripter_characters');
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
      
      // projectId
      const lastProject = await loadData('voiscripter_lastProject');
      // lastProjectが有効なプロジェクト名かチェック
      let validProjectId = 'default';
      if (lastProject && lastProject !== 'lastProject' && lastProject.trim() !== '') {
        validProjectId = lastProject;
      }
      setProjectId(validProjectId);
      
      // projectList
      if (saveDirectory === '') {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('voiscripter_') && !k.endsWith('_undo') && !k.endsWith('_redo') && k !== 'voiscripter_characters' && k !== 'voiscripter_lastProject' && k !== 'voiscripter_saveDirectory' && k !== 'voiscripter_groups');
        const projectKeys = keys.map(k => k.replace('voiscripter_', ''));
        setProjectList(projectKeys);
        console.log('localStorageからプロジェクトリスト読み込み:', projectKeys);
      } else if (window.electronAPI) {
        try {
          const keys = await window.electronAPI.listDataKeys() || [];
          const projectKeys = keys.filter(k => k.startsWith('voiscripter_') && !k.endsWith('_undo') && !k.endsWith('_redo') && k !== 'voiscripter_characters' && k !== 'voiscripter_lastProject' && k !== 'voiscripter_saveDirectory' && k !== 'voiscripter_groups');
          const projectNames = projectKeys.map(k => k.replace('voiscripter_', ''));
          setProjectList(projectNames);
          console.log('ファイルからプロジェクトリスト読み込み:', projectNames);
        } catch (error) {
          console.error('プロジェクトリスト取得エラー:', error);
          setProjectList([]);
        }
      }
      
      // script
      const savedScript = await loadData(`voiscripter_${validProjectId}`);
      if (savedScript) {
        try {
          const parsedScript = JSON.parse(savedScript);
          // 基本的な構造チェック
          if (parsedScript && typeof parsedScript === 'object' && Array.isArray(parsedScript.blocks)) {
            setScript(parsedScript);
          } else {
            throw new Error('Invalid script structure');
          }
        } catch (error) {
          console.error('Script parse error:', error);
          alert('無効な台本形式です。または台本が壊れています。');
          // 無効なデータを削除してから空のプロジェクトを設定
          try {
            if (saveDirectory === '') {
              localStorage.removeItem(`voiscripter_${validProjectId}`);
              localStorage.removeItem(`voiscripter_${validProjectId}_undo`);
              localStorage.removeItem(`voiscripter_${validProjectId}_redo`);
            }
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }
          setScript({
            id: '1', title: '新しい台本', blocks: []
          });
        }
      } else {
        // デフォルトプロジェクトが存在しない場合は初期化
        if (validProjectId === 'default' && window.electronAPI) {
          await window.electronAPI?.initializeDefaultProject();
        }
        setScript({
          id: '1', title: '新しい台本', blocks: []
        });
      }
      
      // undo/redo
      const u = await loadData(`voiscripter_${validProjectId}_undo`);
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
      
      const r = await loadData(`voiscripter_${validProjectId}_redo`);
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

  // プロジェクト切替時の復元
  useEffect(() => {
    if (typeof window === 'undefined') return;
    saveData('voiscripter_lastProject', projectId);
    
    const loadProjectData = async () => {
      const saved = await loadData(`voiscripter_${projectId}`);
      setScript(saved ? JSON.parse(saved) : {
        id: '1', title: '新しい台本', blocks: []
      });
      
      const u = await loadData(`voiscripter_${projectId}_undo`);
      setUndoStack(u ? JSON.parse(u) : []);
      
      const r = await loadData(`voiscripter_${projectId}_redo`);
      setRedoStack(r ? JSON.parse(r) : []);
      
      // プロジェクトリストの更新
      if (saveDirectory === '') {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('voiscripter_') && !k.endsWith('_undo') && !k.endsWith('_redo') && k !== 'voiscripter_characters' && k !== 'voiscripter_lastProject' && k !== 'voiscripter_saveDirectory' && k !== 'voiscripter_groups');
        const projectKeys = keys.map(k => k.replace('voiscripter_', ''));
        setProjectList(projectKeys);
        console.log('プロジェクト切替時localStorageからプロジェクトリスト読み込み:', projectKeys);
      } else if (window.electronAPI) {
        try {
          const keys = await window.electronAPI.listDataKeys() || [];
          const projectKeys = keys.filter(k => k.startsWith('voiscripter_') && !k.endsWith('_undo') && !k.endsWith('_redo') && k !== 'voiscripter_characters' && k !== 'voiscripter_lastProject' && k !== 'voiscripter_saveDirectory' && k !== 'voiscripter_groups');
          const projectNames = projectKeys.map(k => k.replace('voiscripter_', ''));
          setProjectList(projectNames);
          console.log('プロジェクト切替時ファイルからプロジェクトリスト読み込み:', projectNames);
        } catch (error) {
          console.error('プロジェクトリスト取得エラー:', error);
          setProjectList([]);
        }
      }

      // キャラクター設定の復元（プロジェクト切替時も読み込み）
      const savedChars = await loadData('voiscripter_characters');
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
          console.log('プロジェクト切替時キャラクター設定読み込み成功:', charsWithGroups.length, '個');
        } catch (error) {
          console.error('プロジェクト切替時キャラクター設定読み込みエラー:', error);
          setCharacters([]);
        }
      } else {
        console.log('プロジェクト切替時キャラクター設定が見つかりません');
        setCharacters([]);
      }

      // グループデータの復元
      isFirstGroups.current = true; // プロジェクト切り替え時は必ずリセット
      const savedGroups = await loadData('voiscripter_groups');
      if (savedGroups !== null && savedGroups !== undefined) {
        try {
          const parsedGroups = JSON.parse(savedGroups);
          if (Array.isArray(parsedGroups)) {
            setGroups(parsedGroups);
            isFirstGroups.current = false;
            return;
          } else {
            setGroups([]);
            isFirstGroups.current = false;
            return;
          }
        } catch (error) {
          setGroups([]);
          isFirstGroups.current = false;
          return;
        }
      }
      setGroups([]);
      isFirstGroups.current = false;
    };
    
    loadProjectData();
  }, [projectId, saveDirectory]);

  // script変更時に保存＆Undoスタック
  const isFirstRender = useRef(true);
  const isUndoRedoOperation = useRef(false);
  
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (typeof window === 'undefined') return;
    
    // Undo/Redo操作中はUndoスタックに追加しない
    if (isUndoRedoOperation.current) {
      isUndoRedoOperation.current = false;
      saveData(`voiscripter_${projectId}`, JSON.stringify(script));
      return;
    }
    
    setUndoStack(prev => {
      let newStack = [...prev, script];
      if (newStack.length > 50) newStack = newStack.slice(newStack.length - 50);
      saveData(`voiscripter_${projectId}_undo`, JSON.stringify(newStack));
      return newStack;
    });
    setRedoStack([]);
    // redoスタックをクリア
    if (saveDirectory === '') {
      localStorage.removeItem(`voiscripter_${projectId}_redo`);
    } else if (window.electronAPI) {
      window.electronAPI?.saveData(`voiscripter_${projectId}_redo`, '');
    }
    saveData(`voiscripter_${projectId}`, JSON.stringify(script));
  }, [script, projectId, saveDirectory]);

  // Undo/Redoキーハンドラ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (undoStack.length > 0) {
          isUndoRedoOperation.current = true;
          setRedoStack(r => {
            const newRedo = [script, ...r];
            if (typeof window !== 'undefined') saveData(`voiscripter_${projectId}_redo`, JSON.stringify(newRedo));
            return newRedo;
          });
          const prev = undoStack[undoStack.length - 1];
          setUndoStack(u => {
            const newUndo = u.slice(0, -1);
            if (typeof window !== 'undefined') saveData(`voiscripter_${projectId}_undo`, JSON.stringify(newUndo));
            return newUndo;
          });
          setScript(prev);
        }
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (redoStack.length > 0) {
          isUndoRedoOperation.current = true;
          const next = redoStack[0];
          setUndoStack(u => {
            const newUndo = [...u, script];
            if (typeof window !== 'undefined') saveData(`voiscripter_${projectId}_undo`, JSON.stringify(newUndo));
            return newUndo;
          });
          setRedoStack(r => {
            const newRedo = r.slice(1);
            if (typeof window !== 'undefined') saveData(`voiscripter_${projectId}_redo`, JSON.stringify(newRedo));
            return newRedo;
          });
          setScript(next);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, script, projectId, saveDirectory]);

  // プロジェクト新規作成
  const handleNewProject = () => {
    setIsProjectDialogOpen(true);
  };

  const handleCreateProject = (name: string) => {
    const oldProjectId = projectId;
    setProjectId(name);
    setProjectList(prev => prev.includes(name) ? prev : [...prev, name]);
    
    // 新しいプロジェクトのデータを保存
    const newProjectData = {
      id: '1',
      title: name,
      blocks: oldProjectId === 'default' ? script.blocks : []
    };
    
    // 新しいプロジェクトを保存
    saveData(`voiscripter_${name}`, JSON.stringify(newProjectData));
    saveData('voiscripter_lastProject', name);
    

    
    // 新しいプロジェクトの内容を設定
    setScript(newProjectData);
    setUndoStack([]);
    setRedoStack([]);
    
    showNotification(`プロジェクト「${name}」を作成しました`, 'success');
  };

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
                  setScript({
                    id: '1',
                    title: '新しい台本',
                    blocks: []
                  });
                  setUndoStack([]);
                  setRedoStack([]);
                  
                  // defaultプロジェクトのデータを空にする
                  try {
                    await window.electronAPI.saveData('voiscripter_default', JSON.stringify({
                      id: '1',
                      title: '新しい台本',
                      blocks: []
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
    // blocks内のcharacterIdも空にする
    setScript(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.characterId === id ? { ...b, characterId: '' } : b)
    }));
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
    setScript(prev => ({
      ...prev,
      blocks: prev.blocks.map(block =>
        block.id === blockId ? { ...block, ...updates } : block
      )
    }));
  };
  // ブロック追加
  const handleAddBlock = () => {
    const lastSerif = [...script.blocks].reverse().find(b => b.characterId);
    const charId = lastSerif?.characterId || characters[0]?.id || '';
    const emotion = lastSerif?.emotion || 'normal';
    const newBlock: ScriptBlock = {
      id: Date.now().toString(),
      characterId: charId,
      emotion,
      text: ''
    };
    // 追加時はundoStackに積まれるのはuseEffectの1回だけになるようにする
    setScript(prev => {
      if (prev.blocks.length > 0 && prev.blocks[prev.blocks.length - 1].id === newBlock.id) {
        return prev; // すでに追加済みなら何もしない
      }
      return {
        ...prev,
        blocks: [...prev.blocks, newBlock]
      };
    });
  };

  // ブロック削除
  const handleDeleteBlock = (blockId: string) => {
    setScript(prev => ({
      ...prev,
      blocks: prev.blocks.filter(block => block.id !== blockId)
    }));
  };

  // ブロック挿入（ト書き用）
  const handleInsertBlock = (block: ScriptBlock, index: number) => {
    setScript(prev => {
      const newBlocks = [...prev.blocks];
      newBlocks.splice(index, 0, block);
      return { ...prev, blocks: newBlocks };
    });
  };

  // ブロック移動
  const handleMoveBlock = (fromIndex: number, toIndex: number) => {
    setScript(prev => {
      const newBlocks = [...prev.blocks];
      const [movedBlock] = newBlocks.splice(fromIndex, 1);
      newBlocks.splice(toIndex, 0, movedBlock);
      return { ...prev, blocks: newBlocks };
    });
  };

  // CSVエクスポート（話者,セリフ）
  const handleExportCSV = async (includeTogaki?: boolean, selectedOnly?: boolean) => {
    let targetBlocks = script.blocks;
    
    // 選択ブロックのみの場合
    if (selectedOnly && selectedBlockIds.length > 0) {
      targetBlocks = script.blocks.filter(block => selectedBlockIds.includes(block.id));
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
    const defaultName = `${script.title || 'script'}.csv`;
    
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
    let targetBlocks = script.blocks;
    
    // 選択ブロックのみの場合
    if (selectedOnly && selectedBlockIds.length > 0) {
      targetBlocks = script.blocks.filter(block => selectedBlockIds.includes(block.id));
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
    const defaultName = `${script.title || 'serif'}.csv`;
    
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
  const handleExportByGroups = async (selectedGroups: string[], exportType: 'full' | 'serif-only', includeTogaki?: boolean, selectedOnly?: boolean) => {
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
        console.log(`グループ「${group}」にはセリフがありません`);
        continue;
      }

      let rows: string[][];
      let filename: string;

      if (exportType === 'full') {
        // 話者,セリフ形式
        rows = groupBlocks.map(block => {
          if (!block.characterId) {
            return ['ト書き', block.text.replace(/\n/g, '\\n')];
          }
          const char = characters.find(c => c.id === block.characterId);
          return [char ? char.name : '', block.text.replace(/\n/g, '\\n')];
        });
        filename = `${script.title || 'script'}_${group}.csv`;
      } else {
        // セリフだけ
        rows = groupBlocks.map(block => [block.text.replace(/\n/g, '\\n')]);
        filename = `${script.title || 'serif'}_${group}.csv`;
      }

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
      
      if (window.electronAPI) {
        try {
          await window.electronAPI.saveCSVFile(filename, csv);
        } catch (error) {
          console.error(`CSV保存エラー (${group}):`, error);
          alert(`グループ「${group}」のCSVファイルの保存に失敗しました。`);
        }
      } else {
        // ブラウザ環境では従来の方法
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  // キャラクター設定のCSVエクスポート
  const handleExportCharacterCSV = () => {
    const rows = [
      ['名前', 'アイコン', 'グループ', '背景色'],
      ...characters.map(char => [
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
    let targetBlocks = script.blocks;
    
    // 選択ブロックのみの場合
    if (selectedOnly && selectedBlockIds.length > 0) {
      targetBlocks = script.blocks.filter(block => selectedBlockIds.includes(block.id));
    }
    
    let text: string;
    
    if (serifOnly) {
      // セリフだけ
      text = targetBlocks
        .filter(block => includeTogaki ? true : block.characterId) // ト書きを含めるかどうか
        .map(block => block.text)
        .join('\n');
    } else {
      // 話者とセリフ
      text = targetBlocks
        .filter(block => includeTogaki ? true : block.characterId) // ト書きを含めるかどうか
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
      alert('クリップボードにコピーしました。');
    } catch (error) {
      console.error('クリップボード出力エラー:', error);
      alert('クリップボードへの出力に失敗しました。');
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

      // 1行目が「話者」「セリフ」などのヘッダーでなければ全行インポート
      let dataRows = rows;
      if (rows.length > 0 && (rows[0][0].includes('話者') || rows[0][0].toLowerCase().includes('speaker'))) {
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

      if (options?.mode === 'new' && options.projectName) {
        // 新規プロジェクトデータを先に保存
        saveData(`voiscripter_${options.projectName}`, JSON.stringify({ id: '1', title: options.projectName, blocks: newBlocks }));
        if (typeof options.projectName === 'string') {
          setProjectList(prev => prev.includes(options.projectName!) ? prev : [...prev, options.projectName!]);
        }
        setProjectId(options.projectName);
        showNotification(`${newBlocks.length}個のブロックを新規プロジェクト「${options.projectName}」にインポートしました。`, 'success');
      } else {
        // 追加
        setScript(prev => ({
          ...prev,
          blocks: [...prev.blocks, ...newBlocks]
        }));
        showNotification(`${newBlocks.length}個のブロックを現在のプロジェクトにインポートしました。`, 'success');
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
      // 空のプロジェクトを読み込む
      try {
        setScript({
          id: '1',
          title: '新しい台本',
          blocks: []
        });
      } catch (setError) {
        console.error('Failed to set empty script:', setError);
      }
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
      if (rows.length > 0 && (rows[0][0].includes('名前') || rows[0][0].toLowerCase().includes('name'))) {
        dataRows = rows.slice(1);
      }

      const newCharacters: Character[] = [];
      const newGroups: string[] = [];
      const duplicateNames: string[] = [];

      dataRows.forEach((row, index) => {
        if (row.length >= 3) {
          const characterName = row[0]?.trim() || '';
          const iconUrl = row[1]?.trim() || '';
          const characterGroup = row[2]?.trim() || 'なし';
          const backgroundColor = row[3]?.trim() || '#e5e7eb'; // 背景色を追加

          if (characterName && !characters.find(c => c.name === characterName)) {
            // 新しいグループを追加
            if (characterGroup && characterGroup !== 'なし' && !groups.includes(characterGroup)) {
              newGroups.push(characterGroup);
            }

            const emotions = {
              normal: { iconUrl }
            };

            newCharacters.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              name: characterName,
              group: characterGroup,
              emotions,
              backgroundColor // 背景色を追加
            });
          } else if (characterName) {
            duplicateNames.push(characterName);
          }
        }
      });

      // 重複エラーメッセージの表示
      if (duplicateNames.length > 0) {
        const duplicateMessage = `以下のキャラクターは既に存在するためインポートされませんでした：\n${duplicateNames.join(', ')}`;
        showNotification(duplicateMessage, 'error');
      }

      // 新しいグループを追加（重複を除去）
      let actuallyAddedGroups: string[] = [];
      if (newGroups.length > 0) {
        const uniqueNewGroups = newGroups.filter((group, index) => newGroups.indexOf(group) === index);
        setGroups(prev => {
          const groupsToAdd = uniqueNewGroups.filter(group => !prev.includes(group));
          actuallyAddedGroups = groupsToAdd;
          return [...prev, ...groupsToAdd];
        });
      }

      // 新しいキャラクターを追加
      if (newCharacters.length > 0) {
        setCharacters(prev => [...prev, ...newCharacters]);
        showNotification(`${newCharacters.length}個のキャラクターをインポートしました。${actuallyAddedGroups.length > 0 ? `\n新しいグループ「${actuallyAddedGroups.join(', ')}」が追加されました。` : ''}`, 'success');
      } else if (duplicateNames.length === 0) {
        showNotification('インポート可能なキャラクターが見つかりませんでした。', 'info');
      }
    } catch (error) {
      console.error('キャラクター設定のCSVインポートエラー:', error);
      showNotification('キャラクター設定のCSVファイルのインポートに失敗しました。', 'error');
    }
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
          onImportCSV={handleImportCSV}
          onImportCharacterCSV={handleImportCharacterCSV}
          isDarkMode={isDarkMode}
          saveDirectory={saveDirectory}
          onSaveDirectoryChange={handleSaveDirectoryChange}
          groups={groups}
          onAddGroup={handleAddGroup}
          onDeleteGroup={handleDeleteGroup}
          onReorderCharacters={setCharacters}
          onReorderGroups={setGroups}
          projectName={script.title}
          selectedBlockIds={selectedBlockIds}
          onRenameProject={(newName) => {
            if (!newName.trim() || newName === script.title) return;
            
            const oldProjectName = script.title;
            
            // プロジェクトリスト更新
            setProjectList(prev => prev.map(p => p === oldProjectName ? newName : p));
            // プロジェクトID更新
            setProjectId(newName);
            // スクリプトタイトル更新
            setScript(prev => ({ ...prev, title: newName }));
            // 新しいプロジェクトデータを保存
            saveData(`voiscripter_${newName}`, JSON.stringify({ ...script, title: newName }));
            saveData('voiscripter_lastProject', newName);
            
            // 古いプロジェクトのデータを完全に削除
            if (saveDirectory === '') {
              localStorage.removeItem(`voiscripter_${oldProjectName}`);
              localStorage.removeItem(`voiscripter_${oldProjectName}_undo`);
              localStorage.removeItem(`voiscripter_${oldProjectName}_redo`);
            } else if (window.electronAPI) {
              // Electron版では実際にファイルを削除
              window.electronAPI.deleteData(`voiscripter_${oldProjectName}`);
              window.electronAPI.deleteData(`voiscripter_${oldProjectName}_undo`);
              window.electronAPI.deleteData(`voiscripter_${oldProjectName}_redo`);
            }
            
            console.log(`プロジェクト名変更: 「${oldProjectName}」→「${newName}」`);
            showNotification(`プロジェクト名を「${newName}」に変更しました`, 'success');
          }}
        />
        <main className="p-4">
          <div className="max-w-6xl mx-auto">
            <ScriptEditor
              script={{ ...script, characters }}
              onUpdateBlock={handleUpdateBlock}
              onAddBlock={handleAddBlock}
              onDeleteBlock={handleDeleteBlock}
              onInsertBlock={handleInsertBlock}
              onMoveBlock={handleMoveBlock}
              selectedBlockIds={selectedBlockIds}
              onSelectedBlockIdsChange={setSelectedBlockIds}
              onOpenCSVExport={() => {
                // CSVエクスポートダイアログを開く処理
                // HeaderコンポーネントのCSVエクスポートボタンをクリックする
                const csvExportButton = document.querySelector('[title="CSVエクスポート"]') as HTMLButtonElement;
                if (csvExportButton) {
                  csvExportButton.click();
                }
              }}
            />
          </div>
        </main>
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