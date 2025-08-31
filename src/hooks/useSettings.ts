import { useState, useEffect } from 'react';
import { DataManagementHook } from './useDataManagement';

export interface SettingsHook {
  saveDirectory: string;
  setSaveDirectory: (directory: string) => void;
  handleSaveDirectoryChange: (directory: string) => Promise<void>;
  moveDataBetweenStorage: (fromStorage: 'localStorage' | 'file', toStorage: 'localStorage' | 'file') => Promise<void>;
}

export const useSettings = (dataManagement: DataManagementHook): SettingsHook => {
  const [saveDirectory, setSaveDirectory] = useState<string>('');

  // データ保存先変更
  const handleSaveDirectoryChange = async (directory: string) => {
    const previousDirectory = saveDirectory;
    setSaveDirectory(directory);
    
    // 設定を保存
    if (window.electronAPI) {
      try {
        await window.electronAPI.saveSettings({ saveDirectory: directory });
      } catch (error) {
        console.error('設定保存エラー:', error);
      }
    } else {
      localStorage.setItem('voiscripter_saveDirectory', directory);
    }
    
    // 保存先が変更された場合、既存データを移動
    if (directory !== '' && previousDirectory === '') {
      // localStorageからファイルに移動
      await moveDataBetweenStorage('localStorage', 'file');
    } else if (directory === '' && previousDirectory !== '') {
      // ファイルからlocalStorageに移動
      await moveDataBetweenStorage('file', 'localStorage');
    }
  };

  // データの移動処理（localStorage ↔ ファイル）
  const moveDataBetweenStorage = async (
    fromStorage: 'localStorage' | 'file',
    toStorage: 'localStorage' | 'file'
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
        
        console.log(`${keys.length}個のデータをlocalStorageからファイルに移動しました`);
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
        
        console.log(`${keys.length}個のデータをファイルからlocalStorageに移動しました`);
      }
    } catch (error) {
      console.error('データ移動処理エラー:', error);
      throw new Error('データの移動に失敗しました');
    }
  };

  return {
    saveDirectory,
    setSaveDirectory,
    handleSaveDirectoryChange,
    moveDataBetweenStorage
  };
};
