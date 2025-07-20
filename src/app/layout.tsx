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

  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
