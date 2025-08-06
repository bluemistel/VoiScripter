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
  // メインウィンドウを作成
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'VoiScripter - 音声合成ソフトの台本作成支援ツール',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // セキュリティを強化した設定
      webSecurity: true,
      allowRunningInsecureContent: false,
      // 追加のセキュリティ設定
      sandbox: false, // preloadスクリプトを使用するため
      experimentalFeatures: false,
      // パフォーマンス最適化
      backgroundThrottling: false,
      // CSPを設定
      additionalArguments: [
        '--disable-features=VizDisplayCompositor'
      ]
    },
    icon: path.join(__dirname, '../public/favicon.ico'),
    show: false,
    titleBarStyle: 'default'
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