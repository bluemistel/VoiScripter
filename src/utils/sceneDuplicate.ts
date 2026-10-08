import { Scene } from '@/types';
import { generateBlockId } from './blockFactory';

const generateId = () => Date.now().toString() + Math.random().toString(36).slice(2, 7);

export interface DuplicatedScene {
  scene: Scene;
  /** 元の台本ID → 複製後の台本ID（ストーリーパネル画像のコピーに使う） */
  scriptIdMap: Record<string, string>;
}

/**
 * シーンを丸ごと複製する。シーン・台本・ブロックのIDは振り直し、
 * ストーリーパネルの区切り（anchorBlockId）は複製後のブロックIDへ付け替える。
 * 区切りのIDは台本の中で一意なら良いのでそのまま使う（画像の保存キーに使われている）。
 */
export const duplicateScene = (source: Scene, newName: string): DuplicatedScene => {
  const scriptIdMap: Record<string, string> = {};
  const scripts = source.scripts.map((script, index) => {
    const blockIdMap = new Map<string, string>();
    const blocks = script.blocks.map(block => {
      const id = generateBlockId();
      blockIdMap.set(block.id, id);
      return { ...block, id };
    });
    const newScriptId = generateId();
    scriptIdMap[script.id] = newScriptId;
    return {
      ...script,
      id: newScriptId,
      // 先頭の台本タイトルがシーン名と同じなら、複製後の名前に合わせる
      title: index === 0 && script.title === source.name ? newName : script.title,
      blocks,
      characters: [...script.characters],
      storySegments: script.storySegments?.map(segment => ({
        ...segment,
        anchorBlockId: segment.anchorBlockId === null
          ? null
          : blockIdMap.get(segment.anchorBlockId) ?? segment.anchorBlockId
      }))
    };
  });

  return {
    scene: { ...source, id: generateId(), name: newName, scripts },
    scriptIdMap
  };
};
