import { Project, ScriptBlock, Character } from '@/types';
import { DataManagementHook } from './useDataManagement';

export interface DataProcessingHook {
  saveData: (key: string, data: string) => void;
  loadData: (key: string) => Promise<string | null>;
  handleDataQuotaExceeded: () => void;
  cleanupOldData: () => void;
}

export const useDataProcessing = (dataManagement: DataManagementHook): DataProcessingHook => {
  
  // データ保存関数
  const saveData = (key: string, data: string) => {
    try {
      dataManagement.saveData(key, data);
    } catch (error) {
      console.error('データ保存エラー:', error);
      // QuotaExceededErrorの場合、古いデータを削除して再試行
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        handleDataQuotaExceeded();
        try {
          dataManagement.saveData(key, data);
        } catch (retryError) {
          console.error('データ保存再試行エラー:', retryError);
        }
      }
    }
  };

  // データ読み込み関数
  const loadData = async (key: string): Promise<string | null> => {
    try {
      return await dataManagement.loadData(key);
    } catch (error) {
      console.error('データ読み込みエラー:', error);
      return null;
    }
  };

  // データ容量超過時の処理
  const handleDataQuotaExceeded = () => {
    console.warn('データ容量が上限に達しました。古いデータを削除します。');
    cleanupOldData();
  };

  // 古いデータのクリーンアップ
  const cleanupOldData = () => {
    try {
      // 古いundo/redoデータを削除
      const keys = Object.keys(localStorage);
      const undoRedoKeys = keys.filter(k => 
        k.startsWith('voiscripter_project_') && 
        (k.endsWith('_undo') || k.endsWith('_redo'))
      );
      
      // 最新の10件以外を削除
      const projectKeys = Array.from(new Set(undoRedoKeys.map(k => k.replace(/_(undo|redo)$/, ''))));
      if (projectKeys.length > 10) {
        const keysToDelete = projectKeys.slice(10).flatMap(projectId => [
          `voiscripter_project_${projectId}_undo`,
          `voiscripter_project_${projectId}_redo`
        ]);
        
        keysToDelete.forEach(key => {
          try {
            localStorage.removeItem(key);
            console.log(`古いデータを削除: ${key}`);
          } catch (error) {
            console.error(`データ削除エラー (${key}):`, error);
          }
        });
      }
    } catch (error) {
      console.error('データクリーンアップエラー:', error);
    }
  };

  return {
    saveData,
    loadData,
    handleDataQuotaExceeded,
    cleanupOldData
  };
};
