
export type Emotion = 'normal';

export interface Character {
  id: string;
  name: string;
  group: string; // グループ設定を追加
  emotions: {
    [key in Emotion]: {
      iconUrl: string;
    };
  };
}

export interface ScriptBlock {
  id: string;
  characterId: string;
  emotion: Emotion;
  text: string;
}

export interface Script {
  id: string;
  title: string;
  blocks: ScriptBlock[];
  characters: Character[];
}

// Electron API型定義
declare global {
  interface Window {
    electronAPI?: {
      // アプリケーション情報の取得
      getAppVersion: () => Promise<string>;
      getAppName: () => Promise<string>;
      
      // ファイルシステム操作
      selectDirectory: () => Promise<string | null>;
      saveData: (key: string, data: string) => Promise<void>;
      loadData: (key: string) => Promise<string | null>;
      listDataKeys: () => Promise<string[]>;
      
      // 設定操作
      saveSettings: (settings: any) => Promise<void>;
      loadSettings: () => Promise<{ saveDirectory: string }>;
      
      // デフォルトプロジェクト初期化
      initializeDefaultProject: () => Promise<void>;
      
      // メニューイベントの受信
      onNewProject: (callback: () => void) => void;
      onOpenProject: (callback: () => void) => void;
      onSaveProject: (callback: () => void) => void;
      onShowAbout: (callback: () => void) => void;
      
      // イベントリスナーの削除
      removeAllListeners: (channel: string) => void;
    };
  }
} 