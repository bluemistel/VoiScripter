'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import ScriptEditor from '@/components/ScriptEditor';
import { Script, Character, ScriptBlock, Emotion } from '@/types';

export default function Home() {
  const [script, setScript] = useState<Script>({
    id: '1',
    title: '新しい台本',
    characters: [],
    blocks: []
  });

  // ダークモード管理
  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false
  );
  useEffect(() => {
    const isDark =
      localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const handleThemeChange = (isDark: boolean) => {
    setIsDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  // キャラクター追加
  const handleAddCharacter = (character: Character) => {
    setScript(prev => ({
      ...prev,
      characters: [...prev.characters, character]
    }));
  };

  // キャラクター編集
  const handleUpdateCharacter = (updated: Character) => {
    setScript(prev => ({
      ...prev,
      characters: prev.characters.map(c => c.id === updated.id ? updated : c)
    }));
  };

  // キャラクター削除
  const handleDeleteCharacter = (id: string) => {
    setScript(prev => ({
      ...prev,
      characters: prev.characters.filter(c => c.id !== id),
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

  // ブロック追加（直前のセリフブロック or 最初のキャラ or ト書き）
  const handleAddBlock = () => {
    const lastSerif = [...script.blocks].reverse().find(b => b.characterId);
    const charId = lastSerif?.characterId || script.characters[0]?.id || '';
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
          const char = script.characters.find(c => c.id === block.characterId);
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
      ['名前', '通常', '喜び', '悲しみ', '怒り', '驚き'],
      ...script.characters.map(char => [
        char.name,
        char.emotions.normal.iconUrl,
        char.emotions.happy.iconUrl,
        char.emotions.sad.iconUrl,
        char.emotions.angry.iconUrl,
        char.emotions.surprised.iconUrl
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
          const character = script.characters.find(c => c.name === speaker);
          
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
        .map(([name, ...emotionUrls]) => {
          const emotions = {
            normal: { iconUrl: emotionUrls[0] || '' },
            happy: { iconUrl: emotionUrls[1] || '' },
            sad: { iconUrl: emotionUrls[2] || '' },
            angry: { iconUrl: emotionUrls[3] || '' },
            surprised: { iconUrl: emotionUrls[4] || '' }
          } as const;

          return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: name,
            emotions
          };
        });

      setScript(prev => ({
        ...prev,
        characters: [...prev.characters, ...newCharacters]
      }));

      alert(`${newCharacters.length}個のキャラクターをインポートしました。`);
    } catch (error) {
      console.error('キャラクター設定のCSVインポートエラー:', error);
      alert('キャラクター設定のCSVファイルのインポートに失敗しました。');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Header
        characters={script.characters}
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
      />
      <main className="p-4">
        <div className="max-w-6xl mx-auto">
          <ScriptEditor
            script={script}
            onUpdateBlock={handleUpdateBlock}
            onAddBlock={handleAddBlock}
            onDeleteBlock={handleDeleteBlock}
            onInsertBlock={handleInsertBlock}
            onMoveBlock={handleMoveBlock}
          />
        </div>
      </main>
    </div>
  );
}