/**
 * IndexedDB移行のデモンストレーション用ユーティリティ
 * 開発・テスト時に使用
 */

import { voiScripterDB } from './indexedDB';
import { migrateFromLocalStorage, getMigrationStatus } from './migration';

export class MigrationDemo {
  /**
   * 移行のデモンストレーションを実行
   */
  static async runDemo(): Promise<void> {
    //console.log('🎬 IndexedDB移行デモを開始...');

    try {
      // 1. 現在の移行状態を確認
      const status = await getMigrationStatus();
      //console.log('📊 現在の移行状態:', status);

      // 2. localStorageのデータを確認
      const localStorageKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('voiscripter_')
      );
      //console.log(`📦 localStorageのデータ: ${localStorageKeys.length}個のキー`);
      localStorageKeys.forEach(key => {
        const value = localStorage.getItem(key);
        const size = value ? new Blob([value]).size : 0;
        //console.log(`  - ${key}: ${size} bytes`);
      });

      // 3. IndexedDBのデータを確認
      try {
        await voiScripterDB.open();
        const indexedDBKeys = await voiScripterDB.getAllKeys();
        //console.log(`🗄️ IndexedDBのデータ: ${indexedDBKeys.length}個のキー`);
        indexedDBKeys.forEach(key => {
          //console.log(`  - ${key}`);
        });
      } catch (error) {
        //console.log('🗄️ IndexedDBのデータ: アクセスできません');
      }

      // 4. 移行を実行（必要に応じて）
      if (!status.isCompleted && localStorageKeys.length > 0) {
        //console.log('🔄 移行を実行...');
        const result = await migrateFromLocalStorage();
        //console.log('📊 移行結果:', result);
      } else {
        //console.log('⏭️ 移行は既に完了しているか、移行するデータがありません');
      }

      //console.log('✅ デモ完了');

    } catch (error) {
      console.error('❌ デモ実行エラー:', error);
    }
  }

  /**
   * テスト用のlocalStorageデータを作成
   */
  static createTestData(): void {
    //console.log('🧪 テストデータを作成...');

    const testData = {
      'voiscripter_project_test': JSON.stringify({
        id: 'test',
        name: 'テストプロジェクト',
        scenes: [{
          id: 'scene1',
          name: 'テストシーン',
          scripts: [{
            id: 'script1',
            title: 'テストスクリプト',
            blocks: [{
              id: 'block1',
              characterId: 'char1',
              emotion: 'normal',
              text: 'テストテキスト'
            }],
            characters: []
          }]
        }]
      }),
      'voiscripter_project_test_lastScene': 'scene1',
      'voiscripter_project_test_characters': JSON.stringify([]),
      'voiscripter_lastProject': 'test'
    };

    Object.entries(testData).forEach(([key, value]) => {
      localStorage.setItem(key, value);
      //console.log(`✅ テストデータを作成: ${key}`);
    });

    //console.log('🎉 テストデータの作成完了');
  }

  /**
   * テストデータをクリア
   */
  static clearTestData(): void {
    //console.log('🧹 テストデータをクリア...');

    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('voiscripter_')
    );

    keys.forEach(key => {
      localStorage.removeItem(key);
      //console.log(`🗑️ 削除: ${key}`);
    });

    //console.log('✅ テストデータのクリア完了');
  }

  /**
   * IndexedDBのデータをクリア
   */
  static async clearIndexedDBData(): Promise<void> {
    //console.log('🧹 IndexedDBのデータをクリア...');

    try {
      await voiScripterDB.open();
      await voiScripterDB.clear();
      //console.log('✅ IndexedDBのデータクリア完了');
    } catch (error) {
      console.error('❌ IndexedDBクリアエラー:', error);
    }
  }

  /**
   * データベースの状態を表示
   */
  static async showDatabaseStatus(): Promise<void> {
    //console.log('📊 データベース状態レポート');
    //console.log('=' .repeat(50));

    // localStorage
    const localStorageKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('voiscripter_')
    );
    //console.log(`📦 localStorage: ${localStorageKeys.length}個のキー`);
    localStorageKeys.forEach(key => {
      const value = localStorage.getItem(key);
      const size = value ? new Blob([value]).size : 0;
      //console.log(`  - ${key}: ${size} bytes`);
    });

    // IndexedDB
    try {
      await voiScripterDB.open();
      const indexedDBKeys = await voiScripterDB.getAllKeys();
      //console.log(`🗄️ IndexedDB: ${indexedDBKeys.length}個のキー`);
      indexedDBKeys.forEach(key => {
        //console.log(`  - ${key}`);
      });
    } catch (error) {
      //console.log('🗄️ IndexedDB: アクセスできません');
    }

    // 移行状態
    const status = await getMigrationStatus();
    //console.log('🔄 移行状態:', status);

    //console.log('=' .repeat(50));
  }
}

// 開発環境でのみグローバルに公開
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).MigrationDemo = MigrationDemo;
}
