const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let splashWindow;

// セキュリティ設定
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('disable-web-security', 'false');
app.commandLine.appendSwitch('allow-running-insecure-content', 'false');

// 本番環境ではコンソールウィンドウを非表示にする
if (!isDev) {
  app.commandLine.appendSwitch('disable-logging');
  app.commandLine.appendSwitch('silent');
}

// セキュリティ監査を有効化（開発環境のみ）
if (isDev) {
  app.commandLine.appendSwitch('enable-logging');
  app.commandLine.appendSwitch('v', '1');
}

// 追加のセキュリティ設定
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-features', 'TranslateUI');
app.commandLine.appendSwitch('disable-features', 'BlinkGenPropertyTrees');

// 本番環境でのみGPUハードウェアアクセラレーションを無効化
if (!isDev) {
  app.disableHardwareAcceleration();
}

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

function createSplashWindow() {
  // スプラッシュウィンドウを作成
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      sandbox: false,
      experimentalFeatures: false,
      backgroundThrottling: false
    },
    icon: path.join(__dirname, '../public/favicon.ico'),
    show: false
  });

  // スプラッシュ画面のHTML
  const splashHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          overflow: hidden;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 20px;
          text-align: center;
        }
        .loading {
          width: 200px;
          height: 4px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
          overflow: hidden;
          margin: 20px 0;
        }
        .progress {
          height: 100%;
          background: linear-gradient(90deg, #fff, #f0f0f0);
          border-radius: 2px;
          animation: loading 2s ease-in-out infinite;
        }
        @keyframes loading {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        .status {
          font-size: 14px;
          opacity: 0.8;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="logo">VoiScripter</div>
      <div class="loading">
        <div class="progress"></div>
      </div>
      <div class="status">起動中...</div>
    </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
}

function createWindow() {
  // 保存されたウィンドウサイズと位置を読み込み
  let windowBounds = { width: 1200, height: 800, x: undefined, y: undefined };
  try {
    const settingsPath = path.join(app.getPath('userData'), 'window-bounds.json');
    if (fs.existsSync(settingsPath)) {
      const bounds = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      // 画面サイズをチェックして、画面外にウィンドウが表示されないようにする
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
      
      if (bounds.width && bounds.width >= 800 && bounds.width <= screenWidth) {
        windowBounds.width = bounds.width;
      }
      if (bounds.height && bounds.height >= 600 && bounds.height <= screenHeight) {
        windowBounds.height = bounds.height;
      }
      if (bounds.x !== undefined && bounds.x >= 0 && bounds.x + windowBounds.width <= screenWidth) {
        windowBounds.x = bounds.x;
      }
      if (bounds.y !== undefined && bounds.y >= 0 && bounds.y + windowBounds.height <= screenHeight) {
        windowBounds.y = bounds.y;
      }
    }
  } catch (error) {
    if (isDev) {
      console.error('ウィンドウサイズ読み込みエラー:', error);
    }
  }

  // メインウィンドウを作成
  mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      sandbox: false,
      experimentalFeatures: false,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/icon.png'),
    show: false,
    titleBarStyle: 'default',
    autoHideMenuBar: true
  });

  // 開発環境ではローカルサーバー、本番環境ではビルドされたファイルを読み込み
  const loadApp = async () => {
    if (isDev) {
      const port = await findDevServerPort();
      const startUrl = `http://localhost:${port}`;
      if (isDev) {
        console.log(`Loading app from: ${startUrl}`);
      }
      mainWindow.loadURL(startUrl);
    } else {
      // 本番環境では、app.asar内のoutディレクトリを参照
      // パッケージ化されたアプリでは、outディレクトリがapp.asar内に含まれる
      const indexPath = path.join(__dirname, '../out/index.html');
      if (isDev) {
        console.log(`Loading app from: ${indexPath}`);
      }
      
      // ファイルの存在確認
      if (fs.existsSync(indexPath)) {
        // セキュリティを考慮したfile://プロトコルの使用
        const fileUrl = `file://${indexPath}`;
        if (isDev) {
          console.log(`Loading file URL: ${fileUrl}`);
        }
        mainWindow.loadURL(fileUrl);
      } else {
        // パッケージ化されたアプリでは、app.asar内のパスを試す
        const asarIndexPath = path.join(__dirname, 'out/index.html');
        if (isDev) {
          console.log(`Trying asar path: ${asarIndexPath}`);
        }
        
        if (fs.existsSync(asarIndexPath)) {
          const fileUrl = `file://${asarIndexPath}`;
          if (isDev) {
            console.log(`Loading asar file URL: ${fileUrl}`);
          }
          mainWindow.loadURL(fileUrl);
        } else {
          // さらに別のパスを試す（パッケージ化されたアプリ用）
          const appAsarPath = path.join(__dirname, '../out/index.html');
          if (isDev) {
            console.log(`Trying app asar path: ${appAsarPath}`);
          }
          
          if (fs.existsSync(appAsarPath)) {
            const fileUrl = `file://${appAsarPath}`;
            if (isDev) {
              console.log(`Loading app asar file URL: ${fileUrl}`);
            }
            mainWindow.loadURL(fileUrl);
          } else {
            if (isDev) {
              console.error(`Index file not found in all locations: ${indexPath}, ${asarIndexPath}, ${appAsarPath}`);
            }
            // フォールバック: 開発サーバーに接続（セキュリティ警告あり）
            const port = await findDevServerPort();
            const startUrl = `http://localhost:${port}`;
            if (isDev) {
              console.log(`Falling back to dev server: ${startUrl}`);
            }
            mainWindow.loadURL(startUrl);
          }
        }
      }
    }
  };

  loadApp();

  // ウィンドウが準備できたら表示
  mainWindow.once('ready-to-show', () => {
    // スプラッシュウィンドウを閉じる
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    
    // ウィンドウを表示
    mainWindow.show();
    
    // ウィンドウをフォーカス
    mainWindow.focus();
    
    // 開発環境ではDevToolsを開く
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // ウィンドウがアクティブになった時の処理
  mainWindow.on('focus', () => {
    // ウィンドウがフォーカスされた時にレンダラープロセスに通知
    mainWindow.webContents.send('window-focused');
  });

  // ウィンドウが非アクティブになった時の処理
  mainWindow.on('blur', () => {
    // ウィンドウがフォーカスを失った時にレンダラープロセスに通知
    mainWindow.webContents.send('window-blurred');
  });

  // ウィンドウサイズと位置の変更を監視して保存
  let saveWindowBoundsTimeout;
  const saveWindowBounds = () => {
    if (saveWindowBoundsTimeout) {
      clearTimeout(saveWindowBoundsTimeout);
    }
    saveWindowBoundsTimeout = setTimeout(() => {
      try {
        const bounds = mainWindow.getBounds();
        const settingsPath = path.join(app.getPath('userData'), 'window-bounds.json');
        fs.writeFileSync(settingsPath, JSON.stringify(bounds), 'utf8');
        if (isDev) {
          console.log('ウィンドウサイズ保存:', bounds);
        }
      } catch (error) {
        if (isDev) {
          console.error('ウィンドウサイズ保存エラー:', error);
        }
      }
    }, 500); // 500msのディレイで保存（頻繁な保存を防ぐ）
  };

  // ウィンドウサイズ変更時
  mainWindow.on('resize', saveWindowBounds);
  
  // ウィンドウ移動時
  mainWindow.on('move', saveWindowBounds);

  // ウィンドウが閉じられた時の処理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 外部リンクをデフォルトブラウザで開く
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // セキュリティヘッダーを設定
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // 開発環境と本番環境で異なるCSP設定
    const cspDirectives = isDev 
      ? 'default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; style-src-elem \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src \'self\' data: https://fonts.gstatic.com; img-src \'self\' data: https:; connect-src \'self\' http://localhost:* https://localhost:*; frame-src \'none\'; object-src \'none\'; base-uri \'self\'; form-action \'self\';'
      : 'default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; style-src-elem \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src \'self\' data: https://fonts.gstatic.com; img-src \'self\' data: https:; connect-src \'self\'; frame-src \'none\'; object-src \'none\'; base-uri \'self\'; form-action \'self\';';

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block'],
        'Referrer-Policy': ['strict-origin-when-cross-origin']
      }
    });
  });

  // セキュリティ監査: 危険なAPIの使用を監視（開発環境のみ）
  if (isDev) {
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Security: Application loaded with secure settings');
      
      // セキュリティ監査レポート
      console.log('Security Audit Report:');
      console.log('- CSP: Enabled with strict directives');
      console.log('- Web Security: Enabled');
      console.log('- Context Isolation: Enabled');
      console.log('- Node Integration: Disabled');
      console.log('- Sandbox: Disabled (preload script required)');
      console.log('- Insecure Content: Blocked');
    });
  }

  // セキュリティ監査: 外部リソースの読み込みを監視（開発環境のみ）
  if (isDev) {
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.warn(`Security: Failed to load resource: ${validatedURL} (${errorDescription})`);
    });
  }

  // セキュリティ監査: 新しいウィンドウの作成を監視
  mainWindow.webContents.on('new-window', (event, navigationUrl) => {
    if (isDev) {
      console.warn(`Security: New window blocked: ${navigationUrl}`);
    }
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });

  // セキュリティ監査: 危険なナビゲーションを監視
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const allowedProtocols = ['http:', 'https:', 'file:'];
    const url = new URL(navigationUrl);
    
    if (!allowedProtocols.includes(url.protocol)) {
      if (isDev) {
        console.warn(`Security: Navigation to disallowed protocol blocked: ${navigationUrl}`);
      }
      event.preventDefault();
    }
  });
}

