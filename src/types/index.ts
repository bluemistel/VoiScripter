
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

// Electron API型定義
declare global {
  interface Window {
    electronAPI?: {
      selectDirectory: () => Promise<string | null>;
      saveData: (key: string, data: string) => Promise<void>;
      loadData: (key: string) => Promise<string | null>;
      listDataKeys: () => Promise<string[]>;
      initializeDefaultProject: () => Promise<void>;
    };
  }
} 