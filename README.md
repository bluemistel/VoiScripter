# VoiScripter - ブラウザで動作する合成音声ソフトの台本作成支援アプリ

## 概要
VoiScripterは、合成音声ソフト系の台本作成に向いたブロックベースのテキストエディタです。*1<br>
Webアプリケーションとしても、デスクトップアプリケーションとしても動作します。<br>
*1 合成音声系台本に向いているというのは個人の主観です<br>

## 使い方・配布先
Web版
https://voiscripter.vercel.app/ にアクセス

デスクトップ版(Booth)<br>
https://bluemist.booth.pm/items/7272767

## 主な機能
- キャラクター管理機能（追加、編集、削除）
- キャラクターアイコンの表示
- ブロックベースの台本作成・編集
- ドラッグ操作によるブロック並び替え
- グループ設定での分割CSVエクスポート/インポート
- ダークモード対応
- デスクトップアプリケーション対応 (Ver.0.14.0)
- プロジェクト内サブプロジェクトの管理機能 (Ver.0.16.0)

## 技術スタック
- Next.js 14
- TypeScript (Apache-2.0)
- TailwindCSS v4
- React DnD Kit
- Electron
- @dnd-kit/core, @dnd-kit/sortable
- Heroicons
- Electron

### Webアプリケーション版の開発デバッグ
1. `npm run dev` で開発サーバーを起動
2. ブラウザで `http://localhost:3000` にアクセス

### デスクトップアプリケーション版の開発デバッグ
1. `npm run electron-dev` でElectronアプリを起動
2. または `npm run electron-build` でビルドして実行ファイルを作成

## ビルドとデプロイ
1. `npm run buid` でビルド
2. `npm run electron-pack` で実行ファイルを作成

## ライセンス
MIT License 

## 更新履歴
* 2025/07/22 テスト公開
* 2025/08/08 全体を調整
