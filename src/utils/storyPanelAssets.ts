import { Project, StorySeparatorImage } from '@/types';
import { voiScripterDB } from './indexedDB';

const STORY_PANEL_SYNC_SCHEMA_VERSION = 2;
const STORY_ASSET_PREFIX = 'voiscripter_story_asset_';

const getStorageKey = (projectId: string, scriptId: string, segmentId: string) =>
  `${STORY_ASSET_PREFIX}${projectId}_${scriptId}_${segmentId}`;

const useFileStorage = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !window.electronAPI) return false;
  try {
    const settings = await window.electronAPI.loadSettings();
    return !!settings.saveDirectory;
  } catch {
    return false;
  }
};

const saveRawStoryAsset = async (key: string, raw: string): Promise<void> => {
  const isFileStorage = await useFileStorage();
  if (isFileStorage && window.electronAPI) {
    await window.electronAPI.saveData(key, raw);
  } else {
    await voiScripterDB.save(key, raw);
  }
};

export const loadStoryPanelAsset = (
  projectId: string,
  scriptId: string,
  segmentId: string
): Promise<StorySeparatorImage | null> => {
  if (typeof window === 'undefined') return Promise.resolve(null);

  const key = getStorageKey(projectId, scriptId, segmentId);

  return (async () => {
    const isFileStorage = await useFileStorage();
    const raw = isFileStorage && window.electronAPI
      ? await window.electronAPI.loadData(key)
      : await voiScripterDB.load(key);

    if (raw) {
      try {
        return JSON.parse(raw) as StorySeparatorImage;
      } catch {
        return null;
      }
    }

    // 旧localStorageからの後方互換（必要時のみ読み出し）
    const legacyRaw = localStorage.getItem(key);
    if (!legacyRaw) return null;
    try {
      const parsed = JSON.parse(legacyRaw) as StorySeparatorImage;
      try {
        await saveRawStoryAsset(key, legacyRaw);
        localStorage.removeItem(key);
      } catch {
        // 現在保存先への移動が失敗しても、表示継続のために値は返す
      }
      return parsed;
    } catch {
      return null;
    }
  })();
};

export const saveStoryPanelAsset = async (
  projectId: string,
  scriptId: string,
  segmentId: string,
  image: StorySeparatorImage
): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  const key = getStorageKey(projectId, scriptId, segmentId);
  try {
    const serialized = JSON.stringify(image);
    await saveRawStoryAsset(key, serialized);
    // 旧保存キーがあれば削除
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('ストーリーパネル画像の保存容量が上限を超えました。', {
        key,
        imageName: image.name
      });
    } else {
      console.error('ストーリーパネル画像の保存に失敗しました。', error);
    }
    return false;
  }
};

export const removeStoryPanelAsset = async (projectId: string, scriptId: string, segmentId: string) => {
  if (typeof window === 'undefined') return;
  const key = getStorageKey(projectId, scriptId, segmentId);
  try {
    const isFileStorage = await useFileStorage();
    if (isFileStorage && window.electronAPI) {
      await window.electronAPI.deleteData(key);
    } else {
      await voiScripterDB.delete(key);
    }
  } catch {
    // 削除失敗時も旧localStorageだけは掃除しておく
  } finally {
    localStorage.removeItem(key);
  }
};

export const migrateLegacyStoryPanelAssets = async (): Promise<{ migrated: number; failed: number }> => {
  if (typeof window === 'undefined') return { migrated: 0, failed: 0 };
  const keys = Object.keys(localStorage).filter((key) => key.startsWith(STORY_ASSET_PREFIX));
  if (keys.length === 0) return { migrated: 0, failed: 0 };

  let migrated = 0;
  let failed = 0;

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      await saveRawStoryAsset(key, raw);
      localStorage.removeItem(key);
      migrated += 1;
    } catch {
      failed += 1;
    }
  }

  return { migrated, failed };
};

export const buildSyncProjectPayload = (project: Project): Project => ({
  ...project,
  schemaVersion: STORY_PANEL_SYNC_SCHEMA_VERSION,
  scenes: project.scenes.map(scene => ({
    ...scene,
    scripts: scene.scripts.map(script => ({
      ...script,
      storySegments: script.storySegments?.map(segment => ({
        ...segment,
        image: undefined
      }))
    }))
  }))
});
