'use client';

import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Script, ScriptBlock, Character, Emotion } from '@/types';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  Bars3Icon,
  PlusIcon
} from '@heroicons/react/24/outline';

interface ScriptEditorProps {
  script: Script;
  onUpdateBlock: (blockId: string, updates: Partial<ScriptBlock>) => void;
  onAddBlock: () => void;
  onDeleteBlock: (blockId: string) => void;
  onInsertBlock: (block: ScriptBlock, index: number) => void;
  onMoveBlock: (fromIndex: number, toIndex: number) => void;
  selectedBlockIds: string[];
  onSelectedBlockIdsChange: (selectedBlockIds: string[]) => void;
  onOpenCSVExport: () => void;
  characters: Character[];
  onDuplicateBlock: (blockId: string) => void;
  onSelectAllBlocks: () => void;
  onDeselectAllBlocks: () => void;
  onToggleBlockSelection: (blockId: string) => void;
  textareaRefs?: React.MutableRefObject<(HTMLTextAreaElement | null)[]>;
  setManualFocusTarget?: (target: { index: number; id: string } | null) => void;
  setIsCtrlEnterBlock?: (setIsCtrlEnterBlockFn: (isCtrlEnter: boolean) => void) => void;
  setIsUndoRedoOperation?: (setIsUndoRedoOperationFn: (isUndoRedo: boolean) => void) => void;
  enterOnlyBlockAdd?: boolean;
  currentProjectId?: string;
}

