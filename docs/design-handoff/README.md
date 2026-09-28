# Handoff: ポップ／モダン UI 刷新

> **実装後の変更（2026-09）**: 実装後の確認で次を変更した。現在の仕様は `docs/ui-guidelines.md` を正とする。
> - フキダシの classic を廃止し pop に統合（pop の塗りは classic の濃さ）
> - 台本ブロックのアバターは縁取りなしで 60px（モバイル 56px）
> - ト書きの先頭アイコンは `users`（話者切替）
> - ツールバーのブロック追加は1ボタン（直下に追加、未選択なら最下段）
> - セカンダリボタンは薄い枠付き。ボタンの見た目は `globals.css` の `.ui-btn-*` を既定とする
> - データ同期の「同期／復元」はキャラクター設定（軽量版）も一緒に扱い、キャラ同期／キャラ復元ボタンは廃止

## 概要

台本エディタ全体（ヘッダー・シーンタブ・台本ブロック・ツールバー・主要ダイアログ）を、枠線主体の「機械的」な見た目から、面と影で階層を作るポップ／モダンな見た目に刷新する。あわせて、ブロックごとに常時出ていた操作UI（話者リストボックス、上下移動・複製・削除アイコン）を整理し、1画面の情報量を減らす。

ライト／ダーク両テーマ、シンプルモード、モバイル幅、フキダシ3テーマ（pop / cinema / chat。classic は pop に統合）すべてが対象。

## デザインファイルについて

`mock/VoiScripter Pop UI.dc.html` は **HTML で作ったデザイン参照** であり、本番コードではない。ブラウザで直接開いて見た目を確認できる（同じフォルダの `support.js` が必要）。

作業は、このモックを **既存の Next.js + React + Tailwind のコードベースの流儀で再実装する** こと。モックのインラインスタイルやマークアップをそのままコピーしない。色は `src/app/globals.css` のトークン、アイコンは既存の `@heroicons/react` を使う。

モックはターン単位で上から新しい順に並んでいる。**採用案は以下のIDのもの**で、それより下（`1a`〜`1d`）は検討過程なので参照しない。

| ID | 内容 |
| --- | --- |
| `2a` | 台本エディタ（通常モード・クラシック）＝基準 |
| `3a` | シンプルモード |
| `3b` | モバイル幅（390px） |
| `4a` | フキダシ：シネマ |
| `4b` | フキダシ：チャット |
| `5b` | 検索ダイアログ |
| `5c` | 台本ビュー（チャット） |
| `5d` | グループ設定 |
| `5e` | 設定ダイアログ |
| `6a` | エクスポートダイアログ（2カラム）※ `5a` は旧案なので使わない |

各IDのキャプチャは `screenshots/` にある（ファイル名の先頭がID）。

## Fidelity

**High-fidelity。** 色・余白・角丸・影・文字サイズは確定値。数値は `docs/ui-guidelines.md` と本 README に記載したものを正とする。

## 前提ルール

実装前に `docs/ui-guidelines.md` を必ず読むこと。本 README は「どのファイルで何をするか」の計画で、見た目のルールそのものはガイドライン側にある。

---

## 実装計画

小さく分けて PR にする。各フェーズの最後に、ライト／ダーク × 通常／シンプル × デスクトップ／モバイルで見た目を確認する。

### Phase 0 — トークン

**対象:** `src/app/globals.css`, `src/utils/colorUtils.ts`

1. `docs/design-handoff/tokens.css` のトークンを、既存のライト／`.dark` 定義と同じ書式で `globals.css` に追記する。既存値（`--color-primary` など）は変えない。
2. Tailwind から使えるようにする（既存トークンの公開方法に合わせる）。
3. `colorUtils.ts` にパーソナルカラーの派生ヘルパーを追加する（`tokens.css` 末尾のコメント参照）。
   - `bubbleFill(color, isDark)` / `nameBadgeText(color)` / `nameLabelText(color, isDark)`

**完了条件:** 既存画面の見た目が変わらないこと（トークンを足しただけ）。

### Phase 1 — ヘッダーとシーンタブ

