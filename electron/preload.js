const { contextBridge, ipcRenderer } = require('electron');

// レンダラープロセスで使用できるAPIを公開
contextBridge.exposeInMainWorld('electronAPI', {
  // アプリケーション情報の取得
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppName: () => ipcRenderer.invoke('get-app-name'),
  
  // メニューイベントの受信
  onNewProject: (callback) => ipcRenderer.on('new-project', callback),
  onOpenProject: (callback) => ipcRenderer.on('open-project', callback),
  onSaveProject: (callback) => ipcRenderer.on('save-project', callback),
  onShowAbout: (callback) => ipcRenderer.on('show-about', callback),
  
  // イベントリスナーの削除
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// セキュリティのため、Node.jsのAPIは直接公開しない
contextBridge.exposeInMainWorld('nodeAPI', {
  // 必要に応じてNode.jsのAPIを安全に公開
}); 