'use client';

import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
  Bars3Icon
} from '@heroicons/react/24/outline';

interface ScriptEditorProps {
  script: Script;
  onUpdateBlock: (blockId: string, updates: Partial<ScriptBlock>) => void;
  onAddBlock: () => void;
  onDeleteBlock: (blockId: string) => void;
  onInsertBlock: (block: ScriptBlock, index: number) => void;
  onMoveBlock: (fromIndex: number, toIndex: number) => void;
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
  textareaRef,
  isSelected
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start space-x-2 p-2 border rounded-lg shadow mb-2 transition-colors ${
        isSelected ? 'bg-secondary-foreground/10' : 'bg-card'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab flex items-center justify-center w-8 h-6 rounded hover:bg-accent transition"
      >
        <Bars3Icon className="w-8 h-8 text-primary" />
      </div>
      <div className="flex-1">
        {isTogaki ? (
          <div className="flex items-center space-x-2">
            <textarea
              ref={textareaRef}
              value={block.text}
              onChange={e => onUpdate({ text: e.target.value })}
              placeholder="ト書きを入力"
              className="w-full p-2 border rounded min-h-[40px] bg-muted text-foreground focus:ring-1 focus:ring-ring text-sm italic focus:outline-none focus:ring-ring-gray-400 focus:border-gray-400"
            />
            <select
              value={block.characterId}
              onChange={e => onUpdate({ characterId: e.target.value })}
              className="ml-1 p-2 pl-3 mr-2 border rounded bg-background text-foreground text-xs w-36"
            >
              <option value="">ト書きを入力</option>
              {characters.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-start space-x-2">
            {character && (
              <img
                src={character.emotions[block.emotion]?.iconUrl}
                alt={character.name}
                className="w-16 h-16 rounded-full object-cover mt-0 mr-2"
              />
            )}
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={block.text}
                onChange={e => onUpdate({ text: e.target.value })}
                placeholder="セリフを入力"
                className="rounded-2xl border p-2 bg-card shadow-md min-h-[60px] text-sm w-full text-foreground focus:ring-1 focus:ring-ring focus:outline-none focus:ring-ring-gray-400 focus:border-gray-400"
                style={{ borderRadius: '20px 20px 20px 0' }}
              />
              {/* フキダシの三角形 */}
              <div className="absolute left-[-10px] top-6 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-gray-400 focus:ring-2 focus:ring-ring focus:outline-none focus:ring-ring-gray-400 focus:border-gray-400"></div>
            </div>
            <div className="flex flex-col space-y-1 mr-2 mt-3">
              <select
                value={block.characterId}
                onChange={e => onUpdate({ characterId: e.target.value })}
                className="ml-1 p-2 pl-3 border rounded bg-background text-foreground focus:ring-1 focus:ring-ring text-xs w-36"
              >
                <option value="">ト書きを入力</option>
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="flex justify-end space-x-1.5 mt-1 mr-1.5">
          <button
            onClick={onMoveUp}
            className="p-1 rounded hover:bg-accent"
            title="Ctrl+↑:ブロックを上に移動"
          >
            <ArrowUpIcon className="w-6 h-6 text-foreground" />
          </button>
          <button
            onClick={onMoveDown}
            className="p-1 rounded hover:bg-accent"
            title="Ctrl+↓:ブロックを下に移動"
          >
            <ArrowDownIcon className="w-6 h-6 text-foreground" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-1 rounded hover:bg-accent"
            title="Ctrl+B:ブロックを複製"
          >
            <DocumentDuplicateIcon className="w-6 h-6 text-foreground" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-destructive hover:bg-destructive/10 rounded"
            title="Alt+B:ブロックを削除"
          >
            <TrashIcon className="w-6 h-6" />
          </button>
        </div>
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
  onMoveBlock
}: ScriptEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // テキストエリアref配列
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [isButtonFixed, setIsButtonFixed] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [manualFocusTarget, setManualFocusTarget] = useState<{ index: number; id: string } | null>(null);
  
  useEffect(() => {
    // ブロック数が変わったらref配列を調整
    textareaRefs.current = textareaRefs.current.slice(0, script.blocks.length);
  }, [script.blocks.length]);

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

  // 最後に追加されたブロックに自動フォーカス
  const prevBlockCount = useRef(script.blocks.length);
  useEffect(() => {
    if (script.blocks.length > prevBlockCount.current) {
      // 手動フォーカスターゲットがある場合は自動フォーカスをスキップ
      if (manualFocusTarget) {
        setManualFocusTarget(null);
        return;
      }
      setTimeout(() => {
        const lastIdx = script.blocks.length - 1;
        textareaRefs.current[lastIdx]?.focus();
        setSelectedBlockId(script.blocks[lastIdx]?.id || null);
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
        setSelectedBlockId(script.blocks[index]?.id || null);
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
        textareaRefs.current[manualFocusTarget.index]?.focus();
        setSelectedBlockId(manualFocusTarget.id);
        setManualFocusTarget(null);
      }, 10);
    }
  }, [manualFocusTarget]);

  // ショートカットキー
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // フォーカス中のtextareaを特定
      const activeIdx = textareaRefs.current.findIndex(ref => ref === document.activeElement);
      // Ctrl+B: 新規ブロック
      if (e.ctrlKey && !e.altKey && e.key === 'b') {
        e.preventDefault();
        onAddBlock();
        setTimeout(() => {
          const lastIdx = script.blocks.length;
          setManualFocusTarget({ index: lastIdx, id: script.blocks[lastIdx]?.id || '' });
        }, 10); // タイミングを調整
      }
      // Ctrl+Alt+B: 新規ト書き
      else if (e.ctrlKey && e.altKey && e.key === 'b') {
        e.preventDefault();
        const idx = activeIdx >= 0 ? activeIdx + 1 : script.blocks.length;
        const newBlock: ScriptBlock = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          characterId: '',
          emotion: 'normal',
          text: ''
        };
        onInsertBlock(newBlock, idx);
        setTimeout(() => {
          setManualFocusTarget({ index: idx, id: newBlock.id });
        }, 10); // タイミングを調整
      }
      // Alt+B: 選択中のブロックを削除
      else if (!e.ctrlKey && e.altKey && e.key === 'b') {
        if (activeIdx >= 0) {
          e.preventDefault();
          onDeleteBlock(script.blocks[activeIdx].id);
          setTimeout(() => {
            // 削除後に次のブロック、なければ前のブロックにフォーカス
            if (textareaRefs.current[activeIdx]) {
              textareaRefs.current[activeIdx]?.focus();
            } else if (textareaRefs.current[activeIdx - 1]) {
              textareaRefs.current[activeIdx - 1]?.focus();
            }
          }, 0);
        }
      }
      // Alt+↑: 上のキャラクターを選択（ト書き以外）
      else if (!e.ctrlKey && e.altKey && e.key === 'ArrowUp') {
        if (activeIdx >= 0) {
          const block = script.blocks[activeIdx];
          if (block.characterId) {
            const charIdx = script.characters.findIndex(c => c.id === block.characterId);
            if (charIdx > 0) {
              e.preventDefault();
              onUpdateBlock(block.id, { characterId: script.characters[charIdx - 1].id });
            }
          }
        }
      }
      // Alt+↓: 下のキャラクターを選択（ト書き以外）
      else if (!e.ctrlKey && e.altKey && e.key === 'ArrowDown') {
        if (activeIdx >= 0) {
          const block = script.blocks[activeIdx];
          if (block.characterId) {
            const charIdx = script.characters.findIndex(c => c.id === block.characterId);
            if (charIdx >= 0 && charIdx < script.characters.length - 1) {
              e.preventDefault();
              onUpdateBlock(block.id, { characterId: script.characters[charIdx + 1].id });
            }
          }
        }
      }

      // ↑: 上のブロック（テキストエリアの最上段のみ）
      else if (!e.ctrlKey && e.key === 'ArrowUp') {
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
              textareaRefs.current[activeIdx - 1]?.focus();
            }
          }
        }
      }
      // ↓: 下のブロック（テキストエリアの最下段のみ）
      else if (!e.ctrlKey && e.key === 'ArrowDown') {
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
              textareaRefs.current[activeIdx + 1]?.focus();
            }
          }
        }
      }
      // Ctrl+Enter: 直後にキャラクター引き継ぎ新規ブロック
      else if (e.ctrlKey && e.key === 'Enter') {
        if (activeIdx >= 0) {
          e.preventDefault();
          const currentBlock = script.blocks[activeIdx];
          const newBlock: ScriptBlock = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            characterId: currentBlock.characterId,
            emotion: currentBlock.emotion,
            text: ''
          };
          onInsertBlock(newBlock, activeIdx + 1);
          setTimeout(() => {
            setManualFocusTarget({ index: activeIdx + 1, id: newBlock.id });
          }, 10); // タイミングを調整
        }
      }
      // Ctrl+↑: ブロック上移動
      else if (e.ctrlKey && e.key === 'ArrowUp') {
        if (activeIdx > 0) {
          e.preventDefault();
          onMoveBlock(activeIdx, activeIdx - 1);
          setTimeout(() => {
            setManualFocusTarget({ index: activeIdx - 1, id: script.blocks[activeIdx - 1]?.id || '' });
          }, 10); // タイミングを調整
        }
      }
      // Ctrl+↓: ブロック下移動
      else if (e.ctrlKey && e.key === 'ArrowDown') {
        if (activeIdx >= 0 && activeIdx < script.blocks.length - 1) {
          e.preventDefault();
          onMoveBlock(activeIdx, activeIdx + 1);
          setTimeout(() => {
            setManualFocusTarget({ index: activeIdx + 1, id: script.blocks[activeIdx + 1]?.id || '' });
          }, 10); // タイミングを調整
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [script.blocks, onAddBlock, onInsertBlock, onMoveBlock, onDeleteBlock]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = script.blocks.findIndex(block => block.id === active.id);
      const newIndex = script.blocks.findIndex(block => block.id === over.id);
      onMoveBlock(oldIndex, newIndex);
    }
  };

  // ト書き追加
  const handleAddTogaki = (insertIndex: number) => {
    const newBlock: ScriptBlock = {
      id: Date.now().toString(),
      characterId: '',
      emotion: 'normal',
      text: ''
    };
    onInsertBlock(newBlock, insertIndex);
    setTimeout(() => {
      textareaRefs.current[insertIndex]?.focus();
    }, 0);
  };

  return (
    <>
      <div className="script-editor-container">
        {script.blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <p className="text-lg mb-4">キャラクターのアイコンから話者を追加して下のボタンからブロックを追加します。</p>
          </div>
        ) : (
          <div className="bg-card border rounded-lg shadow p-4 relative">
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
                  <div key={block.id}>
                                      <SortableBlock
                    block={block}
                    characters={script.characters}
                    character={script.characters.find(c => c.id === block.characterId)}
                    onUpdate={updates => onUpdateBlock(block.id, updates)}
                    onDelete={() => onDeleteBlock(block.id)}
                    onDuplicate={() => {
                      const newBlock: ScriptBlock = {
                        ...block,
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        text: block.text // 元のテキストを保持
                      };
                      onInsertBlock(newBlock, index + 1);
                      setTimeout(() => {
                        setManualFocusTarget({ index: index + 1, id: newBlock.id });
                      }, 10); // タイミングを調整
                    }}
                    onMoveUp={() => {
                      if (index > 0) {
                        onMoveBlock(index, index - 1);
                      }
                    }}
                    onMoveDown={() => {
                      if (index < script.blocks.length - 1) {
                        onMoveBlock(index, index + 1);
                      }
                    }}
                    textareaRef={el => textareaRefs.current[index] = el}
                    isSelected={selectedBlockId === block.id}
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
      <button
        onClick={onAddBlock}
        className={`fixed right-6 z-40 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg transition-all text-lg ${
          script.blocks.length === 0 
            ? 'bottom-1/2 transform translate-y-1/2' 
            : isButtonFixed 
              ? 'bottom-6' 
              : 'bottom-6'
        }`}
        title="Ctrl+B:新規ブロックを追加"
      >
        ＋ブロックを追加
      </button>
    </>
  );
}