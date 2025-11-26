import { Project, ScriptBlock, Character } from '@/types';
import { buildEmptyScript } from '@/utils/scriptDefaults';
import { DataManagementHook } from './useDataManagement';

export interface ExportImportHook {
  handleExportCSV: (includeTogaki?: boolean, selectedOnly?: boolean, fileFormat?: 'csv' | 'txt') => Promise<void>;
  handleExportSerifOnly: (selectedOnly?: boolean, fileFormat?: 'csv' | 'txt', includeTogaki?: boolean) => Promise<void>;
  handleExportByGroups: (
    selectedGroups: string[],
    exportType: 'full' | 'serif-only',
    includeTogaki?: boolean,
    selectedOnly?: boolean,
    sceneIds?: string[],
    fileFormat?: 'csv' | 'txt'
  ) => Promise<void>;
  handleExportCharacterCSV: () => void;
  handleExportToClipboard: (serifOnly?: boolean, selectedOnly?: boolean, includeTogaki?: boolean) => Promise<void>;
  handleImportCSV: (file: File, options?: { mode: 'append' | 'new'; projectName?: string }) => Promise<void>;
  handleImportCharacterCSV: (file: File) => Promise<void>;
  handleImportJson: (file: File) => Promise<void>;
  handleExportProjectJson: () => void;
  handleExportSceneCSV: (
    sceneIds: string[],
    exportType: 'full' | 'serif-only',
    includeTogaki: boolean,
    selectedOnly: boolean,
    fileFormat?: 'csv' | 'txt'
  ) => Promise<void>;
}

