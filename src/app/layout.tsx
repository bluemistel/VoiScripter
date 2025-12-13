'use client';

import './globals.css';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

export default function RootLayout({
  children,
}: {
  children: ReactNode
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

      // ウィンドウフォーカスイベントの処理
      window.electronAPI.onWindowFocused(() => {
        // ウィンドウがフォーカスされた時にアクティブなtextareaにフォーカスを復元
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'TEXTAREA') {
          setTimeout(() => {
            (activeElement as HTMLTextAreaElement).focus();
            // さらに確実にするため、もう一度フォーカス
            setTimeout(() => {
              (activeElement as HTMLTextAreaElement).focus();
            }, 50);
          }, 10);
        }
        
        // フォーカス可能な要素をすべて復元
        setTimeout(() => {
          const textareas = document.querySelectorAll('textarea');
          textareas.forEach(textarea => {
            if (textarea === document.activeElement) {
              (textarea as HTMLTextAreaElement).focus();
            }
          });
        }, 100);
      });

      window.electronAPI.onWindowBlurred(() => {
        // ウィンドウがフォーカスを失った時の処理（必要に応じて）
      });

      // クリーンアップ
      return () => {
        window.electronAPI?.removeAllListeners('new-project');
        window.electronAPI?.removeAllListeners('open-project');
        window.electronAPI?.removeAllListeners('save-project');
        window.electronAPI?.removeAllListeners('show-about');
        window.electronAPI?.removeAllListeners('window-focused');
        window.electronAPI?.removeAllListeners('window-blurred');
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
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' http://localhost:* https://localhost:*; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self';" />
        <link rel="icon" href="./favicon.ico" />
        <link rel="apple-touch-icon" href="./apple-icon.png" />
        <link rel="manifest" href="./manifest.json" />
      </head>
      <body className="font-mplus">{children}</body>
    </html>
  )
}
