'use client';

import { useState, useRef, useEffect, useMemo, useCallback, ChangeEvent, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Script, ScriptBlock, Character, Emotion, StorySeparatorSegment, StorySeparatorImage } from '@/types';
import { loadStoryPanelAsset, removeStoryPanelAsset, saveStoryPanelAsset } from '@/utils/storyPanelAssets';
import { getEmotionKeys, getEmotionIconUrl, getPresetIdForEmotion, getEmotionForPreset } from '@/utils/emotionUtils';
import { bubbleFill, nameBadgeText, nameLabelText } from '@/utils/colorUtils';
import { buildChatSideMap } from '@/utils/chatUtils';
import { createScriptBlock } from '@/utils/blockFactory';
import CharacterPicker from '@/components/CharacterPicker';
import DialogFrame from '@/components/common/DialogFrame';
import DialogHeader from '@/components/common/DialogHeader';
import Button from '@/components/common/Button';
import type { BubbleTheme } from '@/hooks/useSettings';
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
  ChevronUpDownIcon,
  PencilSquareIcon,
  PlusIcon,
  UsersIcon
} from '@heroicons/react/24/outline';

interface ScriptEditorProps {
  script: Script;
  onUpdateBlock: (blockId: string, updates: Partial<ScriptBlock>) => void;
  onDeleteBlock: (blockId: string) => void;
  onDeleteBlocks?: (blockIds: string[]) => void;
  onInsertBlock: (block: ScriptBlock, index: number) => void;
  onMoveBlock: (fromIndex: number, toIndex: number) => void;
  onMoveBlocks?: (blockIds: string[], direction: 'up' | 'down') => void;
  onMoveBlocksByIndex?: (blockIds: string[], toIndex: number) => void;
  onDuplicateBlocks?: (blockIds: string[]) => void;
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
  simpleMode?: boolean;
  bubbleTheme?: BubbleTheme;
  currentProjectId?: string;
  onUpdateScript?: (updates: Partial<Script>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onBlockDragStateChange?: (isDragging: boolean, blockIds: string[]) => void;
  onDragMovePosition?: (x: number, y: number) => void;
  onActiveBlockChange?: (blockId: string) => void;
  addBlockSpeakerPicker?: boolean;
  /** フキダシの塗り（キャラ色の薄塗り）の濃さをテーマに合わせるため */
  isDarkMode?: boolean;
  /** ピッカー起動関数を親（キーボードショートカット側）へ渡すための登録口 */
  setRequestSpeakerPicker?: (fn: (mode: 'append' | 'insertBelow', anchorIndex: number) => void) => void;
}

interface SortableBlockProps {
  block: ScriptBlock;
  characters: Character[];
  character: Character | undefined;
  onUpdate: (updates: Partial<ScriptBlock>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClick: (event: React.MouseEvent) => void;
  onTextareaFocus?: () => void;
  enterOnlyBlockAdd?: boolean;
  simpleMode?: boolean;
  bubbleTheme?: BubbleTheme;
  isDarkMode?: boolean;
  currentProjectId?: string;
  script: Script;
  onInsertBlock: (block: ScriptBlock, index: number) => void;
  insertIdx: React.MutableRefObject<number>;
  /** ピッカーモード時、ブロック追加の代わりに話者選択を要求する */
  onRequestSpeakerPicker?: (anchorIndex: number) => void;
  /** 複数ブロックを選択中（話者の切り替えは単一ブロックの操作なので切替ボタンを出さない） */
  isMultiSelection?: boolean;
}

/** 既定のキャラクター色（アイコン背景が未設定のとき） */
const FALLBACK_CHARACTER_COLOR = '#9ca3af';

/** セリフ・ト書き共通の textarea の土台 */
const TEXTAREA_BASE = 'block resize-none overflow-hidden text-fg placeholder:text-fg-faint focus:outline-none';

/** 本文サイズは設定のフォントサイズ（既定16px）を基準に、表示モードごとの差分で決める */
const editorFontSize = (offsetPx = 0) =>
  offsetPx === 0 ? 'var(--editor-font-size, 16px)' : `calc(var(--editor-font-size, 16px) ${offsetPx > 0 ? '+' : '-'} ${Math.abs(offsetPx)}px)`;

/**
 * ブロック内の操作ボタン用。ドラッグ開始（dnd-kit）・ブロック選択の切り替え・
 * textarea のフォーカス喪失をいずれも起こさない。
 */
const blockControlGuards = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); },
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation()
};

/** アバターの寸法（表示モードごと） */
interface AvatarSpec {
  size: number;
  nameClass: string;
  switchSize: number;
  switchIconSize: number;
  switchOffset: number;
}

