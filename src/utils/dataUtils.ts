import { Project, ScriptBlock } from '@/types';

// CSVエンコード関数
export const encodeCSV = (rows: string[][]) => {
  return rows.map(row => 
    row.map(cell => {
      if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\r\n');
};

// CSVパース関数
export const parseCSV = (csvText: string) => {
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

// プロジェクトデータの検証
export const validateProject = (data: any): data is Project => {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.scenes) &&
    typeof data.name === 'string' &&
    typeof data.id === 'string'
  );
};

// スクリプトブロックの検証
export const validateScriptBlock = (data: any): data is ScriptBlock => {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.id === 'string' &&
    typeof data.characterId === 'string' &&
    typeof data.emotion === 'string' &&
    typeof data.text === 'string'
  );
};

// プロジェクトデータの正規化
export const normalizeProject = (project: Project): Project => {
  return {
    ...project,
    scenes: project.scenes.map(scene => ({
      ...scene,
      scripts: scene.scripts.map(script => ({
        ...script,
        blocks: script.blocks.map(block => ({
          ...block,
          id: block.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
          characterId: block.characterId || '',
          emotion: block.emotion || 'normal',
          text: block.text || ''
        }))
      }))
    }))
  };
};

// データの移動処理（localStorage ↔ ファイル）
export const moveDataBetweenStorage = async (
  fromStorage: 'localStorage' | 'file',
  toStorage: 'localStorage' | 'file',
  dataManagement: any
) => {
  try {
    if (fromStorage === 'localStorage' && toStorage === 'file') {
      // localStorageからファイルに移動
      const keys = Object.keys(localStorage).filter(k => k.startsWith('voiscripter_'));
      
      for (const key of keys) {
        const data = localStorage.getItem(key);
        if (data) {
          await dataManagement.saveData(key, data);
          console.log(`データ移動成功: ${key}`);
        }
      }
      
      return { success: true, movedCount: keys.length };
    } else if (fromStorage === 'file' && toStorage === 'localStorage') {
      // ファイルからlocalStorageに移動
      const keys = await dataManagement.listDataKeys() || [];
      
      for (const key of keys) {
        const data = await dataManagement.loadData(key);
        if (data) {
          localStorage.setItem(key, data);
          console.log(`データ読み込み成功: ${key}`);
        }
      }
      
      return { success: true, movedCount: keys.length };
    }
    
    return { success: false, error: 'Invalid storage type' };
  } catch (error) {
    console.error('データ移動処理エラー:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// データのクリーンアップ
export const cleanupData = async (dataManagement: any, projectId: string) => {
  try {
    // プロジェクト関連のデータを削除
    dataManagement.deleteData(`voiscripter_project_${projectId}`);
    dataManagement.deleteData(`voiscripter_project_${projectId}_lastScene`);
    dataManagement.deleteData(`voiscripter_project_${projectId}_undo`);
    dataManagement.deleteData(`voiscripter_project_${projectId}_redo`);
    
    return { success: true };
  } catch (error) {
    console.error('データクリーンアップエラー:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// データの整合性チェック
export const validateDataIntegrity = async (dataManagement: any) => {
  try {
    const issues: string[] = [];
    
    // プロジェクトデータの整合性チェック
    const projectKeys = (await dataManagement.listDataKeys() || [])
      .filter((k: string) => k.startsWith('voiscripter_project_') && !k.includes('_'));
    
    for (const key of projectKeys) {
      const projectData = await dataManagement.loadData(key);
      if (projectData) {
        try {
          const project = JSON.parse(projectData);
          if (!validateProject(project)) {
            issues.push(`Invalid project data: ${key}`);
          }
        } catch (error) {
          issues.push(`Corrupted project data: ${key}`);
        }
      }
    }
    
    // キャラクターデータの整合性チェック
    const characterData = await dataManagement.loadData('voiscripter_characters');
    if (characterData) {
      try {
        const characters = JSON.parse(characterData);
        if (!Array.isArray(characters)) {
          issues.push('Invalid characters data format');
        }
      } catch (error) {
        issues.push('Corrupted characters data');
      }
    }
    
    return { success: true, issues };
  } catch (error) {
    console.error('データ整合性チェックエラー:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', issues: [] };
  }
};