**対象:** `src/components/Header.tsx`, `src/app/page.tsx`（タブ部分）

- ヘッダー下の `border-b` と、タブ行上下の `border-t` / `border-b` を外す。ヘッダーは `box-shadow: 0 1px 0 var(--color-hairline)` のみ。
- プロジェクト名は `--color-field` のピル（角丸9999px、`padding: 6px 12px`、15px/500）。
- 右側のアイコンボタンは 36px 角・角丸10px、アイコン22px。**色は `--color-primary`**（黒にしない）。アクティブ中の機能だけ `--color-primary-tint` の背景。
- シーンタブ: 上角12px の角丸。アクティブは背景＝キャンバス色＋`inset 0 3px 0 var(--color-primary)`、13px/700。非アクティブは背景なし、`--color-fg-sub`、13px/400。追加ボタンは 26px の丸（`--color-field`）。

参照: `2a` 上部

### Phase 2 — 台本ブロック（通常モード）

**対象:** `src/components/ScriptEditor.tsx`（ブロック描画部分）

レイアウト:

```
.block  padding 12px / radius 20px / gap 12px / bg --color-block / shadow --shadow-block
 ├ avatar 60px（丸・縁取りなし。モバイル 56px）
 │   └ 選択中のみ: 右下に 21px の丸ボタン（chevron-up-down 13px、キャラ色、パネル面＋小さな影）
 ├ text-area-wrap（relative, flex:1）
 │   ├ 話者名バッジ  absolute top:-8px left:14px / 11px 700 / padding 1px 10px / radius 9999
 │   │     bg=キャラ色, color=nameBadgeText, box-shadow: 0 0 0 2px {block面}
 │   ├ 感情/プリセットチップ（バッジの右隣）10px / bg=panel / border 1.5px solid キャラ色
 │   └ textarea  padding 16px 16px 14px / radius 16px（四隅均一）
 │         border 2px solid キャラ色 / bg=bubbleFill / 16px 行間1.55
 └ hover-palette（absolute top:11px right:12px）複製・削除のみ
```

- ブロック間の間隔は 10px。
- 選択中ブロックは `--shadow-block-selected`。**ブロック外周・アバターの輪郭にキャラ色を使わない。**
- **話者セレクト（`<select>`）を廃止**し、アバターのクリックで既存の `CharacterPicker` を開く。切替ボタン（右下の丸）は選択中ブロックにのみ表示。「タップで切替」等のテキストは置かない。
- **上下移動アイコンをブロックから撤去。** 複製・削除だけをホバー時に表示する（`opacity 0 → 1, .16s ease`、`position:absolute` でレイアウトを動かさない）。パレットは panel 面・角丸11px・`--shadow-popover`、ボタン28px。削除アイコンは `--color-destructive`。
- 現在テキストエリア右上に `absolute` で置いているプリセットの `<select>` は、話者名バッジ右隣のチップに置き換える（クリックで既存のプリセット選択を開く）。
- ト書きブロック: アバターなし。`padding 13px 16px` / 角丸18px / `--color-field` 塗り＋`inset 0 0 0 1px rgb(0 0 0/.05)`。先頭に `users` 14px（`--color-fg-faint`、押すと話者切替）。本文は **`--color-fg` のイタリック**（薄くしない）。

参照: `2a`

### Phase 3 — フローティングツールバー

**対象:** `ScriptEditor.tsx`（`data-floating-toolbar` 部分）

- 枠線を外し、`--color-panel`（96%）＋`--shadow-toolbar`、角丸9999px、`padding 6px`。
- ボタン順（左→右、`|` は 1px×20px の区切り線）:
  `最上段へ(chevron-up)` `最下段へ(chevron-down)` | `元に戻す(arrow-uturn-left)` `やり直す(arrow-uturn-right)` | `上へ(arrow-up)` `下へ(arrow-down)` `複製(document-duplicate)` `削除(trash, destructive)` | `ト書き追加` `ブロック追加`
