/**
 * シーン複製のテスト
 */

import { describe, it, expect } from 'vitest';
import { duplicateScene } from '../utils/sceneDuplicate';
import { Scene } from '../types';

const source: Scene = {
  id: 'scene-1',
  name: '第1話',
  scripts: [{
    id: 'script-1',
    title: '第1話',
    characters: [],
    blocks: [
      { id: 'b1', characterId: 'akane', emotion: 'normal', text: 'こんにちは' },
      { id: 'b2', characterId: '', emotion: 'normal', text: '（ト書き）' },
      { id: 'b3', characterId: 'aoi', emotion: '喜び', text: 'やあ', userPresetId: 'p1' }
    ],
    storySegments: [
      { id: 'seg-head', anchorBlockId: null, label: '冒頭' },
      { id: 'seg-1', anchorBlockId: 'b3', imageRef: { assetId: 'img-1', name: 'a.png' } }
    ],
    storyPanelWidth: 300
  }]
};

describe('duplicateScene', () => {
  it('名前を変え、シーン・台本・ブロックのIDを振り直す', () => {
    const { scene, scriptIdMap } = duplicateScene(source, '第1話 (1)');
    expect(scene.name).toBe('第1話 (1)');
    expect(scene.id).not.toBe(source.id);
    expect(scene.scripts[0].id).not.toBe('script-1');
    expect(scriptIdMap['script-1']).toBe(scene.scripts[0].id);

    const ids = scene.scripts[0].blocks.map(b => b.id);
    expect(ids).not.toContain('b1');
    expect(new Set(ids).size).toBe(3);
  });

  it('本文・話者・表情・プリセットと台本の設定はそのまま写す', () => {
    const { scene } = duplicateScene(source, '第1話 (1)');
    const script = scene.scripts[0];
    expect(script.blocks.map(({ id: _id, ...rest }) => rest)).toEqual(source.scripts[0].blocks.map(({ id: _id, ...rest }) => rest));
    expect(script.storyPanelWidth).toBe(300);
    // 先頭の台本タイトルがシーン名と同じなら新しい名前に合わせる
    expect(script.title).toBe('第1話 (1)');
  });

  it('ストーリーパネルの区切りは複製後のブロックを指し、区切りIDと画像参照は保つ', () => {
    const { scene } = duplicateScene(source, '第1話 (1)');
    const script = scene.scripts[0];
    const [head, seg] = script.storySegments!;
    expect(head.anchorBlockId).toBeNull();
    expect(seg.id).toBe('seg-1');
    expect(seg.anchorBlockId).toBe(script.blocks[2].id);
    expect(seg.imageRef).toEqual({ assetId: 'img-1', name: 'a.png' });
  });

  it('元のシーンは変更しない', () => {
    const before = JSON.stringify(source);
    const { scene } = duplicateScene(source, '第1話 (1)');
    scene.scripts[0].blocks[0].text = '変更';
    expect(JSON.stringify(source)).toBe(before);
  });
});
