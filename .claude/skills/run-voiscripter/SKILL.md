---
name: run-voiscripter
description: Build, run, and drive VoiScripter (Next.js + Electron script editor). Use when asked to start the app, run the dev server, take a screenshot of the UI, verify a UI change works, or interact with the running app in a headless browser.
---

VoiScripter は Next.js の Web アプリ（Electron 同梱）。ヘッドレス検証は
dev サーバー + `playwright-core` + **システムの Chrome/Edge** で行う
（chromium-cli はこの環境に無く、playwright のブラウザDLも不要）。
ドライバーは `.claude/skills/run-voiscripter/driver.mjs`。

検証済み環境: Windows 11 + Git Bash + Node 22 + システムChrome。

## Prerequisites

- Node.js（npm）と、システムにインストール済みの Chrome または Edge
  （driver.mjs が `C:/Program Files/...` の既定パスから自動検出する）

## Setup

```bash
npm install
npm i --no-save playwright-core   # package.json を汚さない。node_modules 削除で消えるので毎回実行
```

## Run (agent path)

dev サーバーをバックグラウンド起動し、ポートをポーリングしてからドライバーを実行する:

```bash
npm run dev &   # またはバックグラウンドタスクとして起動
timeout 90 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'
node .claude/skills/run-voiscripter/driver.mjs smoke
```

| command | what it does |
|---|---|
| `smoke`（既定） | アプリのロード→プロジェクトエクスプローラーを開閉→スクリーンショット。状態を変更しない |
| `explorer` | フォルダ作成→プロジェクト作成→フォルダへ移動のフルフロー（使い捨てコンテキストなので痕跡は残らない） |

- スクリーンショット → `node_modules/.cache/voiscripter-run/*.png`（必ず目視確認すること）
- 成功時は `OK`、コンソールエラー検出時・失敗時は `FAILED` + exit code 1
- 独自の操作を書く場合は driver.mjs 内の `waitForApp` / `dragTo` ヘルパーをコピーして使う

**停止**（重要 — Gotchas 参照）:

```bash
netstat -ano | grep ":3000" | grep LISTENING   # 最終カラムがPID
taskkill //PID <PID> //T //F                   # //T でプロセスツリーごと殺す
```

## Run (human path)

```bash
npm run dev          # → http://localhost:3000 （Ctrl-C で停止）
npm run electron-dev # Electron 版（このスキル作成時は未検証）
```

## Test

```bash
npm run test   # vitest run — 54件パス（2026-06時点）
npm run build  # 静的エクスポート。TypeScriptチェック込み
```

## Gotchas

- **`npm run dev` の停止でゾンビが残る** — npm ラッパーだけ殺すと子の
  `next dev` がポート3000を握り続ける。次回起動が「Port 3000 is in use →
  3001 で起動」したうえ `.next/dev/lock` が取れず即死する。必ず
  `taskkill //PID <pid> //T //F`（ツリーごと）で止める。PID は netstat で探す。
- **新しいブラウザコンテキスト = 空の IndexedDB** — アプリのデータは
  IndexedDB 保存なので、テスト実行ごとにまっさら。永続化の検証は同一
  コンテキスト内で `page.reload()` する。逆に言えば `explorer` コマンドが
  何を作ってもユーザーデータは汚れない。
- **アプリには約2.5秒のローディングオーバーレイがある** — `header` 出現後も
  `waitForTimeout(2500)` しないとクリックがオーバーレイに吸われる
  （driver.mjs の `waitForApp` が処理済み）。
- **Playwright の `text=` / `has-text` は部分一致** — 「作成」「削除」は
  プロジェクト名やヘッダーにも一致して誤クリックする。ダイアログ内ボタンは
  `form button[type="submit"]`、メニュー項目は `hasText: /^削除$/` の完全一致で絞る。
- **ダイアログは固定オーバーレイ（DialogFrame）** — 背面の要素に一致した
  セレクタは「subtree intercepts pointer events」で30秒タイムアウトする。
  一番手前のダイアログにスコープするか `.last()` を使う。
- **dnd-kit のドラッグは PointerSensor distance:8** — `dragTo()` のように
  mouse.down → まず12px動かして活性化 → 段階的 move → up としないと
  ドラッグが始まらない（クリック扱いになる）。
- **ドライバーをプロジェクト外に置くと `ERR_MODULE_NOT_FOUND`** —
  bare import の解決はスクリプトの場所基準。一時スクリプトもリポジトリ
  ルート直下に置いて実行後に消す。

## Troubleshooting

- **`Cannot find package 'playwright-core'`**: `npm i --no-save playwright-core`
  を再実行。**普通の `npm install` を走らせるだけでも prune されて消える**
  （package.json に無いため）。Setup の2行は必ずこの順で実行する。
- **`Unable to acquire lock at .next\dev\lock`**: ゾンビの `next dev` が生きている。
  netstat でPIDを探して `taskkill //PID <pid> //T //F`。
- **`Port 3000 is in use by process NNNNN, using available port 3001`**: 同上。
  3001で動いたサーバーに対しては `--url http://localhost:3001` を渡せば
  ドライバーはそのまま使える。