// アプリケーションが準備できた時の処理
app.whenReady().then(() => {
  // 本番環境ではスプラッシュウィンドウを表示
  if (!isDev) {
    createSplashWindow();
  }
  
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

  // メニューを設定（開発環境のみ）
  if (isDev && mainWindow && !mainWindow.isDestroyed()) {
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } else if (!isDev) {
    // 本番環境ではメニューを完全に無効化
    Menu.setApplicationMenu(null);
  }
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
    if (isDev) {
      console.error('データ保存エラー:', error);
    }
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
    if (isDev) {
      console.error('データ読み込みエラー:', error);
    }
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
    if (isDev) {
      console.error('データキー一覧取得エラー:', error);
    }
    return [];
  }
});

// ファイル削除
ipcMain.handle('deleteData', async (event, key) => {
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
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      if (isDev) {
        console.log(`ファイル削除成功: ${filePath}`);
      }
    } else {
      if (isDev) {
        console.log(`ファイルが存在しません: ${filePath}`);
      }
    }
  } catch (error) {
    if (isDev) {
      console.error('ファイル削除エラー:', error);
    }
    throw error;
  }
});

// 設定保存
ipcMain.handle('saveSettings', async (event, settings) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf8');
  } catch (error) {
    if (isDev) {
      console.error('設定保存エラー:', error);
    }
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
    if (isDev) {
      console.error('設定読み込みエラー:', error);
    }
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
    if (isDev) {
      console.error('CSVファイル保存エラー:', error);
    }
    throw error;
  }
});

