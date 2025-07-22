# VoiScripter - ブラウザで動作する合成音声系台本作成アプリ

## 概要
VoiScripterは、合成音声ソフトの台本に向いたシンプルなエディタです。Webアプリケーションとしても、Electronを使用したデスクトップアプリケーションとしても動作します。
※デスクトップアプリケーション版は開発中です
※合成音声系台本に向いているというのは個人の主観です

## 使い方
https://voiscripter.vercel.app/ にアクセス

## 主な機能
- キャラクター管理（追加、編集、削除）
- アイコンの表示
- ブロックベースの台本作成・編集
- ドラッグ操作によるブロック並び替え
- グループ設定での分割CSVエクスポート/インポート
- ダークモード対応
- デスクトップアプリケーション対応(開発中)

## 技術スタック
- Next.js 14
- TypeScript
- TailwindCSS v4
- React DnD Kit
- Electron

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

## ライセンス
MIT License 

## 更新履歴
* 2025/07/22 テスト公開