function SortableBlock({
  block,
  characters,
  character,
  onUpdate,
  onDelete,
  onDuplicate,
  onClick,
  onTextareaFocus,
  textareaRef,
  isSelected,
  isMultiDragGhost = false,
  enterOnlyBlockAdd = false,
  simpleMode = false,
  bubbleTheme = 'pop',
  isDarkMode = false,
  currentProjectId,
  script,
  onInsertBlock,
  insertIdx,
  onRequestSpeakerPicker,
  isMultiSelection = false
}: SortableBlockProps & { textareaRef: (el: HTMLTextAreaElement | null) => void; isSelected: boolean; isMultiDragGhost?: boolean }) {
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
    opacity: isDragging ? 0.5 : isMultiDragGhost ? 0.3 : 1
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

  // 高さの自動調整用にこのブロックのtextareaを保持しつつ、親のref配列にも登録する
  const localTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const setTextareaRef = (el: HTMLTextAreaElement | null) => {
    localTextareaRef.current = el;
    textareaRef(el);
  };

  // textareaのfocus状態を管理
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const [isSpeakerPickerOpen, setIsSpeakerPickerOpen] = useState(false);
  const [isEmotionPickerOpen, setIsEmotionPickerOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const focusBeforeSpeakerPickerRef = useRef<HTMLElement | null>(null);

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

  // 本文や表示設定が変わったら、このブロックの高さを内容に合わせ直す。
  // シーン切り替えでブロック数が変わらない場合は親側の一括調整が走らないため、
  // ここで個別に調整しないと前のシーンの高さのまま文章が見切れてしまう。
  useEffect(() => {
    const el = localTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [block.text, block.characterId, simpleMode, bubbleTheme, isMobileView]);

  const selectableCharacters = characters.filter(c =>
    c.id === '' ||
    !currentProjectId ||
    !c.disabledProjects ||
    !c.disabledProjects.includes(currentProjectId)
  );
  // 話者切り替えピッカーの選択肢（ト書きはピッカー側で先頭に付く）
  const speakerPickerCharacters = selectableCharacters.filter(c => c.id !== '');

  const handleSelectCharacter = (characterId: string) => {
    onUpdate({ characterId, emotion: 'normal', userPresetId: undefined });
  };

  const openSpeakerPicker = () => {
    focusBeforeSpeakerPickerRef.current = document.activeElement as HTMLElement | null;
    setIsEmotionPickerOpen(false);
    setIsSpeakerPickerOpen(true);
  };

  // 話者を選んだら、そのまま入力できるよう本文へフォーカスする
  const handleSpeakerPicked = (characterId: string) => {
    setIsSpeakerPickerOpen(false);
    if (characterId !== block.characterId) handleSelectCharacter(characterId);
    setTimeout(() => localTextareaRef.current?.focus(), 0);
  };

  const closeSpeakerPicker = () => {
    const target = focusBeforeSpeakerPickerRef.current;
    setIsSpeakerPickerOpen(false);
    setTimeout(() => target?.focus?.(), 0);
  };

  // このキャラクターの感情ラベル一覧（normal のみなら感情ピッカーは出さない）
  const emotionKeys = character ? getEmotionKeys(character) : [];
  const hasEmotionVariants = emotionKeys.length > 1;
  // 未設定・削除済みの感情は標準として扱う
  const currentEmotion: Emotion = emotionKeys.includes(block.emotion) ? block.emotion : 'normal';
  const presets = character?.userPresets ?? [];
  const selectedPreset = presets.find(p => p.id === block.userPresetId);

  // 感情を選択（アイコン側）→ 連動するプリセットも同時に切り替える。
  // 連動プリセットを持たない表情（標準など）を選んだ場合はプリセットも解除して整合させる。
  const handleSelectEmotion = (emotion: Emotion) => {
    const linkedPresetId = character ? getPresetIdForEmotion(character, emotion) : undefined;
    onUpdate({ emotion, userPresetId: linkedPresetId });
    setIsEmotionPickerOpen(false);
  };

  // プリセットを選択（プリセットリスト側）→ 連動する表情（アイコン・立ち絵ステージ）も同時に切り替える。
  // そのプリセットに紐づく表情差分がなければ標準表情に戻す。
  const handleSelectPreset = (presetId: string | undefined) => {
    const emotion = character ? getEmotionForPreset(character, presetId) : 'normal';
    onUpdate({ userPresetId: presetId, emotion });
  };

  // 感情ピッカー内のアイコン表示
  const renderEmotionOption = (emotion: Emotion) => {
    if (!character) return null;
    const iconUrl = getEmotionIconUrl(character, emotion);
    return iconUrl ? (
      <img src={iconUrl} alt={emotion} className="size-9 rounded-full object-cover ring-1 ring-hairline shrink-0" />
    ) : (
      <div
        className="size-9 rounded-full ring-1 ring-hairline shrink-0"
        style={{ backgroundColor: character.backgroundColor || FALLBACK_CHARACTER_COLOR }}
      />
    );
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
    // 新規ブロックは現在ブロックの直後に挿入されるため、話者は「現在ブロック以前」の
    // 直近の話者ブロックから引き継ぐ。これにより Alt+↑/↓ で現在ブロックの話者を
    // 切り替えた直後でも、末尾ブロックではなく切り替え後の話者が反映される。
    const currentIndex = script.blocks.findIndex((b) => b.id === block.id);
    const scope = currentIndex >= 0 ? script.blocks.slice(0, currentIndex + 1) : script.blocks;
    const lastSpeakerBlock = [...scope].reverse().find((b) => b.characterId);
    const fallbackCharacterId = characters.find((c) => c.id)?.id || '';
    return {
      characterId: lastSpeakerBlock?.characterId || fallbackCharacterId,
      emotion: (lastSpeakerBlock?.emotion || 'normal') as Emotion
    };
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // DnDキーボードセンサーへの伝播を防ぎ、IME確定Enterで並び替えモードに入らないようにする。
    // Ctrl+Shift+Enter だけはグローバルショートカット（ト書き追加）へ通す。
    if ((e.key === 'Enter' || e.key === ' ') && !(e.ctrlKey && e.shiftKey)) {
      e.stopPropagation();
    }
    if (isImeComposingKey(e)) {
      return;
    }
    // チェックボックスの状態に応じてEnter操作のみで切り替え
    const shouldAddBlock = enterOnlyBlockAdd
      ? (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey)  // Enter入力のみモード
      : (e.key === 'Enter' && e.ctrlKey && !e.shiftKey);  // 従来のCtrl+Enterモード

    if (shouldAddBlock) {
      e.preventDefault();
      const currentIndex = script.blocks.findIndex(b => b.id === block.id);
      // ピッカーモード時は追加前に話者を選ばせる
      if (onRequestSpeakerPicker) {
        onRequestSpeakerPicker(currentIndex);
        return;
      }
      const { characterId, emotion } = buildBlockFromLastSpeaker();
      insertIdx.current = currentIndex + 1; // 挿入インデックスを設定
      onInsertBlock(createScriptBlock(characterId, emotion, characters), currentIndex + 1);
    }
  };

  // セリフ・ト書き・全表示モードで共通の textarea の振る舞い
  const textareaBehavior = {
    ref: setTextareaRef,
    value: block.text,
    rows: 1,
    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => onUpdate({ text: e.target.value }),
    onKeyDown: handleTextareaKeyDown,
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
    onFocus: () => { setIsTextareaFocused(true); onTextareaFocus?.(); },
    onBlur: () => setIsTextareaFocused(false),
    onInput: (e: React.FormEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      target.style.height = 'auto';
      target.style.height = target.scrollHeight + 'px';
      keepTextareaAboveToolbar(target);
    }
  };

  const variant: 'simple' | BubbleTheme = simpleMode ? 'simple' : bubbleTheme;
  // 選択中（明示的に選択 or 入力中）のブロックだけ、話者切替ボタンや既定値のチップを出す
  const isActive = isSelected || isTextareaFocused;
  const charColor = character?.backgroundColor || FALLBACK_CHARACTER_COLOR;
  // 既定値（標準の表情・プリセット未選択）の表示は、ホバー中か選択中だけ出す
  const revealOnHover = isActive ? '' : 'opacity-0 group-hover/block:opacity-100 focus-visible:opacity-100';

  // チャットテーマ: キャラの左右振り分けと連続発言判定
  const isChatRight = variant === 'chat' && !!character &&
    buildChatSideMap(characters).get(character.id) === 'right';
  const showChatName = (() => {
    if (variant !== 'chat' || !character) return false;
    const blockIndex = script.blocks.findIndex(b => b.id === block.id);
    return blockIndex <= 0 || script.blocks[blockIndex - 1].characterId !== block.characterId;
  })();

  const renderAvatar = ({ size, nameClass, switchSize, switchIconSize, switchOffset }: AvatarSpec) => {
    if (!character) return null;
    // 感情差分アイコン（未設定・削除済みの感情は normal にフォールバック）
    const iconUrl = getEmotionIconUrl(character, block.emotion);
    const displayName = character.name.length > 8 ? character.name.slice(0, 8) + '…' : character.name;
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <button
          type="button"
          className={`block size-full rounded-full cursor-pointer transition-[outline] duration-300 ${animateBorder ? 'outline-4 outline-primary outline-offset-2' : ''}`}
          onClick={(e) => { e.stopPropagation(); openSpeakerPicker(); }}
          // アバターはドラッグの掴み所でもあるため pointerdown は止めない（ドラッグ後のclickは dnd-kit が抑止する）
          onMouseDown={(e) => e.preventDefault()}
          title="話者を切り替え"
        >
          {iconUrl ? (
            <img src={iconUrl} alt={character.name} className="size-full rounded-full object-cover" />
          ) : (
            <span
              className="size-full rounded-full flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: charColor }}
            >
              <span
                className={`${nameClass} font-bold leading-tight text-center px-1 break-all line-clamp-2`}
                style={{ color: nameBadgeText(charColor) }}
              >
                {displayName}
              </span>
            </span>
          )}
        </button>
        {isActive && !isMultiSelection && (
          <button
            type="button"
            tabIndex={-1}
            className="absolute rounded-full bg-panel shadow-(--shadow-popover) flex items-center justify-center"
            style={{ width: switchSize, height: switchSize, right: -switchOffset, bottom: -switchOffset }}
            onClick={(e) => { e.stopPropagation(); openSpeakerPicker(); }}
            {...blockControlGuards}
            title="話者を切り替え"
          >
            <ChevronUpDownIcon style={{ width: switchIconSize, height: switchIconSize, color: charColor }} strokeWidth={2} />
          </button>
        )}
      </div>
    );
  };

  // ト書きを話者ブロックへ切り替える入口（ト書きにはアバターが無いため）
  const renderTogakiSwitch = (className: string) => (
    <button
      type="button"
      className={`shrink-0 rounded-md p-1 text-fg-faint transition-colors hover:text-fg hover:bg-well ${className}`}
      onClick={(e) => { e.stopPropagation(); openSpeakerPicker(); }}
      {...blockControlGuards}
      title="話者を切り替え"
    >
      <UsersIcon className="size-3.5" />
    </button>
  );

  // 複製・削除のホバーパレット（レイアウトを動かさないよう absolute で重ねる。モバイルはツールバーに任せる）
  const renderHoverPalette = (positionClass: string, compact = false) => {
    if (isMobileView) return null;
    const buttonClass = compact ? 'size-6 rounded-[7px] [&>svg]:size-3.5' : 'size-7 rounded-lg [&>svg]:size-4';
    return (
      <div
        className={`absolute z-[3] flex opacity-0 pointer-events-none transition-opacity duration-[160ms] ease-in-out group-hover/block:opacity-100 group-hover/block:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto ${
          compact ? 'gap-px p-px rounded-lg bg-canvas' : 'gap-0.5 p-[3px] rounded-[11px] bg-panel shadow-(--shadow-popover)'
        } ${positionClass}`}
      >
        <button
          type="button"
          className={`${buttonClass} flex items-center justify-center text-fg-sub transition-colors hover:bg-field hover:text-fg`}
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          {...blockControlGuards}
          title="ブロックを複製"
        >
          <DocumentDuplicateIcon />
        </button>
        <button
          type="button"
          className={`${buttonClass} flex items-center justify-center text-destructive transition-colors hover:bg-destructive-tint`}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          {...blockControlGuards}
          title="ブロックを削除"
        >
          <TrashIcon />
        </button>
      </div>
    );
  };

  const renderEmotionPopover = (alignRight: boolean) => isEmotionPickerOpen && (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => { e.stopPropagation(); setIsEmotionPickerOpen(false); }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <div
        className={`absolute ${alignRight ? 'right-0' : 'left-0'} top-full mt-1.5 z-50 w-44 max-h-64 overflow-y-auto p-1.5 bg-panel rounded-xl ring-1 ring-hairline shadow-(--shadow-popover)`}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {emotionKeys.map(emotion => (
          <button
            key={emotion}
            type="button"
            onClick={(e) => { e.stopPropagation(); handleSelectEmotion(emotion); }}
            className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-left text-xs transition-colors ${
              currentEmotion === emotion ? 'bg-primary-tint text-primary-text font-bold' : 'text-fg hover:bg-field'
            }`}
          >
            {renderEmotionOption(emotion)}
            <span className="truncate">{emotion === 'normal' ? '標準' : emotion}</span>
          </button>
        ))}
      </div>
    </>
  );

  /**
   * 感情・プリセットの表示と切り替え口。
   * chip: 話者名バッジの右隣のチップ（クラシック/ポップ/チャット）、text: 小さな文字（シネマ/シンプル）
   */
  const renderMetaControls = (look: 'chip' | 'text', alignRight = false) => {
    if (!character) return null;
    const baseClass = look === 'chip'
      ? 'relative text-[10px] leading-normal px-[9px] py-px rounded-full bg-panel text-fg-sub whitespace-nowrap max-w-40 truncate transition-opacity'
      : 'relative text-[10px] leading-normal text-fg-sub whitespace-nowrap max-w-40 truncate transition-opacity hover:text-fg';
    const chipStyle = look === 'chip' ? { border: `1.5px solid ${charColor}` } : undefined;
    return (
      <>
        {hasEmotionVariants && (
          <span className="relative flex">
            <button
              type="button"
              className={`${baseClass} cursor-pointer ${currentEmotion === 'normal' && !isEmotionPickerOpen ? revealOnHover : ''}`}
              style={chipStyle}
              onClick={(e) => { e.stopPropagation(); setIsEmotionPickerOpen(v => !v); }}
              {...blockControlGuards}
              title="表情を選択"
            >
              {currentEmotion === 'normal' ? '標準' : currentEmotion}
            </button>
            {renderEmotionPopover(alignRight)}
          </span>
        )}
        {presets.length > 0 && (
          <span
            className={`${baseClass} ${selectedPreset ? '' : revealOnHover} has-[select:focus-visible]:opacity-100`}
            style={chipStyle}
            title="Alt+Shift+↑↓:プリセットを切り替え"
          >
            {selectedPreset?.name ?? 'プリセット'}
            {/* 見た目はチップのまま、クリックで既存のプリセット選択（ネイティブのリスト）を開く */}
            <select
              value={block.userPresetId || ''}
              onChange={e => handleSelectPreset(e.target.value || undefined)}
              className="absolute inset-0 size-full opacity-0 cursor-pointer"
              aria-label="プリセット"
              onPointerDown={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              <option value="">プリセットなし</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </span>
        )}
      </>
    );
  };

  // 話者名バッジ（キャラ色の塗り＋濃色文字。背景色のリングで下の枠線から抜く）
  const renderNameBadge = (ringColorVar: string) => character && (
    <span
      className="text-[11px] font-bold leading-normal px-2.5 py-px rounded-full whitespace-nowrap max-w-40 truncate select-none"
      style={{ backgroundColor: charColor, color: nameBadgeText(charColor), boxShadow: `0 0 0 2px ${ringColorVar}` }}
    >
      {character.name}
    </span>
  );

  // ---- 表示モードごとの本体 ----
  let rootClass = '';
  let body: React.ReactNode = null;

  if (variant === 'simple') {
    // 1行1ブロック。話者名は出さず、キャラ色はテキスト左の細い罫だけ
    rootClass = `flex items-center gap-2 py-[5px] px-2 rounded-[10px] ${isActive ? 'ring-1 ring-primary/35' : ''}`;
    body = (
      <>
        {isTogaki ? (
          <div className="w-8 shrink-0 flex justify-center">
            {renderTogakiSwitch(isActive ? '' : 'opacity-0 group-hover/block:opacity-100 focus-visible:opacity-100')}
          </div>
        ) : (
          renderAvatar({ size: 32, nameClass: 'text-[8px]', switchSize: 15, switchIconSize: 10, switchOffset: 3 })
        )}
        <div
          className="flex-1 min-w-0"
          style={isTogaki ? { paddingLeft: 11 } : { borderLeft: `2px solid ${charColor}`, paddingLeft: 9 }}
        >
          <textarea
            {...textareaBehavior}
            placeholder={isTogaki ? 'ト書きを入力' : 'セリフを入力'}
            className={`${TEXTAREA_BASE} w-full bg-transparent p-0${isTogaki ? ' italic' : ''}`}
            style={{ height: 'auto', fontSize: editorFontSize(isTogaki ? -2 : -1), lineHeight: 1.45 }}
          />
        </div>
        {!isTogaki && (
          <div className="shrink-0 flex items-center gap-2">
            {renderMetaControls('text', true)}
          </div>
        )}
        {renderHoverPalette('top-1/2 -translate-y-1/2 right-1.5', true)}
      </>
    );
  } else if (variant === 'cinema') {
    // 脚本風。フキダシの枠と塗りを外し、キャラ色は本文左の罫で示す
    rootClass = `rounded-[14px] ${isActive ? 'ring-1 ring-primary/35' : ''} ${
      isTogaki ? 'flex items-center justify-center py-0.5 px-3' : 'flex items-start gap-3.5 py-2.5 px-3'
    }`;
    body = isTogaki ? (
      <>
        {renderTogakiSwitch(`absolute left-2 top-1/2 -translate-y-1/2 ${isActive ? '' : 'opacity-0 group-hover/block:opacity-100 focus-visible:opacity-100'}`)}
        <textarea
          {...textareaBehavior}
          placeholder="ト書きを入力"
          className={`${TEXTAREA_BASE} w-full bg-transparent p-0 italic text-center tracking-[.06em]`}
          style={{ height: 'auto', fontSize: editorFontSize(-2), lineHeight: 1.7 }}
        />
        {renderHoverPalette('top-1/2 -translate-y-1/2 right-3')}
      </>
    ) : (
      <>
        {renderAvatar({ size: 44, nameClass: 'text-[9px]', switchSize: 19, switchIconSize: 12, switchOffset: 4 })}
        <div className="flex-1 min-w-0 pl-3.5" style={{ borderLeft: `3px solid ${charColor}` }}>
          <div className="flex items-baseline gap-[9px] mb-[5px] min-w-0">
            <span
              className="text-[11px] font-bold tracking-[.22em] whitespace-nowrap truncate select-none"
              style={{ color: nameLabelText(charColor, isDarkMode) }}
            >
              {character?.name}
            </span>
            {renderMetaControls('text')}
          </div>
          <textarea
            {...textareaBehavior}
            placeholder="セリフを入力"
            className={`${TEXTAREA_BASE} w-full bg-transparent p-0`}
            style={{ height: 'auto', fontSize: editorFontSize(1), lineHeight: 1.9 }}
          />
        </div>
        {renderHoverPalette('top-2.5 right-3')}
      </>
    );
  } else if (variant === 'chat') {
    // 左右振り分けのチャット。連続発言ではアバターと名前を省略する
    if (isTogaki) {
      rootClass = `flex justify-center py-1 px-2.5 rounded-[18px] ${isActive ? 'bg-block' : ''}`;
      body = (
        <>
          {renderTogakiSwitch(`absolute left-2 top-1/2 -translate-y-1/2 ${isActive ? '' : 'opacity-0 group-hover/block:opacity-100 focus-visible:opacity-100'}`)}
          <textarea
            {...textareaBehavior}
            placeholder="ト書きを入力"
            className={`${TEXTAREA_BASE} w-auto min-w-[8em] max-w-[74%] [field-sizing:content] py-[5px] px-4 rounded-full bg-field italic text-center`}
            style={{ height: 'auto', fontSize: editorFontSize(-3), lineHeight: 1.5 }}
          />
          {renderHoverPalette('top-1/2 -translate-y-1/2 right-2.5')}
        </>
      );
    } else {
      rootClass = `flex items-start gap-2.5 ${isChatRight ? 'flex-row-reverse' : ''} ${showChatName ? 'p-2.5' : 'px-2.5'} rounded-[18px] ${isActive ? 'bg-block' : ''}`;
      const bubbleRadius = isChatRight ? '18px 18px 6px 18px' : '18px 18px 18px 6px';
      body = (
        <>
          {showChatName
            ? renderAvatar({ size: 44, nameClass: 'text-[9px]', switchSize: 19, switchIconSize: 12, switchOffset: 4 })
            : <div className="w-11 shrink-0" />}
          <div className="relative flex-1 min-w-0 max-w-[74%]">
            {/* 連続発言では名前を省略。感情・プリセットは選択中だけ出す */}
            {(showChatName || isActive) && (
              <div className={`absolute -top-2 ${isChatRight ? 'right-3.5' : 'left-3.5'} z-[2] flex items-center gap-[5px] max-w-[calc(100%-28px)]`}>
                {isChatRight && renderMetaControls('chip', true)}
                {showChatName && renderNameBadge(isActive ? 'var(--color-block)' : 'var(--color-canvas)')}
                {!isChatRight && renderMetaControls('chip')}
              </div>
            )}
            <textarea
              {...textareaBehavior}
              placeholder="セリフを入力"
              className={`${TEXTAREA_BASE} w-full`}
              style={{
                height: 'auto',
                fontSize: editorFontSize(),
                lineHeight: 1.6,
                padding: showChatName ? '15px 15px 13px' : '13px 15px',
                borderRadius: bubbleRadius,
                border: `1.5px solid ${charColor}`,
                backgroundColor: bubbleFill(charColor, isDarkMode)
              }}
            />
          </div>
          {renderHoverPalette(`top-[9px] ${isChatRight ? 'left-2.5' : 'right-2.5'}`)}
        </>
      );
    }
  } else {
    // ポップ（基準）。ブロック面の上にフキダシを載せ、話者名はフキダシ上辺のバッジ
    if (isTogaki) {
      rootClass = `flex items-center gap-1.5 py-[13px] pl-3 pr-4 rounded-[18px] bg-field ${
        isActive ? 'shadow-(--shadow-block-selected)' : 'shadow-[inset_0_0_0_1px_var(--color-hairline)]'
      }`;
      body = (
        <>
          {renderTogakiSwitch('')}
          <textarea
            {...textareaBehavior}
            placeholder="ト書きを入力"
            className={`${TEXTAREA_BASE} w-full flex-1 min-w-0 bg-transparent p-0 italic`}
            style={{ height: 'auto', fontSize: editorFontSize(-1), lineHeight: 1.55 }}
          />
          {renderHoverPalette('top-1/2 -translate-y-1/2 right-2.5')}
        </>
      );
    } else {
      rootClass = `flex ${isMobileView ? 'items-start gap-2.5' : 'items-center gap-3'} p-3 rounded-[20px] bg-block ${
        isActive ? 'shadow-(--shadow-block-selected)' : 'shadow-(--shadow-block)'
      }`;
      body = (
        <>
          {renderAvatar(isMobileView
            // 縁取りを付けない分（外周4px）だけ大きくする
            ? { size: 56, nameClass: 'text-[10px]', switchSize: 20, switchIconSize: 12, switchOffset: 4 }
            : { size: 60, nameClass: 'text-[11px]', switchSize: 21, switchIconSize: 13, switchOffset: 4 })}
          <div className="relative flex-1 min-w-0">
            <div className="absolute -top-2 left-3.5 z-[2] flex items-center gap-[5px] max-w-[calc(100%-28px)]">
              {renderNameBadge('var(--color-block)')}
              {renderMetaControls('chip')}
            </div>
            <textarea
              {...textareaBehavior}
              placeholder="セリフを入力"
              className={`${TEXTAREA_BASE} w-full rounded-[18px]`}
              style={{
                height: 'auto',
                fontSize: editorFontSize(),
                lineHeight: 1.55,
                padding: isMobileView ? '16px 14px 14px' : '16px 16px 14px',
                border: `2px solid ${charColor}`,
                backgroundColor: bubbleFill(charColor, isDarkMode)
              }}
            />
          </div>
          {renderHoverPalette('top-[11px] right-3')}
        </>
      );
    }
  }

  return (
    <>
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      // 感情ピッカーを開いている間は後続ブロックより手前に出す
      className={`relative group/block cursor-grab touch-manipulation focus:outline-none ${isEmotionPickerOpen ? 'z-20' : ''} ${rootClass}`}
      onClick={onClick}
      data-block-index={script.blocks.findIndex(b => b.id === block.id)}
    >
      {body}
    </div>
    {isSpeakerPickerOpen && (
      <CharacterPicker
        characters={speakerPickerCharacters}
        initialCharacterId={block.characterId}
        onSelect={handleSpeakerPicked}
        onClose={closeSpeakerPicker}
        title="話者を切り替え"
      />
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
  onDeleteBlock,
  onDeleteBlocks,
  onInsertBlock,
  onMoveBlock,
  onMoveBlocks,
  onMoveBlocksByIndex,
  onDuplicateBlocks,
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
  simpleMode = false,
  bubbleTheme = 'pop',
  currentProjectId,
  onUpdateScript,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onBlockDragStateChange,
  onDragMovePosition,
  onActiveBlockChange,
  addBlockSpeakerPicker = false,
  isDarkMode = false,
  setRequestSpeakerPicker
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
  // 話者選択ピッカー（addBlockSpeakerPicker が ON のときだけ表示）
  const [speakerPickerRequest, setSpeakerPickerRequest] = useState<{ mode: 'append' | 'insertBelow'; anchorIndex: number } | null>(null);
  const focusBeforePickerRef = useRef<HTMLElement | null>(null);
  
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
      const threshold = Math.round(window.innerHeight * 0.25);
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
          if (rect.top <= threshold) {
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
  const prevBlocksRef = useRef(script.blocks);
  const prevScriptId = useRef(script.id);
  const insertIdx = useRef<number>(-1);
  const isCtrlEnterBlock = useRef<boolean>(false); // Ctrl+Enterで追加されたブロックかどうかのフラグ
  const isUndoRedoOperation = useRef<boolean>(false); // アンドゥ・リドゥ操作かどうかのフラグ

  useEffect(() => {
    // シーン切り替えの場合は自動フォーカスをスキップ
    if (script.id !== prevScriptId.current) {
      prevScriptId.current = script.id;
      prevBlockCount.current = script.blocks.length;
      prevBlocksRef.current = script.blocks;
      return;
    }

    // アンドゥ・リドゥ操作の場合
    if (isUndoRedoOperation.current) {
      isUndoRedoOperation.current = false;

      // ブロック数が減った場合（ブロック追加のアンドゥなど）、追加前のブロックにフォーカス
      if (script.blocks.length < prevBlockCount.current && script.blocks.length > 0) {
        // 選択中のブロックが新しいブロックリストに存在するか確認
        const currentSelectedId = selectedBlockIds[0];
        const newBlockIds = new Set(script.blocks.map(b => b.id));
        let focusIdx: number;

        if (currentSelectedId && newBlockIds.has(currentSelectedId)) {
          // 選択ブロックがまだ存在する場合はそのままフォーカス
          focusIdx = script.blocks.findIndex(b => b.id === currentSelectedId);
        } else {
          // 選択ブロックが削除された場合、旧ブロックリストでの位置を元に直前のブロックにフォーカス
          const oldIndex = prevBlocksRef.current.findIndex(b => b.id === currentSelectedId);
          focusIdx = oldIndex > 0 ? Math.min(oldIndex - 1, script.blocks.length - 1) : 0;
        }

        setTimeout(() => {
          const targetRef = textareaRefs.current[focusIdx];
          if (targetRef) {
            targetRef.focus({ preventScroll: true });
            onSelectedBlockIdsChange([script.blocks[focusIdx]?.id || '']);
            ensureBlockVisible(focusIdx, 10);
          }
        }, 50);
      }

      prevBlockCount.current = script.blocks.length;
      prevBlocksRef.current = script.blocks;
      return;
    }

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
    prevBlocksRef.current = script.blocks;
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

  // simpleModeやfontSize変更時にtextarea高さを再計算
  useEffect(() => {
    requestAnimationFrame(() => {
      textareaRefs.current.forEach(ref => {
        if (ref) {
          ref.style.height = 'auto';
          ref.style.height = ref.scrollHeight + 'px';
        }
      });
    });
  }, [simpleMode]);

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

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    setActiveDragId(activeId);
    const draggedIds = selectedBlockIds.includes(activeId) ? selectedBlockIds : [activeId];
    onBlockDragStateChange?.(true, draggedIds);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (onDragMovePosition && event.activatorEvent) {
      const activatorEvent = event.activatorEvent as PointerEvent;
      const x = activatorEvent.clientX + (event.delta?.x || 0);
      const y = activatorEvent.clientY + (event.delta?.y || 0);
      onDragMovePosition(x, y);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    // 注意: ここではIDsをクリアしない。シーンタブへのドロップがonPointerUpで発火するため、
    // IDsは少し遅延してクリアする必要がある
    setTimeout(() => onBlockDragStateChange?.(false, []), 100);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeId = active.id as string;
      const newIndex = script.blocks.findIndex(block => block.id === over.id);

      // 複数選択ドラッグ：ドラッグされたブロックが選択中の場合、全選択ブロックをまとめて移動
      if (selectedBlockIds.length > 1 && selectedBlockIds.includes(activeId) && onMoveBlocksByIndex) {
        onMoveBlocksByIndex(selectedBlockIds, newIndex);
      } else {
        const oldIndex = script.blocks.findIndex(block => block.id === activeId);
        onMoveBlock(oldIndex, newIndex);
      }

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

  // anchorIndex 指定時はそのブロック以前から直近の話者を探す（直後への挿入用）。
  // 未指定（末尾追加）の場合はスクリプト全体の末尾話者を使う。
  const getLastSpeakerTemplate = useCallback((anchorIndex?: number) => {
    const scope = anchorIndex !== undefined && anchorIndex >= 0
      ? script.blocks.slice(0, anchorIndex + 1)
      : script.blocks;
    const lastSpeakerBlock = [...scope].reverse().find((block) => block.characterId);
    const fallbackCharacterId = characters.find((c) => c.id)?.id || '';
    return {
      characterId: lastSpeakerBlock?.characterId || fallbackCharacterId,
      emotion: (lastSpeakerBlock?.emotion || 'normal') as Emotion
    };
  }, [characters, script.blocks]);

  const handleMoveSelectedBlock = useCallback((direction: 'up' | 'down') => {
    if (selectedBlockIds.length > 1 && onMoveBlocks) {
      onMoveBlocks(selectedBlockIds, direction);
      return;
    }
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
  }, [getPrimarySelectedIndex, onMoveBlock, onMoveBlocks, onSelectedBlockIdsChange, script.blocks, selectedBlockIds]);

  const handleAddBlockBelowSelected = useCallback(() => {
    const currentIndex = getPrimarySelectedIndex();
    const insertIndex = currentIndex >= 0 ? currentIndex + 1 : script.blocks.length;
    const { characterId, emotion } = getLastSpeakerTemplate(currentIndex);

    const newBlock = createScriptBlock(characterId, emotion, characters);
    insertIdx.current = insertIndex;
    onInsertBlock(newBlock, insertIndex);
    setTimeout(() => {
      setManualFocusTargetFn({ index: insertIndex, id: newBlock.id });
    }, 10);
  }, [characters, getLastSpeakerTemplate, getPrimarySelectedIndex, onInsertBlock, script.blocks.length, setManualFocusTargetFn]);

  const handleAddTogakiBelowSelected = useCallback(() => {
    const currentIndex = getPrimarySelectedIndex();
    const insertIndex = currentIndex >= 0 ? currentIndex + 1 : script.blocks.length;
    handleAddTogaki(insertIndex);
  }, [getPrimarySelectedIndex, script.blocks.length]);

  // ===== 話者選択ピッカー =====

  // 現在のプロジェクトで有効なキャラクター（ピッカーの並び順＝数字キーの割り当て順）
  const pickerCharacters = useMemo(() => characters.filter(c =>
    c.id !== '' &&
    (!currentProjectId || !c.disabledProjects || !c.disabledProjects.includes(currentProjectId))
  ), [characters, currentProjectId]);

  // ピッカーモードON時にブロック追加を要求する入口。
  // 起動直後は再レンダーでフォーカスが移るため、この時点の要素を控えてキャンセル時に戻す。
  const requestAddBlock = useCallback((mode: 'append' | 'insertBelow', anchorIndex: number) => {
    focusBeforePickerRef.current = document.activeElement as HTMLElement | null;
    setSpeakerPickerRequest({ mode, anchorIndex });
  }, []);

  const cancelSpeakerPicker = useCallback(() => {
    const target = focusBeforePickerRef.current;
    setSpeakerPickerRequest(null);
    setTimeout(() => target?.focus?.(), 0);
  }, []);

  // キーボードショートカット側からピッカーを起動できるように関数を親へ渡す
  useEffect(() => {
    setRequestSpeakerPicker?.(requestAddBlock);
  }, [requestAddBlock, setRequestSpeakerPicker]);

  // ピッカー表示時の初期選択（従来アルゴリズムと同じ「直前の話者」）
  const speakerPickerInitialId = useMemo(() => {
    if (!speakerPickerRequest) return '';
    return getLastSpeakerTemplate(
      speakerPickerRequest.mode === 'insertBelow' ? speakerPickerRequest.anchorIndex : undefined
    ).characterId;
  }, [getLastSpeakerTemplate, speakerPickerRequest]);

  const handleSpeakerPickerSelect = useCallback((characterId: string) => {
    if (!speakerPickerRequest) return;
    const { mode, anchorIndex } = speakerPickerRequest;
    const insertIndex = mode === 'append'
      ? script.blocks.length
      : (anchorIndex >= 0 ? anchorIndex + 1 : script.blocks.length);

    // 直前の話者をそのまま選んだ場合は表情も引き継ぐ（従来の追加挙動と一致させる）
    const template = getLastSpeakerTemplate(mode === 'insertBelow' ? anchorIndex : undefined);
    const emotion: Emotion = characterId && characterId === template.characterId
      ? template.emotion
      : 'normal';

    const newBlock = createScriptBlock(characterId, emotion, characters);
    insertIdx.current = insertIndex;
    onInsertBlock(newBlock, insertIndex);
    setSpeakerPickerRequest(null);
    setTimeout(() => {
      setManualFocusTargetFn({ index: insertIndex, id: newBlock.id });
    }, 10);
  }, [characters, getLastSpeakerTemplate, onInsertBlock, script.blocks.length, setManualFocusTargetFn, speakerPickerRequest]);

  const primarySelectedBlockId = useMemo(() => selectedBlockIds[0] || null, [selectedBlockIds]);
  const primarySelectedIndex = useMemo(() => {
    if (!primarySelectedBlockId) return -1;
    return script.blocks.findIndex((block) => block.id === primarySelectedBlockId);
  }, [primarySelectedBlockId, script.blocks]);
  const selectedIndices = useMemo(() => {
    const idSet = new Set(selectedBlockIds);
    return script.blocks.map((b, i) => idSet.has(b.id) ? i : -1).filter(i => i >= 0).sort((a, b) => a - b);
  }, [selectedBlockIds, script.blocks]);
  const canMoveSelectedUp = selectedIndices.length > 0 && selectedIndices[0] > 0;
  const canMoveSelectedDown = selectedIndices.length > 0 && selectedIndices[selectedIndices.length - 1] < script.blocks.length - 1;
  const canOperateSelectedBlock = selectedBlockIds.length > 0;

  const handleDuplicateSelectedBlock = useCallback(() => {
    if (selectedBlockIds.length > 1 && onDuplicateBlocks) {
      onDuplicateBlocks(selectedBlockIds);
      return;
    }
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
  }, [onInsertBlock, onDuplicateBlocks, primarySelectedBlockId, primarySelectedIndex, script.blocks, selectedBlockIds, setManualFocusTargetFn]);

  const handleDeleteSelectedBlock = useCallback(() => {
    if (selectedBlockIds.length > 1 && onDeleteBlocks) {
      const minIndex = selectedIndices.length > 0 ? selectedIndices[0] : 0;
      pendingFocusIndexAfterDelete.current = minIndex;
      onDeleteBlocks(selectedBlockIds);
      onSelectedBlockIdsChange([]);
      return;
    }
    if (!primarySelectedBlockId) return;
    if (primarySelectedIndex >= 0) {
      pendingFocusIndexAfterDelete.current = primarySelectedIndex;
    }
    onDeleteBlock(primarySelectedBlockId);
  }, [onDeleteBlock, primarySelectedBlockId, primarySelectedIndex]);

  // フローティングツールバー: タッチ操作では44pxのタップ領域、狭い画面では区切り線と1つ移動を省く
  const isTouchToolbar = isMobileLayout;
  const isCompactToolbar = !isTabletOrLarger;
  const toolbarButtonClass = `${isTouchToolbar ? 'size-11 [&>svg]:size-[21px]' : 'size-8.5 [&>svg]:size-[19px]'} shrink-0 rounded-full flex items-center justify-center text-fg-sub transition-colors hover:bg-field hover:text-fg disabled:opacity-40 disabled:pointer-events-none`;
  const toolbarDivider = isCompactToolbar ? null : <span className="w-px h-5 mx-1 shrink-0 bg-hairline" aria-hidden="true" />;

  // ブロック間の間隔（シンプルは行を詰め、シネマは脚本らしく広めに取る）
  const blockGapClass = simpleMode
    ? 'mb-px'
    : bubbleTheme === 'cinema'
      ? 'mb-5'
      : bubbleTheme === 'chat'
        ? 'mb-3'
        : 'mb-2.5';

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
          className="fixed z-30 p-2 rounded-full bg-panel text-fg-sub ring-1 ring-hairline shadow-(--shadow-popover) hover:text-fg transition-all"
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
          <div className="flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 text-center text-fg-sub">
            <p className="text-sm sm:text-base md:text-lg mb-4">1.右上のキャラクターのアイコンから登場キャラクターを追加します。</p>
            <p className="text-sm sm:text-base md:text-lg mb-4">2.「+ブロックを追加」からテキストブロックを追加し、キャラクターを選択するとセリフを入力できます。</p>
            <p className="text-sm sm:text-base md:text-lg mb-4">3.右上のエクスポートから台本をCSV形式で出力できます。グループ設定ごとにCSVファイルを分割出力することができます。</p>
            <p className="text-sm sm:text-base md:text-lg mb-4">4.より詳しい操作方法は設定＞ヘルプをご覧ください。</p>
            {isStoryPanelOpen && (
              <p className="text-xs text-fg-sub mt-2">
                ストーリーセパレートを使うにはテキストブロックを2つ以上作成してください。
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 items-stretch">
            {isStoryPanelOpen && (
              <>
                <div
                  className="fixed left-0 z-30 bg-canvas shadow-[1px_0_0_var(--color-hairline)] shrink-0 overflow-hidden flex flex-col"
                  style={{ width: panelWidth, top: '64px', height: 'calc(100vh - 64px)' }}
                >
                  <div className="flex items-center justify-between p-2 px-3 bg-well shadow-[0_1px_0_var(--color-hairline)] shrink-0">
                    <span className="text-sm font-semibold text-fg">ストーリーセパレート</span>
                    <span className="text-xs text-fg-sub">幅 {Math.round(panelWidth)}px</span>
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
                          {prevImage && prevSegment && (
                            <div
                              className="absolute left-0 right-0 mx-auto rounded-lg overflow-hidden ring-1 ring-hairline opacity-40 cursor-pointer hover:opacity-60 transition-opacity"
                              style={{
                                width: `${imageWidth * 0.85}px`,
                                top: '-30%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 1,
                              }}
                              onClick={() => {
                                const anchorIndex = getAnchorIndex(prevSegment.anchorBlockId);
                                const el = document.querySelector(`[data-block-index="${anchorIndex}"]`) as HTMLElement | null;
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }}
                            >
                              <img src={prevImage.dataUrl} alt={prevImage.name} className="w-full object-cover" style={{ height: `${imageHeight * 0.85}px` }} />
                            </div>
                          )}
                          
                          <div className="absolute left-0 right-0 z-10" style={{ top: prevImage ? '10%' : '0' }}>
                            <div className="flex items-center justify-between mb-2 px-1">
                              <span className="text-xs font-medium text-fg-sub flex items-center gap-1.5">
                                {segmentIndex + 1} / {orderedSegments.length}
                                {currentSegment.label && (
                                  <span className="ml-1.5 text-fg/80">{currentSegment.label}</span>
                                )}
                                {currentImageMissing && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-destructive-tint text-destructive shadow-[inset_0_0_0_1px_var(--color-destructive-ring)]">
                                    ローカル画像未配置
                                  </span>
                                )}
                              </span>
                            </div>
                            {currentImage ? (
                              <div
                                className={`relative group rounded-lg overflow-hidden ring-1 ring-hairline shadow-(--shadow-popover) transition ${dragOverSegmentId === currentSegment.id ? 'ring-2 ring-primary/60 bg-primary/5' : ''}`}
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
                                className={`w-full border-2 border-dashed border-hairline rounded-xl bg-well flex flex-col items-center justify-center text-sm text-fg-sub hover:text-fg transition ${dragOverSegmentId === currentSegment.id ? 'ring-2 ring-primary/60 bg-primary-tint border-primary/60' : ''}`}
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
                          
                          {nextImage && nextSegment && (
                            <div
                              className="absolute left-0 right-0 mx-auto rounded-lg overflow-hidden ring-1 ring-hairline opacity-40 cursor-pointer hover:opacity-60 transition-opacity"
                              style={{
                                width: `${imageWidth * 0.85}px`,
                                bottom: '-30%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 1,
                              }}
                              onClick={() => {
                                const anchorIndex = getAnchorIndex(nextSegment.anchorBlockId);
                                const el = document.querySelector(`[data-block-index="${anchorIndex}"]`) as HTMLElement | null;
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                  className="hidden lg:block fixed w-1 bg-hairline hover:bg-primary/40 cursor-col-resize z-30"
                  style={{ height: 'calc(100vh - 64px)', top: '64px', left: `${panelWidth}px` }}
                  onMouseDown={handleResizeStart}
                  role="separator"
                  aria-label="ストーリーセパレートの幅を調整"
                />
              </>
            )}
            <div className={`flex-1 story-main-column ${isStoryPanelOpen ? 'lg:ml-0' : ''}`} style={isStoryPanelOpen ? { marginLeft: `${panelWidth + 4}px` } : {}}>
              {/* ブロックはキャンバスに直接並べる（外側のカード面は置かない） */}
              <div className="p-[clamp(0.5rem,1.2vw,1rem)] mb-24 relative h-full flex flex-col justify-between">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
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
                                    className="text-xs px-2 py-1 rounded-l-lg bg-field text-fg w-28 outline-none shadow-[0_0_0_2px_var(--color-primary)]"
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
                                    className="relative flex items-center text-xs font-medium text-fg-sub bg-field pl-2 pr-3 py-1 select-none"
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
                                      className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-destructive-tint text-destructive shadow-[inset_0_0_0_1px_var(--color-destructive-ring)] transition hover:brightness-95"
                                      onClick={() => openImagePicker(firstSegment.id)}
                                      title="ローカル画像を再リンク"
                                    >
                                      未配置
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="p-0.5 text-fg-sub/50 hover:text-fg transition opacity-0 group-hover/bookmark:opacity-100 ml-1"
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
                        <div key={block.id} className={`${blockGapClass} last:mb-0`}>
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
                            textareaRef={el => textareaRefs.current[index] = el}
                            isSelected={selectedBlockIds.includes(block.id)}
                            isMultiSelection={selectedBlockIds.length > 1}
                            isMultiDragGhost={!!activeDragId && activeDragId !== block.id && selectedBlockIds.length > 1 && selectedBlockIds.includes(block.id)}
                            onClick={(event) => handleBlockClick(block.id, index, event)}
                            onTextareaFocus={() => onActiveBlockChange?.(block.id)}
                            enterOnlyBlockAdd={enterOnlyBlockAdd}
                            simpleMode={simpleMode}
                            bubbleTheme={bubbleTheme}
                            isDarkMode={isDarkMode}
                            currentProjectId={currentProjectId}
                            script={script}
                            onInsertBlock={onInsertBlock}
                            insertIdx={insertIdx}
                            onRequestSpeakerPicker={addBlockSpeakerPicker
                              ? (anchorIndex) => requestAddBlock('insertBelow', anchorIndex)
                              : undefined}
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
                                      className="text-xs px-2 py-1 rounded-l-lg bg-field text-fg w-28 outline-none shadow-[0_0_0_2px_var(--color-primary)]"
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
                                      className="relative flex items-center text-xs font-medium text-fg-sub bg-field pl-2 pr-3 py-1 select-none"
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
                                        className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-destructive-tint text-destructive shadow-[inset_0_0_0_1px_var(--color-destructive-ring)] transition hover:brightness-95"
                                        onClick={() => openImagePicker(existingSegment.id)}
                                        title="ローカル画像を再リンク"
                                      >
                                        未配置
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="p-0.5 text-fg-sub/50 hover:text-fg transition opacity-0 group-hover/bookmark:opacity-100 ml-1"
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
                                className="p-1.5 rounded-full bg-panel text-fg-sub shadow-(--shadow-popover) hover:text-fg transition shrink-0"
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
                                className="opacity-0 group-hover/sep-add:opacity-100 transition-opacity inline-flex items-center justify-center w-8 h-8 sm:w-6 sm:h-6 rounded-full border border-dashed border-muted-foreground/30 text-fg-sub/50 hover:bg-accent hover:text-fg hover:border-solid"
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
                  <DragOverlay dropAnimation={null}>
                    {activeDragId && selectedBlockIds.length > 1 && selectedBlockIds.includes(activeDragId) && (() => {
                      const dragBlocks = script.blocks.filter(b => selectedBlockIds.includes(b.id));
                      return (
                        <div className="bg-panel rounded-2xl ring-1 ring-primary/30 shadow-(--shadow-popover) p-2 max-w-[600px] opacity-90">
                          {dragBlocks.slice(0, 5).map((b, i) => {
                            const char = characters.find(c => c.id === b.characterId);
                            return (
                              <div key={b.id} className={`flex items-center gap-2 px-2 py-1 ${i > 0 ? 'shadow-[0_-1px_0_var(--color-hairline)]' : ''}`}>
                                {char ? (
                                  <span className="text-xs font-medium text-fg-sub shrink-0 w-16 truncate">{char.name}</span>
                                ) : (
                                  <span className="text-xs text-fg-sub/60 shrink-0 w-16">ト書き</span>
                                )}
                                <span className="text-sm text-fg truncate">{b.text || '(空)'}</span>
                              </div>
                            );
                          })}
                          {dragBlocks.length > 5 && (
                            <div className="text-xs text-fg-sub text-center py-1">
                              ...他 {dragBlocks.length - 5} ブロック
                            </div>
                          )}
                          <div className="text-xs text-primary font-medium text-center mt-1">
                            {dragBlocks.length} ブロック選択中
                          </div>
                        </div>
                      );
                    })()}
                  </DragOverlay>
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
        <DialogFrame
          isOpen={!!segmentToDelete}
          onCancel={() => setSegmentToDelete(null)}
          panelClassName="w-full max-w-sm mx-4"
        >
          <DialogHeader icon={ScissorsIcon} title="セパレートラインを削除しますか？" onClose={() => setSegmentToDelete(null)} />
          <div className="px-5 pb-5">
            <p className="text-[13px] leading-relaxed text-fg-sub">
              このラインに紐付いた画像も同時に削除されます。元に戻す場合はアンドゥをご利用ください。
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="secondary" onClick={() => setSegmentToDelete(null)}>キャンセル</Button>
              <Button variant="destructive" onClick={handleConfirmDeleteSegment}>削除する</Button>
            </div>
          </div>
        </DialogFrame>
      )}
      {imageToDelete && (
        <DialogFrame
          isOpen={!!imageToDelete}
          onCancel={() => setImageToDelete(null)}
          panelClassName="w-full max-w-sm mx-4"
        >
          <DialogHeader icon={PhotoIcon} title="画像を削除しますか？" onClose={() => setImageToDelete(null)} />
          <div className="px-5 pb-5">
            <p className="text-[13px] leading-relaxed text-fg-sub">
              この画像はストーリーパネルから削除されます。元に戻す場合はアンドゥをご利用ください。
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="secondary" onClick={() => setImageToDelete(null)}>キャンセル</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  handleRemoveSegmentImage(imageToDelete.segmentId);
                  setImageToDelete(null);
                }}
              >
                削除する
              </Button>
            </div>
          </div>
        </DialogFrame>
      )}
      {isTabletOrLarger && (
        <button
          type="button"
          onClick={() => setIsToolbarCollapsed(prev => !prev)}
          className="fixed right-3 bottom-6 z-50 size-10 rounded-full bg-panel/96 backdrop-blur shadow-(--shadow-toolbar) flex items-center justify-center text-fg-sub transition-colors hover:text-fg"
          title={isToolbarCollapsed ? 'ツールバーを表示' : 'ツールバーを非表示'}
        >
          {isToolbarCollapsed ? <ChevronUpIcon className="size-5" /> : <ChevronDownIcon className="size-5" />}
        </button>
      )}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-40 px-2 flex justify-center w-full pointer-events-none"
        style={{ bottom: `${mobileToolbarBottom}px` }}
      >
        <div className="inline-flex items-center gap-2 max-w-[calc(100vw-1rem)] pointer-events-auto">
          <div
            data-floating-toolbar="true"
            className={`bg-panel/96 backdrop-blur rounded-full shadow-(--shadow-toolbar) inline-flex items-center overflow-x-auto no-scrollbar whitespace-nowrap transition-transform duration-300 max-w-[calc(100vw-1rem)] ${
              isTouchToolbar ? 'p-1 gap-0' : 'p-1.5 gap-0.5'
            } ${reverseToolbarOrder ? 'flex-row-reverse' : ''} ${isTabletOrLarger && isToolbarCollapsed ? 'translate-y-[140%] pointer-events-none' : 'translate-y-0'}`}
          >
          <button type="button" onClick={handleScrollTop} className={toolbarButtonClass} title="最上段へ">
            <ChevronUpIcon />
          </button>
          <button type="button" onClick={handleScrollBottom} className={toolbarButtonClass} title="最下段へ">
            <ChevronDownIcon />
          </button>
          {toolbarDivider}
          <button type="button" onClick={onUndo} disabled={!canUndo} className={toolbarButtonClass} title="元に戻す">
            <ArrowUturnLeftIcon />
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo} className={toolbarButtonClass} title="やり直し">
            <ArrowUturnRightIcon />
          </button>
          {toolbarDivider}
          {/* 1つ移動は幅の狭いモバイルでは出さない（ドラッグで並び替えできるため） */}
          {!isCompactToolbar && (
            <>
              <button
                type="button"
                onClick={() => handleMoveSelectedBlock('up')}
                disabled={!canMoveSelectedUp}
                className={toolbarButtonClass}
                title="選択ブロックを上に移動"
              >
                <ArrowUpIcon />
              </button>
              <button
                type="button"
                onClick={() => handleMoveSelectedBlock('down')}
                disabled={!canMoveSelectedDown}
                className={toolbarButtonClass}
                title="選択ブロックを下に移動"
              >
                <ArrowDownIcon />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleDuplicateSelectedBlock}
            disabled={!canOperateSelectedBlock}
            className={toolbarButtonClass}
            title="選択ブロックを複製"
          >
            <DocumentDuplicateIcon />
          </button>
          <button
            type="button"
            onClick={handleDeleteSelectedBlock}
            disabled={!canOperateSelectedBlock}
            className={`${toolbarButtonClass} !text-destructive hover:!bg-destructive-tint`}
            title="選択ブロックを削除"
          >
            <TrashIcon />
          </button>
          {toolbarDivider}
          {/* ト書き追加: アイコンではなく「ト」の文字（話者ピッカーのト書きと表記を揃える） */}
          <button
            type="button"
            onClick={handleAddTogakiBelowSelected}
            className={`${isTouchToolbar ? 'size-11 text-[17px]' : 'size-8.5 text-[15px]'} shrink-0 rounded-full flex items-center justify-center font-bold leading-none bg-togaki-button text-togaki-button-fg shadow-[inset_0_0_0_1px_var(--color-hairline)] transition-[filter] hover:brightness-95`}
            title="現在のブロック直下にト書きを追加"
          >
            ト
          </button>
          {/* ブロック追加: 選択中ブロックの直下（未選択なら最下段）。最下段への追加は Ctrl+B でも可能 */}
          <button
            type="button"
            onClick={() => {
              if (addBlockSpeakerPicker) {
                requestAddBlock('insertBelow', getPrimarySelectedIndex());
                return;
              }
              handleAddBlockBelowSelected();
            }}
            className={`${isTouchToolbar ? 'size-11 justify-center' : 'h-8.5 px-3.5 gap-[5px] ml-0.5'} shrink-0 rounded-full flex items-center bg-primary text-on-primary shadow-[0_4px_12px_-4px_var(--color-primary)] transition-[filter] hover:brightness-105`}
            title={addBlockSpeakerPicker
              ? '新規ブロックを追加（話者を選択。選択中ブロックの直下、未選択なら最下段）'
              : '新規ブロックを追加（選択中ブロックの直下、未選択なら最下段）'}
          >
            <PlusIcon className={isTouchToolbar ? 'size-5.5' : 'size-[17px]'} strokeWidth={2.2} />
            {!isTouchToolbar && <span className="text-xs font-bold">ブロック</span>}
          </button>
          </div>
        </div>
      </div>
      {speakerPickerRequest && (
        <CharacterPicker
          characters={pickerCharacters}
          initialCharacterId={speakerPickerInitialId}
          onSelect={handleSpeakerPickerSelect}
          onClose={cancelSpeakerPicker}
          title={speakerPickerRequest.mode === 'append' ? '最下段に追加する話者' : '直下に追加する話者'}
        />
      )}
    </>
  );
}