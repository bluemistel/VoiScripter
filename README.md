# VoiScripter - 脚本作成アプリ

## 概要
VoiScripterは、ブラウザ上で脚本を作成・編集できるWebアプリケーションです。デスクトップアプリとしても動作します。

## 主な機能
- キャラクター管理（追加、編集、削除）
- 感情設定とアイコン表示
- ブロックベースの編集
- ドラッグ&ドロップによるブロック並び替え
- CSVインポート/エクスポート
- ダークモード対応
- データ保存先の設定（localStorage/カスタムディレクトリ）

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

# Webアプリとして開発
npm run dev

# Electronアプリとして開発
npm run electron-dev

# ビルド
npm run build

# Electronアプリのビルド
npm run electron-build

# Electronアプリのパッケージング
npm run electron-pack
```

## 使用方法

### Webアプリとして
1. `npm run dev` で開発サーバーを起動
2. ブラウザで `http://localhost:3000` にアクセス

### デスクトップアプリとして
1. `npm run electron-dev` でElectronアプリを起動
2. 設定画面からデータ保存先を選択可能

## デプロイ
このプロジェクトはVercelにデプロイされています。

## ライセンス
MIT License 