
export type Emotion = 'happy' | 'sad' | 'angry' | 'normal' | 'surprised';

export interface Character {
  id: string;
  name: string;
  emotions: {
    [key in Emotion]: {
      iconUrl: string;
    };
  };
}

export interface ScriptBlock {
  id: string;
  characterId: string;
  emotion: Emotion;
  text: string;
}

export interface Script {
  id: string;
  title: string;
  characters: Character[];
  blocks: ScriptBlock[];
} 