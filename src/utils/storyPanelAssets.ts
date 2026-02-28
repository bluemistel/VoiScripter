import { Project, StorySeparatorImage } from '@/types';

const STORY_PANEL_SYNC_SCHEMA_VERSION = 2;

const getStorageKey = (projectId: string, scriptId: string, segmentId: string) =>
  `voiscripter_story_asset_${projectId}_${scriptId}_${segmentId}`;

export const loadStoryPanelAsset = (
  projectId: string,
  scriptId: string,
  segmentId: string
): StorySeparatorImage | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getStorageKey(projectId, scriptId, segmentId));
    if (!raw) return null;
    return JSON.parse(raw) as StorySeparatorImage;
  } catch {
    return null;
  }
};

export const saveStoryPanelAsset = (
  projectId: string,
  scriptId: string,
  segmentId: string,
  image: StorySeparatorImage
) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getStorageKey(projectId, scriptId, segmentId), JSON.stringify(image));
};

export const removeStoryPanelAsset = (projectId: string, scriptId: string, segmentId: string) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getStorageKey(projectId, scriptId, segmentId));
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
