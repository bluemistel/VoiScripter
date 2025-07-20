declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      getAppName: () => Promise<string>;
      onNewProject: (callback: () => void) => void;
      onOpenProject: (callback: () => void) => void;
      onSaveProject: (callback: () => void) => void;
      onShowAbout: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
    nodeAPI: {
      // Node.js APIの型定義
    };
  }
}

export {}; 