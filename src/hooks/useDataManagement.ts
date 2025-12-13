import { useState, useEffect, useCallback } from 'react';
import { voiScripterDB } from '@/utils/indexedDB';
import { performAutoMigration, shouldMigrate, isMigrationCompleted } from '@/utils/migration';

export interface DataManagementHook {
  saveData: (key: string, data: string) => void;
  loadData: (key: string) => Promise<string | null>;
  deleteData: (key: string) => void;
  listDataKeys: () => Promise<string[]>;
  saveDirectory: string;
  setSaveDirectory: (directory: string) => void;
  isInitialized: boolean;
}

export const useDataManagement = (): DataManagementHook => {
  const [saveDirectory, setSaveDirectory] = useState<string>('');
  const [isIndexedDBReady, setIsIndexedDBReady] = useState<boolean>(false);
  const [migrationCompleted, setMigrationCompleted] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

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
    
    // Electron環境の場合、設定を確認してカスタムディレクトリが設定されているかチェック
    if (window.electronAPI) {
      try {
        const settings = await window.electronAPI.loadSettings();
        const currentSaveDirectory = settings.saveDirectory || '';
        
        // カスタムディレクトリが設定されている場合はファイルから読み込み（IndexedDBはスキップ）
        if (currentSaveDirectory !== '') {
          const result = await window.electronAPI?.loadData(key) || null;
          //console.log(`📁 ファイルから読み込み - key: ${key}, 結果: ${result ? '成功' : 'null'}`);
          return result;
        }
      } catch (error) {
        console.error('設定読み込みエラー:', error);
        // エラー時は後続の処理に進む
      }
    }
    
    // Electron環境でsaveDirectoryが空の場合、またはブラウザ環境の場合
    // IndexedDBまたはlocalStorageから読み込み
    try {
      // IndexedDBが利用可能かチェック
      if (!window.indexedDB) {
        //console.log('⚠️ [loadData] IndexedDBが利用できません、localStorageから読み込み');
        return localStorage.getItem(key);
      }
      
      // IndexedDBを開く（まだ開いていない場合）
      if (!isIndexedDBReady) {
        try {
          await voiScripterDB.open();
          setIsIndexedDBReady(true);
          //console.log('✅ [loadData] IndexedDBを開きました');
        } catch (error) {
          console.error('IndexedDB初期化エラー:', error);
          // エラー時はlocalStorageから読み込み
          return localStorage.getItem(key);
        }
      }
      
      // まず、IndexedDBからデータを読み込む
      try {
        const indexedDBResult = await voiScripterDB.load(key);
        if (indexedDBResult) {
          // IndexedDBにデータが存在すれば、移行完了と見なしてそのまま返す
          //console.log(`📦 IndexedDBから読み込み - key: ${key}, 結果: 成功`);
          setMigrationCompleted(true);
          return indexedDBResult;
        }
      } catch (error) {
        console.error('IndexedDB読み込みエラー:', error);
      }
      
      // IndexedDBにデータが存在しない場合、localStorageをチェック
      const localStorageResult = localStorage.getItem(key);
      if (localStorageResult) {
        // localStorageにデータがあれば、移行を実行
        //console.log(`🔄 [loadData] IndexedDBにデータなし、localStorageにデータあり - 移行を実行: ${key}`);
        try {
          const { migrateFromLocalStorage } = await import('@/utils/migration');
          const migrationResult = await migrateFromLocalStorage();
          if (migrationResult.success) {
            setMigrationCompleted(true);
            // 移行後、再度IndexedDBから読み込む
            const migratedResult = await voiScripterDB.load(key);
            if (migratedResult) {
              //console.log(`✅ [loadData] 移行後、IndexedDBから読み込み成功: ${key}`);
              return migratedResult;
            }
            // 移行後もIndexedDBにデータがない場合は、localStorageのデータを返す
            //console.log(`⚠️ [loadData] 移行後もIndexedDBにデータなし、localStorageから返す: ${key}`);
            return localStorageResult;
          } else {
            console.error('移行に失敗しました:', migrationResult.error);
            // 移行失敗時はlocalStorageから返す
            return localStorageResult;
          }
        } catch (error) {
          console.error('移行エラー:', error);
          // 移行エラー時はlocalStorageから返す
          return localStorageResult;
        }
      }
      
      // IndexedDBにもlocalStorageにもデータがない場合
      //console.log(`📦 [loadData] IndexedDBにもlocalStorageにもデータなし: ${key}`);
      return null;
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
  }, [saveDirectory, isIndexedDBReady, migrationCompleted, isInitialized]);

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
    
    // Electron環境の場合、設定を確認してカスタムディレクトリが設定されているかチェック
    if (window.electronAPI) {
      try {
        const settings = await window.electronAPI.loadSettings();
        const currentSaveDirectory = settings.saveDirectory || '';
        
        // カスタムディレクトリが設定されている場合はファイルから取得（IndexedDBはスキップ）
        if (currentSaveDirectory !== '') {
          return await window.electronAPI?.listDataKeys() || [];
        }
      } catch (error) {
        console.error('設定読み込みエラー:', error);
        // エラー時は後続の処理に進む
      }
    }
    
    if (saveDirectory === '') {
      // IndexedDBまたはlocalStorageからキー一覧を取得
      try {
        // IndexedDBが利用可能かチェック
        if (!window.indexedDB) {
          //console.log('⚠️ [listDataKeys] IndexedDBが利用できません、localStorageから取得');
          return Object.keys(localStorage).filter(k => k.startsWith('voiscripter_'));
        }
        
        // IndexedDBを開く（まだ開いていない場合）
        if (!isIndexedDBReady) {
          try {
            await voiScripterDB.open();
            setIsIndexedDBReady(true);
            //console.log('✅ [listDataKeys] IndexedDBを開きました');
          } catch (error) {
            console.error('IndexedDB初期化エラー:', error);
            // エラー時はlocalStorageから取得
            return Object.keys(localStorage).filter(k => k.startsWith('voiscripter_'));
          }
        }
        
        // IndexedDBからキー一覧を取得
        try {
          const indexedDBKeys = await voiScripterDB.getAllKeys();
          if (indexedDBKeys.length > 0) {
            // IndexedDBにデータが存在すれば、移行完了と見なしてそのまま返す
            //console.log(`📦 [listDataKeys] IndexedDBから取得: ${indexedDBKeys.length}個のキー`);
            setMigrationCompleted(true);
            return indexedDBKeys;
          }
        } catch (error) {
          console.error('IndexedDB list keys error:', error);
        }
        
        // IndexedDBにデータが存在しない場合、localStorageをチェック
        const localStorageKeys = Object.keys(localStorage).filter(k => k.startsWith('voiscripter_'));
        if (localStorageKeys.length > 0) {
          // localStorageにデータがあれば、移行を実行
          //console.log(`🔄 [listDataKeys] IndexedDBにデータなし、localStorageにデータあり - 移行を実行: ${localStorageKeys.length}個のキー`);
          try {
            const { migrateFromLocalStorage } = await import('@/utils/migration');
            const migrationResult = await migrateFromLocalStorage();
            if (migrationResult.success) {
              setMigrationCompleted(true);
              // 移行後、再度IndexedDBからキー一覧を取得
              const migratedKeys = await voiScripterDB.getAllKeys();
              //console.log(`✅ [listDataKeys] 移行後、IndexedDBから取得: ${migratedKeys.length}個のキー`);
              return migratedKeys;
            } else {
              console.error('移行に失敗しました:', migrationResult.error);
              // 移行失敗時はlocalStorageから返す
              return localStorageKeys;
            }
          } catch (error) {
            console.error('移行エラー:', error);
            // 移行エラー時はlocalStorageから返す
            return localStorageKeys;
          }
        }
        
        // IndexedDBにもlocalStorageにもデータがない場合
        //console.log('📦 [listDataKeys] IndexedDBにもlocalStorageにもデータなし');
        return [];
      } catch (error) {
        console.error('Data list keys error:', error);
        // エラー時はlocalStorageにフォールバック
        try {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('voiscripter_'));
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
  }, [saveDirectory, isIndexedDBReady]);

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
          setIsInitialized(true);
          return;
        }

        // 3. IndexedDBが利用可能かチェック
        if (!window.indexedDB) {
      //console.log('⚠️ IndexedDBが利用できません。localStorageを継続使用します');
          setIsInitialized(true);
          return;
        }

        // 4. IndexedDBを初期化（データの存在確認はloadDataやlistDataKeysで行う）
        try {
          await voiScripterDB.open();
          setIsIndexedDBReady(true);
      //console.log('✅ IndexedDBの初期化完了（移行は必要時に自動実行されます）');
        } catch (error) {
          console.error('❌ IndexedDBの初期化エラー:', error);
          setIsInitialized(true);
          return;
        }

        // 初期化完了をマーク
        setIsInitialized(true);
    //console.log('✅ データ管理の初期化完了');

      } catch (error) {
        console.error('❌ データ管理の初期化エラー:', error);
        // エラーが発生しても初期化完了をマーク（フォールバック動作のため）
        setIsInitialized(true);
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
    setSaveDirectory,
    isInitialized
  };
};
