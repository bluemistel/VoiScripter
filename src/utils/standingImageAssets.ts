import { voiScripterDB } from './indexedDB';

// 立ち絵画像のアセット保存（storyPanelAssets と同じ保存先切替ロジック）。
// キャラクターJSONを肥大化させないため、DataURL は別キーで保存し
// EmotionSetting.standingAssetId で参照する。同期対象外。

const STANDING_ASSET_PREFIX = 'voiscripter_standing_asset_';

const getStorageKey = (assetId: string) => `${STANDING_ASSET_PREFIX}${assetId}`;

const useFileStorage = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !window.electronAPI) return false;
  try {
    const settings = await window.electronAPI.loadSettings();
    return !!settings.saveDirectory;
  } catch {
    return false;
  }
};

export const generateStandingAssetId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const saveStandingAsset = async (assetId: string, dataUrl: string): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  const key = getStorageKey(assetId);
  try {
    const isFileStorage = await useFileStorage();
    if (isFileStorage && window.electronAPI) {
      await window.electronAPI.saveData(key, dataUrl);
    } else {
      await voiScripterDB.save(key, dataUrl);
    }
    return true;
  } catch (error) {
    console.error('立ち絵画像の保存に失敗しました。', error);
    return false;
  }
};

export const loadStandingAsset = async (assetId: string): Promise<string | null> => {
  if (typeof window === 'undefined') return null;
  const key = getStorageKey(assetId);
  try {
    const isFileStorage = await useFileStorage();
    const raw = isFileStorage && window.electronAPI
      ? await window.electronAPI.loadData(key)
      : await voiScripterDB.load(key);
    return raw || null;
  } catch {
    return null;
  }
};

export const removeStandingAsset = async (assetId: string): Promise<void> => {
  if (typeof window === 'undefined') return;
  const key = getStorageKey(assetId);
  try {
    const isFileStorage = await useFileStorage();
    if (isFileStorage && window.electronAPI) {
      await window.electronAPI.deleteData(key);
    } else {
      await voiScripterDB.delete(key);
    }
  } catch {
    // 削除失敗は致命的ではないため無視（次回上書きで置き換わる）
  }
};
