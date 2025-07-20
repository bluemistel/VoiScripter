# VoiScripter - デスクトップ脚本作成アプリ

## 概要
VoiScripterは、合成音声ソフトの台本に向いたシンプルなエディタです。Webアプリケーションとしても、Electronを使用したデスクトップアプリケーションとしても動作します。

## 主な機能
- キャラクター管理（追加、編集、削除）
- 感情設定とアイコン表示
- ブロックベースの編集
- ドラッグ&ドロップによるブロック並び替え
- CSVインポート/エクスポート
- ダークモード対応
- デスクトップアプリケーション対応

## 技術スタック
- Next.js 14
- TypeScript
- TailwindCSS v4
- React DnD Kit
- Electron

## 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# Webアプリケーションとして開発サーバーを起動
npm run dev

# Electronアプリケーションとして開発サーバーを起動
npm run electron-dev

# ビルド
npm run build

# 本番サーバーの起動
npm start

# Electronアプリケーションのビルド
npm run electron-build

# Electronアプリケーションのパッケージング
npm run electron-pack
```

## 使用方法

### Webアプリケーションとして
1. `npm run dev` で開発サーバーを起動
2. ブラウザで `http://localhost:3000` にアクセス

### デスクトップアプリケーションとして
1. `npm run electron-dev` でElectronアプリを起動
2. または `npm run electron-build` でビルドして実行ファイルを作成

## ビルドとデプロイ

### Webアプリケーション
```bash
npm run build
npm start
```

### デスクトップアプリケーション
```bash
# 開発用ビルド
npm run electron-pack

# 配布用ビルド
npm run electron-build
```

## 対応プラットフォーム
- Windows
- macOS
- Linux

## ライセンス
MIT License 