interface SortableBlockProps {
  block: ScriptBlock;
  characters: Character[];
  character: Character | undefined;
  onUpdate: (updates: Partial<ScriptBlock>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onClick: (event: React.MouseEvent) => void;
  enterOnlyBlockAdd?: boolean;
  currentProjectId?: string;
  script: Script;
  onInsertBlock: (block: ScriptBlock, index: number) => void;
  insertIdx: React.MutableRefObject<number>;
}

function SortableBlock({
  block,
  characters,
  character,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onClick,
  textareaRef,
  isSelected,
  enterOnlyBlockAdd = false,
  currentProjectId,
  script,
  onInsertBlock,
  insertIdx
}: SortableBlockProps & { textareaRef: (el: HTMLTextAreaElement | null) => void; isSelected: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  // ト書き判定
  const isTogaki = !block.characterId;

  // 話者変更アニメーション
  const [animateBorder, setAnimateBorder] = useState(false);
  const prevCharacterId = useRef(block.characterId);
  useEffect(() => {
    if (block.characterId && block.characterId !== prevCharacterId.current) {
      setAnimateBorder(true);
      const timer = setTimeout(() => setAnimateBorder(false), 300);
      prevCharacterId.current = block.characterId;
      return () => clearTimeout(timer);
    }
    prevCharacterId.current = block.characterId;
  }, [block.characterId]);

  // textareaのfocus状態を管理
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start space-x-1 sm:space-x-2 p-1 sm:p-2 border rounded-lg shadow mb-2 transition-colors ${isSelected && !isTextareaFocused ? 'ring-2 ring-primary ring-opacity-50' : ''}`}
      onClick={onClick}
      data-block-index={script.blocks.findIndex(b => b.id === block.id)}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab flex items-center justify-center w-0 h-0 sm:w-5 sm:h-4.5 md:w-8 md:h-6 rounded hover:bg-accent transition"
      >
        <Bars3Icon className="w-0 h-0 sm:w-5 sm:h-4.5 md:w-8 md:h-6 text-primary" />
      </div>
      <div className="flex-1">
        {isTogaki ? (
          <div className="flex items-center space-x-2">
            <textarea
              ref={textareaRef}
              value={block.text}
              onChange={e => onUpdate({ text: e.target.value })}
              placeholder="ト書きを入力"
              className="w-full p-2 pt-2 border rounded min-h-[40px] bg-muted text-foreground focus:ring-1 focus:ring-ring text-sm italic focus:outline-none focus:ring-ring-gray-400 focus:border-gray-400 resize-none overflow-hidden"
              rows={1}
              style={{ height: 'auto', borderRadius: '20px 20px 20px 0' }}
              onFocus={() => setIsTextareaFocused(true)}
              onBlur={() => setIsTextareaFocused(false)}
              onKeyDown={e => {
                // チェックボックスの状態に応じてEnter操作のみで切り替え
                const shouldAddBlock = enterOnlyBlockAdd 
                  ? (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey)  // Enter入力のみモード
                  : (e.key === 'Enter' && e.ctrlKey);                 // 従来のCtrl+Enterモード
                
                if (shouldAddBlock) {
                  e.preventDefault();
                  const newBlock: ScriptBlock = {
                    id: Date.now().toString(),
                    characterId: character?.id || '',
                    emotion: 'normal',
                    text: ''
                  };
                  const currentIndex = script.blocks.findIndex(b => b.id === block.id);
                  insertIdx.current = currentIndex + 1; // 挿入インデックスを設定
                  onInsertBlock(newBlock, currentIndex + 1);
                }
              }}
              onInput={e => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />

            {/* キャラ選択リストとアイコン群を横並びに */}
            <div className="flex flex-col justify-between items-center h-16 mr-0.5 sm:mr-1 md:mr-2 mt-0">
              <select
                value={block.characterId}
                onChange={e => onUpdate({ characterId: e.target.value })}
                className="ml-1 p-2 pl-3 border rounded bg-background text-foreground focus:ring-1 focus:ring-ring text-xs w-24 sm:w-28 md:w-32 lg:w-36 mb-1"
                style={{ height: '2.5rem' }}
              >
                <option value="">ト書きを入力</option>
                {characters
                  .filter(c => 
                    // ト書きは常に表示
                    c.id === '' || 
                    // 現在のプロジェクトで有効なキャラクターのみ表示
                    !currentProjectId || 
                    !c.disabledProjects || 
                    !c.disabledProjects.includes(currentProjectId)
                  )
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
              <div className="flex flex-row justify-items-center space-x-0.5 sm:space-x-1.5 md:space-x-3.5 mt-0">
                <button
                  onClick={onMoveUp}
                  className="p-1 rounded hover:bg-accent"
                  title="Ctrl+↑:ブロックを上に移動"
                  style={{ height: '1.75rem', width: '1.5rem' }}
                >
                  <ArrowUpIcon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-foreground" />
                </button>
                <button
                  onClick={onMoveDown}
                  className="p-1 rounded hover:bg-accent"
                  title="Ctrl+↓:ブロックを下に移動"
                  style={{ height: '1.75rem', width: '1.5rem' }}
                >
                  <ArrowDownIcon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-foreground" />
                </button>
                <button
                  onClick={onDuplicate}
                  className="p-1 rounded hover:bg-accent"
                  title="Ctrl+B:ブロックを複製"
                  style={{ height: '1.75rem', width: '1.5rem' }}
                >
                  <DocumentDuplicateIcon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-foreground" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded"
                  title="Alt+B:ブロックを削除"
                  style={{ height: '1.75rem', width: '1.5rem' }}
                >
                  <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>
          </div>
          
        ) : (
          <div className="flex items-start space-x-2">
            {character && (
              character.emotions[block.emotion]?.iconUrl ? (
                <img
                  src={character.emotions[block.emotion]?.iconUrl}
                  alt={character.name}
                  className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full object-cover mt-0 mr-2 transition-all duration-300 ${animateBorder ? 'outline-4 outline-primary outline-offset-2' : ''}`}
                />
              ) : (
                <div 
                  className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-center mt-0 mr-2 overflow-hidden transition-all duration-300 ${animateBorder ? 'outline-4 outline-primary outline-offset-2' : ''}`}
                  style={{ backgroundColor: character.backgroundColor || '#e5e7eb' }}
                >
                  <span 
                    className={`text-xs sm:text-xs md:text-xs font-bold text-foreground px-1 max-w-[60px] sm:max-w-[70px] md:max-w-[80px] whitespace-no-wrap overflow-hidden${character.name.length > 8 ? ' text-ellipsis' : ''}`}
                    style={{
                      textShadow: `
                        -1px -1px 0 var(--color-background),  
                         1px -1px 0 var(--color-background),
                        -1px  1px 0 var(--color-background),
                         1px  1px 0 var(--color-background)
                      `
                    }}
                  >
                    {character.name.length > 8 ? character.name.slice(0, 8) + '…' : character.name}
                  </span>
                </div>
              )
            )}
            <div className="relative flex-1 pl-2">
              <textarea
                ref={textareaRef}
                value={block.text}
                onChange={e => onUpdate({ text: e.target.value })}
                onKeyDown={e => {
                  // チェックボックスの状態に応じてEnter操作のみで切り替え
                  const shouldAddBlock = enterOnlyBlockAdd 
                    ? (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey)  // Enter入力のみモード
                    : (e.key === 'Enter' && e.ctrlKey);                 // 従来のCtrl+Enterモード
                  
                  if (shouldAddBlock) {
                    e.preventDefault();
                    const newBlock: ScriptBlock = {
                      id: Date.now().toString(),
                      characterId: character?.id || '',
                      emotion: 'normal',
                      text: ''
                    };
                    const currentIndex = script.blocks.findIndex(b => b.id === block.id);
                    insertIdx.current = currentIndex + 1; // 挿入インデックスを設定
                    onInsertBlock(newBlock, currentIndex + 1);
                  }
                }}
                placeholder="セリフを入力"
                className="rounded-2xl border p-2 bg-card shadow-md min-h-[60px] text-sm w-full text-foreground focus:ring-1 focus:ring-ring focus:outline-none focus:ring-ring-gray-400 focus:border-gray-400 resize-none overflow-hidden"
                rows={1}
                style={{ height: 'auto', borderRadius: '20px 20px 20px 0' }}
                onFocus={() => setIsTextareaFocused(true)}
                onBlur={() => setIsTextareaFocused(false)}
                onInput={e => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                }}
              />
              {/* フキダシの三角形 */}
              <div className="absolute left-[-4px] top-6 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-gray-400"></div>
            </div>
            {/* キャラ選択リストとアイコン群を横並びに */}
            <div className="flex flex-col justify-between items-center h-16 mr-0.5 sm:mr-1 md:mr-2 mt-0">
              <select
                value={block.characterId}
                onChange={e => onUpdate({ characterId: e.target.value })}
                className="ml-1 p-2 pl-3 border rounded bg-background text-foreground focus:ring-1 focus:ring-ring text-xs w-24 sm:w-28 md:w-32 lg:w-36 mb-1"
                style={{ height: '2.5rem' }}
              >
                <option value="">ト書きを入力</option>
                {characters
                  .filter(c => 
                    // ト書きは常に表示
                    c.id === '' || 
                    // 現在のプロジェクトで有効なキャラクターのみ表示
                    !currentProjectId || 
                    !c.disabledProjects || 
                    !c.disabledProjects.includes(currentProjectId)
                  )
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
              <div className="flex flex-row justify-items-center space-x-0.5 sm:space-x-1.5 md:space-x-3.5 mt-0">
                <button
                  onClick={onMoveUp}
                  className="p-1 rounded hover:bg-accent"
                  title="Ctrl+↑:ブロックを上に移動"
                  style={{ height: '1.75rem', width: '1.5rem' }}
                >
                  <ArrowUpIcon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-foreground" />
                </button>
                <button
                  onClick={onMoveDown}
                  className="p-1 rounded hover:bg-accent"
                  title="Ctrl+↓:ブロックを下に移動"
                  style={{ height: '1.75rem', width: '1.5rem' }}
                >
                  <ArrowDownIcon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-foreground" />
                </button>
                <button
                  onClick={onDuplicate}
                  className="p-1 rounded hover:bg-accent"
                  title="Ctrl+B:ブロックを複製"
                  style={{ height: '1.75rem', width: '1.5rem' }}
                >
                  <DocumentDuplicateIcon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-foreground" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded"
                  title="Alt+B:ブロックを削除"
                  style={{ height: '1.75rem', width: '1.5rem' }}
                >
                  <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScriptEditor({
  script,
  onUpdateBlock,
  onAddBlock,
  onDeleteBlock,
  onInsertBlock,
  onMoveBlock,
  selectedBlockIds,
  onSelectedBlockIdsChange,
  onOpenCSVExport,
  characters,
  onDuplicateBlock,
  onSelectAllBlocks,
  onDeselectAllBlocks,
  onToggleBlockSelection,
  textareaRefs: externalTextareaRefs,
  setManualFocusTarget: externalSetManualFocusTarget,
  setIsCtrlEnterBlock: externalSetIsCtrlEnterBlock,
  setIsUndoRedoOperation: externalSetIsUndoRedoOperation,
  enterOnlyBlockAdd = false,
  currentProjectId
}: ScriptEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // テキストエリアref配列（外部から渡された場合はそれを使用、そうでなければ内部で作成）
  const internalTextareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const textareaRefs = externalTextareaRefs || internalTextareaRefs;
  const [isButtonFixed, setIsButtonFixed] = useState(false);
  const [manualFocusTarget, setManualFocusTarget] = useState<{ index: number; id: string } | null>(null);
  
  // 外部から渡されたsetManualFocusTargetを使用、なければ内部のものを使用
  const setManualFocusTargetFn = externalSetManualFocusTarget || setManualFocusTarget;
  
  // 外部から渡されたsetIsCtrlEnterBlockを使用、なければ内部のものを使用
  const setIsCtrlEnterBlockFn = externalSetIsCtrlEnterBlock || ((isCtrlEnter: boolean) => {
    isCtrlEnterBlock.current = isCtrlEnter;
  });
  
  // 外部から渡されたsetIsUndoRedoOperationを使用、なければ内部のものを使用
  const setIsUndoRedoOperationFn = externalSetIsUndoRedoOperation || ((isUndoRedo: boolean) => {
    isUndoRedoOperation.current = isUndoRedo;
  });
  
  // 外部から渡されたsetIsCtrlEnterBlock関数を外部に渡す
  useEffect(() => {
    if (externalSetIsCtrlEnterBlock) {
      externalSetIsCtrlEnterBlock((isCtrlEnter: boolean) => {
        isCtrlEnterBlock.current = isCtrlEnter;
      });
    }
  }, [externalSetIsCtrlEnterBlock]);
  
  // 外部から渡されたsetIsUndoRedoOperation関数を外部に渡す
  useEffect(() => {
    if (externalSetIsUndoRedoOperation) {
      externalSetIsUndoRedoOperation((isUndoRedo: boolean) => {
        isUndoRedoOperation.current = isUndoRedo;
      });
    }
  }, [externalSetIsUndoRedoOperation]);
  
  // マウス選択用の状態
  const [lastClickedIndex, setLastClickedIndex] = useState<number>(-1);
  
  // ブロック選択の処理
  const handleBlockClick = (blockId: string, index: number, event: React.MouseEvent) => {
    // textarea内のクリックは無視
    if ((event.target as HTMLElement).tagName === 'TEXTAREA') {
      return;
    }

    event.preventDefault();
    
    // Shiftキーを押しながらの選択時にブラウザの選択状態を無効化
    if (event.shiftKey) {
      event.preventDefault();
      // ブラウザの選択状態をクリア
      if (window.getSelection) {
        window.getSelection()?.removeAllRanges();
      }
    }
    
    if (event.ctrlKey || event.metaKey) {
      // Ctrl+クリック: 追加選択
      onSelectedBlockIdsChange(
        selectedBlockIds.includes(blockId) 
          ? selectedBlockIds.filter(id => id !== blockId)
          : [...selectedBlockIds, blockId]
      );
      setLastClickedIndex(index);
    } else if (event.shiftKey && lastClickedIndex >= 0) {
      // Shift+クリック: 範囲選択
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const rangeBlockIds = script.blocks
        .slice(start, end + 1)
        .map(block => block.id);
      onSelectedBlockIdsChange(rangeBlockIds);
    } else {
      // 通常のクリック: 単一選択
      onSelectedBlockIdsChange([blockId]);
      setLastClickedIndex(index);
    }
  };

  // 選択状態のクリア
  const clearSelection = () => {
    onSelectedBlockIdsChange([]);
    setLastClickedIndex(-1);
  };

  useEffect(() => {
    // ブロック数が変わったらref配列を調整
    textareaRefs.current = textareaRefs.current.slice(0, script.blocks.length);
    // 初期表示時に各textareaの高さを自動調整
    setTimeout(() => {
      textareaRefs.current.forEach(ref => {
        if (ref) {
          ref.style.height = 'auto';
          ref.style.height = ref.scrollHeight + 'px';
        }
      });
    }, 0);
    
    // 最下段にブロックが追加された場合のみスクロール位置を調整
    const prevIdx = script.blocks.findIndex(block => block.id === selectedBlockIds[0]);  // 増える前のインデックス
    const maxBlockCount = Math.max(script.blocks.length, prevBlockCount.current);
    if (script.blocks.length > 0 && maxBlockCount <= script.blocks.length && prevBlockCount.current <= prevIdx + 1) {
      const lastIdx = script.blocks.length - 1;
      const lastRef = textareaRefs.current[lastIdx];
      if (lastRef) {
        // 手動フォーカスターゲットが設定されている場合は自動スクロールを無効にする
        if (manualFocusTarget) {
          return;
        }
        
        // 現在のスクロール位置を取得
        const currentScrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // 最下段にスクロールが可能かチェック
        const canScrollToBottom = currentScrollY + windowHeight < documentHeight;
        
        // 新しく追加されたブロックが画面外にあるかチェック
        const rect = lastRef.getBoundingClientRect();
        const isBlockVisible = rect.bottom > windowHeight && rect.bottom > 0;
        
        // 最下段にブロックが追加された場合のみ、最下段までスクロール
        if (canScrollToBottom && isBlockVisible) {
          setTimeout(() => {
            window.scrollTo({
              top: documentHeight - windowHeight,
              behavior: 'smooth'
            });
          }, 50); // 少し遅延を入れてDOMの更新を待つ
        }
      }
    }
  }, [script.blocks.length, selectedBlockIds]);

  // コンテンツの高さに応じてボタンの位置を調整
  useEffect(() => {
    const handleResize = () => {
      const container = document.querySelector('.script-editor-container');
      if (container) {
        const containerHeight = container.scrollHeight;
        const windowHeight = window.innerHeight;
        const isContentOverflow = containerHeight > windowHeight - 200; // 200pxのマージン
        setIsButtonFixed(isContentOverflow);
      }
    };

    // 初期状態とリサイズ時に実行
    handleResize();
    window.addEventListener('resize', handleResize);
    
    // ブロックが変更された時にも実行
    const timer = setTimeout(handleResize, 1);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [script.blocks]);

  // フォーカス時に選択状態を更新（単一選択の場合のみ）
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const textarea = e.target as HTMLTextAreaElement;
      const index = textareaRefs.current.findIndex(ref => ref === textarea);
      if (index >= 0) {
        // フォーカス時は単一選択に変更
        onSelectedBlockIdsChange([script.blocks[index]?.id || '']);
        setLastClickedIndex(index);
      }
    };

    const handleBlur = () => {
      // フォーカスが外れた時は選択状態をクリアしない
    };

    textareaRefs.current.forEach(ref => {
      if (ref) {
        ref.addEventListener('focus', handleFocus);
        ref.addEventListener('blur', handleBlur);
        
        // Electron版での追加処理
        if (typeof window !== 'undefined' && window.electronAPI) {
          ref.addEventListener('click', () => {
            // クリック時にフォーカスを確実にする
            setTimeout(() => {
              ref.focus();
            }, 10);
          });
        }
      }
    });

    return () => {
      textareaRefs.current.forEach(ref => {
        if (ref) {
          ref.removeEventListener('focus', handleFocus);
          ref.removeEventListener('blur', handleBlur);
          
          // Electron版での追加処理
          if (typeof window !== 'undefined' && window.electronAPI) {
            ref.removeEventListener('click', () => {});
          }
        }
      });
    };
  }, [script.blocks]);

  // 最後に追加されたブロックに自動フォーカス
  const prevBlockCount = useRef(script.blocks.length);
  const insertIdx = useRef<number>(-1);
  const isCtrlEnterBlock = useRef<boolean>(false); // Ctrl+Enterで追加されたブロックかどうかのフラグ
  const isUndoRedoOperation = useRef<boolean>(false); // アンドゥ・リドゥ操作かどうかのフラグ
  
  useEffect(() => {
    if (script.blocks.length > prevBlockCount.current) {
      // 手動フォーカスターゲットがある場合は自動フォーカスをスキップ
      if (manualFocusTarget) {
        //console.log('Skipping auto focus due to manual focus target');
        setManualFocusTargetFn(null);
        prevBlockCount.current = script.blocks.length;
        return;
      }
      
      // Ctrl+Enterで追加されたブロックの場合は自動フォーカスをスキップ
      if (isCtrlEnterBlock.current) {
        //console.log('Skipping auto focus due to Ctrl+Enter block');
        isCtrlEnterBlock.current = false;
        prevBlockCount.current = script.blocks.length;
        return;
      }
      
      // アンドゥ・リドゥ操作の場合は自動フォーカスをスキップ
      if (isUndoRedoOperation.current) {
        //console.log('Skipping auto focus due to undo/redo operation');
        isUndoRedoOperation.current = false;
        prevBlockCount.current = script.blocks.length;
        return;
      }
      
      // 挿入されたインデックスがある場合はそのインデックスにフォーカス
      if (insertIdx.current >= 0) {
        //console.log(`Auto focusing inserted block at index: ${insertIdx.current}`);
        setTimeout(() => {
          textareaRefs.current[insertIdx.current]?.focus();
          onSelectedBlockIdsChange([script.blocks[insertIdx.current]?.id || '']); // 単一選択に変更
          insertIdx.current = -1; // リセット
        }, 10);
        prevBlockCount.current = script.blocks.length;
        return;
      }
      
      // 通常の最後のブロックへの自動フォーカス
      //console.log('Auto focusing last block');
      setTimeout(() => {
        const lastIdx = script.blocks.length - 1;
        textareaRefs.current[lastIdx]?.focus();
        onSelectedBlockIdsChange([script.blocks[lastIdx]?.id || '']); // 単一選択に変更
      }, 10); // タイミングを調整
    }
    prevBlockCount.current = script.blocks.length;
  }, [script.blocks.length, manualFocusTarget]);

  // フォーカス時に選択状態を更新
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const textarea = e.target as HTMLTextAreaElement;
      const index = textareaRefs.current.findIndex(ref => ref === textarea);
      if (index >= 0) {
        // フォーカス時は単一選択に変更
        onSelectedBlockIdsChange([script.blocks[index]?.id || '']);
        setLastClickedIndex(index);
      }
    };

    const handleBlur = () => {
      // フォーカスが外れた時は選択状態をクリアしない（他の要素にフォーカスが移る可能性があるため）
    };

    textareaRefs.current.forEach(ref => {
      if (ref) {
        ref.addEventListener('focus', handleFocus);
        ref.addEventListener('blur', handleBlur);
      }
    });

    return () => {
      textareaRefs.current.forEach(ref => {
        if (ref) {
          ref.removeEventListener('focus', handleFocus);
          ref.removeEventListener('blur', handleBlur);
        }
      });
    };
  }, [script.blocks]);

  // 手動フォーカスターゲットの処理
  useEffect(() => {
    if (manualFocusTarget) {
      setTimeout(() => {
        const targetRef = textareaRefs.current[manualFocusTarget.index];
        if (targetRef) {
          // スクロールが必要か事前に判定
          const rect = targetRef.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          const headerHeight = 64;
          const needsScroll = rect.bottom > windowHeight || rect.top < headerHeight;
          
          // スクロールが必要な場合のみ、スクロール位置を保存
          const scrollYBeforeFocus = needsScroll ? window.scrollY : null;
          
          targetRef.focus();
          onSelectedBlockIdsChange([manualFocusTarget.id]); // 単一選択に変更
          
          if (needsScroll && scrollYBeforeFocus !== null) {
            // スクロールが必要な場合のみ処理
            setTimeout(() => {
              // ブラウザの自動スクロールを防ぐ
              if (window.scrollY !== scrollYBeforeFocus) {
                window.scrollTo(0, scrollYBeforeFocus);
              }
              // 適切なスクロールを実行
              ensureBlockVisible(manualFocusTarget.index, 20);
            }, 5);
          } else {
            // スクロールが不要な場合は即座にスクロール処理を実行
            ensureBlockVisible(manualFocusTarget.index, 5);
          }
        }
        
        setManualFocusTargetFn(null);
      }, 5);
    }
  }, [manualFocusTarget]);

  // スクロールアニメーション（500ms）
  const scrollToY = (targetY: number, duration: number = 500) => {
    const startY = window.scrollY;
    const diff = targetY - startY;
    const startTime = performance.now();
    function animateScroll(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      window.scrollTo(0, startY + diff * easeInOutQuad(progress));
      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    }
    function easeInOutQuad(t: number) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    requestAnimationFrame(animateScroll);
  };

  // スクロール＆選択機能＋ボタンスライドアニメーション
  const [slideUp, setSlideUp] = useState(false);
  const [slideDown, setSlideDown] = useState(false);
  const scrollToBlock = (index: number) => {
          if (textareaRefs.current[index]) {
        textareaRefs.current[index]?.focus();
        onSelectedBlockIdsChange([script.blocks[index]?.id || '']); // 単一選択に変更
        ensureBlockVisible(index, 50);
      }
  };

  // ブロックがウィンドウの表示領域に収まるようにスクロール位置を調整する関数
  const ensureBlockVisible = (index: number, delay: number = 10) => {
    setTimeout(() => {
      const targetRef = textareaRefs.current[index];
      if (targetRef) {
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
      }
    }, delay);
  };

  const handleScrollTop = () => {
    setSlideUp(true);
    setTimeout(() => setSlideUp(false), 300);
    scrollToY(0, 500);
    setTimeout(() => {
              if (textareaRefs.current[0]) {
          textareaRefs.current[0]?.focus();
          onSelectedBlockIdsChange([script.blocks[0]?.id || '']); // 単一選択に変更
        }
    }, 500);
  };
  const handleScrollBottom = () => {
    setSlideDown(true);
    setTimeout(() => setSlideDown(false), 300);
    scrollToY(document.body.scrollHeight, 500);
    setTimeout(() => {
      const lastIdx = script.blocks.length - 1;
      if (textareaRefs.current[lastIdx]) {
        textareaRefs.current[lastIdx]?.focus();
        onSelectedBlockIdsChange([script.blocks[lastIdx]?.id || '']); // 単一選択に変更
      }
    }, 500);
  };

  // テキストエリア内の矢印キー処理のみ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // フォーカス中のtextareaを特定
      const activeIdx = textareaRefs.current.findIndex(ref => ref === document.activeElement);
      
      // ↑: 上のブロック（テキストエリアの最上段のみ）
      if (!e.ctrlKey && e.key === 'ArrowUp' && !e.altKey && !e.shiftKey) {
        if (activeIdx > 0) {
          const textarea = textareaRefs.current[activeIdx] as HTMLTextAreaElement | null;
          if (textarea) {
            const { selectionStart } = textarea;
            // 現在のカーソル位置が最上段か判定
            const value = textarea.value;
            const before = value.slice(0, selectionStart);
            const lineCount = before.split('\n').length;
            if (lineCount === 1) {
              e.preventDefault();
              const targetIndex = activeIdx - 1;
              const targetRef = textareaRefs.current[targetIndex];
              if (targetRef) {
                // スクロールが必要か事前に判定
                const rect = targetRef.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                const headerHeight = 64;
                const needsScroll = rect.bottom > windowHeight || rect.top < headerHeight;
                
                // スクロールが必要な場合のみ、スクロール位置を保存
                const scrollYBeforeFocus = needsScroll ? window.scrollY : null;
                
                targetRef.focus();
                
                if (needsScroll && scrollYBeforeFocus !== null) {
                  // スクロールが必要な場合のみ処理
                  setTimeout(() => {
                    // ブラウザの自動スクロールを防ぐ
                    if (window.scrollY !== scrollYBeforeFocus) {
                      window.scrollTo(0, scrollYBeforeFocus);
                    }
                    // 適切なスクロールを実行
                    ensureBlockVisible(targetIndex, 20);
                  }, 5);
                } else {
                  // スクロールが不要な場合は即座にスクロール処理を実行
                  ensureBlockVisible(targetIndex, 5);
                }
              }
            }
          }
        }
      }
      // ↓: 下のブロック（テキストエリアの最下段のみ）
      else if (!e.ctrlKey && e.key === 'ArrowDown' && !e.altKey && !e.shiftKey) {
        if (activeIdx >= 0 && activeIdx < script.blocks.length - 1) {
          const textarea = textareaRefs.current[activeIdx] as HTMLTextAreaElement | null;
          if (textarea) {
            const { selectionStart } = textarea;
            const value = textarea.value;
            const before = value.slice(0, selectionStart);
            const currentLine = before.split('\n').length;
            const totalLines = value.split('\n').length;
            // 現在のカーソル位置が最下段か判定
            if (currentLine === totalLines) {
              e.preventDefault();
              const targetIndex = activeIdx + 1;
              const targetRef = textareaRefs.current[targetIndex];
              if (targetRef) {
                // スクロールが必要か事前に判定
                const rect = targetRef.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                const headerHeight = 64;
                const needsScroll = rect.bottom > windowHeight || rect.top < headerHeight;
                
                // スクロールが必要な場合のみ、スクロール位置を保存
                const scrollYBeforeFocus = needsScroll ? window.scrollY : null;
                
                targetRef.focus();
                
                if (needsScroll && scrollYBeforeFocus !== null) {
                  // スクロールが必要な場合のみ処理
                  setTimeout(() => {
                    // ブラウザの自動スクロールを防ぐ
                    if (window.scrollY !== scrollYBeforeFocus) {
                      window.scrollTo(0, scrollYBeforeFocus);
                    }
                    // 適切なスクロールを実行
                    ensureBlockVisible(targetIndex, 20);
                  }, 5);
                } else {
                  // スクロールが不要な場合は即座にスクロール処理を実行
                  ensureBlockVisible(targetIndex, 5);
                }
              }
            }
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [script.blocks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = script.blocks.findIndex(block => block.id === active.id);
      const newIndex = script.blocks.findIndex(block => block.id === over.id);
      onMoveBlock(oldIndex, newIndex);
      
      // ドラッグ&ドロップ後のスクロール位置補正
      setTimeout(() => {
        const targetRef = textareaRefs.current[newIndex];
        if (targetRef) {
          ensureBlockVisible(newIndex, 50);
        }
      }, 50);
    }
  };

  // ト書き追加
  const handleAddTogaki = (insertIndex: number) => {
    const newBlock: ScriptBlock = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      characterId: '',
      emotion: 'normal',
      text: ''
    };
    insertIdx.current = insertIndex; // 挿入インデックスを設定
    onInsertBlock(newBlock, insertIndex);
    setTimeout(() => {
      setManualFocusTargetFn({ index: insertIndex, id: newBlock.id });
    }, 10);
  };

  return (
    <>
      <div className="script-editor-container min-h-auto">
        {script.blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 text-center text-muted-foreground">
            <p className="text-sm sm:text-base md:text-lg mb-4">1.右上のキャラクターのアイコンから登場キャラクターを追加します。</p>
            <p className="text-sm sm:text-base md:text-lg mb-4">2.「+ブロックを追加」からテキストブロックを追加し、キャラクターを選択するとセリフを入力できます。</p>
            <p className="text-sm sm:text-base md:text-lg mb-4">3.右上のエクスポートから台本をCSV形式で出力できます。グループ設定ごとにCSVファイルを分割出力することができます。</p>
            <p className="text-sm sm:text-base md:text-lg mb-4">4.より詳しい操作方法は設定＞ヘルプをご覧ください。</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg shadow p-2 sm:p-3 md:p-4 mb-24 relative h-full flex flex-col justify-between">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={script.blocks.map(block => block.id)}
                strategy={verticalListSortingStrategy}
              >
                {script.blocks.map((block, index) => (
                  <div key={block.id} className="mb-1 last:mb-0">
                    <SortableBlock
                      block={block}
                      characters={characters}
                      character={characters.find(c => c.id === block.characterId)}
                      onUpdate={updates => onUpdateBlock(block.id, updates)}
                      onDelete={() => {
                        onDeleteBlock(block.id);
                        
                        // 削除後のフォーカス処理
                        setTimeout(() => {
                          // 削除されたブロックの位置を考慮してフォーカスを設定
                          let focusIndex = index;
                          
                          // 最上段の場合はそのまま、それ以外は一つ上のブロックにフォーカス
                          if (index > 0) {
                            focusIndex = index - 1;
                          }
                          
                          const focusRef = textareaRefs.current[focusIndex];
                          if (focusRef) {
                            focusRef.focus();
                            onSelectedBlockIdsChange([script.blocks[focusIndex]?.id || '']);
                          }
                        }, 50);
                      }}
                      onDuplicate={() => {
                        const newBlock: ScriptBlock = {
                          ...block,
                          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                          text: block.text // 元のテキストを保持
                        };
                        insertIdx.current = index + 1; // 複製ブロックの挿入インデックスを設定
                        onInsertBlock(newBlock, index + 1);
                        setTimeout(() => {
                          setManualFocusTargetFn({ index: index + 1, id: newBlock.id });
                        }, 10); // タイミングを調整
                      }}
                      onMoveUp={() => {
                        if (index > 0) {
                          onMoveBlock(index, index - 1);
                          
                          // 移動後のスクロール位置補正
                          setTimeout(() => {
                            const targetRef = textareaRefs.current[index - 1];
                            if (targetRef) {
                              ensureBlockVisible(index - 1, 50);
                            }
                          }, 50);
                        }
                      }}
                      onMoveDown={() => {
                        if (index < script.blocks.length - 1) {
                          onMoveBlock(index, index + 1);
                          
                          // 移動後のスクロール位置補正
                          setTimeout(() => {
                            const targetRef = textareaRefs.current[index + 1];
                            if (targetRef) {
                              ensureBlockVisible(index + 1, 50);
                            }
                          }, 50);
                        }
                      }}
                      textareaRef={el => textareaRefs.current[index] = el}
                      isSelected={selectedBlockIds.includes(block.id)}
                      onClick={(event) => handleBlockClick(block.id, index, event)}
                      enterOnlyBlockAdd={enterOnlyBlockAdd}
                      currentProjectId={currentProjectId}
                      script={script}
                      onInsertBlock={onInsertBlock}
                      insertIdx={insertIdx}
                    />
                    {/* ブロック間のト書き追加 */}
                    <div className="flex justify-center my-1 group">
                      <button
                        className="hidden group-hover:inline-block px-2 py-1 bg-primary text-primary-foreground rounded text-xs"
                        onClick={() => handleAddTogaki(index + 1)}
                      >
                        ＋ト書きを追加
                      </button>
                    </div>
                  </div>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
      {/* 右下固定ボタン群 */}
      <div className="fixed right-6 z-40 flex flex-row items-end space-x-2 bottom-6">
        <button
          onClick={handleScrollTop}
          className={`px-3 py-2 bg-muted hover:bg-muted/90 text-muted-foreground rounded-full shadow-lg text-lg transition-transform duration-600 ${slideUp ? '-translate-y-2' : ''}`}
          title="Ctrl+Alt+↑: 最上段へ"
        >
          <ArrowUpIcon className="w-6 h-6" />
        </button>
        <button
          onClick={handleScrollBottom}
          className={`px-3 py-2 bg-muted hover:bg-muted/90 text-muted-foreground rounded-full shadow-lg text-lg transition-transform duration-600 ${slideDown ? 'translate-y-2' : ''}`}
          title="Ctrl+,: 最下段へ"
        >
          <ArrowDownIcon className="w-6 h-6" />
        </button>
          <button
            onClick={onAddBlock}
            className={`px-3 py-2 sm:px-4 sm:py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg transition-all text-lg`}
            title="Ctrl+B:新規ブロックを追加"
          >
            <PlusIcon className="w-6 h-6 inline-block sm:mr-0.5 sm:mb-0.5" />
            <span className="hidden sm:inline">ブロックを追加</span>
          </button>
      </div>
    </>
  );
}