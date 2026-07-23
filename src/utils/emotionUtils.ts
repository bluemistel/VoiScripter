import { Character, Emotion, EmotionSetting, DEFAULT_EMOTION } from '@/types';

/** キャラクターの感情ラベル一覧を返す（normal を先頭に固定） */
export const getEmotionKeys = (character: Character): Emotion[] => [
  DEFAULT_EMOTION,
  ...Object.keys(character.emotions).filter(k => k !== DEFAULT_EMOTION)
];

/** 感情設定を取得する。未定義の感情（削除済み等）は normal にフォールバック */
export const getEmotionSetting = (character: Character, emotion: Emotion): EmotionSetting =>
  character.emotions[emotion] ?? character.emotions.normal;

/** ブロック表示用のアイコンURL。感情差分が未設定なら normal のアイコンを使う */
export const getEmotionIconUrl = (character: Character, emotion: Emotion): string => {
  const setting = character.emotions[emotion];
  return (setting?.iconUrl || character.emotions.normal?.iconUrl) ?? '';
};

/** 指定した感情に連動するユーザープリセットID（連動なしは undefined）。表情→プリセットの連動に使う */
export const getPresetIdForEmotion = (character: Character, emotion: Emotion): string | undefined =>
  character.emotions[emotion]?.userPresetId;

/** 指定したプリセットに連動する感情ラベル（連動する差分がなければ normal）。プリセット→表情の連動に使う */
export const getEmotionForPreset = (character: Character, presetId: string | undefined): Emotion => {
  if (!presetId) return DEFAULT_EMOTION;
  const linked = getEmotionKeys(character).find(e => character.emotions[e]?.userPresetId === presetId);
  return linked ?? DEFAULT_EMOTION;
};