- ボタン: 34px の丸、アイコン19px、`--color-fg-sub`。
- **ト書き追加**: 34px の丸に全角の「ト」（15px/700）。背景はライト `#e4e4de` / ダーク `rgb(255 255 255/.16)`、`inset 0 0 0 1px var(--color-hairline)`、文字はライト `#5a5a5a` / ダーク `#b5b5b5`。従来の鉛筆アイコンのボタンを置き換える。
- **ブロック追加**: プライマリ。高さ34px、`padding 0 14px`、`plus` 17px＋「ブロック」12px/700、`--color-on-primary`、`box-shadow: 0 4px 12px -4px var(--color-primary)`。
- 左利き設定（ツールバー反転）は既存どおり順序を反転する。

参照: `2a` 下部

### Phase 4 — シンプルモード

**対象:** `ScriptEditor.tsx`（`simpleMode` 分岐）

- 1行1ブロック。行 `padding 5px 8px` / 角丸10px / 行間 `gap 1px`、影・フキダシなし。
- アバター32px。**話者名は表示しない。**
- テキストの左に `border-left: 2px solid キャラ色; padding-left: 9px`。本文15px/行間1.45。
- 感情名がある場合は行の右端に 10px の `--color-fg-faint`。
- 選択行のみ `box-shadow: 0 0 0 1px` primary 35%、ホバーで複製・削除（24px ボタン）。
- ト書き行はアバター幅ぶんを空けてイタリック。

参照: `3a`

### Phase 5 — モバイル

**対象:** `ScriptEditor.tsx`（`isMobileView` 分岐）, `Header.tsx`

- ブロックは Phase 2 と同じ構造でアバター48px。話者セレクト・移動アイコンは出さず、アバタータップで `CharacterPicker` をボトムシートで開く。
- ツールバー: ボタン 44px（タップ領域）、`gap 0` / `padding 4px`。区切り線とスクロールヒントは出さない。表示するのは 元に戻す / やり直す / 複製 / 削除 / ト / 追加 ＋ 最上段・最下段（計8ボタンで 360px、390px 幅に収まる）。
- ヘッダー右はハンバーガー1つ（44px）に集約。

参照: `3b`

### Phase 6 — フキダシテーマ

**対象:** `ScriptEditor.tsx`（`bubbleTheme` 分岐）

| テーマ | 実装 |
| --- | --- |
| pop | Phase 2 そのもの（テキストエリア角丸18px）。旧 classic はここに統合 |
| cinema | テキストエリアの枠と塗りを外し、`border-left: 3px solid キャラ色; padding-left:14px`。話者名はバッジではなく 11px/700・`letter-spacing:.22em`・`nameLabelText` 色の行ラベル。本文17px/行間1.9。アバター44px。ブロックの外周なし（選択中だけ primary 35% の 1px リング）。ト書きは中央寄せイタリック |
| chat | `chatSide` の左右振り分けを維持。フキダシ最大幅74%、`border 1.5px solid キャラ色`＋`bubbleFill`。**アバター側の角だけ 6px**（左: `18px 18px 18px 6px` / 右: `18px 18px 6px 18px`）。連続発言ではアバター・名前を省略。ト書きは中央のピル（13px、`--color-field`） |

参照: `4a`, `4b`

### Phase 7 — ダイアログ共通

**対象:** `src/components/common/DialogFrame.tsx`

- パネル: `--color-panel`、角丸22px、**枠線なし**、`--shadow-dialog`。オーバーレイは黒40%。
- ヘッダー: 左に `--color-primary-text` のアイコン19px＋タイトル16px/700、右に 30px の丸い閉じるボタン（`--color-field`＋`x-mark` 16px）。
- 入力欄・セレクト: 枠線なし、`--color-field`、角丸12px、`padding 10px 13px`、13.5px。フォーカスは `box-shadow: 0 0 0 2px var(--color-primary)`。
- チェックボックス／ラジオ: 19px。オフ＝`--color-field`＋`inset 0 0 0 1.5px var(--color-hairline)`、オン＝primary 塗り（チェックは `check` 13px、ラジオは中心7px）、部分選択＝primary 塗り＋横バー。
- ボタン3種（ガイドライン §5）。`Button` 相当の共通コンポーネントがなければ `src/components/common/` に作る。
- タブはすべてシーンタブと同じ形状（Phase 1）。タブ行は `--color-well` の帯。

