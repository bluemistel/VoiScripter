/**
 * 新規ブロックの既定プリセットのテスト
 */

import { describe, it, expect } from 'vitest';
import { createScriptBlock, speakerChangeUpdates } from '../utils/blockFactory';
import { Character } from '../types';

const characters: Character[] = [
  { id: 'plain', name: 'プリセットなし', group: 'なし', emotions: { normal: { iconUrl: '' } } },
  {
    id: 'akane',
    name: '茜',
    group: 'なし',
    emotions: { normal: { iconUrl: '' }, '喜び': { iconUrl: '', userPresetId: 'p-joy' } },
    userPresets: [{ id: 'p-std', name: '茜（標準）' }, { id: 'p-joy', name: '茜（喜び）' }]
  },
  {
    id: 'linked-first',
    name: '先頭が表情つき',
    group: 'なし',
    emotions: { normal: { iconUrl: '' }, '怒り': { iconUrl: '', userPresetId: 'p-angry' } },
    userPresets: [{ id: 'p-angry', name: '怒り' }, { id: 'p-other', name: 'その他' }]
  }
];

describe('createScriptBlock', () => {
  it('characters を渡さなければプリセットは付けない（従来どおり）', () => {
    const block = createScriptBlock('akane', 'normal');
    expect(block.userPresetId).toBeUndefined();
    expect(block.text).toBe('');
  });

  it('プリセットを持たないキャラクターとト書きには付けない', () => {
    expect(createScriptBlock('plain', 'normal', characters).userPresetId).toBeUndefined();
    expect(createScriptBlock('', 'normal', characters).userPresetId).toBeUndefined();
  });

  it('一番上のプリセットを既定にする', () => {
    const block = createScriptBlock('akane', 'normal', characters);
    expect(block.userPresetId).toBe('p-std');
    expect(block.emotion).toBe('normal');
  });

  it('引き継いだ表情に連動するプリセットがあれば、そちらを優先する', () => {
    const block = createScriptBlock('akane', '喜び', characters);
    expect(block.userPresetId).toBe('p-joy');
    expect(block.emotion).toBe('喜び');
  });

  it('一番上のプリセットに連動する表情があれば、表情も合わせる', () => {
    const block = createScriptBlock('linked-first', 'normal', characters);
    expect(block.userPresetId).toBe('p-angry');
    expect(block.emotion).toBe('怒り');
  });
});

describe('speakerChangeUpdates', () => {
  it('話者を切り替えたら、新しい話者の一番上のプリセットを付ける', () => {
    expect(speakerChangeUpdates('akane', characters)).toEqual({ characterId: 'akane', emotion: 'normal', userPresetId: 'p-std' });
  });

  it('一番上のプリセットに連動する表情があれば、表情も合わせる', () => {
    expect(speakerChangeUpdates('linked-first', characters)).toEqual({ characterId: 'linked-first', emotion: '怒り', userPresetId: 'p-angry' });
  });

  it('プリセットを持たない話者・ト書きでは、前の話者のプリセットと表情を外す', () => {
    expect(speakerChangeUpdates('plain', characters)).toEqual({ characterId: 'plain', emotion: 'normal', userPresetId: undefined });
    expect(speakerChangeUpdates('', characters)).toEqual({ characterId: '', emotion: 'normal', userPresetId: undefined });
  });
});
