import { useState, useEffect, useCallback } from 'react';

export interface DataManagementHook {
  saveData: (key: string, data: string) => void;
  loadData: (key: string) => Promise<string | null>;
  deleteData: (key: string) => void;
  listDataKeys: () => Promise<string[]>;
  saveDirectory: string;
  setSaveDirectory: (directory: string) => void;
}

export const useDataManagement = (): DataManagementHook => {
  const [saveDirectory, setSaveDirectory] = useState<string>('');

  // データ保存関数
  const saveData = useCallback((key: string, data: string) => {
    if (saveDirectory === '') {
      // localStorageに保存
      try {
        // データサイズのチェック
        const dataSize = new Blob([data]).size;
        const maxSize = 2 * 1024 * 1024; // 2MB制限（より厳しく）
        
        if (dataSize > maxSize) {
          console.warn(`Data size (${dataSize} bytes) exceeds localStorage limit (${maxSize} bytes) for key: ${key}`);
          
          // 大きなデータの種類に応じて処理
          if (key.includes('_undo') || key.includes('_redo')) {
            console.log('Skipping large undo/redo data to prevent localStorage overflow');
            return;
          } else if (key.includes('_characters')) {
            console.log('Skipping large character data to prevent localStorage overflow');
            return;
          } else if (key.includes('_groups')) {
            console.log('Skipping large group data to prevent localStorage overflow');
            return;
          }
          
          // その他の大きなデータもスキップ
          console.log(`Skipping large data for key: ${key}`);
          return;
        }
        
        localStorage.setItem(key, data);
        console.log(`Successfully saved to localStorage: ${key} (${dataSize} bytes)`);
      } catch (error) {
        console.error('localStorage save error:', error);
        console.error('Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          key,
          dataLength: data.length,
          saveDirectory
        });
        
        // QuotaExceededErrorの場合、古いデータを削除して再試行
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          try {
            console.log('QuotaExceededError detected, attempting cleanup...');
            // 古いundo/redoデータを削除
            const keys = Object.keys(localStorage);
            const undoRedoKeys = keys.filter(k => k.includes('_undo') || k.includes('_redo'));
            console.log('Removing undo/redo keys:', undoRedoKeys);
            undoRedoKeys.forEach(k => localStorage.removeItem(k));
            // 再試行
            localStorage.setItem(key, data);
            console.log('Retry save successful after cleanup');
          } catch (retryError) {
            console.error('Retry save failed:', retryError);
            console.error('Retry error details:', {
              name: retryError instanceof Error ? retryError.name : 'Unknown',
              message: retryError instanceof Error ? retryError.message : String(retryError)
            });
          }
        }
      }
    } else if (window.electronAPI) {
      // ファイルに保存
      window.electronAPI?.saveData(key, data);
    }
  }, []);

  // データ読み込み関数
  const loadData = useCallback(async (key: string): Promise<string | null> => {
    if (saveDirectory === '') {
      // localStorageから読み込み
      return localStorage.getItem(key);
    } else if (window.electronAPI) {
      // ファイルから読み込み
      return await window.electronAPI?.loadData(key) || null;
    }
    return null;
  }, []);

  // データ削除関数
  const deleteData = useCallback((key: string) => {
    if (saveDirectory === '') {
      localStorage.removeItem(key);
    } else if (window.electronAPI) {
      window.electronAPI?.deleteData(key);
    }
  }, []);

  // データキー一覧取得関数
  const listDataKeys = useCallback(async (): Promise<string[]> => {
    if (saveDirectory === '') {
      return Object.keys(localStorage);
    } else if (window.electronAPI) {
      return await window.electronAPI?.listDataKeys() || [];
    }
    return [];
  }, []);

  // 初回マウント時に保存先設定を読み込み
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadSaveDirectory = async () => {
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
    };
    
    loadSaveDirectory();
  }, []);

  return {
    saveData,
    loadData,
    deleteData,
    listDataKeys,
    saveDirectory,
    setSaveDirectory
  };
};
