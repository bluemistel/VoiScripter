const { contextBridge, ipcRenderer } = require('electron');

// レンダラープロセスで使用できるAPIを公開
contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('selectDirectory'),
  saveData: (key, data) => ipcRenderer.invoke('saveData', key, data),
  loadData: (key) => ipcRenderer.invoke('loadData', key),
  listDataKeys: () => ipcRenderer.invoke('listDataKeys'),
  initializeDefaultProject: () => ipcRenderer.invoke('initializeDefaultProject')
}); 