'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import ScriptEditor from '@/components/ScriptEditor';
import ProjectDialog from '@/components/ProjectDialog';
import { Script, Character, ScriptBlock, Emotion } from '@/types';

export default function Home() {
  // グローバルキャラクター管理
  const [characters, setCharacters] = useState<Character[]>([]);
  // プロジェクトID管理
  const [projectId, setProjectId] = useState<string>('default');
  const [projectList, setProjectList] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<Omit<Script, 'characters'>[]>([]);
  const [redoStack, setRedoStack] = useState<Omit<Script, 'characters'>[]>([]);
  const [script, setScript] = useState<Omit<Script, 'characters'>>({
    id: '1',
    title: '新しい台本',
    blocks: []
  });
  // データ保存先設定
  const [saveDirectory, setSaveDirectory] = useState<string>('');
  // プロジェクトダイアログ
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);

  // 初回マウント時にデータを読み込み
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadInitialData = async () => {
      // 保存先設定を読み込み
      const savedDirectory = localStorage.getItem('voiscripter_saveDirectory');
      setSaveDirectory(savedDirectory || '');
      
      // characters
      const savedChars = await loadData('voiscripter_characters');
      if (savedChars) setCharacters(JSON.parse(savedChars));
      
      // projectId
      const lastProject = await loadData('voiscripter_lastProject');
      // lastProjectが有効なプロジェクト名かチェック
      let validProjectId = 'default';
      if (lastProject && lastProject !== 'lastProject') {
        validProjectId = lastProject;
      }
      setProjectId(validProjectId);
      
      // projectList
      if (savedDirectory === '') {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('voiscripter_') && !k.endsWith('_undo') && !k.endsWith('_redo') && k !== 'voiscripter_characters' && k !== 'voiscripter_lastProject' && k !== 'voiscripter_saveDirectory');
        setProjectList(keys.map(k => k.replace('voiscripter_', '')));
      } else if (window.electronAPI) {
        const keys = await window.electronAPI?.listDataKeys() || [];
        const projectKeys = keys.filter(k => k.startsWith('voiscripter_') && !k.endsWith('_undo') && !k.endsWith('_redo') && k !== 'voiscripter_characters' && k !== 'voiscripter_lastProject' && k !== 'voiscripter_saveDirectory');
        setProjectList(projectKeys.map(k => k.replace('voiscripter_', '')));
      }
      
      // script
      const savedScript = await loadData(`voiscripter_${validProjectId}`);
      if (savedScript) {
        try {
          setScript(JSON.parse(savedScript));
        } catch (error) {
          console.error('Script parse error:', error);
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
          setUndoStack(JSON.parse(u));
        } catch (error) {
          console.error('Undo stack parse error:', error);
          setUndoStack([]);
        }
      }
      
      const r = await loadData(`voiscripter_${validProjectId}_redo`);
      if (r) {
        try {
          setRedoStack(JSON.parse(r));
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
  }, [characters]);

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
        const keys = Object.keys(localStorage).filter(k => k.startsWith('voiscripter_') && !k.endsWith('_undo') && !k.endsWith('_redo') && k !== 'voiscripter_characters' && k !== 'voiscripter_lastProject' && k !== 'voiscripter_saveDirectory');
        setProjectList(keys.map(k => k.replace('voiscripter_', '')));
      } else if (window.electronAPI) {
        const keys = await window.electronAPI?.listDataKeys() || [];
        const projectKeys = keys.filter(k => k.startsWith('voiscripter_') && !k.endsWith('_undo') && !k.endsWith('_redo') && k !== 'voiscripter_characters' && k !== 'voiscripter_lastProject' && k !== 'voiscripter_saveDirectory');
        setProjectList(projectKeys.map(k => k.replace('voiscripter_', '')));
      }
    };
    
    loadProjectData();
  }, [projectId, saveDirectory]);

  // script変更時に保存＆Undoスタック
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (typeof window === 'undefined') return;
    setUndoStack(prev => {
      const newStack = [...prev, script];
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
    setProjectList(prev => [...prev, name]);
    saveData(`voiscripter_${name}`, JSON.stringify({
      id: '1', title: name, blocks: []
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

  // データ保存関数
  const saveData = (key: string, data: string) => {
    if (saveDirectory === '') {
      // localStorageに保存
      localStorage.setItem(key, data);
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

  // データ保存先変更
  const handleSaveDirectoryChange = async (directory: string) => {
    const previousDirectory = saveDirectory;
    setSaveDirectory(directory);
    localStorage.setItem('voiscripter_saveDirectory', directory);
    
    // 保存先が変更された場合、既存データを移動
    if (directory !== '' && previousDirectory === '') {
      // localStorageからファイルに移動
      if (window.electronAPI) {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('voiscripter_'));
        for (const key of keys) {
          const data = localStorage.getItem(key);
          if (data) {
            await window.electronAPI?.saveData(key, data);
          }
        }
      }
    } else if (directory === '' && previousDirectory !== '') {
      // ファイルからlocalStorageに移動
      if (window.electronAPI) {
        const keys = await window.electronAPI?.listDataKeys() || [];
        for (const key of keys) {
          const data = await window.electronAPI?.loadData(key);
          if (data) {
            localStorage.setItem(key, data);
          }
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
    setScript(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock]
    }));
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
  const handleExportCSV = () => {
    const rows = [
      ['話者', 'セリフ'],
      ...script.blocks
        .filter(block => block.characterId) // ト書きは除外
        .map(block => {
          const char = characters.find(c => c.id === block.characterId);
          return [
            char ? char.name : '',
            block.text
          ];
        })
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
    a.download = `${script.title || 'script'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // セリフだけエクスポート
  const handleExportSerifOnly = () => {
    const rows = [
      ['セリフ'],
      ...script.blocks
        .filter(block => block.characterId) // ト書きは除外
        .map(block => [block.text])
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
    a.download = `${script.title || 'serif'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // キャラクター設定のCSVエクスポート
  const handleExportCharacterCSV = () => {
    const rows = [
      ['名前', 'アイコン'],
      ...characters.map(char => [
        char.name,
        char.emotions.normal.iconUrl
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

  // CSVインポート（話者,セリフ）
  const handleImportCSV = async (file: File) => {
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

      // 新しいブロックを作成
      const newBlocks: ScriptBlock[] = dataRows
        .filter(row => row.length >= 2 && (row[0] || row[1])) // 空行を除外
        .map(([speaker, text]) => {
          // 話者が既存のキャラクターと一致するか確認
          const character = characters.find(c => c.name === speaker);
          
          if (character) {
            // キャラクターが存在する場合はセリフブロックとして追加
            return {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              characterId: character.id,
              emotion: 'normal',
              text: text || ''
            };
          } else {
            // キャラクターが存在しない場合はト書きとして追加
            return {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              characterId: '',
              emotion: 'normal',
              text: `【${speaker}】${text || ''}`
            };
          }
        });

      setScript(prev => ({
        ...prev,
        blocks: [...prev.blocks, ...newBlocks]
      }));

      alert(`${newBlocks.length}個のブロックをインポートしました。`);
    } catch (error) {
      console.error('CSVインポートエラー:', error);
      alert('CSVファイルのインポートに失敗しました。');
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

      // 新しいキャラクターを作成
      const newCharacters: Character[] = dataRows
        .filter(row => row.length >= 1 && row[0].trim() !== '') // 名前が空の行をスキップ
        .map(([name, iconUrl]) => {
          const emotions = {
            normal: { iconUrl: iconUrl || '' }
          } as const;

          return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: name,
            emotions
          };
        });

      setCharacters(prev => [...prev, ...newCharacters]);

      alert(`${newCharacters.length}個のキャラクターをインポートしました。`);
    } catch (error) {
      console.error('キャラクター設定のCSVインポートエラー:', error);
      alert('キャラクター設定のCSVファイルのインポートに失敗しました。');
    }
  };

  return (
    <div id="root">
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        {/* プロジェクト切替UI */}
        <div className="flex items-center gap-2 p-2">
          <label>プロジェクト: </label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className="border rounded p-1">
            {projectList.map(name => (
              <option key={name} value={name}>{name}</option>
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
          onImportCSV={handleImportCSV}
          onImportCharacterCSV={handleImportCharacterCSV}
          isDarkMode={isDarkMode}
          onSaveDirectoryChange={handleSaveDirectoryChange}
          currentSaveDirectory={saveDirectory}
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