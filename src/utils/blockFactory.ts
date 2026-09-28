import { Character, Emotion, ScriptBlock } from '@/types';
import { getEmotionKeys, getPresetIdForEmotion } from '@/utils/emotionUtils';

export const generateBlockId = (): string =>
  Date.now().toString() + Math.random().toString(36).substr(2, 9);

/**
 * 新しいブロックの既定プリセット。ユーザープリセットを持つキャラクターだけが対象。
 * - 引き継いだ表情に連動するプリセットがあれば、それ（表情とプリセットの組み合わせを崩さない）
 * - なければ一番上のプリセット（そのプリセットに連動する表情があれば表情も合わせる）
 */
const withDefaultPreset = (block: ScriptBlock, character: Character | undefined): ScriptBlock => {
  const presets = character?.userPresets;
  if (!character || !presets || presets.length === 0) return block;

  const linkedPresetId = getPresetIdForEmotion(character, block.emotion);
  if (linkedPresetId && presets.some(p => p.id === linkedPresetId)) {
    return { ...block, userPresetId: linkedPresetId };
  }

  const firstPreset = presets[0];
  const linkedEmotion = getEmotionKeys(character).find(e => character.emotions[e]?.userPresetId === firstPreset.id);
  return { ...block, userPresetId: firstPreset.id, emotion: linkedEmotion ?? block.emotion };
};

/**
 * 空のブロックを作る。characters を渡すと、話者の既定プリセットも設定する。
 * （ト書き＝characterId が空のときはプリセットを付けない）
 */
export const createScriptBlock = (
  characterId: string,
  emotion: Emotion = 'normal',
  characters?: Character[]
): ScriptBlock => {
  const block: ScriptBlock = {
    id: generateBlockId(),
    characterId,
    emotion,
    text: ''
  };
  if (!characterId || !characters) return block;
  return withDefaultPreset(block, characters.find(c => c.id === characterId));
};