### Phase 8 — 個別ダイアログ

**検索** `src/components/SearchDialog.tsx`（`5b`）
- 左上にドラッグ用グリップ（2×4 のドット）。
- 入力欄はフォーカス時にアクセントの 2px リング、先頭に `magnifying-glass` 17px。
- 件数と前へ／次へを `--color-primary-tint` の1つの帯にまとめる。**前へ／次へは同格のセカンダリボタン**（panel 面＋`inset 0 0 0 1.5px var(--color-hairline)`）。
- ショートカット表記は `--color-field` のピル。

**台本ビュー** `src/components/ScriptViewDialog.tsx`（`5c`）
- タブは Phase 7 の形状。フキダシは chat テーマと同じ見た目（Phase 6）。

**グループ設定** `src/components/CharacterManager.tsx` 内（`5d`）
- 1グループ＝1カード（`--color-well`、角丸16px、`padding 11px 13px`）。
- 上段: 並び替えグリップ／グループ名（13.5px/700）／**名前ホバーで右に編集ボタン（`pencil-square`、26px、`--color-field`）**／右端に削除（destructive 弱スタイル＋「削除」）。
- 下段: クレジット表記の入力欄（placeholder: `クレジット表記（例: VOICEVOX:ずんだもん）`）。
- 変更は即時保存のため、フッターは「閉じる」のみ。

**設定** `src/components/Settings.tsx`（`5e`）
- 構成は現状どおり（データ保存先 → 動作モードの切り替え → 表示）。見た目だけ差し替える。
- 「ブラウザ内データベースに戻す」は destructive 弱スタイル＋`exclamation-triangle`。「変更」はセカンダリ。
- 「フォント」は `--color-well` のカードにまとめる。
- 立ち絵ステージをONにしたときの表示サイドはインデントしたセレクト。

### Phase 9 — エクスポート（2カラム）

**対象:** `src/components/CSVExportDialog.tsx`（`6a`）

デスクトップ前提。**モバイルでは従来の1カラムのまま**でよい（必要なら縦積みにフォールバック）。幅960px。

```
┌ タブ行（台本 / バックアップ / クレジット）＋閉じる ─────────────┐
├──────────── 左 384px（必須） ───────┬──── 右（任意） ──────────┤
│ ① 出力する内容  [必須]              │ ③ 出力範囲を絞り込む [任意]  n/4 適用中 │
│   ◉ 話者とセリフの両方              │ 説明: すべてオフのままで…     │
│   ○ セリフのみ                      │ ┌ □ グループごとにエクスポート ┐ │
│   ○ クリップボードにコピー          │ ├ □ 特定のシーンのみ出力      ┤ │
│ ② ファイル形式  [必須]              │ ├ □ 選択中のブロックのみ出力  ┤ │
│   [ .csv ] [ .txt ]  ← 2枚のカード   │ └ □ プリセット名と区切り文字  ┘ │
│ ── 出力プレビュー（mono） ──         │   チェックしたカードだけ詳細が開く │
│ 42ブロック・1,248字   [エクスポート] │                              │
└────────────────────────────────────┴──────────────────────────┘
```

- **デフォルト**: ① 話者とセリフの両方 / ② .csv / ③ すべてオフ。右カラムを見なくてもこの状態でエクスポートできること。
- ステップ番号は 21px の丸。①② は primary 塗り＋「必須」チップ（`--color-primary-tint`／`--color-primary-text`）、③ は `--color-field`＋「任意」チップ。
- ① の選択肢: 選択中は `--color-primary-tint`＋`inset 0 0 0 1.5px var(--color-primary)`。
- ② は `<select>` を廃止し `.csv` / `.txt` の2枚カード（等幅15px/700＋用途の説明）。既存の他形式が必要な場合は txt の区切り文字オプション側に寄せる。
- 出力プレビュー: 現在の設定で先頭3行を等幅フォントで表示（`--color-well` 相当、角丸11px）。設定変更に追従。
- ③ のカード: 閉じた状態は `--color-well`、チェックONで `--color-primary-tint`＋primary リングになり、中に panel 面の詳細エリアが開く（`chevron-down` → `chevron-up`）。
  - **グループごと**: 親チェック（部分選択あり）＋各グループのチェック、グループ名の下に台本内の対象キャラ名をチップで表示、`n人`。
  - **特定のシーンのみ**: シーン一覧のチェックリスト。
  - **選択中のブロックのみ**: 説明文に対象ブロック数（「エディタで選択している n ブロックが対象です」）。0件のときはカードを無効化。
  - **プリセット名と区切り文字**: 1文字入力（52px、フォーカスリング）＋候補チップ（＞ ： ＝ ／）＋この設定での出力例（等幅）。
