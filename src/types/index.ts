
export type Emotion = 'normal';

export interface Character {
  id: string;
  name: string;
  emotions: {
    normal: {
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