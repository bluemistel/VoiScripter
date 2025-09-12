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
  deleteData: (key) => ipcRenderer.invoke('deleteData', key),
  moveDataBetweenDirectories: (fromDirectory, toDirectory) => ipcRenderer.invoke('moveDataBetweenDirectories', fromDirectory, toDirectory),
  
  // CSVファイル保存
  saveCSVFile: (defaultName, csvContent) => ipcRenderer.invoke('saveCSVFile', defaultName, csvContent),
  
  // 設定操作
  saveSettings: (settings) => ipcRenderer.invoke('saveSettings', settings),
  loadSettings: () => ipcRenderer.invoke('loadSettings'),
  
  // メニューイベントの受信
  onNewProject: (callback) => ipcRenderer.on('new-project', callback),
  onOpenProject: (callback) => ipcRenderer.on('open-project', callback),
  onSaveProject: (callback) => ipcRenderer.on('save-project', callback),
  onShowAbout: (callback) => ipcRenderer.on('show-about', callback),
  
  // ウィンドウフォーカスイベント
  onWindowFocused: (callback) => ipcRenderer.on('window-focused', callback),
  onWindowBlurred: (callback) => ipcRenderer.on('window-blurred', callback),
  
  // イベントリスナーの削除
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // ウィンドウサイズと位置の取得
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  
  // ウィンドウサイズと位置の設定
  setWindowBounds: (bounds) => ipcRenderer.invoke('set-window-bounds', bounds)
});

// セキュリティのため、Node.jsのAPIは直接公開しない
contextBridge.exposeInMainWorld('nodeAPI', {
  // 必要に応じてNode.jsのAPIを安全に公開
});

// ロゴパスを取得する機能
contextBridge.exposeInMainWorld('getLogoPath', () => {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    return '/rogo.png';
  } else {
    // 本番環境では相対パスを使用
    return './rogo.png';
  }
}); 