import { useState, useEffect, useCallback } from 'react';
import { voiScripterDB } from '@/utils/indexedDB';
import { performAutoMigration, shouldMigrate } from '@/utils/migration';

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
  const [isIndexedDBReady, setIsIndexedDBReady] = useState<boolean>(false);
  const [migrationCompleted, setMigrationCompleted] = useState<boolean>(false);

  // データ保存関数
  const saveData = useCallback(async (key: string, data: string) => {
    if (typeof window === 'undefined') return;
    
    if (saveDirectory === '') {
      // IndexedDBまたはlocalStorageに保存
      try {
        if (isIndexedDBReady && migrationCompleted) {
          // IndexedDBに保存
          await voiScripterDB.save(key, data);
          //console.log(`Successfully saved to IndexedDB: ${key}`);
        } else {
          // localStorageに保存（移行前またはIndexedDBが利用できない場合）
          // データサイズのチェック
          const dataSize = new Blob([data]).size;
          const maxSize = 2 * 1024 * 1024; // 2MB制限（より厳しく）
          
          if (dataSize > maxSize) {
            console.warn(`Data size (${dataSize} bytes) exceeds localStorage limit (${maxSize} bytes) for key: ${key}`);
            
            // 大きなデータの種類に応じて処理
            if (key.includes('_undo') || key.includes('_redo')) {
              return;
            } else if (key.includes('_characters')) {
              return;
            } else if (key.includes('_groups')) {
              return;
            }
            
            return;
          }
          
          localStorage.setItem(key, data);
          //console.log(`Successfully saved to localStorage: ${key} (${dataSize} bytes)`);
        }
      } catch (error) {
        console.error('Data save error:', error);
        console.error('Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          key,
          dataLength: data.length,
          saveDirectory,
          isIndexedDBReady,
          migrationCompleted
        });
        
        // localStorageにフォールバック
        try {
          localStorage.setItem(key, data);
          //console.log('Fallback to localStorage successful');
        } catch (fallbackError) {
          console.error('Fallback to localStorage failed:', fallbackError);
          
          // QuotaExceededErrorの場合、古いデータを削除して再試行
          if (fallbackError instanceof Error && fallbackError.name === 'QuotaExceededError') {
            try {
              const keys = Object.keys(localStorage);
              const undoRedoKeys = keys.filter(k => k.includes('_undo') || k.includes('_redo'));
              undoRedoKeys.forEach(k => localStorage.removeItem(k));
              localStorage.setItem(key, data);
              //console.log('Retry save successful after cleanup');
            } catch (retryError) {
              console.error('Retry save failed:', retryError);
            }
          }
        }
      }
    } else if (typeof window !== 'undefined' && window.electronAPI) {
      // ファイルに保存
      window.electronAPI?.saveData(key, data);
    }
  }, [saveDirectory, isIndexedDBReady, migrationCompleted]);

  // データ読み込み関数
  const loadData = useCallback(async (key: string): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    
    //console.log(`🔍 データ読み込み - key: ${key}, 保存先: ${saveDirectory}, IndexedDB: ${isIndexedDBReady && migrationCompleted}`);
    
    if (saveDirectory === '') {
      // IndexedDBまたはlocalStorageから読み込み
      try {
        if (isIndexedDBReady && migrationCompleted) {
          // IndexedDBから読み込み
          const result = await voiScripterDB.load(key);
          //console.log(`📦 IndexedDBから読み込み - key: ${key}, 結果: ${result ? '成功' : 'null'}`);
          return result;
        } else {
          // localStorageから読み込み（移行前またはIndexedDBが利用できない場合）
          const result = localStorage.getItem(key);
          //console.log(`📦 localStorageから読み込み - key: ${key}, 結果: ${result ? '成功' : 'null'}`);
          return result;
        }
      } catch (error) {
        console.error('Data load error:', error);
        // localStorageにフォールバック
        try {
          const result = localStorage.getItem(key);
          //console.log(`📦 フォールバック: localStorageから読み込み - key: ${key}, 結果: ${result ? '成功' : 'null'}`);
          return result;
        } catch (fallbackError) {
          console.error('Fallback to localStorage failed:', fallbackError);
          return null;
        }
      }
    } else if (window.electronAPI) {
      // ファイルから読み込み
      const result = await window.electronAPI?.loadData(key) || null;
      //console.log(`📁 ファイルから読み込み - key: ${key}, 結果: ${result ? '成功' : 'null'}`);
      return result;
    }
    return null;
  }, [saveDirectory, isIndexedDBReady, migrationCompleted]);

  // データ削除関数
  const deleteData = useCallback(async (key: string) => {
    if (typeof window === 'undefined') return;
    
    if (saveDirectory === '') {
      // IndexedDBまたはlocalStorageから削除
      try {
        if (isIndexedDBReady && migrationCompleted) {
          // IndexedDBから削除
          await voiScripterDB.delete(key);
          //console.log(`Deleted from IndexedDB: ${key}`);
        } else {
          // localStorageから削除（移行前またはIndexedDBが利用できない場合）
          localStorage.removeItem(key);
          //console.log(`Deleted from localStorage: ${key}`);
        }
      } catch (error) {
        console.error('Data delete error:', error);
        // localStorageにフォールバック
        try {
          localStorage.removeItem(key);
          //console.log(`Fallback: Deleted from localStorage: ${key}`);
        } catch (fallbackError) {
          console.error('Fallback to localStorage failed:', fallbackError);
        }
      }
    } else if (window.electronAPI) {
      window.electronAPI?.deleteData(key);
    }
  }, [saveDirectory, isIndexedDBReady, migrationCompleted]);

  // データキー一覧取得関数
  const listDataKeys = useCallback(async (): Promise<string[]> => {
    if (typeof window === 'undefined') return [];
    
    if (saveDirectory === '') {
      // IndexedDBまたはlocalStorageからキー一覧を取得
      try {
        if (isIndexedDBReady && migrationCompleted) {
          // IndexedDBからキー一覧を取得
          const keys = await voiScripterDB.getAllKeys();
          //console.log(`Retrieved ${keys.length} keys from IndexedDB`);
          return keys;
        } else {
          // localStorageからキー一覧を取得（移行前またはIndexedDBが利用できない場合）
          const keys = Object.keys(localStorage);
          //console.log(`Retrieved ${keys.length} keys from localStorage`);
          return keys;
        }
      } catch (error) {
        console.error('Data list keys error:', error);
        // localStorageにフォールバック
        try {
          const keys = Object.keys(localStorage);
          //console.log(`Fallback: Retrieved ${keys.length} keys from localStorage`);
          return keys;
        } catch (fallbackError) {
          console.error('Fallback to localStorage failed:', fallbackError);
          return [];
        }
      }
    } else if (window.electronAPI) {
      return await window.electronAPI?.listDataKeys() || [];
    }
    return [];
  }, [saveDirectory, isIndexedDBReady, migrationCompleted]);

  // 初回マウント時に保存先設定を読み込みとIndexedDB移行を実行
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const initializeDataManagement = async () => {
      try {
        //console.log('🚀 データ管理の初期化開始');
        
        // 1. 保存先設定を読み込み
        let savedDirectory = '';
        if (window.electronAPI) {
          try {
            const settings = await window.electronAPI.loadSettings();
            savedDirectory = settings.saveDirectory || '';
            setSaveDirectory(savedDirectory);
            //console.log('🔧 設定から読み込んだ保存先:', savedDirectory);
            
            // 保存先が設定されている場合、データキー一覧を確認
            if (savedDirectory) {
              const keys = await window.electronAPI.listDataKeys();
              //console.log('📁 ディレクトリ内のデータキー:', keys);
            }
          } catch (error) {
            console.error('設定読み込みエラー:', error);
          }
        } else {
          savedDirectory = localStorage.getItem('voiscripter_saveDirectory') || '';
          setSaveDirectory(savedDirectory);
          //console.log('🔧 localStorageから読み込んだ保存先:', savedDirectory);
        }

        // 2. Electronでカスタムディレクトリが設定されている場合は移行をスキップ
        if (savedDirectory && window.electronAPI) {
          //console.log('⏭️ Electron環境でカスタムディレクトリが設定されているため、移行をスキップ');
          return;
        }

        // 3. IndexedDBが利用可能かチェック
        if (!window.indexedDB) {
          //console.log('⚠️ IndexedDBが利用できません。localStorageを継続使用します');
          return;
        }

        // 4. IndexedDBを初期化
        try {
          await voiScripterDB.open();
          setIsIndexedDBReady(true);
          //console.log('✅ IndexedDBの初期化完了');
        } catch (error) {
          console.error('❌ IndexedDBの初期化エラー:', error);
          return;
        }

        // 5. 自動移行を実行
        //console.log('🔄 自動移行を開始...');
        const migrationResult = await performAutoMigration();
        
        if (migrationResult.success) {
          setMigrationCompleted(true);
          //console.log(`🎉 移行完了: ${migrationResult.migratedCount}個のデータを移行しました`);
          
          if (migrationResult.error) {
            console.warn('⚠️ 移行中にエラーが発生しました:', migrationResult.error);
          }
        } else {
          console.error('❌ 移行に失敗しました:', migrationResult.error);
        }

      } catch (error) {
        console.error('❌ データ管理の初期化エラー:', error);
      }
    };
    
    initializeDataManagement();
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
