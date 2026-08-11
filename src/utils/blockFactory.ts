import { Emotion, ScriptBlock } from '@/types';

export const generateBlockId = (): string =>
  Date.now().toString() + Math.random().toString(36).substr(2, 9);

export const createScriptBlock = (characterId: string, emotion: Emotion = 'normal'): ScriptBlock => ({
  id: generateBlockId(),
  characterId,
  emotion,
  text: ''
});
