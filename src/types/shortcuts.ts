export type ShortcutId =
  | 'undo'
  | 'redo'
  | 'openSearch'
  | 'openCSVExport'
  | 'scrollBottom'
  | 'scrollTop'
  | 'insertBlock'
  | 'addBlock'
  | 'insertTogakiBlock'
  | 'deleteBlock'
  | 'moveBlockUp'
  | 'moveBlockDown'
  | 'prevCharacter'
  | 'nextCharacter'
  | 'prevPreset'
  | 'nextPreset';

export interface ShortcutBinding {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string; // lowercase for single chars (e.g. 'f'), named for special keys (e.g. 'ArrowUp', 'Enter')
}

export interface ShortcutDef {
  id: ShortcutId;
  label: string;
  group: 'global' | 'editor';
  defaultBinding: ShortcutBinding;
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  { id: 'undo',              label: '元に戻す',                   group: 'global', defaultBinding: { ctrl: true,  shift: false, alt: false, key: 'z' } },
  { id: 'redo',              label: 'やり直し',                   group: 'global', defaultBinding: { ctrl: true,  shift: false, alt: false, key: 'y' } },
  { id: 'openSearch',        label: '検索ダイアログを開く',        group: 'global', defaultBinding: { ctrl: true,  shift: false, alt: false, key: 'f' } },
  { id: 'openCSVExport',     label: 'CSVエクスポートダイアログを開く', group: 'global', defaultBinding: { ctrl: true,  shift: false, alt: false, key: 'm' } },
  { id: 'scrollBottom',      label: '最下段へ移動',               group: 'global', defaultBinding: { ctrl: true,  shift: false, alt: false, key: ',' } },
  { id: 'scrollTop',         label: '最上段へ移動',               group: 'global', defaultBinding: { ctrl: true,  shift: false, alt: true,  key: ',' } },
  { id: 'insertBlock',       label: '直下に新規ブロック追加',      group: 'editor', defaultBinding: { ctrl: true,  shift: false, alt: false, key: 'Enter' } },
  { id: 'addBlock',          label: '最下段に新規ブロック追加',    group: 'editor', defaultBinding: { ctrl: true,  shift: false, alt: false, key: 'b' } },
  { id: 'insertTogakiBlock', label: 'ト書きブロックを追加',        group: 'editor', defaultBinding: { ctrl: true,  shift: false, alt: true,  key: 'b' } },
  { id: 'deleteBlock',       label: '選択ブロック削除',            group: 'editor', defaultBinding: { ctrl: false, shift: false, alt: true,  key: 'b' } },
  { id: 'moveBlockUp',       label: 'ブロックを上に移動',          group: 'editor', defaultBinding: { ctrl: true,  shift: false, alt: false, key: 'ArrowUp' } },
  { id: 'moveBlockDown',     label: 'ブロックを下に移動',          group: 'editor', defaultBinding: { ctrl: true,  shift: false, alt: false, key: 'ArrowDown' } },
  { id: 'prevCharacter',     label: 'キャラクターを前に切り替え',  group: 'editor', defaultBinding: { ctrl: false, shift: false, alt: true,  key: 'ArrowUp' } },
  { id: 'nextCharacter',     label: 'キャラクターを次に切り替え',  group: 'editor', defaultBinding: { ctrl: false, shift: false, alt: true,  key: 'ArrowDown' } },
  { id: 'prevPreset',        label: '前のプリセットを選択',        group: 'editor', defaultBinding: { ctrl: false, shift: true,  alt: true,  key: 'ArrowUp' } },
  { id: 'nextPreset',        label: '次のプリセットを選択',        group: 'editor', defaultBinding: { ctrl: false, shift: true,  alt: true,  key: 'ArrowDown' } },
];

export type ShortcutMap = Record<ShortcutId, ShortcutBinding>;

export const defaultShortcuts: ShortcutMap = Object.fromEntries(
  SHORTCUT_DEFS.map(def => [def.id, { ...def.defaultBinding }])
) as ShortcutMap;

const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: 'Enter',
  ' ': 'Space',
  Escape: 'Esc',
  Backspace: 'BS',
  Delete: 'Del',
  Tab: 'Tab',
};

export const formatBinding = (binding: ShortcutBinding): string => {
  const parts: string[] = [];
  if (binding.ctrl)  parts.push('Ctrl');
  if (binding.shift) parts.push('Shift');
  if (binding.alt)   parts.push('Alt');
  parts.push(KEY_LABELS[binding.key] ?? binding.key.toUpperCase());
  return parts.join('+');
};

const normalizeKey = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);

export const matchesShortcut = (event: KeyboardEvent, binding: ShortcutBinding): boolean =>
  event.ctrlKey  === binding.ctrl  &&
  event.shiftKey === binding.shift &&
  event.altKey   === binding.alt   &&
  normalizeKey(event.key) === normalizeKey(binding.key);

export const bindingsEqual = (a: ShortcutBinding, b: ShortcutBinding): boolean =>
  a.ctrl  === b.ctrl  &&
  a.shift === b.shift &&
  a.alt   === b.alt   &&
  normalizeKey(a.key) === normalizeKey(b.key);
