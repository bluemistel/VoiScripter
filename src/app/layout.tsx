'use client';

import './globals.css';
import { useEffect } from 'react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    // Electron APIが利用可能な場合の初期化
    if (typeof window !== 'undefined' && window.electronAPI) {
      // メニューイベントの設定
      window.electronAPI.onNewProject(() => {
        console.log('新規プロジェクトが要求されました');
        // ここで新規プロジェクトの処理を実装
      });

      window.electronAPI.onOpenProject(() => {
        console.log('プロジェクトを開くが要求されました');
        // ここでプロジェクトを開く処理を実装
      });

      window.electronAPI.onSaveProject(() => {
        console.log('プロジェクトの保存が要求されました');
        // ここでプロジェクトの保存処理を実装
      });

      window.electronAPI.onShowAbout(() => {
        console.log('アプリケーションについてが要求されました');
        // ここでアバウトダイアログを表示
      });

      // クリーンアップ
      return () => {
        window.electronAPI?.removeAllListeners('new-project');
        window.electronAPI?.removeAllListeners('open-project');
        window.electronAPI?.removeAllListeners('save-project');
        window.electronAPI?.removeAllListeners('show-about');
      };
    }
  }, []);

  // useEffectでbodyのclassListをlocalStorageのfontFamily値で上書きする
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const fontFamily = localStorage.getItem('fontFamily') || 'mplus';
      document.body.classList.remove('font-mplus', 'font-noto', 'font-sawarabi');
      document.body.classList.add(`font-${fontFamily}`);
    }
  }, []);

  return (
    <html lang="ja">
      <head>
        <title>VoiScripter</title>
        <meta name="description" content="VoiScripter - 音声合成用台本作成ツール" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-mplus">{children}</body>
    </html>
  )
}