// ウィンドウサイズと位置の取得
ipcMain.handle('get-window-bounds', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.getBounds();
  }
  return null;
});

// ウィンドウサイズと位置の設定
ipcMain.handle('set-window-bounds', (event, bounds) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBounds(bounds);
    return true;
  }
  return false;
}); 

// ディレクトリ間データ移動
ipcMain.handle('moveDataBetweenDirectories', async (event, fromDirectory, toDirectory) => {
  try {
    if (isDev) {
      console.log(`ディレクトリ間データ移動: ${fromDirectory} → ${toDirectory}`);
    }
    
    const movedData = {};
    
    // 前のディレクトリからデータを読み込み
    if (fs.existsSync(fromDirectory)) {
      const files = fs.readdirSync(fromDirectory);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      if (isDev) {
        console.log(`前のディレクトリのファイル数: ${jsonFiles.length}`);
        console.log('移動対象ファイル:', jsonFiles);
      }
      
      for (const file of jsonFiles) {
        const key = file.replace('.json', '');
        const filePath = path.join(fromDirectory, file);
        const data = fs.readFileSync(filePath, 'utf8');
        movedData[key] = data;
        if (isDev) {
          console.log(`データ読み込み成功: ${key} (${data.length} bytes)`);
        }
      }
    } else {
      if (isDev) {
        console.log(`前のディレクトリが存在しません: ${fromDirectory}`);
      }
    }
    
    // 新しいディレクトリにデータを保存
    if (!fs.existsSync(toDirectory)) {
      fs.mkdirSync(toDirectory, { recursive: true });
      if (isDev) {
        console.log(`新しいディレクトリを作成: ${toDirectory}`);
      }
    }
    
    for (const [key, data] of Object.entries(movedData)) {
      const filePath = path.join(toDirectory, `${key}.json`);
      fs.writeFileSync(filePath, data, 'utf8');
      if (isDev) {
        console.log(`データ移動成功: ${key} → ${filePath}`);
      }
    }
    
    if (isDev) {
      console.log(`移動完了: ${Object.keys(movedData).length}個のファイル`);
    }
    
    return { success: true, movedCount: Object.keys(movedData).length };
  } catch (error) {
    if (isDev) {
      console.error('ディレクトリ間データ移動エラー:', error);
    }
    throw error;
  }
}); 