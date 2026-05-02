import { useEffect, useRef, useState } from 'react';
import { UndoRedoHook, ProjectHistory } from './useUndoRedo';
import { ScriptBlock } from '@/types';
import { ShortcutMap, defaultShortcuts, matchesShortcut } from '@/types/shortcuts';

export interface KeyboardShortcutsHook {
  registerShortcuts: () => void;
  unregisterShortcuts: () => void;
  setManualFocusTarget?: (target: { index: number; id: string } | null) => void;
  setIsCtrlEnterBlock?: (isCtrlEnter: boolean) => void;
  undoResult?: ProjectHistory | null;
  redoResult?: ProjectHistory | null;
}

export const useKeyboardShortcuts = (
  undoRedo: UndoRedoHook,
  onAddBlock: () => void,
  onDeleteSelectedBlocks: () => void,
  onDuplicateSelectedBlocks: () => void,
  onMoveBlockUp: () => void,
  onMoveBlockDown: () => void,
  onSelectAll: () => void,
  onDeselectAll: () => void,
  // ScriptEditor用の追加パラメータ
  onInsertBlock?: (block: ScriptBlock, index: number) => void,
  onDeleteBlock?: (blockId: string) => void,
  onUpdateBlock?: (blockId: string, updates: Partial<ScriptBlock>) => void,
  onMoveBlock?: (fromIndex: number, toIndex: number) => void,
  onOpenCSVExport?: () => void,
  onScrollBottom?: () => void,
  onScrollTop?: () => void,
  onOpenSearch?: () => void,
  // ScriptEditorの状態
  scriptBlocks?: ScriptBlock[],
  characters?: any[],
  activeBlockIndex?: number,
  currentProjectId?: string,
  textareaRefs?: React.MutableRefObject<(HTMLTextAreaElement | null)[]>,
  setManualFocusTarget?: (target: { index: number; id: string } | null) => void,
  setIsCtrlEnterBlock?: (isCtrlEnter: boolean) => void,
  shortcuts: ShortcutMap = defaultShortcuts
): KeyboardShortcutsHook => {
  const isRegistered = useRef(false);
  const [undoResult, setUndoResult] = useState<ProjectHistory | null>(null);
  const [redoResult, setRedoResult] = useState<ProjectHistory | null>(null);

  // ブロックがウィンドウの表示領域に収まるようにスクロール位置を調整する関数
  const ensureBlockVisible = (targetRef: HTMLTextAreaElement, index: number) => {
    if (!targetRef) return;
    
    const rect = targetRef.getBoundingClientRect();
    const toolbarElement = document.querySelector('[data-floating-toolbar="true"]') as HTMLElement | null;
    const toolbarTop = toolbarElement?.getBoundingClientRect().top ?? window.innerHeight;
    const bottomBoundary = Math.min(window.innerHeight, toolbarTop) - 8;
    const headerHeight = 64;
    
    // ブロックが画面外にある場合のみスクロール
    if (rect.bottom > bottomBoundary) {
      // 下方向にスクロールが必要な場合
      const scrollOffset = rect.bottom - bottomBoundary + 20; // 20pxのマージン
      window.scrollBy({
        top: scrollOffset,
        behavior: 'smooth'
      });
    } else if (rect.top < headerHeight) {
      // 上方向にスクロールが必要な場合（ヘッダーの高さを考慮）
      const scrollOffset = rect.top - headerHeight - 20; // ヘッダーの高さ + 20pxのマージン
      window.scrollBy({
        top: scrollOffset,
        behavior: 'smooth'
      });
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229) {
      return;
    }

    // ===== グローバルショートカット（常に動作） =====

    if (matchesShortcut(event, shortcuts.openSearch) && onOpenSearch) {
      event.preventDefault();
      onOpenSearch();
      return;
    }

    if (matchesShortcut(event, shortcuts.openCSVExport) && onOpenCSVExport) {
      event.preventDefault();
      onOpenCSVExport();
      return;
    }

    // scrollTop は scrollBottom より先にチェック（より具体的なバインディングが優先）
    if (matchesShortcut(event, shortcuts.scrollTop) && onScrollTop) {
      event.preventDefault();
      onScrollTop();
      return;
    }

    if (matchesShortcut(event, shortcuts.scrollBottom) && onScrollBottom) {
      event.preventDefault();
      onScrollBottom();
      return;
    }

    if (matchesShortcut(event, shortcuts.undo)) {
      event.preventDefault();
      if (undoRedo.canUndo) {
        const result = undoRedo.undo();
        setUndoResult(result);
        setTimeout(() => {
          undoRedo.isUndoRedoOperation.current = false;
          setUndoResult(null);
        }, 50);
      }
      return;
    }

    if (matchesShortcut(event, shortcuts.redo)) {
      event.preventDefault();
      if (undoRedo.canRedo) {
        const result = undoRedo.redo();
        setRedoResult(result);
        setTimeout(() => {
          undoRedo.isUndoRedoOperation.current = false;
          setRedoResult(null);
        }, 50);
      }
      return;
    }

    // ===== エディター専用のショートカット（条件付き） =====
    if (scriptBlocks && onInsertBlock && onDeleteBlock && onUpdateBlock && onMoveBlock && characters) {
      // フォーカス中のtextareaを特定
      let activeIdx = -1;
      if (textareaRefs?.current) {
        activeIdx = textareaRefs.current.findIndex(ref => ref === document.activeElement);
        if (activeIdx === -1 && document.activeElement instanceof HTMLTextAreaElement) {
          activeIdx = textareaRefs.current.findIndex(ref => ref && ref === document.activeElement);
        }
        if (activeIdx === -1 && document.activeElement) {
          const textareaElement = (document.activeElement as HTMLElement).closest('textarea');
          if (textareaElement) {
            activeIdx = textareaRefs.current.findIndex(ref => ref === textareaElement);
          }
        }
      }

      // 直下に新規ブロック追加
      if (matchesShortcut(event, shortcuts.insertBlock)) {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length) {
          const currentBlock = scriptBlocks[activeIdx];
          if (currentBlock) {
            event.preventDefault();
            const lastSpeakerBlock = [...scriptBlocks].reverse().find(block => block.characterId);
            const fallbackCharacterId = characters.find(c => c.id)?.id || '';
            const newBlock: ScriptBlock = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              characterId: lastSpeakerBlock?.characterId || fallbackCharacterId,
              emotion: lastSpeakerBlock?.emotion || 'normal',
              text: ''
            };
            onInsertBlock(newBlock, activeIdx + 1);
            if (setIsCtrlEnterBlock) setIsCtrlEnterBlock(true);
            setTimeout(() => {
              const newBlockRef = textareaRefs?.current?.[activeIdx + 1];
              if (newBlockRef) {
                newBlockRef.focus();
                ensureBlockVisible(newBlockRef, activeIdx + 1);
              }
            }, 100);
            return;
          }
        }
      }

      // ト書きブロックを追加（addBlock より先にチェック）
      if (matchesShortcut(event, shortcuts.insertTogakiBlock)) {
        event.preventDefault();
        const idx = activeIdx >= 0 ? activeIdx + 1 : scriptBlocks.length;
        const newBlock: ScriptBlock = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          characterId: '',
          emotion: 'normal',
          text: ''
        };
        onInsertBlock(newBlock, idx);
        if (setIsCtrlEnterBlock) setIsCtrlEnterBlock(true);
        setTimeout(() => {
          const newBlockRef = textareaRefs?.current?.[idx];
          if (newBlockRef) {
            newBlockRef.focus();
            ensureBlockVisible(newBlockRef, idx);
          }
        }, 100);
        return;
      }

      // 最下段に新規ブロック追加
      if (matchesShortcut(event, shortcuts.addBlock)) {
        event.preventDefault();
        onAddBlock();
        setTimeout(() => {
          const lastIndex = scriptBlocks.length;
          const newBlockRef = textareaRefs?.current?.[lastIndex];
          if (newBlockRef) {
            newBlockRef.focus();
            ensureBlockVisible(newBlockRef, lastIndex);
          }
        }, 100);
        return;
      }

      // 選択ブロック削除
      if (matchesShortcut(event, shortcuts.deleteBlock)) {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length) {
          const currentBlock = scriptBlocks[activeIdx];
          if (currentBlock) {
            event.preventDefault();
            onDeleteBlock(currentBlock.id);
            setTimeout(() => {
              const focusIndex = activeIdx > 0 ? activeIdx - 1 : 0;
              textareaRefs?.current?.[focusIndex]?.focus();
            }, 50);
            return;
          }
        }
      }

      // ブロックを上に移動（moveBlockUp は prevCharacter/prevPreset より先にチェック）
      if (matchesShortcut(event, shortcuts.moveBlockUp)) {
        if (activeIdx > 0) {
          event.preventDefault();
          onMoveBlock(activeIdx, activeIdx - 1);
          setTimeout(() => {
            const targetRef = textareaRefs?.current?.[activeIdx - 1];
            if (targetRef) ensureBlockVisible(targetRef, activeIdx - 1);
          }, 50);
          return;
        }
      }

      // ブロックを下に移動
      if (matchesShortcut(event, shortcuts.moveBlockDown)) {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length - 1) {
          event.preventDefault();
          onMoveBlock(activeIdx, activeIdx + 1);
          setTimeout(() => {
            const targetRef = textareaRefs?.current?.[activeIdx + 1];
            if (targetRef) ensureBlockVisible(targetRef, activeIdx + 1);
          }, 50);
          return;
        }
      }

      // キャラクターを前に切り替え
      if (matchesShortcut(event, shortcuts.prevCharacter)) {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length) {
          const block = scriptBlocks[activeIdx];
          if (block && block.characterId) {
            const validCharacters = characters.filter(c =>
              c.id === '' || !currentProjectId || !c.disabledProjects || !c.disabledProjects.includes(currentProjectId)
            );
            const charIdx = validCharacters.findIndex(c => c.id === block.characterId);
            if (charIdx > 0) {
              event.preventDefault();
              onUpdateBlock(block.id, { characterId: validCharacters[charIdx - 1].id });
            }
          }
        }
      }

      // キャラクターを次に切り替え
      if (matchesShortcut(event, shortcuts.nextCharacter)) {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length) {
          const block = scriptBlocks[activeIdx];
          if (block && block.characterId) {
            const validCharacters = characters.filter(c =>
              c.id === '' || !currentProjectId || !c.disabledProjects || !c.disabledProjects.includes(currentProjectId)
            );
            const charIdx = validCharacters.findIndex(c => c.id === block.characterId);
            if (charIdx >= 0 && charIdx < validCharacters.length - 1) {
              event.preventDefault();
              onUpdateBlock(block.id, { characterId: validCharacters[charIdx + 1].id });
            }
          }
        }
      }

      // 前のユーザープリセットを選択
      if (matchesShortcut(event, shortcuts.prevPreset)) {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length) {
          const block = scriptBlocks[activeIdx];
          if (block && block.characterId) {
            const char = characters.find(c => c.id === block.characterId);
            const presets = char?.userPresets || [];
            if (presets.length > 0) {
              event.preventDefault();
              const currentPresetIdx = presets.findIndex((p: { id: string }) => p.id === block.userPresetId);
              if (currentPresetIdx > 0) {
                onUpdateBlock(block.id, { userPresetId: presets[currentPresetIdx - 1].id });
              } else if (currentPresetIdx === 0) {
                onUpdateBlock(block.id, { userPresetId: undefined });
              } else {
                onUpdateBlock(block.id, { userPresetId: presets[presets.length - 1].id });
              }
            }
          }
        }
      }

      // 次のユーザープリセットを選択
      if (matchesShortcut(event, shortcuts.nextPreset)) {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length) {
          const block = scriptBlocks[activeIdx];
          if (block && block.characterId) {
            const char = characters.find(c => c.id === block.characterId);
            const presets = char?.userPresets || [];
            if (presets.length > 0) {
              event.preventDefault();
              const currentPresetIdx = presets.findIndex((p: { id: string }) => p.id === block.userPresetId);
              if (currentPresetIdx === -1) {
                onUpdateBlock(block.id, { userPresetId: presets[0].id });
              } else if (currentPresetIdx < presets.length - 1) {
                onUpdateBlock(block.id, { userPresetId: presets[currentPresetIdx + 1].id });
              }
            }
          }
        }
      }
    }
  };

  const registerShortcuts = () => {
    if (typeof window === 'undefined') return;
    if (isRegistered.current) return;
    
    document.addEventListener('keydown', handleKeyDown);
    isRegistered.current = true;
  };

  const unregisterShortcuts = () => {
    if (typeof window === 'undefined') return;
    if (!isRegistered.current) return;
    
    document.removeEventListener('keydown', handleKeyDown);
    isRegistered.current = false;
  };

  useEffect(() => {
    registerShortcuts();
    return () => {
      unregisterShortcuts();
    };
  }, [scriptBlocks, characters, undoRedo, shortcuts]); // 依存配列に必要な値を追加

  return {
    registerShortcuts,
    unregisterShortcuts,
    undoResult,
    redoResult
  };
};
