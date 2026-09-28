import { Character, Project, ScriptBlock } from '@/types';

/**
 * エクスポートダイアログの「出力プレビュー」と件数表示用。
 * 実際の出力処理（useExportImport）と同じ行の組み立て方を、画面表示用に簡略化して再現する。
 */
export interface ExportPreviewOptions {
  project: Pick<Project, 'scenes'>;
  characters: Character[];
  /** full: 話者,セリフ / serif-only: セリフのみ / clipboard: クリップボード（セリフのみ） */
  content: 'full' | 'serif-only' | 'clipboard';
  includeTogaki: boolean;
  includeUserPreset: boolean;
  /** 指定時はプリセット名（なければ話者名）＋区切り文字＋セリフの形式 */
  presetSeparator?: string;
  /** 指定時はこのシーンだけを対象にする */
  sceneIds?: string[];
  /** 指定時はこのグループのキャラクターのセリフだけを対象にする */
  groups?: string[];
  /** 指定時は選択中のブロックだけを対象にする */
  selectedBlockIds?: string[];
}

export interface ExportPreview {
  /** 先頭から最大 maxLines 行 */
  lines: string[];
  blockCount: number;
  /** 改行を除いた文字数の合計 */
  charCount: number;
}

const encodeCsvRow = (row: string[]) =>
  row
    .map(cell => (cell.includes(',') || cell.includes('\n') || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell))
    .join(',');

const escapeNewlines = (text: string) => text.replace(/\n/g, '\\n');

/** 出力対象のブロック（シーン・選択・グループ・ト書きの絞り込みを反映） */
export const collectExportBlocks = (options: ExportPreviewOptions): ScriptBlock[] => {
  const { project, characters, includeTogaki, sceneIds, groups, selectedBlockIds } = options;
  const scenes = sceneIds ? project.scenes.filter(scene => sceneIds.includes(scene.id)) : project.scenes;
  let blocks = scenes.flatMap(scene => scene.scripts[0]?.blocks || []);

  if (selectedBlockIds && selectedBlockIds.length > 0) {
    blocks = blocks.filter(block => selectedBlockIds.includes(block.id));
  }
  if (groups) {
    const groupCharacterIds = new Set(characters.filter(c => groups.includes(c.group)).map(c => c.id));
    blocks = blocks.filter(block => (block.characterId ? groupCharacterIds.has(block.characterId) : includeTogaki));
  }
  return blocks.filter(block => (includeTogaki ? true : block.characterId));
};

export const buildExportPreview = (options: ExportPreviewOptions, maxLines = 3): ExportPreview => {
  const { characters, content, includeUserPreset, presetSeparator } = options;
  const blocks = collectExportBlocks(options);
  const nameOf = (block: ScriptBlock) => characters.find(c => c.id === block.characterId)?.name || '';
  const presetOf = (block: ScriptBlock) => {
    if (!block.characterId || !block.userPresetId) return '';
    return characters.find(c => c.id === block.characterId)?.userPresets?.find(p => p.id === block.userPresetId)?.name || '';
  };

  const formatLine = (block: ScriptBlock): string => {
    if (presetSeparator !== undefined && content !== 'clipboard') {
      const text = escapeNewlines(block.text);
      if (!block.characterId) return text;
      return `${presetOf(block) || nameOf(block)}${presetSeparator || '＞'}${text}`;
    }
    if (content === 'clipboard') return escapeNewlines(block.text);
    if (content === 'serif-only') return encodeCsvRow([escapeNewlines(block.text)]);
    const row = [block.characterId ? nameOf(block) : 'ト書き', escapeNewlines(block.text)];
    if (includeUserPreset) row.push(presetOf(block));
    return encodeCsvRow(row);
  };

  return {
    lines: blocks.slice(0, maxLines).map(formatLine),
    blockCount: blocks.length,
    charCount: blocks.reduce((sum, block) => sum + block.text.replace(/\n/g, '').length, 0)
  };
};