- 右カラム見出しの右端に「n / 4 適用中」。

---

## 状態管理

新たに必要な状態は少ない。

- `hoveredBlockId`（または CSS の `:hover` / `group-hover` で代替可。**CSS で済むならそちらを優先**）
- 選択中ブロック（既存）に応じて話者切替ボタンを出し分け
- エクスポート: 既存の state をそのまま使い、③ の各カードの開閉はチェック状態から導出する（別 state を持たない）
- グループ設定: 名前の編集中フラグ `editingGroupId`

## アイコン（`@heroicons/react/24/outline`）

| 用途 | アイコン |
| --- | --- |
| 最上段へ / 最下段へ | `ChevronUpIcon` / `ChevronDownIcon` |
| 上へ / 下へ | `ArrowUpIcon` / `ArrowDownIcon` |
| 元に戻す / やり直す | `ArrowUturnLeftIcon` / `ArrowUturnRightIcon` |
| 複製 | `DocumentDuplicateIcon` |
| 削除 | `TrashIcon` |
| 話者切替 | `ChevronUpDownIcon` |
| 閉じる | `XMarkIcon` |
| 注意（destructive 弱） | `ExclamationTriangleIcon` |
| グループ名編集 | `PencilSquareIcon` |
| ト書き追加 | アイコンではなく「ト」の文字 |

二重シェブロン（`ChevronDoubleUpIcon` 等）は使わない。

## アセット

新規の画像アセットはなし。フォントは既存の `M PLUS 1p`。

## 同梱ファイル

```
CLAUDE.md                                  ← リポジトリ直下に置く
docs/
  ui-guidelines.md                         ← UIルール（正）
  design-handoff/
    README.md                              ← 本ファイル（実装計画）
    tokens.css                             ← 追加トークン
    mock/
      VoiScripter Pop UI.dc.html           ← 見た目の参照モック
      support.js                           ← モックの表示に必要
    screenshots/                           ← 採用案のキャプチャ（各画像は左ライト／右ダーク）
      2a-editor-classic.png
      3a-simple-mode.png
      3b-mobile.png
      4a-theme-cinema.png
      4b-theme-chat.png
      5b-search.png
      5c-script-view-chat.png
      5d-group-settings.png
      5e-settings.png
      6a-export.png
```

スクリーンショットは静止画のため、ホバー時の表示（複製・削除パレット、グループ名の編集ボタン）は `2a` の選択中ブロックのように「表示された状態」で撮っています。実際はホバー時のみ出る点に注意。

## 確認チェックリスト

- [ ] 画面内に `border-gray-*` の常時表示の枠線が残っていない
- [ ] キャラ色がブロック外周・アバター輪郭に使われていない
- [ ] 通常モードで各ブロックに常時出ている操作UIがない（ホバー／選択時のみ）
- [ ] 前へ／次へなど対になるボタンが同じスタイル
- [ ] 黄色・琥珀の色が使われていない
- [ ] ライトテーマで本文・説明文のコントラスト比が 4.5:1 以上
- [ ] モバイルのタップ領域が 44px 以上、390px 幅でツールバーがはみ出さない
- [ ] 4つのフキダシテーマ × ライト／ダーク × 通常／シンプルで表示が崩れない
- [ ] 既存のショートカット・ドラッグ並び替え・左利き設定が動く
