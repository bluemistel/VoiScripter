
// 感情ラベル。'normal' は既定で必ず存在し、ユーザー定義ラベル（喜・怒 等）を追加できる
export type Emotion = string;
export const DEFAULT_EMOTION: Emotion = 'normal';

// 立ち絵の表示調整（上部中央起点の原寸表示が既定。ズームと位置をキャラ/表情ごとに補正）
export interface StandingView {
  scale: number;   // 1 = 原寸
  offsetX: number; // px（右が正）
  offsetY: number; // px（下が正）
}

// 感情ごとの設定（表情差分アイコン + 感情選択時に自動選択するプリセット + 立ち絵）
export interface EmotionSetting {
  iconUrl: string;
  userPresetId?: string; // 連動するユーザープリセット（例: 「琴葉 茜（喜び）」）
  standingAssetId?: string; // 立ち絵画像のアセットID（IndexedDB/ファイル保存。同期対象外）
  standingView?: StandingView; // 立ち絵の表示調整
}

export interface UserPreset {
  id: string;
  name: string;
}

// 立ち絵などの素材クレジット情報（概要欄用のクレジット出力と制作時の確認に使用）
export interface MaterialCredit {
  url?: string;     // 配布ページURL（ニコニコ静画/コモンズ等）
  id?: string;      // 素材ID（im/nc番号等）
  creator?: string; // 制作者名
  memo?: string;    // メモ（クレジット出力には含めない）
}

export interface Character {
  id: string;
  name: string;
  group: string; // グループ設定を追加
  emotions: {
    normal: EmotionSetting; // 既定の表情（必須）
    [emotion: Emotion]: EmotionSetting; // ユーザー定義の表情差分
  };
  backgroundColor?: string; // アイコン背景色
  disabledProjects?: string[]; // 無効なプロジェクトIDの配列（未設定の場合は全プロジェクトで有効）
  userPresets?: UserPreset[]; // ユーザープリセット
  materialCredit?: MaterialCredit; // 立ち絵素材クレジット
  chatSide?: 'left' | 'right'; // チャットビューでの表示サイド（未設定はキャラ順で自動振り分け）
}

// グループ名 → クレジット表記（例: "VOICEVOX:ずんだもん"）のマップ
// voiscripter_group_credits に保存（groups は string[] のまま非破壊で拡張）
export type GroupCredits = Record<string, string>;

export interface ScriptBlock {
  id: string;
  characterId: string;
  emotion: Emotion;
  text: string;
  userPresetId?: string; // ユーザープリセットID
}

export interface StorySeparatorImage {
  id: string;
  name: string;
  dataUrl: string;
}

export interface StoryPanelImageRef {
  assetId: string;
  name?: string;
}

export interface StorySeparatorSegment {
  id: string;
  anchorBlockId: string | null; // null は冒頭を指す
  imageRef?: StoryPanelImageRef;
  image?: StorySeparatorImage;
  label?: string;
}

export interface ProjectSyncMeta {
  syncId?: string;
  lastSyncedAt?: string;
  autoSyncEnabled?: boolean;
  lastSyncedDeviceId?: string;
}

export interface Script {
  id: string;
  title: string;
  blocks: ScriptBlock[];
  characters: Character[];
  storySegments?: StorySeparatorSegment[];
  storyPanelWidth?: number;
}

// シーン（サブプロジェクト）
export interface Scene {
  id: string;
  name: string;
  scripts: Script[];
  // 必要に応じて他のシーン固有情報を追加
}

// プロジェクト型
export interface Project {
  id: string;
  name: string;
  scenes: Scene[];
  schemaVersion?: number;
  syncMeta?: ProjectSyncMeta;
  // プロジェクト全体の設定やメタ情報を追加可能
}

// プロジェクトエクスプローラーのフォルダ
export interface ExplorerFolder {
  id: string;
  name: string;
  parentId: string | null; // null はルート直下
}

// プロジェクトエクスプローラーのツリーメタデータ（voiscripter_explorer_tree に保存）
export interface ExplorerTreeData {
  version: 1;
  folders: ExplorerFolder[];
  projectLocations: Record<string, string>; // projectId -> folderId（エントリなし = ルート）
  updatedAt: number;
}

// ツリー描画用ノード
export type ExplorerNode =
  | { type: 'folder'; folder: ExplorerFolder; children: ExplorerNode[] }
  | { type: 'project'; projectId: string };

// Electron API型定義
declare global {
  interface Window {
    electronAPI?: {
      // アプリケーション情報の取得
      getAppVersion: () => Promise<string>;
      getAppName: () => Promise<string>;
      
      // ファイルシステム操作
      selectDirectory: () => Promise<string | null>;
      saveData: (key: string, data: string) => Promise<void>;
      loadData: (key: string) => Promise<string | null>;
      listDataKeys: () => Promise<string[]>;
      deleteData: (key: string) => Promise<void>;
      moveDataBetweenDirectories: (fromDirectory: string, toDirectory: string) => Promise<{ success: boolean; movedCount: number }>;
      
      // CSVファイル保存
      saveCSVFile: (defaultName: string, csvContent: string) => Promise<string | null>;
      
      // 設定操作
      saveSettings: (settings: any) => Promise<void>;
      loadSettings: () => Promise<{ saveDirectory: string }>;
      
      
      // メニューイベントの受信
      onNewProject: (callback: () => void) => void;
      onOpenProject: (callback: () => void) => void;
      onSaveProject: (callback: () => void) => void;
      onShowAbout: (callback: () => void) => void;
      
      // ウィンドウフォーカスイベント
      onWindowFocused: (callback: () => void) => void;
      onWindowBlurred: (callback: () => void) => void;
      
      // イベントリスナーの削除
      removeAllListeners: (channel: string) => void;
      
      // ウィンドウサイズと位置の取得・設定
      getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
      setWindowBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<boolean>;
    };
    getLogoPath?: () => string;
  }
} 