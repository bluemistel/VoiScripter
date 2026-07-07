/**
 * クレジット出力ユーティリティのテスト
 */

import { describe, it, expect } from 'vitest';
import { collectUsedCharacterIds, buildCreditText } from '../utils/creditUtils';
import { Scene, Character, GroupCredits } from '../types';

const makeCharacter = (overrides: Partial<Character> & { id: string; name: string }): Character => ({
  group: 'なし',
  emotions: { normal: { iconUrl: '' } },
  ...overrides
});

const makeScene = (id: string, blocks: { characterId: string; text: string }[]): Scene => ({
  id,
  name: `シーン${id}`,
  scripts: [
    {
      id: `script-${id}`,
      title: '',
      blocks: blocks.map((b, i) => ({
        id: `${id}-block-${i}`,
        characterId: b.characterId,
        emotion: 'normal' as const,
        text: b.text
      })),
      characters: []
    }
  ]
});

describe('collectUsedCharacterIds', () => {
  it('should collect unique character ids across scenes', () => {
    const scenes = [
      makeScene('1', [
        { characterId: 'zunda', text: 'こんにちは' },
        { characterId: 'akane', text: 'やあ' },
        { characterId: 'zunda', text: 'また会ったのだ' }
      ]),
      makeScene('2', [{ characterId: 'metan', text: 'どうも' }])
    ];
    const ids = collectUsedCharacterIds(scenes);
    expect(ids).toEqual(new Set(['zunda', 'akane', 'metan']));
  });

  it('should skip togaki blocks (empty characterId)', () => {
    const scenes = [makeScene('1', [{ characterId: '', text: 'ト書きです' }])];
    expect(collectUsedCharacterIds(scenes).size).toBe(0);
  });
});

describe('buildCreditText', () => {
  const characters: Character[] = [
    makeCharacter({
      id: 'zunda',
      name: 'ずんだもん',
      group: 'VOICEVOX',
      materialCredit: { creator: '○○様', id: 'im00000000', url: 'https://example.com/im00000000', memo: '内部メモ' }
    }),
    makeCharacter({
      id: 'metan',
      name: '四国めたん',
      group: 'VOICEVOX'
    }),
    makeCharacter({
      id: 'akane',
      name: '琴葉茜',
      group: 'A.I.VOICE',
      materialCredit: { url: 'https://example.com/akane' }
    }),
    makeCharacter({ id: 'unused', name: '未使用キャラ', group: 'CeVIO' })
  ];
  const groups = ['VOICEVOX', 'A.I.VOICE', 'CeVIO'];
  const groupCredits: GroupCredits = {
    VOICEVOX: 'VOICEVOX:ずんだもん・四国めたん',
    'A.I.VOICE': 'A.I.VOICE 琴葉 茜',
    CeVIO: 'CeVIO AI さとうささら'
  };

  it('should include voice credits only for used groups (in group order, no duplicates)', () => {
    const text = buildCreditText(new Set(['zunda', 'metan', 'akane']), characters, groups, groupCredits);
    expect(text).toContain('【音声】');
    expect(text).toContain('VOICEVOX:ずんだもん・四国めたん');
    expect(text).toContain('A.I.VOICE 琴葉 茜');
    expect(text).not.toContain('CeVIO AI さとうささら'); // 未使用グループは含めない
    // 重複しない（VOICEVOX キャラ2人でも1行）
    expect(text.match(/VOICEVOX:ずんだもん・四国めたん/g)?.length).toBe(1);
  });

  it('should include material credits with creator, id and url but not memo', () => {
    const text = buildCreditText(new Set(['zunda']), characters, groups, groupCredits);
    expect(text).toContain('【立ち絵】');
    expect(text).toContain('ずんだもん：○○様 (im00000000)');
    expect(text).toContain('https://example.com/im00000000');
    expect(text).not.toContain('内部メモ'); // メモは出力しない
  });

  it('should output url-only material credit inline', () => {
    const text = buildCreditText(new Set(['akane']), characters, groups, groupCredits);
    expect(text).toContain('琴葉茜：https://example.com/akane');
  });

  it('should omit material section when used characters have no credits', () => {
    const text = buildCreditText(new Set(['metan']), characters, groups, groupCredits);
    expect(text).toContain('【音声】');
    expect(text).not.toContain('【立ち絵】');
  });

  it('should return empty string when nothing is set', () => {
    const text = buildCreditText(new Set(['metan']), characters, groups, {});
    expect(text).toBe('');
  });
});