export const useExportImport = (
  project: Project,
  characters: Character[],
  groups: string[],
  selectedBlockIds: string[],
  selectedSceneId: string | null,
  dataManagement: DataManagementHook,
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void,
  onProjectUpdate: (project: Project) => void,
  onProjectIdUpdate: (id: string) => void,
  onProjectListUpdate: (list: string[] | ((prev: string[]) => string[])) => void,
  onSelectedSceneIdUpdate: (id: string | null) => void,
  onCharactersUpdate: (characters: Character[]) => void,
  onGroupsUpdate: (groups: string[]) => void
): ExportImportHook => {

  // CSVエンコード関数
  const encodeCSV = (rows: string[][]) => {
    return rows.map(row => 
      row.map(cell => {
        if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    ).join('\r\n');
  };

  // CSVエクスポート（話者,セリフ）
  const handleExportCSV = async (includeTogaki?: boolean, selectedOnly?: boolean, fileFormat?: 'csv' | 'txt') => {
    let allBlocks = project.scenes.flatMap(scene => scene.scripts[0]?.blocks || []);
    
    if (selectedOnly && selectedBlockIds.length > 0) {
      allBlocks = allBlocks.filter(block => selectedBlockIds.includes(block.id));
    }
    
    const rows = allBlocks
      .filter(block => includeTogaki ? true : block.characterId)
      .map(block => {
        if (!block.characterId) {
          return ['ト書き', block.text.replace(/\n/g, '\\n')];
        }
        const char = characters.find(c => c.id === block.characterId);
        return [char ? char.name : '', block.text.replace(/\n/g, '\\n')];
      });

    const csv = encodeCSV(rows);
    const extension = fileFormat === 'txt' ? 'txt' : 'csv';
    const defaultName = `${project.name || 'project'}_all_scenes.${extension}`;
    
    if (window.electronAPI) {
      try {
        await window.electronAPI.saveCSVFile(defaultName, csv);
      } catch (error) {
        console.error('ファイル保存エラー:', error);
        onNotification('ファイルの保存に失敗しました。', 'error');
      }
    } else {
      const mimeType = fileFormat === 'txt' ? 'text/plain;charset=utf-8;' : 'text/csv;charset=utf-8;';
      const blob = new Blob([csv], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // セリフのみエクスポート（ト書きは含めない）
  const handleExportSerifOnly = async (selectedOnly?: boolean, fileFormat?: 'csv' | 'txt', includeTogaki?: boolean) => {
    let allBlocks = project.scenes.flatMap(scene => scene.scripts[0]?.blocks || []);
    
    if (selectedOnly && selectedBlockIds.length > 0) {
      allBlocks = allBlocks.filter(block => selectedBlockIds.includes(block.id));
    }
    
    const rows = allBlocks
      .filter(block => includeTogaki ? true : block.characterId)
      .map(block => [block.text]);
    
    const csv = encodeCSV(rows);
    const extension = fileFormat === 'txt' ? 'txt' : 'csv';
    const defaultName = `${project.name || 'project'}_all_scenes_${includeTogaki ? 'with_togaki' : 'serif_only'}.${extension}`;
    
    if (window.electronAPI) {
      try {
        await window.electronAPI.saveCSVFile(defaultName, csv);
      } catch (error) {
        console.error('ファイル保存エラー:', error);
        onNotification('ファイルの保存に失敗しました。', 'error');
      }
    } else {
      const mimeType = fileFormat === 'txt' ? 'text/plain;charset=utf-8;' : 'text/csv;charset=utf-8;';
      const blob = new Blob([csv], { type: mimeType });
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
    sceneIds?: string[],
    fileFormat?: 'csv' | 'txt'
  ) => {
    // 特定のシーンのみCSVを出力がONの場合はシーンごとに処理
    if (Array.isArray(sceneIds) && sceneIds.length > 0) {
      const targetScenes = project.scenes.filter(s => sceneIds.includes(s.id));
      
      for (const scene of targetScenes) {
        const script = scene.scripts[0];
        for (const group of selectedGroups) {
          const groupCharacterIds = characters
            .filter(char => char.group === group)
            .map(char => char.id);
          
          let groupBlocks = script.blocks.filter(block =>
            (block.characterId && groupCharacterIds.includes(block.characterId))
          );
          
          if (includeTogaki) {
            groupBlocks = [
              ...groupBlocks,
              ...script.blocks.filter(block => !block.characterId)
            ];
          }
          
          if (selectedOnly && selectedBlockIds.length > 0) {
            groupBlocks = groupBlocks.filter(block => selectedBlockIds.includes(block.id));
          }
          
          if (groupBlocks.length === 0) continue;
          
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
          
          const extension = fileFormat === 'txt' ? 'txt' : 'csv';
          filename = `${project.name || 'project'}_${scene.name}_${group}.${extension}`;
          const csv = encodeCSV(rows);
          
          if (window.electronAPI) {
            try {
              await window.electronAPI.saveCSVFile(filename, csv);
            } catch (error) {
              onNotification(`グループ「${group}」のファイルの保存に失敗しました。`, 'error');
            }
          } else {
            const mimeType = fileFormat === 'txt' ? 'text/plain;charset=utf-8;' : 'text/csv;charset=utf-8;';
            const blob = new Blob([csv], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
          }
        }
      }
    } else {
      // 特定のシーンのみCSVを出力がOFFの場合は全シーンを結合して処理
      for (const group of selectedGroups) {
        const groupCharacterIds = characters
          .filter(char => char.group === group)
          .map(char => char.id);
        
        // 全シーンのブロックを結合
        let allGroupBlocks = project.scenes.flatMap(scene => {
          const script = scene.scripts[0];
          if (!script) return [];
          
          return script.blocks.filter(block =>
            (block.characterId && groupCharacterIds.includes(block.characterId))
          );
        });
        
        if (includeTogaki) {
          const allTogakiBlocks = project.scenes.flatMap(scene => {
            const script = scene.scripts[0];
            if (!script) return [];
            return script.blocks.filter(block => !block.characterId);
          });
          allGroupBlocks = [...allGroupBlocks, ...allTogakiBlocks];
        }
        
        if (selectedOnly && selectedBlockIds.length > 0) {
          allGroupBlocks = allGroupBlocks.filter(block => selectedBlockIds.includes(block.id));
        }
        
        if (allGroupBlocks.length === 0) continue;
        
        let rows: string[][];
        let filename: string;
        
        if (exportType === 'full') {
          rows = allGroupBlocks.map(block => {
            if (!block.characterId) {
              return ['ト書き', block.text.replace(/\n/g, '\\n')];
            }
            const char = characters.find(c => c.id === block.characterId);
            return [char ? char.name : '', block.text.replace(/\n/g, '\\n')];
          });
        } else {
          rows = allGroupBlocks.map(block => [block.text.replace(/\n/g, '\\n')]);
        }
        
        const extension = fileFormat === 'txt' ? 'txt' : 'csv';
        filename = `${project.name || 'project'}_all_scenes_${group}.${extension}`;
        const csv = encodeCSV(rows);
        
        if (window.electronAPI) {
          try {
            await window.electronAPI.saveCSVFile(filename, csv);
          } catch (error) {
            onNotification(`グループ「${group}」のファイルの保存に失敗しました。`, 'error');
          }
        } else {
          const mimeType = fileFormat === 'txt' ? 'text/plain;charset=utf-8;' : 'text/csv;charset=utf-8;';
          const blob = new Blob([csv], { type: mimeType });
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
      ['ID', '名前', 'アイコン', 'グループ', '背景色', '無効プロジェクト'],
      ...characters.map(char => [
        char.id,
        char.name,
        char.emotions.normal.iconUrl,
        char.group,
        char.backgroundColor || '#e5e7eb',
        char.disabledProjects ? char.disabledProjects.join(';') : ''
      ])
    ];
    
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
    let allBlocks = project.scenes.flatMap(scene => scene.scripts[0]?.blocks || []);
    
    if (selectedOnly && selectedBlockIds.length > 0) {
      allBlocks = allBlocks.filter(block => selectedBlockIds.includes(block.id));
    }
    
    let text: string;
    if (serifOnly) {
      text = allBlocks
        .filter(block => includeTogaki ? true : block.characterId)
        .map(block => block.text)
        .join('\n');
    } else {
      text = allBlocks
        .filter(block => includeTogaki ? true : block.characterId)
        .map(block => {
          if (block.characterId) {
            const char = characters.find(c => c.id === block.characterId);
            return `${char ? char.name : ''}: ${block.text}`;
          } else {
            return block.text;
          }
        })
        .join('\n');
    }
    
    try {
      await navigator.clipboard.writeText(text);
      onNotification('クリップボードにコピーしました。', 'success');
    } catch (error) {
      onNotification('クリップボードへの出力に失敗しました。', 'error');
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
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          result.push(current.trim());
          return result;
        });
      };

      const rows = parseCSV(text);
      let dataRows = rows;
      if (rows.length > 0 && (rows[0][0].includes('ID') || rows[0][1]?.includes('名前') || rows[0][0].toLowerCase().includes('id'))) {
        dataRows = rows.slice(1);
      }
      
      const newBlocks: ScriptBlock[] = dataRows
        .filter(row => row.length >= 2 && (row[0] || row[1]))
        .map(([speaker, text]) => {
          const character = characters.find(c => c.name === speaker);
          
          if (character) {
            return {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              characterId: character.id,
              emotion: 'normal',
              text: (text || '').replace(/\\n/g, '\n').replace(/\n/g, '\n')
            };
          } else if(speaker === 'ト書き'){
            return {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              characterId: '',
              emotion: 'normal',
              text: (text || '').replace(/\\n/g, '\n').replace(/\n/g, '\n')
            };
          } else {
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
        
        const newSceneId = Date.now().toString();
        const newScriptId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const baseScript = buildEmptyScript({ id: newScriptId, title: options.projectName });
        const newProject = {
          id: options.projectName,
          name: options.projectName,
          scenes: [
            {
              id: newSceneId,
              name: options.projectName,
              scripts: [
                {
                  ...baseScript,
                  blocks: newBlocks
                }
              ]
            }
          ]
        };
        
        dataManagement.saveData(`voiscripter_project_${options.projectName}`, JSON.stringify(newProject));
        
        // プロジェクトリストを更新
        onProjectListUpdate((prev: string[]) => {
          const name = options.projectName as string;
          return prev.includes(name) ? prev : [...prev, name];
        });
        
        onProjectUpdate(newProject);
        onProjectIdUpdate(options.projectName);
        onSelectedSceneIdUpdate(newSceneId);
        onNotification(`${newBlocks.length}個のブロックを新規プロジェクト「${options.projectName}」にインポートしました。`, 'success');
      } else {
        // 既存プロジェクトへの追加
        if (!project || !selectedSceneId) {
          onNotification('プロジェクトまたはシーンが選択されていません。', 'error');
          return;
        }
        
        const currentScene = project.scenes.find(s => s.id === selectedSceneId);
        if (!currentScene) {
          onNotification('選択されたシーンが見つかりません。', 'error');
          return;
        }
        
        const currentScript = currentScene.scripts[0];
        if (!currentScript) {
          onNotification('選択されたシーンのスクリプトが見つかりません。', 'error');
          return;
        }
        
        // 既存のブロックに新しいブロックを追加
        const updatedScript = {
          ...currentScript,
          blocks: [...currentScript.blocks, ...newBlocks]
        };
        
        const updatedScene = {
          ...currentScene,
          scripts: [updatedScript]
        };
        
        const updatedProject = {
          ...project,
          scenes: project.scenes.map(s => s.id === selectedSceneId ? updatedScene : s)
        };
        
        // プロジェクトを保存
        dataManagement.saveData(`voiscripter_project_${project.id}`, JSON.stringify(updatedProject));
        
        onProjectUpdate(updatedProject);
        onNotification(`${newBlocks.length}個のブロックを既存プロジェクト「${project.name}」に追加しました。`, 'success');
      }
    } catch (error) {
      console.error('CSVインポートエラー:', error);
      onNotification('無効な台本形式です。または台本が壊れています。', 'error');
    }
  };

  // キャラクター設定のCSVインポート
  const handleImportCharacterCSV = async (file: File) => {
    try {
      const text = await file.text();
      
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
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          result.push(current.trim());
          return result;
        });
      };

      const rows = parseCSV(text);
      let dataRows = rows;
      if (rows.length > 0 && (rows[0][0].includes('ID') || rows[0][0].toLowerCase().includes('id'))) {
        dataRows = rows.slice(1);
      }

      const newCharacters: Character[] = [];
      const newGroups: string[] = [];

      dataRows.forEach((row, index) => {
        if (row.length >= 4) {
          const characterId = row[0]?.trim() || '';
          const characterName = row[1]?.trim() || '';
          const iconUrl = row[2]?.trim() || '';
          const characterGroup = row[3]?.trim() || 'なし';
          const backgroundColor = row[4]?.trim() || '#e5e7eb';
          const disabledProjectsStr = row[5]?.trim() || '';

          if (characterName) {
            const existingCharacter = characters.find(c => c.name === characterName);
            
            if (existingCharacter) {
              const disabledProjects = disabledProjectsStr ? disabledProjectsStr.split(';').filter(p => p.trim() !== '') : [];
              if (existingCharacter.group !== characterGroup || existingCharacter.emotions.normal.iconUrl !== iconUrl || existingCharacter.backgroundColor !== backgroundColor || existingCharacter.id !== characterId || JSON.stringify(existingCharacter.disabledProjects || []) !== JSON.stringify(disabledProjects)) {
                const updatedCharacter = { 
                  ...existingCharacter, 
                  id: characterId,
                  group: characterGroup, 
                  emotions: { ...existingCharacter.emotions, normal: { iconUrl } },
                  backgroundColor,
                  disabledProjects: disabledProjects
                };
                onCharactersUpdate(characters.map(char => 
                  char.name === characterName ? updatedCharacter : char
                ));
                //console.log(`「${characterName}」の設定を更新しました（characterId: ${existingCharacter.id}）`);
              }
            } else {
              if (characterGroup && characterGroup !== 'なし' && !newGroups.includes(characterGroup)) {
                newGroups.push(characterGroup);
              }

              const emotions = {
                normal: { iconUrl }
              };

              const disabledProjects = disabledProjectsStr ? disabledProjectsStr.split(';').filter(p => p.trim() !== '') : [];

              newCharacters.push({
                id: characterId || Date.now().toString() + Math.random().toString(36).substr(2, 9),
                name: characterName,
                group: characterGroup,
                emotions,
                backgroundColor,
                disabledProjects: disabledProjects
              });
            }
          }
        }
      });

      // 新しいグループを追加（重複を除去）
      let actuallyAddedGroups: string[] = [];
      if (newGroups.length > 0) {
        const uniqueNewGroups = newGroups.filter((group, index) => newGroups.indexOf(group) === index);
        const groupsToAdd = uniqueNewGroups.filter(group => !groups.includes(group));
        actuallyAddedGroups = groupsToAdd;
        if (groupsToAdd.length > 0) {
          onGroupsUpdate([...groups, ...groupsToAdd]);
          // グループデータを保存
          dataManagement.saveData('voiscripter_groups', JSON.stringify([...groups, ...groupsToAdd]));
        }
      }

      // 新しいキャラクターを追加
      if (newCharacters.length > 0) {
        onCharactersUpdate([...characters, ...newCharacters]);
        onNotification(`${newCharacters.length}個のキャラクターをインポートしました。${actuallyAddedGroups.length > 0 ? `\n新しいグループ「${actuallyAddedGroups.join(', ')}」が追加されました。` : ''}`, 'success');
      } else {
        onNotification('キャラクター設定のインポートが完了しました。', 'success');
      }
    } catch (error) {
      console.error('キャラクター設定のCSVインポートエラー:', error);
      onNotification('キャラクター設定のCSVファイルのインポートに失敗しました。', 'error');
    }
  };

  // JSONインポート（プロジェクト/シーン）
  const handleImportJson = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data || typeof data !== 'object' || !Array.isArray(data.scenes) || !data.name || !data.id) {
        onNotification('無効な形式のためインポートできませんでした。', 'error');
        return;
      }
      
      const mappedScenes = data.scenes.map((scene: any) => ({
        ...scene,
        scripts: scene.scripts.map((script: any) => ({
          ...script,
          blocks: script.blocks.map((block: any) => {
            let newCharId = '';
            
            // まずIDでマッピングを試行
            if (block.characterId && characters.some(c => c.id === block.characterId)) {
              newCharId = block.characterId;
            } else if (block.characterId) {
              // IDでマッピングできない場合、キャラクター名でマッピングを試行
              const character = characters.find(c => c.name === block.characterId);
              if (character) {
                newCharId = character.id;
              }
            }
            
            return {
              ...block,
              characterId: newCharId,
            };
          })
        }))
      }));
      
      const importedProject = {
        id: data.id,
        name: data.name,
        scenes: mappedScenes
      };
      
      // プロジェクトデータを保存
      dataManagement.saveData(`voiscripter_project_${data.id}`, JSON.stringify(importedProject));
      
      // プロジェクトリストを更新
      onProjectListUpdate((prev: string[]) => {
        return prev.includes(data.id) ? prev : [...prev, data.id];
      });
      
      onProjectUpdate(importedProject);
      onSelectedSceneIdUpdate(mappedScenes[0]?.id || null);
      onProjectIdUpdate(data.id);
      onNotification('プロジェクトをインポートしました', 'success');
    } catch (e) {
      onNotification('無効な形式のためインポートできませんでした。', 'error');
    }
  };

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
    onNotification('プロジェクトをエクスポートしました', 'success');
  };

  // シーン単位でCSVエクスポート
  const handleExportSceneCSV = async (
    sceneIds: string[],
    exportType: 'full' | 'serif-only',
    includeTogaki: boolean,
    selectedOnly: boolean,
    fileFormat?: 'csv' | 'txt'
  ) => {
    sceneIds.forEach(async (sceneId) => {
      const scene = project.scenes.find(s => s.id === sceneId);
      if (!scene || scene.scripts.length === 0) {
        onNotification('シーンが見つかりません', 'error');
        return;
      }
      
      const script = scene.scripts[0];
      let targetBlocks = script.blocks;
      if (selectedOnly && selectedBlockIds.length > 0) {
        targetBlocks = script.blocks.filter(block => selectedBlockIds.includes(block.id));
      }
      
      if (!targetBlocks || targetBlocks.length === 0) {
        onNotification('エクスポート対象のブロックがありません', 'info');
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
          .filter(block => includeTogaki ? true : block.characterId)
          .map(block => [block.text.replace(/\n/g, '\\n')]);
      }
      
      if (!rows || rows.length === 0) {
        onNotification('エクスポート対象のデータがありません', 'info');
        return;
      }
      
      const csv = encodeCSV(rows);
      const extension = fileFormat === 'txt' ? 'txt' : 'csv';
      const filename = `${project.name || 'project'}_${scene.name}_${exportType}.${extension}`;
      
      if (window.electronAPI) {
        try {
          await window.electronAPI.saveCSVFile(filename, csv);
          onNotification(`${extension.toUpperCase()}ファイルを保存しました`, 'success');
        } catch (error) {
          onNotification(`${extension.toUpperCase()}ファイルの保存に失敗しました`, 'error');
        }
      } else {
        const mimeType = fileFormat === 'txt' ? 'text/plain;charset=utf-8;' : 'text/csv;charset=utf-8;';
        const blob = new Blob([csv], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        onNotification(`${extension.toUpperCase()}ファイルをダウンロードしました`, 'success');
      }
    });
  };

  return {
    handleExportCSV,
    handleExportSerifOnly,
    handleExportByGroups,
    handleExportCharacterCSV,
    handleExportToClipboard,
    handleImportCSV,
    handleImportCharacterCSV,
    handleImportJson,
    handleExportProjectJson,
    handleExportSceneCSV
  };
};
