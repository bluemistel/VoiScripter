import { useState, useEffect } from 'react';
import { DataManagementHook } from './useDataManagement';

export interface SettingsHook {
  saveDirectory: string;
  setSaveDirectory: (directory: string) => void;
  handleSaveDirectoryChange: (directory: string) => Promise<void>;
  moveDataBetweenStorage: (fromStorage: 'localStorage' | 'file', toStorage: 'localStorage' | 'file') => Promise<void>;
  enterOnlyBlockAdd: boolean;
  setEnterOnlyBlockAdd: (enabled: boolean) => void;
  handleEnterOnlyBlockAddChange: (enabled: boolean) => void;
  reverseToolbarOrder: boolean;
  setReverseToolbarOrder: (enabled: boolean) => void;
  handleReverseToolbarOrderChange: (enabled: boolean) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  handleFontSizeChange: (size: number) => void;
  simpleMode: boolean;
  setSimpleMode: (enabled: boolean) => void;
  handleSimpleModeChange: (enabled: boolean) => void;
}

export const useSettings = (dataManagement: DataManagementHook): SettingsHook => {
  // saveDirectoryはdataManagementから取得
  const { saveDirectory, setSaveDirectory } = dataManagement;
  const [enterOnlyBlockAdd, setEnterOnlyBlockAdd] = useState<boolean>(false);
  const [reverseToolbarOrder, setReverseToolbarOrder] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<number>(16);
  const [simpleMode, setSimpleMode] = useState<boolean>(false);

  // 初回マウント時に設定を読み込み
  useEffect(() => {
    const loadSettings = async () => {
      if (typeof window !== 'undefined') {
        const savedValue = await dataManagement.loadData('voiscripter_enterOnlyBlockAdd');
        if (savedValue !== null) {
          setEnterOnlyBlockAdd(savedValue === 'true');
        }
        const savedToolbarOrder = await dataManagement.loadData('voiscripter_reverseToolbarOrder');
        if (savedToolbarOrder !== null) {
          setReverseToolbarOrder(savedToolbarOrder === 'true');
        }
        const savedFontSize = await dataManagement.loadData('voiscripter_fontSize');
        if (savedFontSize !== null) {
          const parsed = parseInt(savedFontSize, 10);
          if (!isNaN(parsed)) {
            setFontSize(parsed);
            document.documentElement.style.setProperty('--editor-font-size', `${parsed}px`);
          }
        }
        const savedSimpleMode = await dataManagement.loadData('voiscripter_simpleMode');
        if (savedSimpleMode !== null) {
          setSimpleMode(savedSimpleMode === 'true');
        }
      }
    };
    loadSettings();
  }, [dataManagement]);

  // Enter入力のみでブロック追加の設定変更
  const handleEnterOnlyBlockAddChange = (enabled: boolean) => {
    setEnterOnlyBlockAdd(enabled);
    dataManagement.saveData('voiscripter_enterOnlyBlockAdd', enabled.toString());
  };

  const handleReverseToolbarOrderChange = (enabled: boolean) => {
    setReverseToolbarOrder(enabled);
    dataManagement.saveData('voiscripter_reverseToolbarOrder', enabled.toString());
  };

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
    dataManagement.saveData('voiscripter_fontSize', size.toString());
  };

  const handleSimpleModeChange = (enabled: boolean) => {
    setSimpleMode(enabled);
    dataManagement.saveData('voiscripter_simpleMode', enabled.toString());
  };

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
      dataManagement.saveData('voiscripter_saveDirectory', directory);
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
            //console.log(`データ移動成功: ${key}`);
          }
        }
        
        //console.log(`${keys.length}個のデータをlocalStorageからファイルに移動しました`);
      } else if (fromStorage === 'file' && toStorage === 'localStorage') {
        // ファイルからlocalStorageに移動
        const keys = await dataManagement.listDataKeys() || [];
        
        for (const key of keys) {
          const data = await dataManagement.loadData(key);
          if (data) {
            localStorage.setItem(key, data);
            //console.log(`データ読み込み成功: ${key}`);
          }
        }
        
        //console.log(`${keys.length}個のデータをファイルからlocalStorageに移動しました`);
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
    moveDataBetweenStorage,
    enterOnlyBlockAdd,
    setEnterOnlyBlockAdd,
    handleEnterOnlyBlockAddChange,
    reverseToolbarOrder,
    setReverseToolbarOrder,
    handleReverseToolbarOrderChange,
    fontSize,
    setFontSize,
    handleFontSizeChange,
    simpleMode,
    setSimpleMode,
    handleSimpleModeChange
  };
};
