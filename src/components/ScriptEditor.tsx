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
  textareaRef
}: SortableBlockProps & { textareaRef: (el: HTMLTextAreaElement | null) => void }) {
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
      className="flex items-start space-x-2 p-2 bg-card border rounded-lg shadow mb-2"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab flex items-center justify-center w-12 h-12 rounded hover:bg-accent transition"
      >
        <Bars3Icon className="w-12 h-12 text-primary" />
      </div>
      <div className="flex-1">
        {isTogaki ? (
          <div className="flex items-center space-x-2">
            <select
              value={block.characterId}
              onChange={e => onUpdate({ characterId: e.target.value })}
              className="p-1 border rounded bg-background text-foreground text-xs"
            >
              <option value="">ト書きを入力</option>
              {characters.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <textarea
              ref={textareaRef}
              value={block.text}
              onChange={e => onUpdate({ text: e.target.value })}
              placeholder="ト書きを入力"
              className="w-full p-2 border rounded min-h-[40px] bg-muted text-foreground focus:ring-2 focus:ring-ring text-sm italic"
            />
          </div>
        ) : (
          <div className="flex items-start space-x-2">
            {character && (
              <img
                src={character.emotions[block.emotion]?.iconUrl}
                alt={character.name}
                className="w-10 h-10 rounded-full object-cover mt-2"
              />
            )}
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={block.text}
                onChange={e => onUpdate({ text: e.target.value })}
                placeholder="セリフを入力"
                className="rounded-2xl border p-2 bg-muted shadow-md min-h-[60px] text-sm w-full text-foreground"
                style={{ borderRadius: '20px 20px 20px 0' }}
              />
              {/* フキダシの三角形 */}
              <div className="absolute left-[-10px] top-4 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-muted"></div>
            </div>
            <div className="flex flex-col space-y-1 ml-2 mt-2">
              <select
                value={block.characterId}
                onChange={e => onUpdate({ characterId: e.target.value })}
                className="p-1 border rounded bg-background text-foreground focus:ring-2 focus:ring-ring text-xs"
              >
                <option value="">ト書きを入力</option>
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {character && (
                <select
                  value={block.emotion}
                  onChange={e => onUpdate({ emotion: e.target.value as Emotion })}
                  className="p-1 border rounded bg-background text-foreground focus:ring-2 focus:ring-ring text-xs"
                >
                  {Object.keys(character.emotions).map(emotion => (
                    <option key={emotion} value={emotion}>
                      {emotion}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}
        <div className="flex justify-end space-x-1 mt-1">
          <button
            onClick={onMoveUp}
            className="p-1 rounded hover:bg-accent"
          >
            <ArrowUpIcon className="w-4 h-4 text-foreground" />
          </button>
          <button
            onClick={onMoveDown}
            className="p-1 rounded hover:bg-accent"
          >
            <ArrowDownIcon className="w-4 h-4 text-foreground" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-1 rounded hover:bg-accent"
          >
            <DocumentDuplicateIcon className="w-4 h-4 text-foreground" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-destructive hover:bg-destructive/10 rounded"
          >
            <TrashIcon className="w-4 h-4" />
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
  useEffect(() => {
    // ブロック数が変わったらref配列を調整
    textareaRefs.current = textareaRefs.current.slice(0, script.blocks.length);
  }, [script.blocks.length]);

  // 最後に追加されたブロックに自動フォーカス
  const prevBlockCount = useRef(script.blocks.length);
  useEffect(() => {
    if (script.blocks.length > prevBlockCount.current) {
      setTimeout(() => {
        const lastIdx = script.blocks.length - 1;
        textareaRefs.current[lastIdx]?.focus();
      }, 0);
    }
    prevBlockCount.current = script.blocks.length;
  }, [script.blocks.length]);

  // ショートカットキー
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // フォーカス中のtextareaを特定
      const activeIdx = textareaRefs.current.findIndex(ref => ref === document.activeElement);
      // Ctrl+B: 新規ブロック
      if (e.ctrlKey && !e.altKey && e.key === 'b') {
        e.preventDefault();
        onAddBlock();
      }
      // Ctrl+Alt+B: 新規ト書き
      else if (e.ctrlKey && e.altKey && e.key === 'b') {
        e.preventDefault();
        const idx = activeIdx >= 0 ? activeIdx + 1 : script.blocks.length;
        const newBlock: ScriptBlock = {
          id: Date.now().toString(),
          characterId: '',
          emotion: 'normal',
          text: ''
        };
        onInsertBlock(newBlock, idx);
        setTimeout(() => {
          textareaRefs.current[idx]?.focus();
        }, 0);
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
      // Alt+→: 次の感情を選択
      else if (!e.ctrlKey && e.shiftKey && e.key === 'ArrowRight') {
        if (activeIdx >= 0) {
          const block = script.blocks[activeIdx];
          if (block.characterId) {
            const character = script.characters.find(c => c.id === block.characterId);
            if (character) {
              const emotions = Object.keys(character.emotions);
              const idx = emotions.indexOf(block.emotion);
              if (idx >= 0 && idx < emotions.length - 1) {
                e.preventDefault();
                onUpdateBlock(block.id, { emotion: emotions[idx + 1] as Emotion });
              }
            }
          }
        }
      }
      // Alt+←: 前の感情を選択
      else if (!e.ctrlKey && e.shiftKey && e.key === 'ArrowLeft') {
        if (activeIdx >= 0) {
          const block = script.blocks[activeIdx];
          if (block.characterId) {
            const character = script.characters.find(c => c.id === block.characterId);
            if (character) {
              const emotions = Object.keys(character.emotions);
              const idx = emotions.indexOf(block.emotion);
              if (idx > 0) {
                e.preventDefault();
                onUpdateBlock(block.id, { emotion: emotions[idx - 1] as Emotion });
              }
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
            id: Date.now().toString(),
            characterId: currentBlock.characterId,
            emotion: currentBlock.emotion,
            text: ''
          };
          onInsertBlock(newBlock, activeIdx + 1);
          setTimeout(() => {
            textareaRefs.current[activeIdx + 1]?.focus();
          }, 0);
        }
      }
      // Ctrl+↑: ブロック上移動
      else if (e.ctrlKey && e.key === 'ArrowUp') {
        if (activeIdx > 0) {
          e.preventDefault();
          onMoveBlock(activeIdx, activeIdx - 1);
          setTimeout(() => {
            textareaRefs.current[activeIdx - 1]?.focus();
          }, 0);
        }
      }
      // Ctrl+↓: ブロック下移動
      else if (e.ctrlKey && e.key === 'ArrowDown') {
        if (activeIdx >= 0 && activeIdx < script.blocks.length - 1) {
          e.preventDefault();
          onMoveBlock(activeIdx, activeIdx + 1);
          setTimeout(() => {
            textareaRefs.current[activeIdx + 1]?.focus();
          }, 0);
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
                      id: Date.now().toString(),
                      text: ''
                    };
                    onAddBlock();
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
      <button
        onClick={onAddBlock}
        className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg transition-colors text-lg"
      >
        ＋ブロックを追加
      </button>
    </>
  );
}