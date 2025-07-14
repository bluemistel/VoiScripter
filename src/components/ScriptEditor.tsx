'use client';

import { useState } from 'react';
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
  onMoveDown
}: SortableBlockProps) {
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