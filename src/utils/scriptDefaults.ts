import { Script } from '@/types';

const generateId = () => Date.now().toString() + Math.random().toString(36).slice(2, 7);

export interface BuildEmptyScriptParams {
  id?: string;
  title?: string;
}

export const buildEmptyScript = (params: BuildEmptyScriptParams = {}): Script => ({
  id: params.id ?? generateId(),
  title: params.title ?? '新しいシーン',
  blocks: [],
  characters: [],
  storySegments: [
    {
      id: `segment_${generateId()}`,
      anchorBlockId: null,
      images: []
    }
  ],
  storyPanelWidth: 320
});

