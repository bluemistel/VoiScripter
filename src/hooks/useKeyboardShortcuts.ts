import { useEffect, useRef, useState } from 'react';
import { UndoRedoHook, ProjectHistory } from './useUndoRedo';
import { ScriptBlock } from '@/types';
import { ShortcutMap, defaultShortcuts, matchesShortcut, findConflictingDef } from '@/types/shortcuts';
import { getEmotionForPreset } from '@/utils/emotionUtils';

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
  shortcuts: ShortcutMap = defaultShortcuts,
  // 話者選択ピッカーモード（ONのときブロック追加前に話者を選ばせる）
  speakerPickerEnabled: boolean = false,
  onRequestSpeakerPicker?: (mode: 'append' | 'insertBelow', anchorIndex: number) => void
): KeyboardShortcutsHook => {
  const isRegistered = useRef(false);
  const [undoResult, setUndoResult] = useState<ProjectHistory | null>(null);
  const [redoResult, setRedoResult] = useState<ProjectHistory | null>(null);

  // ピッカー起動コールバックは毎レンダーで同一性が変わるため、
  // リスナーの再登録を避けて ref 経由で最新版を参照する。
  const requestSpeakerPickerRef = useRef(onRequestSpeakerPicker);
  useEffect(() => {
    requestSpeakerPickerRef.current = onRequestSpeakerPicker;
  }, [onRequestSpeakerPicker]);

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

      // ト書きブロックを挿入する共通処理（Ctrl+Alt+B / Ctrl+Shift+Enter で共有）
      const insertTogakiAt = (idx: number) => {
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
      };

      // 直下に新規ブロック追加
      if (matchesShortcut(event, shortcuts.insertBlock)) {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length) {
          const currentBlock = scriptBlocks[activeIdx];
          if (currentBlock) {
            event.preventDefault();
            // ピッカーモード時は話者を選ばせてから挿入する
            if (speakerPickerEnabled && requestSpeakerPickerRef.current) {
              requestSpeakerPickerRef.current('insertBelow', activeIdx);
              return;
            }
            // 新規ブロックは現在ブロックの直後に挿入されるため、話者は「現在ブロック以前」の
            // 直近の話者ブロックから引き継ぐ（末尾ではなく、Alt+↑/↓ で切り替えた現在ブロックの話者）。
            const precedingBlocks = scriptBlocks.slice(0, activeIdx + 1);
            const lastSpeakerBlock = [...precedingBlocks].reverse().find(block => block.characterId);
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
        insertTogakiAt(activeIdx >= 0 ? activeIdx + 1 : scriptBlocks.length);
        return;
      }

      // ト書きブロックを追加（別キー割り当て）。
      // 既存ショートカットと同じキーに割り当てられている場合は既存側を優先し、ここでは発火させない。
      if (matchesShortcut(event, shortcuts.insertTogakiBlockAlt) &&
          !findConflictingDef('insertTogakiBlockAlt', shortcuts)) {
        event.preventDefault();
        insertTogakiAt(activeIdx >= 0 ? activeIdx + 1 : scriptBlocks.length);
        return;
      }

      // 最下段に新規ブロック追加
      if (matchesShortcut(event, shortcuts.addBlock)) {
        event.preventDefault();
        // ピッカーモード時は話者を選ばせてから追加する
        if (speakerPickerEnabled && requestSpeakerPickerRef.current) {
          requestSpeakerPickerRef.current('append', -1);
          return;
        }
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

      // ブロック複製
      if (matchesShortcut(event, shortcuts.duplicateBlock)) {
        event.preventDefault();
        onDuplicateSelectedBlocks();
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
              let nextPresetId: string | undefined;
              if (currentPresetIdx > 0) {
                nextPresetId = presets[currentPresetIdx - 1].id;
              } else if (currentPresetIdx === 0) {
                nextPresetId = undefined;
              } else {
                nextPresetId = presets[presets.length - 1].id;
              }
              // プリセット切替に表情（アイコン・立ち絵）も連動させる
              const nextEmotion = char ? getEmotionForPreset(char, nextPresetId) : 'normal';
              onUpdateBlock(block.id, { userPresetId: nextPresetId, emotion: nextEmotion });
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
              let nextPresetId: string | undefined;
              let shouldUpdate = true;
              if (currentPresetIdx === -1) {
                nextPresetId = presets[0].id;
              } else if (currentPresetIdx < presets.length - 1) {
                nextPresetId = presets[currentPresetIdx + 1].id;
              } else {
                shouldUpdate = false; // 末尾のときは据え置き（従来の挙動を維持）
              }
              if (shouldUpdate) {
                // プリセット切替に表情（アイコン・立ち絵）も連動させる
                const nextEmotion = char ? getEmotionForPreset(char, nextPresetId) : 'normal';
                onUpdateBlock(block.id, { userPresetId: nextPresetId, emotion: nextEmotion });
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
  }, [scriptBlocks, characters, undoRedo, shortcuts, speakerPickerEnabled]); // 依存配列に必要な値を追加

  return {
    registerShortcuts,
    unregisterShortcuts,
    undoResult,
    redoResult
  };
};
