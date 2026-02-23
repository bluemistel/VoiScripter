import { useEffect, useRef, useState } from 'react';
import { UndoRedoHook, ProjectHistory } from './useUndoRedo';
import { ScriptBlock } from '@/types';

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
  setIsCtrlEnterBlock?: (isCtrlEnter: boolean) => void
): KeyboardShortcutsHook => {
  const isRegistered = useRef(false);
  const [undoResult, setUndoResult] = useState<ProjectHistory | null>(null);
  const [redoResult, setRedoResult] = useState<ProjectHistory | null>(null);

  // ブロックがウィンドウの表示領域に収まるようにスクロール位置を調整する関数
  const ensureBlockVisible = (targetRef: HTMLTextAreaElement, index: number) => {
    if (!targetRef) return;
    
    const rect = targetRef.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const headerHeight = 64;
    
    // ブロックが画面外にある場合のみスクロール
    if (rect.bottom > windowHeight) {
      // 下方向にスクロールが必要な場合
      const scrollOffset = rect.bottom - windowHeight + 20; // 20pxのマージン
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
    // グローバルショートカット（常に動作）
    // Ctrl+F: 検索ダイアログを開く
    if (event.ctrlKey && event.key === 'f' && onOpenSearch) {
      event.preventDefault();
      onOpenSearch();
      return;
    }

    // Ctrl+M: CSVエクスポートダイアログを開く
    if (event.ctrlKey && event.key === 'm' && onOpenCSVExport) {
      event.preventDefault();
      onOpenCSVExport();
      return;
    }

    // Ctrl+, : 最下段へ
    if (event.ctrlKey && event.key === ',' && onScrollBottom) {
      event.preventDefault();
      onScrollBottom();
      return;
    }

    // Ctrl+Alt+, : 最上段へ
    if (event.ctrlKey && event.altKey && event.key === ',' && onScrollTop) {
      event.preventDefault();
      onScrollTop();
      return;
    }

    // Ctrl+Z: Undo
    if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      if (undoRedo.canUndo) {
        const result = undoRedo.undo();
        setUndoResult(result);
        
        // アンドゥ操作後にisUndoRedoOperationをリセット
        setTimeout(() => {
          undoRedo.isUndoRedoOperation.current = false;
          
          // アンドゥ結果をクリア
          setUndoResult(null);
        }, 50);
      }
      return;
    }

    // Ctrl+Y または Ctrl+Shift+Z: Redo
    if ((event.ctrlKey && event.key === 'y') || (event.ctrlKey && event.shiftKey && event.key === 'z')) {
      event.preventDefault();
      if (undoRedo.canRedo) {
        const result = undoRedo.redo();
        setRedoResult(result);
        
        // リドゥ操作後にisUndoRedoOperationをリセット
        setTimeout(() => {
          undoRedo.isUndoRedoOperation.current = false;
          
          // リドゥ結果をクリア
          setRedoResult(null);
        }, 50);
      }
      return;
    }

    // ScriptEditor専用のショートカット（条件付き）
    if (scriptBlocks && onInsertBlock && onDeleteBlock && onUpdateBlock && onMoveBlock && characters) {
      // フォーカス中のtextareaを特定（より確実な方法）
      let activeIdx = -1;
      if (textareaRefs?.current) {
        // まず、document.activeElementとの直接比較
        activeIdx = textareaRefs.current.findIndex(ref => ref === document.activeElement);
        
        // 見つからない場合は、フォーカスされている要素がtextareaかどうかもチェック
        if (activeIdx === -1 && document.activeElement instanceof HTMLTextAreaElement) {
          // textareaRefsの配列内で、同じ要素を探す
          activeIdx = textareaRefs.current.findIndex(ref => ref && ref === document.activeElement);
        }
        
        // まだ見つからない場合は、フォーカスされている要素の親要素をチェック
        if (activeIdx === -1 && document.activeElement) {
          const activeElement = document.activeElement as HTMLElement;
          const textareaElement = activeElement.closest('textarea');
          if (textareaElement) {
            activeIdx = textareaRefs.current.findIndex(ref => ref === textareaElement);
          }
        }
      }
      
      // Ctrl+Enter: 直後にキャラクター引き継ぎ新規ブロック
      if (event.ctrlKey && event.key === 'Enter') {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length) {
          const currentBlock = scriptBlocks[activeIdx];
          if (currentBlock) {
            event.preventDefault();
            const newBlock: ScriptBlock = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              characterId: currentBlock.characterId,
              emotion: currentBlock.emotion,
              text: ''
            };
            onInsertBlock(newBlock, activeIdx + 1);
            
            // Ctrl+Enterで追加されたブロックであることをマーク
            if (setIsCtrlEnterBlock) {
              setIsCtrlEnterBlock(true);
            }
            
            // 追加されたブロックに直接フォーカスとスクロール補正を適用
            setTimeout(() => {
              const newBlockRef = textareaRefs?.current?.[activeIdx + 1];
              if (newBlockRef) {
                // フォーカスを当てる
                newBlockRef.focus();
                
                // スクロール補正を適用
                ensureBlockVisible(newBlockRef, activeIdx + 1);
              }
            }, 100);
            return;
          }
        }
      }

      // Ctrl+Alt+B: 新規ト書き（Ctrl+Bより先にチェック）
      if (event.ctrlKey && event.altKey && event.key === 'b') {
        event.preventDefault();
        const idx = activeIdx >= 0 ? activeIdx + 1 : scriptBlocks.length;
        const newBlock: ScriptBlock = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          characterId: '',
          emotion: 'normal',
          text: ''
        };
        onInsertBlock(newBlock, idx);
          // Ctrl+Enterで追加されたブロックであることをマーク
          if (setIsCtrlEnterBlock) {
            setIsCtrlEnterBlock(true);
          }
          
          // 追加されたブロックに直接フォーカスとスクロール補正を適用
          setTimeout(() => {
            const newBlockRef = textareaRefs?.current?.[activeIdx + 1];
            if (newBlockRef) {
              // フォーカスを当てる
              newBlockRef.focus();
              
              // スクロール補正を適用
              ensureBlockVisible(newBlockRef, activeIdx + 1);
            }
          }, 100);
          return;
      }

      // Ctrl+B: 新規ブロック（最下段に追加）
      if (event.ctrlKey && !event.altKey && event.key === 'b') {
        event.preventDefault();
        onAddBlock();
        
        // 追加されたブロックに直接フォーカスとスクロール補正を適用
        setTimeout(() => {
          const lastIndex = scriptBlocks.length; // 新しく追加されたブロックのインデックス
          const newBlockRef = textareaRefs?.current?.[lastIndex];
          if (newBlockRef) {
            // フォーカスを当てる
            newBlockRef.focus();
            
            // スクロール補正を適用
            ensureBlockVisible(newBlockRef, lastIndex);
          }
        }, 100);
        return;
      }

      // Alt+B: 選択中のブロックを削除
      if (!event.ctrlKey && event.altKey && event.key === 'b') {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length) {
          const currentBlock = scriptBlocks[activeIdx];
          if (currentBlock) {
            event.preventDefault();
            onDeleteBlock(currentBlock.id);
            
            // 削除後のフォーカス処理
            setTimeout(() => {
              // 削除されたブロックの位置を考慮してフォーカスを設定
              let focusIndex = activeIdx;
              
              // 最上段の場合はそのまま、それ以外は一つ上のブロックにフォーカス
              if (activeIdx > 0) {
                focusIndex = activeIdx - 1;
              }
              
              const focusRef = textareaRefs?.current?.[focusIndex];
              if (focusRef) {
                focusRef.focus();
              }
            }, 50);
            return;
          }
        }
      }

      // Alt+↑: 上のキャラクターを選択（ト書き以外、現在のプロジェクトで有効なキャラクターのみ）
      if (!event.ctrlKey && event.altKey && event.key === 'ArrowUp') {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length) {
          const block = scriptBlocks[activeIdx];
          if (block && block.characterId) {
            // 現在のプロジェクトで有効なキャラクターのみをフィルタリング
            const validCharacters = characters.filter(c => 
              c.id === '' || 
              !currentProjectId || 
              !c.disabledProjects || 
              !c.disabledProjects.includes(currentProjectId)
            );
            
            const charIdx = validCharacters.findIndex(c => c.id === block.characterId);
            if (charIdx > 0) {
              event.preventDefault();
              onUpdateBlock(block.id, { characterId: validCharacters[charIdx - 1].id });
            }
          }
        }
      }

      // Alt+↓: 下のキャラクターを選択（ト書き以外、現在のプロジェクトで有効なキャラクターのみ）
      if (!event.ctrlKey && event.altKey && event.key === 'ArrowDown') {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length) {
          const block = scriptBlocks[activeIdx];
          if (block && block.characterId) {
            // 現在のプロジェクトで有効なキャラクターのみをフィルタリング
            const validCharacters = characters.filter(c => 
              c.id === '' || 
              !currentProjectId || 
              !c.disabledProjects || 
              !c.disabledProjects.includes(currentProjectId)
            );
            
            const charIdx = validCharacters.findIndex(c => c.id === block.characterId);
            if (charIdx >= 0 && charIdx < validCharacters.length - 1) {
              event.preventDefault();
              onUpdateBlock(block.id, { characterId: validCharacters[charIdx + 1].id });
            }
          }
        }
      }

      // Ctrl+↑: ブロック上移動（ScriptEditor専用）
      if (event.ctrlKey && event.key === 'ArrowUp') {
        if (activeIdx > 0) {
          event.preventDefault();
          onMoveBlock(activeIdx, activeIdx - 1);
          
          // 移動後のスクロール位置補正
          setTimeout(() => {
            const targetRef = textareaRefs?.current?.[activeIdx - 1];
            if (targetRef) {
              ensureBlockVisible(targetRef, activeIdx - 1);
            }
          }, 50);
          return;
        }
      }

      // Ctrl+↓: ブロック下移動（ScriptEditor専用）
      if (event.ctrlKey && event.key === 'ArrowDown') {
        if (activeIdx >= 0 && activeIdx < scriptBlocks.length - 1) {
          event.preventDefault();
          onMoveBlock(activeIdx, activeIdx + 1);
          
          // 移動後のスクロール位置補正
          setTimeout(() => {
            const targetRef = textareaRefs?.current?.[activeIdx + 1];
            if (targetRef) {
              ensureBlockVisible(targetRef, activeIdx + 1);
            }
          }, 50);
          return;
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
  }, [scriptBlocks, characters, undoRedo]); // 依存配列に必要な値を追加

  return {
    registerShortcuts,
    unregisterShortcuts,
    undoResult,
    redoResult
  };
};
