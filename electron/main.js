const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let saveDirectory = '';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    // icon: path.join(__dirname, '../public/icon.svg'),
    title: 'VoiScripter'
  });

  // 開発環境ではローカルサーバーを、本番環境ではビルドされたファイルを読み込み
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC通信の設定
ipcMain.handle('selectDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'データ保存先ディレクトリを選択'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    saveDirectory = result.filePaths[0];
    return saveDirectory;
  }
  return null;
});

ipcMain.handle('saveData', async (event, key, data) => {
  if (!saveDirectory) return;
  
  try {
    const filePath = path.join(saveDirectory, `${key}.json`);
    fs.writeFileSync(filePath, data, 'utf8');
  } catch (error) {
    console.error('データ保存エラー:', error);
    throw error;
  }
});

// デフォルトプロジェクトの初期化
ipcMain.handle('initializeDefaultProject', async () => {
  if (!saveDirectory) return;
  
  try {
    const defaultProjectPath = path.join(saveDirectory, 'voiscripter_default.json');
    if (!fs.existsSync(defaultProjectPath)) {
      const defaultProject = {
        id: '1',
        title: '新しい台本',
        blocks: []
      };
      fs.writeFileSync(defaultProjectPath, JSON.stringify(defaultProject), 'utf8');
    }
  } catch (error) {
    console.error('デフォルトプロジェクト初期化エラー:', error);
  }
});

ipcMain.handle('loadData', async (event, key) => {
  if (!saveDirectory) return null;
  
  try {
    const filePath = path.join(saveDirectory, `${key}.json`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return null;
  } catch (error) {
    console.error('データ読み込みエラー:', error);
    return null;
  }
});

ipcMain.handle('listDataKeys', async () => {
  if (!saveDirectory) return [];
  
  try {
    const files = fs.readdirSync(saveDirectory);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (error) {
    console.error('データキー一覧取得エラー:', error);
    return [];
  }
}); 