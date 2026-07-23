import { Scene, Character, GroupCredits } from '@/types';

/** 対象シーンのブロックから使用中キャラクターIDを集計する */
export const collectUsedCharacterIds = (scenes: Scene[]): Set<string> => {
  const ids = new Set<string>();
  scenes.forEach(scene => {
    scene.scripts.forEach(script => {
      script.blocks.forEach(block => {
        if (block.characterId) ids.add(block.characterId);
      });
    });
  });
  return ids;
};

/**
 * 動画概要欄用のクレジットテキストを生成する。
 * - 【音声】: 使用キャラのグループのクレジット表記（グループ順・重複除去）
 * - 【立ち絵】: 使用キャラの素材クレジット（制作者・ID・URL。メモは含めない）
 */
export const buildCreditText = (
  usedCharacterIds: Set<string>,
  characters: Character[],
  groups: string[],
  groupCredits: GroupCredits
): string => {
  const usedCharacters = characters.filter(c => usedCharacterIds.has(c.id));

  const usedGroups = new Set(usedCharacters.map(c => c.group));
  const voiceLines = groups
    .filter(group => usedGroups.has(group) && groupCredits[group])
    .map(group => groupCredits[group]);

  const materialLines: string[] = [];
  usedCharacters.forEach(char => {
    const credit = char.materialCredit;
    if (!credit) return;
    const inline = [credit.creator, credit.id ? `(${credit.id})` : '']
      .filter(Boolean)
      .join(' ');
    if (inline) {
      materialLines.push(`${char.name}：${inline}`);
      if (credit.url) materialLines.push(credit.url);
    } else if (credit.url) {
      materialLines.push(`${char.name}：${credit.url}`);
    }
  });

  const sections: string[] = [];
  if (voiceLines.length > 0) {
    sections.push(['【音声】', ...voiceLines].join('\n'));
  }
  if (materialLines.length > 0) {
    sections.push(['【立ち絵】', ...materialLines].join('\n'));
  }
  return sections.join('\n\n');
};
