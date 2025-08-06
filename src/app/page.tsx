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
        const parsedChars = JSON.parse(savedChars);
        // 既存のキャラクターにグループプロパティを追加
        const charsWithGroups = parsedChars.map((char: any) => ({
          ...char,
          group: char.group || 'なし'
        }));
        setCharacters(charsWithGroups);
      }
      
      // groups
      const savedGroups = await loadData('voiscripter_groups');
      if (savedGroups !== null && savedGroups !== undefined) {
        try {
          const parsedGroups = JSON.parse(savedGroups);
          if (Array.isArray(parsedGroups)) {
            setGroups(parsedGroups); // 空配列でも必ずセット
            isFirstGroups.current = false;
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
      } else if (window.electronAPI) {
        try {
          const keys = await window.electronAPI.listDataKeys() || [];
          const projectKeys = keys.filter(k => k.startsWith('voiscripter_') && !k.endsWith('_undo') && !k.endsWith('_redo') && k !== 'voiscripter_characters' && k !== 'voiscripter_lastProject' && k !== 'voiscripter_saveDirectory' && k !== 'voiscripter_groups');
          const projectNames = projectKeys.map(k => k.replace('voiscripter_', ''));
          setProjectList(projectNames);
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
    saveData('voiscripter_characters', JSON.stringify(characters));
  }, [characters, saveDirectory]);

  // groups保存
  useEffect(() => {
    if (isFirstGroups.current) return;
    if (typeof window === 'undefined') return;
    saveData('voiscripter_groups', JSON.stringify(groups));
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
      } else if (window.electronAPI) {
        try {
          const keys = await window.electronAPI.listDataKeys() || [];
          const projectKeys = keys.filter(k => k.startsWith('voiscripter_') && !k.endsWith('_undo') && !k.endsWith('_redo') && k !== 'voiscripter_characters' && k !== 'voiscripter_lastProject' && k !== 'voiscripter_saveDirectory' && k !== 'voiscripter_groups');
          const projectNames = projectKeys.map(k => k.replace('voiscripter_', ''));
          setProjectList(projectNames);
        } catch (error) {
          console.error('プロジェクトリスト取得エラー:', error);
          setProjectList([]);
        }
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
    setProjectId(name);
    setProjectList(prev => prev.includes(name) ? prev : [...prev, name]);
    // defaultで作業中なら内容を引き継ぐ
    setScript(prev => ({
      id: '1',
      title: name,
      blocks: projectId === 'default' ? prev.blocks : []
    }));
    saveData(`voiscripter_${name}`, JSON.stringify({
      id: '1', title: name, blocks: projectId === 'default' ? script.blocks : []
    }));
    saveData('voiscripter_lastProject', name);
  };

  // プロジェクト削除
  const handleDeleteProject = () => {
    if (projectId === 'default') {
      alert('デフォルトプロジェクトは削除できません');
      return;
    }
    if (confirm(`プロジェクト「${projectId}」を削除しますか？\nこの操作は元に戻せません。`)) {
      // データから削除
      if (saveDirectory === '') {
        localStorage.removeItem(`voiscripter_${projectId}`);
        localStorage.removeItem(`voiscripter_${projectId}_undo`);
        localStorage.removeItem(`voiscripter_${projectId}_redo`);
      } else if (window.electronAPI) {
        window.electronAPI?.saveData(`voiscripter_${projectId}`, '');
        window.electronAPI?.saveData(`voiscripter_${projectId}_undo`, '');
        window.electronAPI?.saveData(`voiscripter_${projectId}_redo`, '');
      }
      // プロジェクトリストから削除
      setProjectList(prev => prev.filter(p => p !== projectId));
      // デフォルトプロジェクトに切り替え
      setProjectId('default');
      // 台本を空にする
      setScript({
        id: '1',
        title: '新しい台本',
        blocks: []
      });
      setUndoStack([]);
      setRedoStack([]);
    }
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
        const keys = Object.keys(localStorage).filter(k => k.startsWith('voiscripter_'));
        for (const key of keys) {
          const data = localStorage.getItem(key);
          if (data) {
            try {
              await window.electronAPI.saveData(key, data);
            } catch (error) {
              console.error(`データ移動エラー (${key}):`, error);
            }
          }
        }
      }
    } else if (directory === '' && previousDirectory !== '') {
      // ファイルからlocalStorageに移動
      if (window.electronAPI) {
        try {
          const keys = await window.electronAPI.listDataKeys() || [];
          for (const key of keys) {
            const data = await window.electronAPI.loadData(key);
            if (data) {
              localStorage.setItem(key, data);
            }
          }
        } catch (error) {
          console.error('データ移動エラー:', error);
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
      ['名前', 'アイコン', 'グループ'],
      ...characters.map(char => [
        char.name,
        char.emotions.normal.iconUrl,
        char.group
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
        alert(`${newBlocks.length}個のブロックを新規プロジェクト「${options.projectName}」にインポートしました。`);
      } else {
        // 追加
        setScript(prev => ({
          ...prev,
          blocks: [...prev.blocks, ...newBlocks]
        }));
        alert(`${newBlocks.length}個のブロックを現在のプロジェクトにインポートしました。`);
      }
      
      // CSVインポート後に最後のブロックにフォーカス
      setTimeout(() => {
        const lastBlockIndex = newBlocks.length - 1;
        if (lastBlockIndex >= 0) {
          const textareaRefs = document.querySelectorAll('textarea');
          const lastTextarea = textareaRefs[textareaRefs.length - 1] as HTMLTextAreaElement;
          if (lastTextarea) {
            lastTextarea.focus();
            lastTextarea.setSelectionRange(lastTextarea.value.length, lastTextarea.value.length);
          }
        }
      }, 100);
    } catch (error) {
      console.error('CSVインポートエラー:', error);
      alert('無効な台本形式です。または台本が壊れています。');
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

      // ヘッダー行をスキップ
      const dataRows = rows.slice(1);

      // 重複チェックと新しいキャラクターを作成
      const newCharacters: Character[] = [];
      const duplicateNames: string[] = [];
      const newGroups: string[] = [];

      dataRows
        .filter(row => row.length >= 1 && row[0].trim() !== '') // 名前が空の行をスキップ
        .forEach(([name, iconUrl, group]) => {
          const characterName = name.trim();
          const characterGroup = group || 'なし';
          
          // 重複チェック（名前とグループが同じ）
          const isDuplicate = characters.some(char => 
            char.name === characterName && char.group === characterGroup
          );
          
          if (isDuplicate) {
            duplicateNames.push(characterName);
          } else {
            // 新しいグループを収集
            if (characterGroup !== 'なし' && !groups.includes(characterGroup)) {
              newGroups.push(characterGroup);
            }
            
            const emotions = {
              normal: { iconUrl: iconUrl || '' }
            } as const;

            newCharacters.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              name: characterName,
              group: characterGroup,
              emotions
            });
          }
        });

      // 重複エラーメッセージの表示
      if (duplicateNames.length > 0) {
        const duplicateMessage = `以下のキャラクターは既に存在するためインポートされませんでした：\n${duplicateNames.join(', ')}`;
        alert(duplicateMessage);
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
        alert(`${newCharacters.length}個のキャラクターをインポートしました。${actuallyAddedGroups.length > 0 ? `\n新しいグループ「${actuallyAddedGroups.join(', ')}」が追加されました。` : ''}`);
      } else if (duplicateNames.length === 0) {
        alert('インポート可能なキャラクターが見つかりませんでした。');
      }
    } catch (error) {
      console.error('キャラクター設定のCSVインポートエラー:', error);
      alert('キャラクター設定のCSVファイルのインポートに失敗しました。');
    }
  };


  return (
    <div id="root">
      <div className="min-h-auto bg-background text-foreground transition-colors duration-300">
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
            // プロジェクトリスト更新
            setProjectList(prev => prev.map(p => p === script.title ? newName : p));
            // プロジェクトID更新
            setProjectId(newName);
            // スクリプトタイトル更新
            setScript(prev => ({ ...prev, title: newName }));
            // 保存先も更新
            saveData(`voiscripter_${newName}`, JSON.stringify({ ...script, title: newName }));
            saveData('voiscripter_lastProject', newName);
            // 旧プロジェクトデータ削除（任意）
            if (saveDirectory === '') {
              localStorage.removeItem(`voiscripter_${script.title}`);
            } else if (window.electronAPI) {
              window.electronAPI?.saveData(`voiscripter_${script.title}`, '');
            }
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
    </div>
  );
}