const { contextBridge, ipcRenderer } = require('electron');

// レンダラープロセスで使用できるAPIを公開
contextBridge.exposeInMainWorld('electronAPI', {
  // アプリケーション情報の取得
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppName: () => ipcRenderer.invoke('get-app-name'),
  
  // ファイルシステム操作
  selectDirectory: () => ipcRenderer.invoke('selectDirectory'),
  saveData: (key, data) => ipcRenderer.invoke('saveData', key, data),
  loadData: (key) => ipcRenderer.invoke('loadData', key),
  listDataKeys: () => ipcRenderer.invoke('listDataKeys'),
  
  // 設定操作
  saveSettings: (settings) => ipcRenderer.invoke('saveSettings', settings),
  loadSettings: () => ipcRenderer.invoke('loadSettings'),
  
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