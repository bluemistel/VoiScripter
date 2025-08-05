const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

// GPUハードウェアアクセラレーションを無効化してキャッシュエラーを回避
app.disableHardwareAcceleration();

// ffmpegを有効化
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');

// 開発サーバーのポートを検出する関数
async function findDevServerPort() {
  const ports = [3000,3001];
  
  for (const port of ports) {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
          resolve(res.statusCode);
        });
        req.on('error', () => reject());
        req.setTimeout(1000, () => reject());
      });
      
      if (response === 200) {
        return port;
      }
    } catch (error) {
      // ポートが利用できない場合は次のポートを試す
      continue;
    }
  }
  
  // デフォルトポート
  return 3000;
}

function createWindow() {
  // メインウィンドウを作成
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'VoiScripter - 音声合成用台本作成ツール',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // ローカルファイルの読み込みを許可するための設定
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    icon: path.join(__dirname, '../public/icon_x512.png'),
    show: false,
    titleBarStyle: 'default'
  });

  // 開発環境ではローカルサーバー、本番環境ではビルドされたファイルを読み込み
  const loadApp = async () => {
    if (isDev) {
      const port = await findDevServerPort();
      const startUrl = `http://localhost:${port}`;
      console.log(`Loading app from: ${startUrl}`);
      mainWindow.loadURL(startUrl);
    } else {
      // 本番環境では、app.asar内のoutディレクトリを参照
      const indexPath = path.join(__dirname, '../out/index.html');
      console.log(`Loading app from: ${indexPath}`);
      
      // ファイルの存在確認
      if (fs.existsSync(indexPath)) {
        // file://プロトコルを使用して相対パスでの読み込みを確実にする
        const fileUrl = `file://${indexPath}`;
        console.log(`Loading file URL: ${fileUrl}`);
        mainWindow.loadURL(fileUrl);
      } else {
        console.error(`Index file not found: ${indexPath}`);
        // フォールバック: 開発サーバーに接続
        const port = await findDevServerPort();
        const startUrl = `http://localhost:${port}`;
        console.log(`Falling back to dev server: ${startUrl}`);
        mainWindow.loadURL(startUrl);
      }
    }
  };

  loadApp();

  // ウィンドウが準備できたら表示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // 開発環境ではDevToolsを開く
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // ウィンドウが閉じられた時の処理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 外部リンクをデフォルトブラウザで開く
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// アプリケーションが準備できた時の処理
app.whenReady().then(() => {
  createWindow();

  // macOS用の処理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // メニューの設定
  const template = [
    {
      label: 'ファイル',
      submenu: [
        {
          label: '新規プロジェクト',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('new-project');
          }
        },
        {
          label: 'プロジェクトを開く',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('open-project');
          }
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('save-project');
          }
        },
        { type: 'separator' },
        {
          label: '終了',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '編集',
      submenu: [
        { role: 'undo', label: '元に戻す' },
        { role: 'redo', label: 'やり直し' },
        { type: 'separator' },
        { role: 'cut', label: '切り取り' },
        { role: 'copy', label: 'コピー' },
        { role: 'paste', label: '貼り付け' },
        { role: 'selectall', label: 'すべて選択' }
      ]
    },
    {
      label: '表示',
      submenu: [
        { role: 'reload', label: '再読み込み' },
        { role: 'forceReload', label: '強制再読み込み' },
        { role: 'toggleDevTools', label: '開発者ツール' },
        { type: 'separator' },
        { role: 'resetZoom', label: '実際のサイズ' },
        { role: 'zoomIn', label: '拡大' },
        { role: 'zoomOut', label: '縮小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全画面表示' }
      ]
    },
    {
      label: 'ウィンドウ',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '閉じる' }
      ]
    },
    {
      label: 'ヘルプ',
      submenu: [
        {
          label: 'VoiScripterについて',
          click: () => {
            mainWindow.webContents.send('show-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

// すべてのウィンドウが閉じられた時の処理
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// セキュリティ設定
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// IPC通信の設定
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-name', () => {
  return app.getName();
});

// ファイルシステム操作
ipcMain.handle('selectDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'データ保存先ディレクトリを選択'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('saveData', async (event, key, data) => {
  try {
    // 保存先ディレクトリを取得（設定から）
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let saveDirectory = '';
    
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      saveDirectory = settings.saveDirectory || '';
    }
    
    if (!saveDirectory) {
      throw new Error('保存先ディレクトリが設定されていません');
    }
    
    const filePath = path.join(saveDirectory, `${key}.json`);
    fs.writeFileSync(filePath, data, 'utf8');
  } catch (error) {
    console.error('データ保存エラー:', error);
    throw error;
  }
});

ipcMain.handle('loadData', async (event, key) => {
  try {
    // 保存先ディレクトリを取得（設定から）
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let saveDirectory = '';
    
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      saveDirectory = settings.saveDirectory || '';
    }
    
    if (!saveDirectory) {
      return null;
    }
    
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
  try {
    // 保存先ディレクトリを取得（設定から）
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let saveDirectory = '';
    
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      saveDirectory = settings.saveDirectory || '';
    }
    
    if (!saveDirectory) {
      return [];
    }
    
    const files = fs.readdirSync(saveDirectory);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (error) {
    console.error('データキー一覧取得エラー:', error);
    return [];
  }
});

// 設定保存
ipcMain.handle('saveSettings', async (event, settings) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf8');
  } catch (error) {
    console.error('設定保存エラー:', error);
    throw error;
  }
});

// 設定読み込み
ipcMain.handle('loadSettings', async () => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    return { saveDirectory: '' };
  } catch (error) {
    console.error('設定読み込みエラー:', error);
    return { saveDirectory: '' };
  }
});

// CSVファイル保存
ipcMain.handle('saveCSVFile', async (event, defaultName, csvContent) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'CSVのエクスポート',
      defaultPath: defaultName,
      filters: [
        { name: 'CSVファイル', extensions: ['csv'] },
        { name: 'すべてのファイル', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, csvContent, 'utf8');
      return result.filePath;
    }
    return null;
  } catch (error) {
    console.error('CSVファイル保存エラー:', error);
    throw error;
  }
}); 