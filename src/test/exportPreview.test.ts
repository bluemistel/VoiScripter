/**
 * エクスポートダイアログの出力プレビューのテスト
 */

import { describe, it, expect } from 'vitest';
import { buildExportPreview } from '../utils/exportPreview';
import { Character, Scene } from '../types';

const characters: Character[] = [
  { id: 'c1', name: 'ミナト', group: 'A', emotions: { normal: { iconUrl: '' } } },
  { id: 'c2', name: 'ひなた', group: 'B', emotions: { normal: { iconUrl: '' } }, userPresets: [{ id: 'p1', name: 'ひなた（喜び）' }] }
];

const scene = (id: string, blocks: { characterId: string; text: string; userPresetId?: string }[]): Scene => ({
  id,
  name: id,
  scripts: [{ id: `script-${id}`, title: '', characters: [], blocks: blocks.map((b, i) => ({ id: `${id}-${i}`, emotion: 'normal', ...b })) }]
});

const project = {
  scenes: [
    scene('s1', [
      { characterId: 'c1', text: 'こんにちは' },
      { characterId: '', text: '（間）' },
      { characterId: 'c2', text: 'やあ、元気？', userPresetId: 'p1' }
    ]),
    scene('s2', [{ characterId: 'c1', text: '二行\n目' }])
  ]
};

const base = { project, characters, content: 'full' as const, includeTogaki: false, includeUserPreset: false };

describe('buildExportPreview', () => {
  it('話者とセリフの両方: 話者,セリフ（改行は \\n に置き換える）', () => {
    const preview = buildExportPreview(base);
    expect(preview.lines).toEqual(['ミナト,こんにちは', 'ひなた,やあ、元気？', 'ミナト,二行\\n目']);
    expect(preview.blockCount).toBe(3);
    expect(preview.charCount).toBe(5 + 6 + 3);
  });

  it('ト書きを含めると「ト書き」列で出力する', () => {
    const preview = buildExportPreview({ ...base, includeTogaki: true }, 10);
    expect(preview.lines[1]).toBe('ト書き,（間）');
    expect(preview.blockCount).toBe(4);
  });

  it('プリセット名を3列目に追加する', () => {
    const preview = buildExportPreview({ ...base, includeUserPreset: true });
    expect(preview.lines[0]).toBe('ミナト,こんにちは,');
    expect(preview.lines[1]).toBe('ひなた,やあ、元気？,ひなた（喜び）');
  });

  it('カンマを含むセルは引用符で囲む', () => {
    const withComma = { scenes: [scene('s9', [{ characterId: 'c1', text: 'はい, そうです' }])] };
    expect(buildExportPreview({ ...base, project: withComma }).lines[0]).toBe('ミナト,"はい, そうです"');
  });

  it('セリフのみ・クリップボードは本文だけ', () => {
    expect(buildExportPreview({ ...base, content: 'serif-only' }).lines[0]).toBe('こんにちは');
    expect(buildExportPreview({ ...base, content: 'clipboard' }).lines[0]).toBe('こんにちは');
  });

  it('区切り文字形式はプリセット名（なければ話者名）＋区切り文字＋セリフ', () => {
    const preview = buildExportPreview({ ...base, presetSeparator: '＞' });
    expect(preview.lines[0]).toBe('ミナト＞こんにちは');
    expect(preview.lines[1]).toBe('ひなた（喜び）＞やあ、元気？');
  });

  it('シーン・グループ・選択ブロックで絞り込む', () => {
    expect(buildExportPreview({ ...base, sceneIds: ['s2'] }).blockCount).toBe(1);
    expect(buildExportPreview({ ...base, groups: ['B'] }).lines).toEqual(['ひなた,やあ、元気？']);
    expect(buildExportPreview({ ...base, selectedBlockIds: ['s1-0'] }).blockCount).toBe(1);
  });
});
