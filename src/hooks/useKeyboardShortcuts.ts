import { useEffect, useRef } from 'react';
import { UndoRedoHook } from './useUndoRedo';

export interface KeyboardShortcutsHook {
  registerShortcuts: () => void;
  unregisterShortcuts: () => void;
}

export const useKeyboardShortcuts = (
  undoRedo: UndoRedoHook,
  onAddBlock: () => void,
  onDeleteSelectedBlocks: () => void,
  onDuplicateSelectedBlocks: () => void,
  onMoveBlockUp: () => void,
  onMoveBlockDown: () => void,
  onSelectAll: () => void,
  onDeselectAll: () => void
): KeyboardShortcutsHook => {
  const isRegistered = useRef(false);

  const handleKeyDown = (event: KeyboardEvent) => {
    // Ctrl+Z: Undo
    if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      if (undoRedo.canUndo) {
        undoRedo.undo();
      }
      return;
    }

    // Ctrl+Y または Ctrl+Shift+Z: Redo
    if ((event.ctrlKey && event.key === 'y') || (event.ctrlKey && event.shiftKey && event.key === 'z')) {
      event.preventDefault();
      if (undoRedo.canRedo) {
        undoRedo.redo();
      }
      return;
    }

    // Ctrl+A: 全選択
    if (event.ctrlKey && event.key === 'a') {
      event.preventDefault();
      onSelectAll();
      return;
    }

    // Escape: 選択解除
    if (event.key === 'Escape') {
      event.preventDefault();
      onDeselectAll();
      return;
    }

    // Enter: ブロック追加
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      onAddBlock();
      return;
    }

    // Delete: 選択ブロック削除
    if (event.key === 'Delete') {
      event.preventDefault();
      onDeleteSelectedBlocks();
      return;
    }

    // Ctrl+D: 選択ブロック複製
    if (event.ctrlKey && event.key === 'd') {
      event.preventDefault();
      onDuplicateSelectedBlocks();
      return;
    }

    // 上矢印: ブロック上移動
    if (event.key === 'ArrowUp' && event.ctrlKey) {
      event.preventDefault();
      onMoveBlockUp();
      return;
    }

    // 下矢印: ブロック下移動
    if (event.key === 'ArrowDown' && event.ctrlKey) {
      event.preventDefault();
      onMoveBlockDown();
      return;
    }
  };

  const registerShortcuts = () => {
    if (isRegistered.current) return;
    
    document.addEventListener('keydown', handleKeyDown);
    isRegistered.current = true;
  };

  const unregisterShortcuts = () => {
    if (!isRegistered.current) return;
    
    document.removeEventListener('keydown', handleKeyDown);
    isRegistered.current = false;
  };

  useEffect(() => {
    registerShortcuts();
    return () => {
      unregisterShortcuts();
    };
  }, []);

  return {
    registerShortcuts,
    unregisterShortcuts
  };
};
