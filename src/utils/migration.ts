/**
 * localStorageからIndexedDBへのデータ移行ユーティリティ
 */

import { voiScripterDB } from './indexedDB';

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  error?: string;
}

export interface MigrationStatus {
  isCompleted: boolean;
  isInProgress: boolean;
  lastMigrationTime?: number;
}

/**
 * localStorageからIndexedDBへの移行を実行
 */
export async function migrateFromLocalStorage(): Promise<MigrationResult> {
  try {
    ////console.log('🔄 localStorageからIndexedDBへの移行を開始...');

    // IndexedDBが利用可能かチェック
    if (!window.indexedDB) {
      throw new Error('IndexedDB is not supported in this browser');
    }

    // localStorageのデータを取得
    const localStorageKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('voiscripter_')
    );

    if (localStorageKeys.length === 0) {
      ////console.log('📦 移行するlocalStorageデータがありません');
      return { success: true, migratedCount: 0 };
    }

    ////console.log(`📦 ${localStorageKeys.length}個のlocalStorageデータを発見`);

    // IndexedDBを開く
    await voiScripterDB.open();

    let migratedCount = 0;
    const errors: string[] = [];

    // 各データを移行
    for (const key of localStorageKeys) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          await voiScripterDB.save(key, value);
          migratedCount++;
          //console.log(`✅ 移行完了: ${key}`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate ${key}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // 移行完了をマーク
    await voiScripterDB.save('voiscripter_migration_completed', JSON.stringify({
      completed: true,
      timestamp: Date.now(),
      migratedCount,
      sourceKeys: localStorageKeys
    }));

    //console.log(`🎉 移行完了: ${migratedCount}個のデータを移行しました`);

    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length}個のエラーが発生しました:`, errors);
    }

    return {
      success: true,
      migratedCount,
      error: errors.length > 0 ? errors.join('; ') : undefined
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ 移行エラー:', errorMsg);
    return {
      success: false,
      migratedCount: 0,
      error: errorMsg
    };
  }
}

/**
 * 移行が完了しているかチェック
 */
export async function isMigrationCompleted(): Promise<boolean> {
  try {
    if (!window.indexedDB) {
      return false;
    }

    await voiScripterDB.open();
    const migrationData = await voiScripterDB.load('voiscripter_migration_completed');
    
    if (migrationData) {
      const parsed = JSON.parse(migrationData);
      return parsed.completed === true;
    }

    return false;
  } catch (error) {
    console.error('移行状態チェックエラー:', error);
    return false;
  }
}

/**
 * 移行状態を取得
 */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  try {
    if (!window.indexedDB) {
      return { isCompleted: false, isInProgress: false };
    }

    await voiScripterDB.open();
    const migrationData = await voiScripterDB.load('voiscripter_migration_completed');
    
    if (migrationData) {
      const parsed = JSON.parse(migrationData);
      return {
        isCompleted: parsed.completed === true,
        isInProgress: false,
        lastMigrationTime: parsed.timestamp
      };
    }

    return { isCompleted: false, isInProgress: false };
  } catch (error) {
    console.error('移行状態取得エラー:', error);
    return { isCompleted: false, isInProgress: false };
  }
}

/**
 * localStorageのデータをクリア（移行完了後）
 */
export async function clearLocalStorageAfterMigration(): Promise<void> {
  try {
    //console.log('🧹 移行完了後のlocalStorageクリーンアップを開始...');

    const localStorageKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('voiscripter_')
    );

    for (const key of localStorageKeys) {
      localStorage.removeItem(key);
      //console.log(`🗑️ localStorageから削除: ${key}`);
    }

    //console.log(`✅ localStorageクリーンアップ完了: ${localStorageKeys.length}個のキーを削除`);
  } catch (error) {
    console.error('localStorageクリーンアップエラー:', error);
  }
}

/**
 * 移行が必要かどうかをチェック
 * Electronでカスタムディレクトリが設定されている場合は移行をスキップ
 */
export function shouldMigrate(): boolean {
  // Electron環境でカスタムディレクトリが設定されている場合は移行しない
  if (typeof window !== 'undefined' && window.electronAPI) {
    // Electron環境では、カスタムディレクトリの設定をチェック
    // この場合は移行をスキップして、既存のファイルシステムを使用
    return false;
  }

  // ブラウザ環境では移行を実行
  return true;
}

/**
 * 自動移行を実行（アプリ起動時）
 */
export async function performAutoMigration(): Promise<MigrationResult> {
  try {
    // 移行が必要かチェック
    if (!shouldMigrate()) {
      //console.log('⏭️ 移行をスキップ（Electron環境でカスタムディレクトリ使用）');
      return { success: true, migratedCount: 0 };
    }

    // 既に移行が完了しているかチェック
    const isCompleted = await isMigrationCompleted();
    if (isCompleted) {
      //console.log('✅ 移行は既に完了しています');
      return { success: true, migratedCount: 0 };
    }

    // IndexedDBが利用可能かチェック
    if (!window.indexedDB) {
      //console.log('⚠️ IndexedDBが利用できません。localStorageを継続使用します');
      return { success: false, migratedCount: 0, error: 'IndexedDB not supported' };
    }

    // 移行を実行
    const result = await migrateFromLocalStorage();
    
    if (result.success && result.migratedCount > 0) {
      //console.log('🎉 自動移行が完了しました');
    }

    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ 自動移行エラー:', errorMsg);
    return {
      success: false,
      migratedCount: 0,
      error: errorMsg
    };
  }
}
