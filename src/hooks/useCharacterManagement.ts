import { useState, useEffect, useRef } from 'react';
import { Character } from '@/types';
import { DataManagementHook } from './useDataManagement';

export interface CharacterManagementHook {
  characters: Character[];
  setCharacters: (characters: Character[]) => void;
  groups: string[];
  setGroups: (groups: string[]) => void;
  handleAddCharacter: (character: Character) => void;
  handleUpdateCharacter: (updated: Character) => void;
  handleDeleteCharacter: (id: string) => void;
  handleAddGroup: (group: string) => void;
  handleDeleteGroup: (group: string) => void;
  handleReorderCharacters: (newOrder: Character[]) => void;
  handleReorderGroups: (newOrder: string[]) => void;
  handleImportCharacterCSV: (file: File) => Promise<void>;
}

export const useCharacterManagement = (
  dataManagement: DataManagementHook,
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void,
  onProjectUpdate: (project: any) => void,
  selectedSceneId: string | null
): CharacterManagementHook => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  
  // グループ保存フラグ
  const isFirstGroups = useRef(true);
  const isFirstCharacters = useRef(true);

  // 初回マウント時にデータを読み込み
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadInitialData = async () => {
      // characters
      const savedChars = await dataManagement.loadData('voiscripter_characters');
      if (savedChars) {
        try {
          const parsedChars = JSON.parse(savedChars);
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
      const savedGroups = await dataManagement.loadData('voiscripter_groups');
      if (savedGroups !== null && savedGroups !== undefined) {
        try {
          const parsedGroups = JSON.parse(savedGroups);
          if (Array.isArray(parsedGroups)) {
            setGroups(parsedGroups);
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
      const savedCharsForGroups = await dataManagement.loadData('voiscripter_characters');
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
    };
    
    loadInitialData();
  }, [dataManagement.saveDirectory]);

  // characters保存（初回マウント時の復元直後は保存しない）
  useEffect(() => {
    if (isFirstCharacters.current) {
      isFirstCharacters.current = false;
      return;
    }
    if (typeof window === 'undefined') return;
    
    if (characters.length > 0) {
      dataManagement.saveData('voiscripter_characters', JSON.stringify(characters));
      console.log('キャラクター設定を保存:', characters.length, '個');
    }
  }, [characters]);

  // groups保存
  useEffect(() => {
    if (isFirstGroups.current) return;
    if (typeof window === 'undefined') return;
    
    if (groups.length > 0) {
      dataManagement.saveData('voiscripter_groups', JSON.stringify(groups));
      console.log('グループ設定を保存:', groups.length, '個');
    }
  }, [groups]);

  // saveDirectory変更時のキャラクター・グループ設定の再保存
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (dataManagement.saveDirectory !== '') {
      if (characters.length > 0) {
        dataManagement.saveData('voiscripter_characters', JSON.stringify(characters));
        console.log('saveDirectory変更後、キャラクター設定を保存:', characters.length, '個');
      }
      if (groups.length > 0) {
        dataManagement.saveData('voiscripter_groups', JSON.stringify(groups));
        console.log('saveDirectory変更後、グループ設定を保存:', groups.length, '個');
      }
    } else {
      if (characters.length > 0) {
        localStorage.setItem('voiscripter_characters', JSON.stringify(characters));
        console.log('localStorage変更後、キャラクター設定を保存:', characters.length, '個');
      }
      if (groups.length > 0) {
        localStorage.setItem('voiscripter_groups', JSON.stringify(groups));
        console.log('localStorage変更後、グループ設定を保存:', groups.length, '個');
      }
    }
  }, [dataManagement.saveDirectory, characters, groups]);

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
      onProjectUpdate((prev: any) => ({
        ...prev,
        scenes: prev.scenes.map((scene: any) =>
          scene.id === selectedSceneId
            ? {
                ...scene,
                scripts: scene.scripts.map((script: any) => ({
                  ...script,
                  blocks: script.blocks.map((b: any) => b.characterId === id ? { ...b, characterId: '' } : b)
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

  // キャラクターの並び替え
  const handleReorderCharacters = (newOrder: Character[]) => {
    setCharacters(newOrder);
    dataManagement.saveData('voiscripter_characters', JSON.stringify(newOrder));
  };

  // グループの並び替え
  const handleReorderGroups = (newOrder: string[]) => {
    setGroups(newOrder);
    dataManagement.saveData('voiscripter_groups', JSON.stringify(newOrder));
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

          if (characterName) {
            const existingCharacter = characters.find(c => c.name === characterName);
            
            if (existingCharacter) {
              if (existingCharacter.group !== characterGroup || existingCharacter.emotions.normal.iconUrl !== iconUrl || existingCharacter.backgroundColor !== backgroundColor || existingCharacter.id !== characterId) {
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
                backgroundColor
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
          dataManagement.saveData('voiscripter_groups', JSON.stringify(newGroups));
          return newGroups;
        });
      }

      // 新しいキャラクターを追加
      if (newCharacters.length > 0) {
        setCharacters(prev => {
          const newCharactersList = [...prev, ...newCharacters];
          dataManagement.saveData('voiscripter_characters', JSON.stringify(newCharactersList));
          return newCharactersList;
        });
        onNotification(`${newCharacters.length}個のキャラクターをインポートしました。${actuallyAddedGroups.length > 0 ? `\n新しいグループ「${actuallyAddedGroups.join(', ')}」が追加されました。` : ''}`, 'success');
      } else {
        onNotification('キャラクター設定のインポートが完了しました。', 'success');
      }
    } catch (error) {
      console.error('キャラクター設定のCSVインポートエラー:', error);
      onNotification('キャラクター設定のCSVファイルのインポートに失敗しました。', 'error');
    }
  };

  return {
    characters,
    setCharacters,
    groups,
    setGroups,
    handleAddCharacter,
    handleUpdateCharacter,
    handleDeleteCharacter,
    handleAddGroup,
    handleDeleteGroup,
    handleReorderCharacters,
    handleReorderGroups,
    handleImportCharacterCSV
  };
};
