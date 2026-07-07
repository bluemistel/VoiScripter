import { Character } from '@/types';

/**
 * チャット表示（チャットテーマ・チャットビュー）でのキャラクターの
 * 左右振り分けマップを作る。明示設定（chatSide）を優先し、
 * 未設定はキャラクターの並び順で交互（偶数=左）に自動割り当て。
 */
export const buildChatSideMap = (characters: Character[]): Map<string, 'left' | 'right'> => {
  const map = new Map<string, 'left' | 'right'>();
  let autoIndex = 0;
  characters.forEach(char => {
    if (!char.id) return;
    if (char.chatSide === 'left' || char.chatSide === 'right') {
      map.set(char.id, char.chatSide);
    } else {
      map.set(char.id, autoIndex % 2 === 0 ? 'left' : 'right');
      autoIndex++;
    }
  });
  return map;
};
