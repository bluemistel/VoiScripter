'use client';

import { useState, useRef, useEffect, useMemo, useCallback, ChangeEvent, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Script, ScriptBlock, Character, Emotion, StorySeparatorSegment, StorySeparatorImage } from '@/types';
import { loadStoryPanelAsset, removeStoryPanelAsset, saveStoryPanelAsset } from '@/utils/storyPanelAssets';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ScissorsIcon,
  PhotoIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilSquareIcon
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
  reverseToolbarOrder?: boolean;
  currentProjectId?: string;
  onUpdateScript?: (updates: Partial<Script>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
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
  const [isMobileCharacterPickerOpen, setIsMobileCharacterPickerOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateMobileView = () => {
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const smallScreen = window.innerWidth < 640;
      setIsMobileView(coarsePointer || smallScreen);
    };
    updateMobileView();
    window.addEventListener('resize', updateMobileView);
    return () => window.removeEventListener('resize', updateMobileView);
  }, []);

  const selectableCharacters = characters.filter(c =>
    c.id === '' ||
    !currentProjectId ||
    !c.disabledProjects ||
    !c.disabledProjects.includes(currentProjectId)
  );

  const renderCharacterVisual = () => {
    if (!character) return null;
    if (character.emotions[block.emotion]?.iconUrl) {
      return (
        <img
          src={character.emotions[block.emotion]?.iconUrl}
          alt={character.name}
          className={`w-16 h-16 sm:w-16 sm:h-16 md:w-16 md:h-16 rounded-full object-cover mt-0 mr-2 transition-all duration-300 ${animateBorder ? 'outline-4 outline-primary outline-offset-2' : ''}`}
        />
      );
    }
    return (
      <div
        className={`w-16 h-16 sm:w-16 sm:h-16 md:w-16 md:h-16 rounded-full flex items-center justify-center text-center mt-0 mr-2 overflow-hidden transition-all duration-300 ${animateBorder ? 'outline-4 outline-primary outline-offset-2' : ''}`}
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
    );
  };

  const handleSelectCharacter = (characterId: string) => {
    onUpdate({ characterId });
    setIsMobileCharacterPickerOpen(false);
  };

  const keepTextareaAboveToolbar = (target: HTMLTextAreaElement) => {
    if (typeof window === 'undefined') return;
    const toolbarElement = document.querySelector('[data-floating-toolbar="true"]') as HTMLElement | null;
    if (!toolbarElement) return;

    const toolbarTop = toolbarElement.getBoundingClientRect().top;
    const textareaRect = target.getBoundingClientRect();
    const overlap = textareaRect.bottom - (toolbarTop - 8);
    if (overlap > 0) {
      window.scrollBy({
        top: overlap + 20,
        behavior: 'smooth'
      });
    }
  };

  const isImeComposingKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const nativeEvent = event.nativeEvent as KeyboardEvent;
    return nativeEvent.isComposing || nativeEvent.keyCode === 229;
  };

  const buildBlockFromLastSpeaker = () => {
    const lastSpeakerBlock = [...script.blocks].reverse().find((b) => b.characterId);
    const fallbackCharacterId = characters.find((c) => c.id)?.id || '';
    return {
      characterId: lastSpeakerBlock?.characterId || fallbackCharacterId,
      emotion: (lastSpeakerBlock?.emotion || 'normal') as Emotion
    };
  };

  const renderCharacterGridVisual = (c: Character) => {
    const iconUrl = c.emotions.normal?.iconUrl;
    if (iconUrl) {
      return (
        <img
          src={iconUrl}
          alt={c.name}
        className="w-10 h-10 rounded-full object-cover border"
        />
      );
    }
    return (
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold border"
        style={{ backgroundColor: c.backgroundColor || '#e5e7eb' }}
      >
        {c.name?.slice(0, 2) || '?'}
      </div>
    );
  };

  return (
    <>
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={`flex items-start space-x-1 sm:space-x-2 p-1 sm:p-2 rounded-xl bg-card/80 shadow-(--separator-shadow-block) mb-2 transition-colors cursor-grab touch-manipulation ${isSelected || isTextareaFocused ? 'ring-2 ring-primary/50' : 'ring-[0.5px] ring-foreground/10 dark:ring-white/15'}`}
      onClick={onClick}
      data-block-index={script.blocks.findIndex(b => b.id === block.id)}
    >
      <div className="flex-1">
        {isTogaki ? (
          <div className="flex items-center space-x-2">
            <textarea
              ref={textareaRef}
              value={block.text}
              onChange={e => onUpdate({ text: e.target.value })}
              placeholder="ト書きを入力"
              className="w-full p-2 pt-2 rounded-2xl min-h-[40px] bg-muted/70 text-foreground shadow-(--separator-shadow-input) ring-1 ring-foreground/15 dark:ring-white/20 focus:ring-1 focus:ring-primary/40 text-sm italic focus:outline-none resize-none overflow-hidden"
              rows={1}
              style={{ height: 'auto', borderRadius: '20px 20px 20px 0' }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onFocus={() => setIsTextareaFocused(true)}
              onBlur={() => setIsTextareaFocused(false)}
              onKeyDown={e => {
                // DnDキーボードセンサーへの伝播を防ぎ、IME確定Enterで並び替えモードに入らないようにする
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                }
                if (isImeComposingKey(e)) {
                  return;
                }
                // チェックボックスの状態に応じてEnter操作のみで切り替え
                const shouldAddBlock = enterOnlyBlockAdd 
                  ? (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey)  // Enter入力のみモード
                  : (e.key === 'Enter' && e.ctrlKey);                 // 従来のCtrl+Enterモード
                
                if (shouldAddBlock) {
                  e.preventDefault();
                  const { characterId, emotion } = buildBlockFromLastSpeaker();
                  const newBlock: ScriptBlock = {
                    id: Date.now().toString(),
                    characterId,
                    emotion,
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
                keepTextareaAboveToolbar(target);
              }}
            />

            {/* キャラ選択リストとアイコン群を横並びに */}
            <div className="flex flex-col justify-between items-center h-16 mr-0.5 sm:mr-1 md:mr-2 mt-0">
              {!isMobileView && (
                <select
                  value={block.characterId}
                  onChange={e => onUpdate({ characterId: e.target.value })}
                  className="ml-1 p-2 pl-3 border rounded bg-background text-foreground focus:ring-1 focus:ring-ring text-xs w-24 sm:w-28 md:w-32 lg:w-36 mb-1"
                  style={{ height: '2.5rem' }}
                >
                  <option value="">ト書きを入力</option>
                  {selectableCharacters.map(c => (
                    <option key={c.id || 'togaki'} value={c.id}>{c.name || 'ト書き'}</option>
                  ))}
                </select>
              )}
              <div className="flex flex-row justify-items-center space-x-0.5 sm:space-x-0.5 md:space-x-0.5 mt-0">
                {!isMobileView && (
                  <>
                <button
                      onClick={onMoveUp}
                      className="p-1 rounded hover:bg-accent"
                      title="Ctrl+↑:ブロックを上に移動"
                      style={{ height: '2.25rem', width: '2.25rem' }}
                    >
                      <ArrowUpIcon className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 text-foreground" />
                    </button>
                    <button
                      onClick={onMoveDown}
                      className="p-1 rounded hover:bg-accent"
                      title="Ctrl+↓:ブロックを下に移動"
                      style={{ height: '2.25rem', width: '2.25rem' }}
                    >
                      <ArrowDownIcon className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 text-foreground" />
                    </button>
                  </>
                )}
                {!isMobileView && (
                  <>
                    <button
                      onClick={onDuplicate}
                      className="p-1 rounded hover:bg-accent"
                      title="Ctrl+B:ブロックを複製"
                      style={{ height: '2.25rem', width: '2.25rem' }}
                    >
                      <DocumentDuplicateIcon className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 text-foreground" />
                    </button>
                    <button
                      onClick={onDelete}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded"
                      title="Alt+B:ブロックを削除"
                      style={{ height: '2.25rem', width: '2.25rem' }}
                    >
                      <TrashIcon className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

        ) : (
          <div className="flex items-start space-x-2">
            {/* 左列: キャラアイコン + プリセット選択（デスクトップのみ） */}
            <div className="flex flex-col items-center shrink-0">
              {isMobileView ? (
                <button
                  type="button"
                  className="rounded-full p-0.5"
                  onClick={() => setIsMobileCharacterPickerOpen(true)}
                  title="話者を選択"
                >
                  {renderCharacterVisual()}
                </button>
              ) : (
                renderCharacterVisual()
              )}
              {!isMobileView && character?.userPresets && character.userPresets.length > 0 && (
                <select
                  value={block.userPresetId || ''}
                  onChange={e => onUpdate({ userPresetId: e.target.value || undefined })}
                  className="mt-0.5 border rounded-sm bg-background text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 truncate"
                  style={{ width: '4rem', height: '1.375rem', fontSize: '9px', padding: '0 2px' }}
                  title="Alt+Shift+↑↓:プリセットを切り替え"
                  onPointerDown={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <option value="">-</option>
                  {character.userPresets.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="relative flex-1 pl-2">
              <textarea
                ref={textareaRef}
                value={block.text}
                onChange={e => onUpdate({ text: e.target.value })}
                onKeyDown={e => {
                  // DnDキーボードセンサーへの伝播を防ぎ、IME確定Enterで並び替えモードに入らないようにする
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                  }
                  if (isImeComposingKey(e)) {
                    return;
                  }
                  // チェックボックスの状態に応じてEnter操作のみで切り替え
                  const shouldAddBlock = enterOnlyBlockAdd 
                    ? (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey)  // Enter入力のみモード
                    : (e.key === 'Enter' && e.ctrlKey);                 // 従来のCtrl+Enterモード
                  
                  if (shouldAddBlock) {
                    e.preventDefault();
                    const { characterId, emotion } = buildBlockFromLastSpeaker();
                    const newBlock: ScriptBlock = {
                      id: Date.now().toString(),
                      characterId,
                      emotion,
                      text: ''
                    };
                    const currentIndex = script.blocks.findIndex(b => b.id === block.id);
                    insertIdx.current = currentIndex + 1; // 挿入インデックスを設定
                    onInsertBlock(newBlock, currentIndex + 1);
                  }
                }}
                placeholder="セリフを入力"
                className="rounded-2xl p-2 bg-card/95 shadow-(--separator-shadow-input) ring-1 ring-foreground/15 dark:ring-white/20 min-h-[60px] text-sm w-full text-foreground focus:ring-1 focus:ring-primary/40 focus:outline-none resize-none overflow-hidden"
                rows={1}
                style={{ height: 'auto', borderRadius: '20px 20px 20px 0' }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onFocus={() => setIsTextareaFocused(true)}
                onBlur={() => setIsTextareaFocused(false)}
                onInput={e => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                  keepTextareaAboveToolbar(target);
                }}
              />
              {/* フキダシの三角形 */}
              <div className="absolute left-[-4px] top-6 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-gray-400 dark:border-r-gray-500"></div>
            </div>
            {/* キャラ選択リストとアイコン群を横並びに */}
            <div className="flex flex-col justify-between items-center h-16 mr-0.5 sm:mr-1 md:mr-2 mt-0">
              {!isMobileView && (
                <select
                  value={block.characterId}
                  onChange={e => onUpdate({ characterId: e.target.value, userPresetId: undefined })}
                  className="ml-1 p-2 pl-3 border rounded bg-background text-foreground focus:ring-1 focus:ring-ring text-xs w-24 sm:w-28 md:w-32 lg:w-36 mb-1"
                  style={{ height: '2.5rem' }}
                  title="Alt+↑↓:話者を切り替え"
                >
                  <option value="">ト書きを入力</option>
                  {selectableCharacters.map(c => (
                    <option key={c.id || 'togaki'} value={c.id}>{c.name || 'ト書き'}</option>
                  ))}
                </select>
              )}
              <div className="flex flex-row justify-items-center space-x-0.5 sm:space-x-0.5 md:space-x-0.5 mt-0">
                {!isMobileView && (
                  <>
                    <button
                      onClick={onMoveUp}
                      className="p-1 rounded hover:bg-accent"
                      title="Ctrl+↑:ブロックを上に移動"
                      style={{ height: '2.25rem', width: '2.25rem' }}
                    >
                      <ArrowUpIcon className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 text-foreground" />
                    </button>
                    <button
                      onClick={onMoveDown}
                      className="p-1 rounded hover:bg-accent"
                      title="Ctrl+↓:ブロックを下に移動"
                      style={{ height: '2.25rem', width: '2.25rem' }}
                    >
                      <ArrowDownIcon className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 text-foreground" />
                    </button>
                  </>
                )}
                {!isMobileView && (
                  <>
                    <button
                      onClick={onDuplicate}
                      className="p-1 rounded hover:bg-accent"
                      title="Ctrl+B:ブロックを複製"
                      style={{ height: '2.25rem', width: '2.25rem' }}
                    >
                      <DocumentDuplicateIcon className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 text-foreground" />
                    </button>
                    <button
                      onClick={onDelete}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded"
                      title="Alt+B:ブロックを削除"
                      style={{ height: '2.25rem', width: '2.25rem' }}
                    >
                      <TrashIcon className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    {isMobileView && isMobileCharacterPickerOpen && (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setIsMobileCharacterPickerOpen(false)}>
        <div
          className="w-full max-h-[70vh] bg-background border-t rounded-t-xl p-4 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">話者を選択</h3>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border"
              onClick={() => setIsMobileCharacterPickerOpen(false)}
            >
              閉じる
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`p-2 border rounded text-left text-xs flex items-center gap-2 ${!block.characterId ? 'border-primary bg-primary/5' : ''}`}
              onClick={() => handleSelectCharacter('')}
            >
              <div className="w-10 h-10 rounded-full border flex items-center justify-center text-xs font-bold bg-muted">ト</div>
              ト書き
            </button>
            {selectableCharacters
              .filter(c => c.id !== '')
              .map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`p-2 border rounded text-left text-xs flex items-center gap-2 ${block.characterId === c.id ? 'border-primary bg-primary/5' : ''}`}
                  onClick={() => handleSelectCharacter(c.id)}
                >
                  {renderCharacterGridVisual(c)}
                  {c.name}
                </button>
              ))}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

const generateSegmentId = () => `segment_${Date.now().toString()}_${Math.random().toString(36).slice(2, 6)}`;
const MIN_PANEL_WIDTH = 240;
const MAX_PANEL_WIDTH = 520;

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
  reverseToolbarOrder = false,
  currentProjectId,
  onUpdateScript,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
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
    })
  );

  // テキストエリアref配列（外部から渡された場合はそれを使用、そうでなければ内部で作成）
  const internalTextareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const textareaRefs = externalTextareaRefs || internalTextareaRefs;
  const [isButtonFixed, setIsButtonFixed] = useState(false);
  const [manualFocusTarget, setManualFocusTarget] = useState<{ index: number; id: string } | null>(null);
  const [isStoryPanelOpen, setIsStoryPanelOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState<number>(script.storyPanelWidth || 320);
  const panelWidthRef = useRef(panelWidth);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [segmentHeights, setSegmentHeights] = useState<Record<string, number>>({});
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [lineDragState, setLineDragState] = useState<{ mode: 'new' | 'move'; segmentId?: string; targetBlockId?: string } | null>(null);
  const [lineIndicatorY, setLineIndicatorY] = useState<number | null>(null);
  const [segmentToDelete, setSegmentToDelete] = useState<StorySeparatorSegment | null>(null);
  const [lineDeleteTarget, setLineDeleteTarget] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageActionRef = useRef<{ segmentId: string } | null>(null);
  const [imageToDelete, setImageToDelete] = useState<{ segmentId: string } | null>(null);
  const [currentDisplayedSegmentId, setCurrentDisplayedSegmentId] = useState<string | null>(null);
  const [editingLabelSegmentId, setEditingLabelSegmentId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState('');
  const [localSegmentImages, setLocalSegmentImages] = useState<Record<string, StorySeparatorImage>>({});
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [isTabletOrLarger, setIsTabletOrLarger] = useState(false);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [mobileToolbarBottom, setMobileToolbarBottom] = useState(16);
  const [dragOverSegmentId, setDragOverSegmentId] = useState<string | null>(null);
  const pendingFocusIndexAfterDelete = useRef<number | null>(null);
  
  useEffect(() => {
    setPanelWidth(script.storyPanelWidth || 320);
  }, [script.storyPanelWidth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateLayout = () => {
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const tabletOrLarger = window.innerWidth >= 768;
      const smallScreen = window.innerWidth < 768;
      setIsTabletOrLarger(tabletOrLarger);
      setIsMobileLayout(coarsePointer || smallScreen);
      if (!tabletOrLarger) {
        setIsToolbarCollapsed(false);
      }
    };
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    if (isMobileLayout && isStoryPanelOpen) {
      setIsStoryPanelOpen(false);
    }
  }, [isMobileLayout, isStoryPanelOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isMobileLayout) {
      setMobileToolbarBottom(16);
      return;
    }

    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      setMobileToolbarBottom(16);
      return;
    }

    const updateToolbarBottom = () => {
      const keyboardInset = Math.max(
        0,
        Math.round(window.innerHeight - (visualViewport.height + visualViewport.offsetTop))
      );

      // 小さなUI変動は無視し、キーボード表示時のみツールバーを押し上げる
      if (keyboardInset > 80) {
        setMobileToolbarBottom(keyboardInset + 8);
      } else {
        setMobileToolbarBottom(16);
      }
    };

    updateToolbarBottom();
    visualViewport.addEventListener('resize', updateToolbarBottom);
    visualViewport.addEventListener('scroll', updateToolbarBottom);
    window.addEventListener('resize', updateToolbarBottom);

    return () => {
      visualViewport.removeEventListener('resize', updateToolbarBottom);
      visualViewport.removeEventListener('scroll', updateToolbarBottom);
      window.removeEventListener('resize', updateToolbarBottom);
    };
  }, [isMobileLayout]);

  useEffect(() => {
    if (!lineDeleteTarget) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.story-panel-line-control')) {
        setLineDeleteTarget(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [lineDeleteTarget]);

  useEffect(() => {
    if (!isStoryPanelOpen) {
      setLineDeleteTarget(null);
    }
  }, [isStoryPanelOpen]);

  useEffect(() => {
    panelWidthRef.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    if (!onUpdateScript) return;
    if (!script.storySegments || script.storySegments.length === 0) {
      onUpdateScript({
        storySegments: [
          {
            id: generateSegmentId(),
            anchorBlockId: null
          }
        ]
      });
    }
  }, [script.storySegments, onUpdateScript]);

  const storySegments = useMemo<StorySeparatorSegment[]>(() => {
    if (script.storySegments && script.storySegments.length > 0) {
      return script.storySegments;
    }
    return [
      {
        id: 'segment_default',
        anchorBlockId: null
      }
    ];
  }, [script.storySegments]);

  const getAnchorIndex = useCallback(
    (anchorId: string | null | undefined) => {
      if (!anchorId) return 0;
      const index = script.blocks.findIndex(block => block.id === anchorId);
      return index === -1 ? script.blocks.length : index;
    },
    [script.blocks]
  );

  const orderedSegments = useMemo(() => {
    const segmentsCopy = [...storySegments];
    segmentsCopy.sort((a, b) => getAnchorIndex(a.anchorBlockId) - getAnchorIndex(b.anchorBlockId));
    return segmentsCopy;
  }, [storySegments, getAnchorIndex]);

  const projectStorageId = currentProjectId || 'default';

  const updateStorySegments = useCallback(
    (updater: (current: StorySeparatorSegment[]) => StorySeparatorSegment[]) => {
      if (!onUpdateScript) return;
      const current = script.storySegments && script.storySegments.length > 0 ? script.storySegments : storySegments;
      onUpdateScript({ storySegments: updater(current) });
    },
    [onUpdateScript, script.storySegments, storySegments]
  );

  useEffect(() => {
    let cancelled = false;
    const hydrateLocalImages = async () => {
      const nextLocalImages: Record<string, StorySeparatorImage> = {};
      for (const segment of storySegments) {
        if (!segment.imageRef?.assetId) continue;
        const image = await loadStoryPanelAsset(projectStorageId, script.id, segment.id);
        if (image) {
          nextLocalImages[segment.id] = image;
        }
      }
      if (!cancelled) {
        setLocalSegmentImages(nextLocalImages);
      }
    };
    void hydrateLocalImages();
    return () => {
      cancelled = true;
    };
  }, [projectStorageId, script.id, storySegments]);

  useEffect(() => {
    if (!onUpdateScript) return;
    const needsMigration = storySegments.some(segment => segment.image?.dataUrl && !segment.imageRef?.assetId);
    if (!needsMigration) return;
    let cancelled = false;
    const migrateSegments = async () => {
      const migratedSegments: StorySeparatorSegment[] = [];
      for (const segment of storySegments) {
        if (!segment.image?.dataUrl || segment.imageRef?.assetId) {
          migratedSegments.push(segment);
          continue;
        }
        const assetId = segment.image.id || `asset_${segment.id}`;
        const saved = await saveStoryPanelAsset(projectStorageId, script.id, segment.id, segment.image);
        if (!saved) {
          migratedSegments.push(segment);
          continue;
        }
        migratedSegments.push({
          ...segment,
          imageRef: {
            assetId,
            name: segment.image.name
          },
          image: undefined
        });
      }
      if (!cancelled) {
        onUpdateScript({ storySegments: migratedSegments });
      }
    };
    void migrateSegments();
    return () => {
      cancelled = true;
    };
  }, [onUpdateScript, projectStorageId, script.id, storySegments]);

  const handleSegmentImageChange = useCallback(
    async (segmentId: string, image?: StorySeparatorImage) => {
      if (!image) return;
      const saved = await saveStoryPanelAsset(projectStorageId, script.id, segmentId, image);
      setLocalSegmentImages(prev => ({ ...prev, [segmentId]: image }));
      updateStorySegments(prev =>
        prev.map(segment =>
          segment.id === segmentId
            ? {
                ...segment,
                ...(saved
                  ? {
                      imageRef: {
                        assetId: image.id,
                        name: image.name
                      },
                      image: undefined
                    }
                  : {
                      imageRef: undefined,
                      image
                    })
              }
            : segment
        )
      );
    },
    [projectStorageId, script.id, updateStorySegments]
  );

  const handleRemoveSegmentImage = useCallback(
    (segmentId: string) => {
      void removeStoryPanelAsset(projectStorageId, script.id, segmentId);
      setLocalSegmentImages(prev => {
        const next = { ...prev };
        delete next[segmentId];
        return next;
      });
      updateStorySegments(prev =>
        prev.map(segment =>
          segment.id === segmentId
            ? { ...segment, image: undefined, imageRef: undefined }
            : segment
        )
      );
    },
    [projectStorageId, script.id, updateStorySegments]
  );

  const handleUpdateSegmentLabel = useCallback(
    (segmentId: string, label: string) => {
      updateStorySegments(prev =>
        prev.map(segment => (segment.id === segmentId ? { ...segment, label: label || undefined } : segment))
      );
    },
    [updateStorySegments]
  );

  const startEditingLabel = useCallback((segmentId: string, currentLabel: string) => {
    setEditingLabelSegmentId(segmentId);
    setEditingLabelValue(currentLabel);
  }, []);

  const commitLabelEdit = useCallback(() => {
    if (editingLabelSegmentId) {
      handleUpdateSegmentLabel(editingLabelSegmentId, editingLabelValue.trim());
      setEditingLabelSegmentId(null);
      setEditingLabelValue('');
    }
  }, [editingLabelSegmentId, editingLabelValue, handleUpdateSegmentLabel]);

  const cancelLabelEdit = useCallback(() => {
    setEditingLabelSegmentId(null);
    setEditingLabelValue('');
  }, []);

  const addSegmentAtAnchor = useCallback(
    (anchorBlockId: string | null) => {
      if (anchorBlockId === null) return;
      if (storySegments.some(seg => seg.anchorBlockId === anchorBlockId)) {
        return;
      }
      updateStorySegments(prev => [
        ...prev,
        {
          id: generateSegmentId(),
          anchorBlockId
        }
      ]);
    },
    [storySegments, updateStorySegments]
  );

  const moveSegmentToAnchor = useCallback(
    (segmentId: string, anchorBlockId: string | null) => {
      if (anchorBlockId === null) return;
      if (storySegments.some(seg => seg.anchorBlockId === anchorBlockId && seg.id !== segmentId)) {
        return;
      }
      updateStorySegments(prev =>
        prev.map(segment => (segment.id === segmentId ? { ...segment, anchorBlockId } : segment))
      );
    },
    [storySegments, updateStorySegments]
  );

  const deleteSegment = useCallback(
    (segmentId: string) => {
      updateStorySegments(prev => {
        const target = prev.find(segment => segment.id === segmentId);
        if (!target || target.anchorBlockId === null) {
          return prev;
        }
        void removeStoryPanelAsset(projectStorageId, script.id, segmentId);
        setLocalSegmentImages(current => {
          const nextImages = { ...current };
          delete nextImages[segmentId];
          return nextImages;
        });
        const next = prev.filter(segment => segment.id !== segmentId);
        return next.length === 0
          ? [
              {
                id: generateSegmentId(),
                anchorBlockId: null
              }
            ]
          : next;
      });
    },
    [projectStorageId, script.id, updateStorySegments]
  );
  
  const openImagePicker = (segmentId: string) => {
    imageActionRef.current = { segmentId };
    imageFileInputRef.current?.click();
  };

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const action = imageActionRef.current;
    imageActionRef.current = null;
    if (!file || !action) {
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const payload: StorySeparatorImage = {
        id: `image_${generateSegmentId()}`,
        name: file.name,
        dataUrl
      };
      void handleSegmentImageChange(action.segmentId, payload);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleDropImageFile = useCallback(
    (segmentId: string, file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const payload: StorySeparatorImage = {
          id: `image_${generateSegmentId()}`,
          name: file.name,
          dataUrl
        };
        void handleSegmentImageChange(segmentId, payload);
      };
      reader.readAsDataURL(file);
    },
    [handleSegmentImageChange]
  );

  const handlePanelImageDragOver = useCallback((event: ReactDragEvent<HTMLElement>, segmentId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragOverSegmentId(segmentId);
  }, []);

  const handlePanelImageDrop = useCallback(
    (event: ReactDragEvent<HTMLElement>, segmentId: string) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      setDragOverSegmentId(null);
      if (!file) return;
      handleDropImageFile(segmentId, file);
    },
    [handleDropImageFile]
  );

  const determineAnchorFromClientY = useCallback(
    (clientY: number): string | null => {
      if (typeof window === 'undefined') return null;
      if (script.blocks.length === 0) return null;
      const boundaries: { y: number; anchorBlockId: string | null }[] = [];
      const container = document.querySelector('.script-editor-container');
      const containerRect = container?.getBoundingClientRect();
      boundaries.push({
        y: (containerRect?.top ?? 0) + window.scrollY,
        anchorBlockId: script.blocks[0]?.id ?? null
      });
      script.blocks.forEach((block, index) => {
        const element = document.querySelector(`[data-block-index="${index}"]`) as HTMLElement | null;
        if (element) {
          const rect = element.getBoundingClientRect();
          boundaries.push({
            y: rect.top + window.scrollY,
            anchorBlockId: block.id
          });
        }
      });
      if (boundaries.length === 0) return null;
      const absoluteY = clientY + window.scrollY;
      let nearest = boundaries[0];
      let minDiff = Math.abs(absoluteY - nearest.y);
      boundaries.forEach(boundary => {
        const diff = Math.abs(absoluteY - boundary.y);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = boundary;
        }
      });
      return nearest.anchorBlockId;
    },
    [script.blocks]
  );

  useEffect(() => {
    if (!lineDragState) return;
    const handleMove = (event: MouseEvent) => {
      setLineIndicatorY(event.clientY);
    };
    const handleUp = (event: MouseEvent) => {
      setLineIndicatorY(event.clientY);
      if (lineDragState.mode === 'new') {
        const anchorId = lineDragState.targetBlockId || determineAnchorFromClientY(event.clientY);
        if (anchorId) {
          addSegmentAtAnchor(anchorId);
        }
      } else if (lineDragState.segmentId) {
        const anchorId = determineAnchorFromClientY(event.clientY);
        if (anchorId) {
          moveSegmentToAnchor(lineDragState.segmentId, anchorId);
        }
      }
      setLineDragState(null);
      setLineIndicatorY(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [lineDragState, determineAnchorFromClientY, addSegmentAtAnchor, moveSegmentToAnchor]);

  const handleStartNewLineDrag = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isStoryPanelOpen || script.blocks.length < 2) {
      return;
    }
    setLineDeleteTarget(null);
    setLineDragState({ mode: 'new' });
    setLineIndicatorY(event.clientY);
  };

  const handleStartMoveLine = (segmentId: string) => (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setLineDeleteTarget(null);
    setLineDragState({ mode: 'move', segmentId });
    setLineIndicatorY(event.clientY);
  };

  const handleResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isStoryPanelOpen) return;
    setIsResizingPanel(true);
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: panelWidthRef.current
    };
  };

  useEffect(() => {
    if (!isResizingPanel) return;
    const handleMove = (event: MouseEvent) => {
      if (!resizeStateRef.current) return;
      const delta = event.clientX - resizeStateRef.current.startX;
      let nextWidth = resizeStateRef.current.startWidth + delta;
      nextWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, nextWidth));
      setPanelWidth(nextWidth);
      panelWidthRef.current = nextWidth;
    };
    const handleUp = () => {
      setIsResizingPanel(false);
      resizeStateRef.current = null;
      if (onUpdateScript) {
        onUpdateScript({ storyPanelWidth: panelWidthRef.current });
      }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizingPanel, onUpdateScript]);

  const calculateSegmentHeights = useCallback(() => {
    if (typeof window === 'undefined') return;
    const container = document.querySelector('.story-main-column');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top + window.scrollY;
    const containerBottom = containerRect.bottom + window.scrollY;
    const blockElements = script.blocks.map((_, index) => document.querySelector(`[data-block-index="${index}"]`) as HTMLElement | null);
    const getBoundaryY = (index: number) => {
      if (index <= 0) {
        const firstRect = blockElements[0]?.getBoundingClientRect();
        return firstRect ? firstRect.top + window.scrollY : containerTop;
      }
      const target = blockElements[index];
      if (target) {
        return target.getBoundingClientRect().top + window.scrollY;
      }
      const last = blockElements[blockElements.length - 1];
      return last ? last.getBoundingClientRect().bottom + window.scrollY : containerBottom;
    };
    const heights: Record<string, number> = {};
    orderedSegments.forEach((segment, idx) => {
      const startIndex = getAnchorIndex(segment.anchorBlockId);
      const nextSegment = orderedSegments[idx + 1];
      const endIndex = nextSegment ? getAnchorIndex(nextSegment.anchorBlockId) : script.blocks.length;
      const startY = getBoundaryY(startIndex);
      const endY =
        endIndex >= script.blocks.length
          ? (() => {
              const lastIndex = script.blocks.length - 1;
              const lastRect = blockElements[lastIndex]?.getBoundingClientRect();
              return lastRect ? lastRect.bottom + window.scrollY : containerBottom;
            })()
          : getBoundaryY(endIndex);
      const height = Math.max(endY - startY, 200);
      heights[segment.id] = height;
    });
    setSegmentHeights(heights);
  }, [orderedSegments, script.blocks, getAnchorIndex]);

  useEffect(() => {
    if (!isStoryPanelOpen) return;
    calculateSegmentHeights();
    const handleResize = () => calculateSegmentHeights();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isStoryPanelOpen, calculateSegmentHeights]);

  useEffect(() => {
    if (!isStoryPanelOpen) return;
    const timer = setTimeout(() => calculateSegmentHeights(), 150);
    return () => clearTimeout(timer);
  }, [script.blocks, orderedSegments, calculateSegmentHeights, isStoryPanelOpen]);

  useEffect(() => {
    if (!isStoryPanelOpen) {
      setActiveSegmentId(null);
      setCurrentDisplayedSegmentId(null);
      return;
    }
    
    const handleScroll = () => {
      if (script.blocks.length === 0) {
        const firstSegment = orderedSegments[0];
        setActiveSegmentId(firstSegment?.id ?? null);
        setCurrentDisplayedSegmentId(firstSegment?.id ?? null);
        return;
      }
      const threshold = 120;
      const nearBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
      let currentIndex = 0;
      if (nearBottom) {
        currentIndex = script.blocks.length - 1;
      } else {
        script.blocks.forEach((_, index) => {
          const element = document.querySelector(`[data-block-index="${index}"]`) as HTMLElement | null;
          if (!element) return;
          const rect = element.getBoundingClientRect();
          if (rect.top - threshold <= 0) {
            currentIndex = index;
          }
        });
      }
      const active =
        [...orderedSegments]
          .reverse()
          .find(segment => getAnchorIndex(segment.anchorBlockId) <= currentIndex) ?? orderedSegments[0];
      setActiveSegmentId(active?.id ?? null);
      setCurrentDisplayedSegmentId(active?.id ?? null);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isStoryPanelOpen, orderedSegments, script.blocks, getAnchorIndex]);

  const handleConfirmDeleteSegment = () => {
    if (segmentToDelete) {
      deleteSegment(segmentToDelete.id);
      setSegmentToDelete(null);
    }
  };

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
  }, [script.blocks.length]);

  useEffect(() => {
    const pendingIndex = pendingFocusIndexAfterDelete.current;
    if (pendingIndex === null) return;
    pendingFocusIndexAfterDelete.current = null;

    if (script.blocks.length === 0) {
      onSelectedBlockIdsChange([]);
      return;
    }

    const nextIndex = Math.min(pendingIndex, script.blocks.length - 1);
    const nextBlockId = script.blocks[nextIndex]?.id;

    setTimeout(() => {
      const focusRef = textareaRefs.current[nextIndex];
      if (focusRef) {
        focusRef.focus();
        ensureBlockVisible(nextIndex, 20);
      }
      if (nextBlockId) {
        onSelectedBlockIdsChange([nextBlockId]);
      }
    }, 30);
  }, [script.blocks, onSelectedBlockIdsChange]);

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
          const insertedRef = textareaRefs.current[insertIdx.current];
          insertedRef?.focus({ preventScroll: true });
          onSelectedBlockIdsChange([script.blocks[insertIdx.current]?.id || '']); // 単一選択に変更
          ensureBlockVisible(insertIdx.current, 10);
          insertIdx.current = -1; // リセット
        }, 10);
        prevBlockCount.current = script.blocks.length;
        return;
      }
      
      // 通常の最後のブロックへの自動フォーカス
      //console.log('Auto focusing last block');
      setTimeout(() => {
        const lastIdx = script.blocks.length - 1;
        textareaRefs.current[lastIdx]?.focus({ preventScroll: true });
        onSelectedBlockIdsChange([script.blocks[lastIdx]?.id || '']); // 単一選択に変更
        ensureBlockVisible(lastIdx, 10);
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
          const { bottomBoundary, headerHeight } = getViewportBounds();
          const needsScroll = rect.bottom > bottomBoundary || rect.top < headerHeight;
          
          // スクロールが必要な場合のみ、スクロール位置を保存
          const scrollYBeforeFocus = needsScroll ? window.scrollY : null;
          
          targetRef.focus({ preventScroll: true });
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
      }, 50);
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

  // スクロール＆選択機能
  const scrollToBlock = (index: number) => {
          if (textareaRefs.current[index]) {
        textareaRefs.current[index]?.focus();
        onSelectedBlockIdsChange([script.blocks[index]?.id || '']); // 単一選択に変更
        ensureBlockVisible(index, 50);
      }
  };

  const getViewportBounds = () => {
    const headerHeight = 64;
    const toolbarElement = document.querySelector('[data-floating-toolbar="true"]') as HTMLElement | null;
    const toolbarTop = toolbarElement?.getBoundingClientRect().top ?? window.innerHeight;
    const bottomBoundary = Math.min(window.innerHeight, toolbarTop) - 8;
    const bottomSafeMargin = isMobileLayout ? 92 : 20;
    return { headerHeight, bottomBoundary, bottomSafeMargin };
  };

  // ブロックがウィンドウの表示領域に収まるようにスクロール位置を調整する関数
  const ensureBlockVisible = (index: number, delay: number = 10) => {
    setTimeout(() => {
      const targetRef = textareaRefs.current[index];
      if (targetRef) {
        const rect = targetRef.getBoundingClientRect();
        const { bottomBoundary, headerHeight, bottomSafeMargin } = getViewportBounds();
        const safeBottom = bottomBoundary - bottomSafeMargin;
        
        // ブロックが画面外にある場合のみスクロール
        if (rect.bottom > safeBottom) {
          // 下方向にスクロールが必要な場合
          const scrollOffset = rect.bottom - safeBottom + 8;
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
    scrollToY(0, 500);
    setTimeout(() => {
              if (textareaRefs.current[0]) {
          textareaRefs.current[0]?.focus();
          onSelectedBlockIdsChange([script.blocks[0]?.id || '']); // 単一選択に変更
        }
    }, 500);
  };
  const handleScrollBottom = () => {
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
  const lastArrowKeyTime = useRef<number>(0);
  const arrowKeyDelay = 80; // 0.08秒（80ミリ秒）
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) {
        return;
      }
      // フォーカス中のtextareaを特定
      const activeIdx = textareaRefs.current.findIndex(ref => ref === document.activeElement);
      
      // ↑: 上のブロック（テキストエリアの最上段のみ）
      if (!e.ctrlKey && e.key === 'ArrowUp' && !e.altKey && !e.shiftKey) {
        // キーリピートの間隔を制御（0.08秒間隔）
        const now = Date.now();
        if (now - lastArrowKeyTime.current < arrowKeyDelay) {
          return;
        }
        lastArrowKeyTime.current = now;
        
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
                // focus()の前に位置を取得
                const rectBeforeFocus = targetRef.getBoundingClientRect();
                const { bottomBoundary, headerHeight } = getViewportBounds();
                
                // ブロックが画面外にあるかどうかを判定
                const needsScrollDown = rectBeforeFocus.bottom > bottomBoundary;
                const needsScrollUp = rectBeforeFocus.top < headerHeight;
                const needsScroll = needsScrollDown || needsScrollUp;
                
                // ブロックが画面外にある場合のみpreventScrollをtrueにして、ブラウザの自動スクロールを防ぐ
                targetRef.focus({ preventScroll: needsScroll });
                
                // ブロックが画面外にある場合、適切な位置にスクロール（1回の操作で完了）
                if (needsScroll) {
                  setTimeout(() => {
                    if (needsScrollDown) {
                      // ブロックの下端が画面下端に来るようにスクロール
                      const scrollOffset = rectBeforeFocus.bottom - bottomBoundary + 20; // 20pxのマージン
                      window.scrollBy({
                        top: scrollOffset,
                        behavior: 'smooth'
                      });
                    } else if (needsScrollUp) {
                      // ブロックが画面上に隠れている場合
                      const scrollOffset = rectBeforeFocus.top - headerHeight - 65; // ヘッダーの高さ + 65pxのマージン
                      window.scrollBy({
                        top: scrollOffset,
                        behavior: 'smooth'
                      });
                    }
                  }, 10);
                }
              }
            }
          }
        }
      }
      // ↓: 下のブロック（テキストエリアの最下段のみ）
      else if (!e.ctrlKey && e.key === 'ArrowDown' && !e.altKey && !e.shiftKey) {
        // キーリピートの間隔を制御（0.1秒間隔）
        const now = Date.now();
        if (now - lastArrowKeyTime.current < arrowKeyDelay) {
          return;
        }
        lastArrowKeyTime.current = now;
        
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
                // focus()の前に位置を取得
                const rectBeforeFocus = targetRef.getBoundingClientRect();
                const { bottomBoundary, headerHeight } = getViewportBounds();
                
                // ブロックが画面外にあるかどうかを判定
                const needsScrollDown = rectBeforeFocus.bottom > bottomBoundary;
                const needsScrollUp = rectBeforeFocus.top < headerHeight;
                const needsScroll = needsScrollDown || needsScrollUp;
                
                // ブロックが画面外にある場合のみpreventScrollをtrueにして、ブラウザの自動スクロールを防ぐ
                targetRef.focus({ preventScroll: needsScroll });
                
                // ブロックが画面外にある場合、適切な位置にスクロール（1回の操作で完了）
                if (needsScroll) {
                  setTimeout(() => {
                    if (needsScrollDown) {
                      // ブロックの下端が画面下端に来るようにスクロール
                      const scrollOffset = rectBeforeFocus.bottom - bottomBoundary + 20; // 20pxのマージン
                      window.scrollBy({
                        top: scrollOffset,
                        behavior: 'smooth'
                      });
                    } else if (needsScrollUp) {
                      // ブロックが画面上に隠れている場合
                      const scrollOffset = rectBeforeFocus.top - headerHeight - 20; // ヘッダーの高さ + 20pxのマージン
                      window.scrollBy({
                        top: scrollOffset,
                        behavior: 'smooth'
                      });
                    }
                  }, 10);
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

  const getPrimarySelectedIndex = useCallback(() => {
    if (selectedBlockIds.length === 0) return -1;
    return script.blocks.findIndex((block) => block.id === selectedBlockIds[0]);
  }, [selectedBlockIds, script.blocks]);

  const getLastSpeakerTemplate = useCallback(() => {
    const lastSpeakerBlock = [...script.blocks].reverse().find((block) => block.characterId);
    const fallbackCharacterId = characters.find((c) => c.id)?.id || '';
    return {
      characterId: lastSpeakerBlock?.characterId || fallbackCharacterId,
      emotion: (lastSpeakerBlock?.emotion || 'normal') as Emotion
    };
  }, [characters, script.blocks]);

  const handleMoveSelectedBlock = useCallback((direction: 'up' | 'down') => {
    const currentIndex = getPrimarySelectedIndex();
    if (currentIndex < 0) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= script.blocks.length) return;
    onMoveBlock(currentIndex, targetIndex);
    setTimeout(() => {
      const movedId = script.blocks[currentIndex]?.id;
      if (movedId) {
        onSelectedBlockIdsChange([movedId]);
      }
      ensureBlockVisible(targetIndex, 30);
    }, 30);
  }, [getPrimarySelectedIndex, onMoveBlock, onSelectedBlockIdsChange, script.blocks]);

  const handleAddBlockBelowSelected = useCallback(() => {
    const currentIndex = getPrimarySelectedIndex();
    const insertIndex = currentIndex >= 0 ? currentIndex + 1 : script.blocks.length;
    const { characterId, emotion } = getLastSpeakerTemplate();

    const newBlock: ScriptBlock = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      characterId,
      emotion,
      text: ''
    };
    insertIdx.current = insertIndex;
    onInsertBlock(newBlock, insertIndex);
    setTimeout(() => {
      setManualFocusTargetFn({ index: insertIndex, id: newBlock.id });
    }, 10);
  }, [getLastSpeakerTemplate, getPrimarySelectedIndex, onInsertBlock, script.blocks.length, setManualFocusTargetFn]);

  const handleAddTogakiBelowSelected = useCallback(() => {
    const currentIndex = getPrimarySelectedIndex();
    const insertIndex = currentIndex >= 0 ? currentIndex + 1 : script.blocks.length;
    handleAddTogaki(insertIndex);
  }, [getPrimarySelectedIndex, script.blocks.length]);

  const primarySelectedBlockId = useMemo(() => selectedBlockIds[0] || null, [selectedBlockIds]);
  const primarySelectedIndex = useMemo(() => {
    if (!primarySelectedBlockId) return -1;
    return script.blocks.findIndex((block) => block.id === primarySelectedBlockId);
  }, [primarySelectedBlockId, script.blocks]);
  const canMoveSelectedUp = primarySelectedIndex > 0;
  const canMoveSelectedDown = primarySelectedIndex >= 0 && primarySelectedIndex < script.blocks.length - 1;
  const canOperateSelectedBlock = primarySelectedIndex >= 0 && !!primarySelectedBlockId;

  const handleDuplicateSelectedBlock = useCallback(() => {
    if (!primarySelectedBlockId || primarySelectedIndex < 0) return;
    const sourceBlock = script.blocks[primarySelectedIndex];
    if (!sourceBlock) return;

    const duplicatedBlock: ScriptBlock = {
      ...sourceBlock,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    };

    const insertIndex = primarySelectedIndex + 1;
    insertIdx.current = insertIndex;
    onInsertBlock(duplicatedBlock, insertIndex);
    setTimeout(() => {
      setManualFocusTargetFn({ index: insertIndex, id: duplicatedBlock.id });
    }, 10);
  }, [onInsertBlock, primarySelectedBlockId, primarySelectedIndex, script.blocks, setManualFocusTargetFn]);

  const handleDeleteSelectedBlock = useCallback(() => {
    if (!primarySelectedBlockId) return;
    if (primarySelectedIndex >= 0) {
      pendingFocusIndexAfterDelete.current = primarySelectedIndex;
    }
    onDeleteBlock(primarySelectedBlockId);
  }, [onDeleteBlock, primarySelectedBlockId, primarySelectedIndex]);

  return (
    <>
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />
      {!isMobileLayout && (
        <button
          type="button"
          className="fixed z-50 p-2 rounded-full shadow-lg hover:bg-muted/90 transition-all"
          style={{
            top: '118px',
            left: isStoryPanelOpen ? `${panelWidth + 8}px` : '8px',
            transition: 'left 0.2s ease',
          }}
          onClick={() => setIsStoryPanelOpen(prev => !prev)}
          title={isStoryPanelOpen ? 'ストーリーパネルを閉じる' : 'ストーリーパネルを開く'}
        >
          {isStoryPanelOpen
            ? <ChevronDoubleLeftIcon className="w-5 h-5" />
            : <ChevronDoubleRightIcon className="w-5 h-5" />
          }
        </button>
      )}
      <div className="script-editor-container min-h-auto">
        {script.blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 text-center text-muted-foreground">
            <p className="text-sm sm:text-base md:text-lg mb-4">1.右上のキャラクターのアイコンから登場キャラクターを追加します。</p>
            <p className="text-sm sm:text-base md:text-lg mb-4">2.「+ブロックを追加」からテキストブロックを追加し、キャラクターを選択するとセリフを入力できます。</p>
            <p className="text-sm sm:text-base md:text-lg mb-4">3.右上のエクスポートから台本をCSV形式で出力できます。グループ設定ごとにCSVファイルを分割出力することができます。</p>
            <p className="text-sm sm:text-base md:text-lg mb-4">4.より詳しい操作方法は設定＞ヘルプをご覧ください。</p>
            {isStoryPanelOpen && (
              <p className="text-xs text-muted-foreground mt-2">
                ストーリーセパレートを使うにはテキストブロックを2つ以上作成してください。
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 items-stretch">
            {isStoryPanelOpen && (
              <>
                <div
                  className="fixed left-0 z-30 border-r bg-muted/30 shrink-0 overflow-hidden flex flex-col"
                  style={{ width: panelWidth, top: '64px', height: 'calc(100vh - 64px)' }}
                >
                  <div className="flex items-center justify-between p-2 px-3 border-b bg-muted/60 shrink-0">
                    <span className="text-sm font-semibold text-foreground">ストーリーセパレート</span>
                    <span className="text-xs text-muted-foreground">幅 {Math.round(panelWidth)}px</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
                    {(() => {
                      const currentIndex = orderedSegments.findIndex(seg => seg.id === currentDisplayedSegmentId);
                      const currentSegment = orderedSegments[currentIndex] ?? orderedSegments[0];
                      const prevSegment = currentIndex > 0 ? orderedSegments[currentIndex - 1] : null;
                      const nextSegment = currentIndex < orderedSegments.length - 1 ? orderedSegments[currentIndex + 1] : null;
                      
                      if (!currentSegment) return null;
                      
                      const imageWidth = panelWidth - 32;
                      const imageHeight = Math.max(Math.round(imageWidth * 9 / 16), 180);
                      const segmentIndex = orderedSegments.findIndex(s => s.id === currentSegment.id);
                      const prevImage = prevSegment ? localSegmentImages[prevSegment.id] : undefined;
                      const currentImage = localSegmentImages[currentSegment.id];
                      const nextImage = nextSegment ? localSegmentImages[nextSegment.id] : undefined;
                      const currentImageMissing = !!currentSegment.imageRef?.assetId && !currentImage;
                      
                      return (
                        <div className="relative w-full" style={{ height: `${imageHeight + 80}px` }}>
                          {prevImage && (
                            <div
                              className="absolute left-0 right-0 mx-auto rounded-lg overflow-hidden border opacity-40 pointer-events-none"
                              style={{
                                width: `${imageWidth * 0.85}px`,
                                top: '-30%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 1,
                              }}
                            >
                              <img src={prevImage.dataUrl} alt={prevImage.name} className="w-full object-cover" style={{ height: `${imageHeight * 0.85}px` }} />
                            </div>
                          )}
                          
                          <div className="absolute left-0 right-0 z-10" style={{ top: prevImage ? '10%' : '0' }}>
                            <div className="flex items-center justify-between mb-2 px-1">
                              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                {segmentIndex + 1} / {orderedSegments.length}
                                {currentSegment.label && (
                                  <span className="ml-1.5 text-foreground/80">{currentSegment.label}</span>
                                )}
                                {currentImageMissing && (
                                  <span className="px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                    ローカル画像未配置
                                  </span>
                                )}
                              </span>
                            </div>
                            {currentImage ? (
                              <div
                                className={`relative group rounded-lg overflow-hidden border shadow-lg transition ${dragOverSegmentId === currentSegment.id ? 'ring-2 ring-primary/60 bg-primary/5' : ''}`}
                                onDragOver={(e) => handlePanelImageDragOver(e, currentSegment.id)}
                                onDragLeave={() => setDragOverSegmentId(null)}
                                onDrop={(e) => handlePanelImageDrop(e, currentSegment.id)}
                              >
                                <img src={currentImage.dataUrl} alt={currentImage.name} className="w-full object-cover" style={{ height: `${imageHeight}px` }} />
                                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4 text-white text-sm">
                                  <button type="button" className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 transition" onClick={() => openImagePicker(currentSegment.id)}>
                                    置き換え
                                  </button>
                                  <button type="button" className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 transition" onClick={() => setImageToDelete({ segmentId: currentSegment.id })}>
                                    削除
                                  </button>
                                </div>
                                {dragOverSegmentId === currentSegment.id && (
                                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center text-sm font-medium text-primary pointer-events-none">
                                    ここにドロップして画像を置き換え
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                className={`w-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-sm text-muted-foreground hover:bg-muted/40 transition shadow-lg ${dragOverSegmentId === currentSegment.id ? 'ring-2 ring-primary/60 bg-primary/5 border-primary/60' : ''}`}
                                style={{ height: `${imageHeight}px` }}
                                onClick={() => openImagePicker(currentSegment.id)}
                                onDragOver={(e) => handlePanelImageDragOver(e, currentSegment.id)}
                                onDragLeave={() => setDragOverSegmentId(null)}
                                onDrop={(e) => handlePanelImageDrop(e, currentSegment.id)}
                              >
                                <PhotoIcon className="w-12 h-12 mb-3 opacity-60" />
                                <span>{currentImageMissing ? 'ローカル画像が見つかりません' : 'クリックまたはドラッグ&ドロップで画像を追加'}</span>
                                {currentImageMissing && (
                                  <span className="mt-2 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                                    クリックして再リンク
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                          
                          {nextImage && (
                            <div
                              className="absolute left-0 right-0 mx-auto rounded-lg overflow-hidden border opacity-40 pointer-events-none"
                              style={{
                                width: `${imageWidth * 0.85}px`,
                                bottom: '-30%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 1,
                              }}
                            >
                              <img src={nextImage.dataUrl} alt={nextImage.name} className="w-full object-cover" style={{ height: `${imageHeight * 0.85}px` }} />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div
                  className="hidden lg:block fixed w-1 bg-border cursor-col-resize z-30"
                  style={{ height: 'calc(100vh - 64px)', top: '64px', left: `${panelWidth}px` }}
                  onMouseDown={handleResizeStart}
                  role="separator"
                  aria-label="ストーリーセパレートの幅を調整"
                />
              </>
            )}
            <div className={`flex-1 story-main-column ${isStoryPanelOpen ? 'lg:ml-0' : ''}`} style={isStoryPanelOpen ? { marginLeft: `${panelWidth + 4}px` } : {}}>
              <div className="bg-card rounded-lg shadow p-[clamp(0.5rem,1.2vw,1rem)] mb-24 relative h-full flex flex-col justify-between">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={script.blocks.map(block => block.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {isStoryPanelOpen && (() => {
                      const firstSegment = orderedSegments.find(segment => segment.anchorBlockId === null) ?? orderedSegments[0];
                      if (!firstSegment) return null;
                      const firstSegmentNumber = orderedSegments.findIndex(segment => segment.id === firstSegment.id) + 1;
                      const firstSegmentMissingImage =
                        !!firstSegment.imageRef?.assetId && !localSegmentImages[firstSegment.id];

                      return (
                        <div className="mb-1">
                          <div className="flex items-center w-full my-1 story-panel-line-control">
                            <div className="flex items-center shrink-0 group/bookmark">
                              {editingLabelSegmentId === firstSegment.id ? (
                                <div className="flex items-center">
                                  <input
                                    type="text"
                                    className="text-xs px-2 py-1 border border-primary rounded-l-lg bg-background text-foreground w-28 outline-none focus:ring-1 focus:ring-primary"
                                    value={editingLabelValue}
                                    onChange={(e) => setEditingLabelValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { e.preventDefault(); commitLabelEdit(); }
                                      if (e.key === 'Escape') { e.preventDefault(); cancelLabelEdit(); }
                                    }}
                                    onBlur={commitLabelEdit}
                                    autoFocus
                                    placeholder={`${firstSegmentNumber}`}
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <div
                                    className="relative flex items-center text-xs font-medium text-muted-foreground bg-muted pl-2 pr-3 py-1 select-none border border-muted-foreground/20"
                                    style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 0 100%)' }}
                                  >
                                    {firstSegment.label ? (
                                      <>
                                        <span className="mr-1 opacity-60">{firstSegmentNumber}.</span>
                                        <span className="max-w-[120px] truncate">{firstSegment.label}</span>
                                      </>
                                    ) : (
                                      <span>{firstSegmentNumber}</span>
                                    )}
                                  </div>
                                  {firstSegmentMissingImage && (
                                    <button
                                      type="button"
                                      className="ml-1 px-1.5 py-0.5 text-[10px] rounded border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition"
                                      onClick={() => openImagePicker(firstSegment.id)}
                                      title="ローカル画像を再リンク"
                                    >
                                      未配置
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="p-0.5 text-muted-foreground/50 hover:text-foreground transition opacity-0 group-hover/bookmark:opacity-100 ml-1"
                                    onClick={() => startEditingLabel(firstSegment.id, firstSegment.label || '')}
                                    title="見出しを編集"
                                  >
                                    <PencilSquareIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 border-t border-dashed border-primary/40 mx-1"></div>
                          </div>
                        </div>
                      );
                    })()}
                    {script.blocks.map((block, index) => {
                      const nextBlockId = index < script.blocks.length - 1 ? script.blocks[index + 1]?.id : null;
                      const existingSegment = nextBlockId ? storySegments.find(seg => seg.anchorBlockId === nextBlockId) : null;
                      const segmentNumber = existingSegment ? orderedSegments.findIndex(s => s.id === existingSegment.id) + 1 : -1;
                      const hasMissingLocalImage =
                        !!existingSegment?.imageRef?.assetId && !localSegmentImages[existingSegment.id];
                      
                      return (
                        <div key={block.id} className="mb-1 last:mb-0">
                          <SortableBlock
                            block={block}
                            characters={characters}
                            character={characters.find(c => c.id === block.characterId)}
                            onUpdate={updates => onUpdateBlock(block.id, updates)}
                            onDelete={() => {
                              pendingFocusIndexAfterDelete.current = index;
                              onDeleteBlock(block.id);
                            }}
                            onDuplicate={() => {
                              const newBlock: ScriptBlock = {
                                ...block,
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                                text: block.text
                              };
                              insertIdx.current = index + 1;
                              onInsertBlock(newBlock, index + 1);
                              setTimeout(() => {
                                setManualFocusTargetFn({ index: index + 1, id: newBlock.id });
                              }, 10);
                            }}
                            onMoveUp={() => {
                              if (index > 0) {
                                onMoveBlock(index, index - 1);
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
                          {/* セパレートライン（常時表示） */}
                          {isStoryPanelOpen && existingSegment && index < script.blocks.length - 1 && (
                            <div className="flex items-center w-full my-1 story-panel-line-control group/sep-line">
                              {/* ブックマーク型ラベル */}
                              <div className="flex items-center shrink-0 group/bookmark">
                                {editingLabelSegmentId === existingSegment.id ? (
                                  <div className="flex items-center">
                                    <input
                                      type="text"
                                      className="text-xs px-2 py-1 border border-primary rounded-l-lg bg-background text-foreground w-28 outline-none focus:ring-1 focus:ring-primary"
                                      value={editingLabelValue}
                                      onChange={(e) => setEditingLabelValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); commitLabelEdit(); }
                                        if (e.key === 'Escape') { e.preventDefault(); cancelLabelEdit(); }
                                      }}
                                      onBlur={commitLabelEdit}
                                      autoFocus
                                      placeholder={`${segmentNumber}`}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center">
                                    <div
                                      className="relative flex items-center text-xs font-medium text-muted-foreground bg-muted pl-2 pr-3 py-1 select-none border border-muted-foreground/20"
                                      style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 0 100%)' }}
                                    >
                                      {existingSegment.label ? (
                                        <>
                                          <span className="mr-1 opacity-60">{segmentNumber}.</span>
                                          <span className="max-w-[120px] truncate">{existingSegment.label}</span>
                                        </>
                                      ) : (
                                        <span>{segmentNumber}</span>
                                      )}
                                    </div>
                                    {hasMissingLocalImage && (
                                      <button
                                        type="button"
                                        className="ml-1 px-1.5 py-0.5 text-[10px] rounded border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition"
                                        onClick={() => openImagePicker(existingSegment.id)}
                                        title="ローカル画像を再リンク"
                                      >
                                        未配置
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="p-0.5 text-muted-foreground/50 hover:text-foreground transition opacity-0 group-hover/bookmark:opacity-100 ml-1"
                                      onClick={() => startEditingLabel(existingSegment.id, existingSegment.label || '')}
                                      title="見出しを編集"
                                    >
                                      <PencilSquareIcon className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 border-t border-dashed border-primary/40 mx-1"></div>
                              <button
                                type="button"
                                className="p-1.5 rounded-full bg-background text-foreground shadow hover:bg-accent transition shrink-0"
                                onMouseDown={handleStartMoveLine(existingSegment.id)}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setLineDeleteTarget(prev => (prev === existingSegment.id ? null : existingSegment.id));
                                }}
                                title="ドラッグで移動 / クリックで削除を表示"
                              >
                                <ScissorsIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                              </button>
                              {lineDeleteTarget === existingSegment.id && (
                                <button
                                  type="button"
                                  className="p-1.5 rounded-full bg-destructive text-destructive-foreground shadow shrink-0 ml-1"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSegmentToDelete(existingSegment);
                                  }}
                                  title="ラインを削除"
                                >
                                  <TrashIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                                </button>
                              )}
                            </div>
                          )}
                          {/* セパレートライン追加ボタン（ホバー時のみ、ラインが無い箇所） */}
                          {isStoryPanelOpen && !existingSegment && script.blocks.length >= 2 && index < script.blocks.length - 1 && (
                            <div className="flex justify-center my-0 group/sep-add">
                              <button
                                type="button"
                                className="opacity-0 group-hover/sep-add:opacity-100 transition-opacity inline-flex items-center justify-center w-8 h-8 sm:w-6 sm:h-6 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:bg-accent hover:text-foreground hover:border-solid"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (nextBlockId) {
                                    setLineDragState({ mode: 'new', targetBlockId: nextBlockId });
                                    setLineIndicatorY(e.clientY);
                                  }
                                }}
                                title="セパレートラインを追加"
                              >
                                <ScissorsIcon className="w-4 h-4 sm:w-3 sm:h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>
        )}
      </div>
      {lineDragState && lineIndicatorY !== null && (
        <div className="fixed inset-x-0 pointer-events-none z-40" style={{ top: lineIndicatorY }}>
          <div className="border-t border-dashed border-primary"></div>
        </div>
      )}
      {segmentToDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-foreground mb-3">セパレートラインを削除しますか？</h3>
            <p className="text-sm text-muted-foreground mb-4">
              このラインに紐付いた画像も同時に削除されます。元に戻す場合はアンドゥをご利用ください。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSegmentToDelete(null)}
                className="px-4 py-2 rounded-full border text-sm"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSegment}
                className="px-4 py-2 rounded-full bg-destructive text-destructive-foreground text-sm"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      {imageToDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-foreground mb-3">画像を削除しますか？</h3>
            <p className="text-sm text-muted-foreground mb-4">
              この画像はストーリーパネルから削除されます。元に戻す場合はアンドゥをご利用ください。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImageToDelete(null)}
                className="px-4 py-2 rounded-full border text-sm"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRemoveSegmentImage(imageToDelete.segmentId);
                  setImageToDelete(null);
                }}
                className="px-4 py-2 rounded-full bg-destructive text-destructive-foreground text-sm"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      {isTabletOrLarger && (
        <button
          type="button"
          onClick={() => setIsToolbarCollapsed(prev => !prev)}
          className="fixed right-3 bottom-6 z-50 h-10 w-10 rounded-lg border bg-background/95 backdrop-blur shadow flex items-center justify-center hover:bg-muted"
          title={isToolbarCollapsed ? 'ツールバーを表示' : 'ツールバーを非表示'}
        >
          {isToolbarCollapsed ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
        </button>
      )}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-40 px-2 flex justify-center w-full pointer-events-none"
        style={{ bottom: `${mobileToolbarBottom}px` }}
      >
        <div className="inline-flex items-center gap-2 max-w-[calc(100vw-1rem)] pointer-events-auto">
          <div
            data-floating-toolbar="true"
            className={`bg-background/95 backdrop-blur border rounded-2xl shadow-lg px-2 py-2 inline-flex items-center gap-1 overflow-x-auto whitespace-nowrap transition-transform duration-300 max-w-[calc(100vw-1rem)] ${reverseToolbarOrder ? 'flex-row-reverse' : ''} ${isTabletOrLarger && isToolbarCollapsed ? 'translate-y-[140%] pointer-events-none' : 'translate-y-0'}`}
          >
          <button
            type="button"
            onClick={handleScrollTop}
            className="h-10 w-10 rounded-lg border flex items-center justify-center shrink-0"
            title="最上段へ"
          >
            <ArrowUpIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleScrollBottom}
            className="h-10 w-10 rounded-lg border flex items-center justify-center shrink-0"
            title="最下段へ"
          >
            <ArrowDownIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="h-10 w-10 rounded-lg border flex items-center justify-center disabled:opacity-40 shrink-0"
            title="元に戻す"
          >
            <ArrowUturnLeftIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="h-10 w-10 rounded-lg border flex items-center justify-center disabled:opacity-40 shrink-0"
            title="やり直し"
          >
            <ArrowUturnRightIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleDeleteSelectedBlock}
            disabled={!canOperateSelectedBlock}
            className="h-10 w-10 rounded-lg border flex items-center justify-center text-destructive disabled:opacity-40 shrink-0"
            title="選択ブロックを削除"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleDuplicateSelectedBlock}
            disabled={!canOperateSelectedBlock}
            className="h-10 w-10 rounded-lg border flex items-center justify-center disabled:opacity-40 shrink-0"
            title="選択ブロックを複製"
          >
            <DocumentDuplicateIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleMoveSelectedBlock('up')}
            disabled={!canMoveSelectedUp}
            className="h-10 w-10 rounded-lg border flex items-center justify-center disabled:opacity-40 shrink-0"
            title="選択ブロックを上に移動"
          >
            <ArrowUpIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleMoveSelectedBlock('down')}
            disabled={!canMoveSelectedDown}
            className="h-10 w-10 rounded-lg border flex items-center justify-center disabled:opacity-40 shrink-0"
            title="選択ブロックを下に移動"
          >
            <ArrowDownIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleAddTogakiBelowSelected}
            className="h-10 px-2 rounded-lg bg-muted text-muted-foreground border text-xs font-medium whitespace-nowrap shrink-0"
            title="現在のブロック直下にト書きを追加"
          >
            ト書
          </button>
          <button
            type="button"
            onClick={onAddBlock}
            className="h-10 px-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium whitespace-nowrap shrink-0"
            title="最下段に新規ブロック追加"
          >
            末追
          </button>
          <button
            type="button"
            onClick={handleAddBlockBelowSelected}
            className="h-10 px-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium whitespace-nowrap shrink-0"
            title="直下に新規ブロック追加"
          >
            直追
          </button>
          </div>
        </div>
      </div>
    </>
  );
}