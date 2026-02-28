import { Character } from '@/types';

export interface LightweightCharacter {
  id: string;
  name: string;
  group: string;
  backgroundColor?: string;
  disabledProjects?: string[];
}

export interface LightweightCharacterSyncPayload {
  schemaVersion: number;
  updatedAt: string;
  characters: LightweightCharacter[];
  groups: string[];
}

export const CHARACTER_SYNC_KEY_SUFFIX = '__characters_v1';

export const buildCharacterSyncPayload = (
  characters: Character[],
  groups: string[]
): LightweightCharacterSyncPayload => {
  const lightweightCharacters: LightweightCharacter[] = characters
    .filter(char => !!char.id)
    .map(char => ({
      id: char.id,
      name: char.name,
      group: char.group || 'なし',
      backgroundColor: char.backgroundColor,
      disabledProjects: char.disabledProjects || []
    }));

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    characters: lightweightCharacters,
    groups
  };
};

export const restoreCharactersFromSyncPayload = (
  payload: LightweightCharacterSyncPayload,
  existingCharacters: Character[],
  existingGroups: string[]
): { characters: Character[]; groups: string[] } => {
  const existingById = new Map(existingCharacters.map(char => [char.id, char]));

  const restoredCharacters: Character[] = payload.characters.map(light => {
    const existing = existingById.get(light.id);
    return {
      id: light.id,
      name: light.name,
      group: light.group || 'なし',
      backgroundColor: light.backgroundColor || '#e5e7eb',
      disabledProjects: light.disabledProjects || [],
      emotions: existing?.emotions || { normal: { iconUrl: '' } }
    };
  });

  // Keep local special/system characters (e.g. id === '') that are not part of sync payload.
  const localOnlyCharacters = existingCharacters.filter(char => !char.id);

  const mergedGroups = Array.from(
    new Set([...(existingGroups || []), ...(payload.groups || []), ...restoredCharacters.map(c => c.group)])
  ).filter(group => group && group !== 'なし');

  return {
    characters: [...restoredCharacters, ...localOnlyCharacters],
    groups: mergedGroups
  };
};
