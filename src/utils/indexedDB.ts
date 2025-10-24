/**
 * IndexedDBのラッパークラス
 * VoiScripterアプリケーション用のデータベース操作を提供
 */

export interface DatabaseItem {
  key: string;
  value: string;
  timestamp: number;
}

export class VoiScripterDB {
  private dbName = 'VoiScripterDB';
  private version = 1;
  private storeName = 'projects';
  private db: IDBDatabase | null = null;

  /**
   * データベースを開く
   */
  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        //console.log('IndexedDB opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // オブジェクトストアが存在しない場合は作成
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          //console.log('Created object store:', this.storeName);
        }
      };
    });
  }

  /**
   * データベースを閉じる
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * データを保存
   */
  async save(key: string, value: string): Promise<void> {
    if (!this.db) {
      await this.open();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const item: DatabaseItem = {
        key,
        value,
        timestamp: Date.now()
      };

      const request = store.put(item);

      request.onsuccess = () => {
        //console.log(`Saved to IndexedDB: ${key}`);
        resolve();
      };

      request.onerror = () => {
        console.error('IndexedDB save error:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * データを読み込み
   */
  async load(key: string): Promise<string | null> {
    if (!this.db) {
      await this.open();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          //console.log(`Loaded from IndexedDB: ${key}`);
          resolve(result.value);
        } else {
          //console.log(`No data found in IndexedDB: ${key}`);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('IndexedDB load error:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * データを削除
   */
  async delete(key: string): Promise<void> {
    if (!this.db) {
      await this.open();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        //console.log(`Deleted from IndexedDB: ${key}`);
        resolve();
      };

      request.onerror = () => {
        console.error('IndexedDB delete error:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 全てのキーを取得
   */
  async getAllKeys(): Promise<string[]> {
    if (!this.db) {
      await this.open();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const keys = request.result as string[];
        //console.log(`Retrieved ${keys.length} keys from IndexedDB`);
        resolve(keys);
      };

      request.onerror = () => {
        console.error('IndexedDB getAllKeys error:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 全てのデータを取得
   */
  async getAllData(): Promise<DatabaseItem[]> {
    if (!this.db) {
      await this.open();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const data = request.result as DatabaseItem[];
        //console.log(`Retrieved ${data.length} items from IndexedDB`);
        resolve(data);
      };

      request.onerror = () => {
        console.error('IndexedDB getAllData error:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * データベースをクリア
   */
  async clear(): Promise<void> {
    if (!this.db) {
      await this.open();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not opened'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        //console.log('IndexedDB cleared');
        resolve();
      };

      request.onerror = () => {
        console.error('IndexedDB clear error:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * データベースの存在確認
   */
  async exists(): Promise<boolean> {
    try {
      const request = indexedDB.open(this.dbName);
      return new Promise((resolve) => {
        request.onsuccess = () => {
          request.result.close();
          resolve(true);
        };
        request.onerror = () => {
          resolve(false);
        };
      });
    } catch {
      return false;
    }
  }
}

// シングルトンインスタンス
export const voiScripterDB = new VoiScripterDB();
