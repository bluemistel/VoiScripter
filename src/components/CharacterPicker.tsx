'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Character } from '@/types';
import { UsersIcon } from '@heroicons/react/24/outline';
import CharacterGridAvatar from '@/components/common/CharacterGridAvatar';
import DialogHeader from '@/components/common/DialogHeader';

interface CharacterPickerProps {
  /** 現在のプロジェクトで有効なキャラクター（表示順・ト書きは含めない） */
  characters: Character[];
  /** 初期選択（直前の話者。ト書きの場合は ''） */
  initialCharacterId: string;
  onSelect: (characterId: string) => void;
  onClose: () => void;
  title?: string;
  /**
   * 指定するとデスクトップ表示では画面中央ではなく、この要素（話者アイコンなど）の横に重ねて表示する。
   * アイコンから視線を大きく動かさずに選べるようにするため。モバイルは従来どおりボトムシート。
   */
  anchorEl?: HTMLElement | null;
}

/** アンカー横に出すときの、アンカーとの間隔と画面端からの余白 */
const ANCHOR_GAP = 10;
const VIEWPORT_MARGIN = 8;

const GRID_COLUMNS = 2;
/** キャラクターに割り当てる数字キー（有効キャラクターの並び順で先頭9名） */
const CHARACTER_NUMBER_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** ト書きに割り当てる数字キー */
const TOGAKI_NUMBER_KEY = '0';

export default function CharacterPicker({
  characters,
  initialCharacterId,
  onSelect,
  onClose,
  title = '話者を選択',
  anchorEl = null
}: CharacterPickerProps) {
  // 選択肢は先頭がト書き（characterId: ''）、以降が有効キャラクター
  const options = useMemo(
    () => [{ id: '', name: 'ト書き', character: null as Character | null }].concat(
      characters.map(c => ({ id: c.id, name: c.name, character: c }))
    ),
    [characters]
  );

  const initialIndex = Math.max(0, options.findIndex(o => o.id === initialCharacterId));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isMobileView, setIsMobileView] = useState(false);
  // 表示行数は解像度で決める（タブレットはボトムシートのままでも5行表示にする）
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateMobileView = () => {
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const smallScreen = window.innerWidth < 640;
      setIsMobileView(coarsePointer || smallScreen);
      setIsNarrowScreen(smallScreen);
    };
    updateMobileView();
    window.addEventListener('resize', updateMobileView);
    return () => window.removeEventListener('resize', updateMobileView);
  }, []);

  // パネルへフォーカスを移し、ピッカー表示中の打鍵が背後のtextareaへ入力されないようにする
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // アンカー横の表示位置。右側に出し、入らなければ左側、どちらも入らなければアンカーの下に出す。
  // 縦は画面内に収める。スクロールやリサイズでアンカーが動いたら追従する。
  const isAnchored = !isMobileView && !!anchorEl;
  const [anchoredPosition, setAnchoredPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!isAnchored || !anchorEl) return;
    const place = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const anchor = anchorEl.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
      const maxTop = window.innerHeight - height - VIEWPORT_MARGIN;
      let left: number;
      let top = anchor.top;
      if (anchor.right + ANCHOR_GAP <= maxLeft) {
        left = anchor.right + ANCHOR_GAP;
      } else if (anchor.left - ANCHOR_GAP - width >= VIEWPORT_MARGIN) {
        left = anchor.left - ANCHOR_GAP - width;
      } else {
        left = anchor.left;
        top = anchor.bottom + ANCHOR_GAP;
      }
      setAnchoredPosition({
        left: Math.max(VIEWPORT_MARGIN, Math.min(left, maxLeft)),
        top: Math.max(VIEWPORT_MARGIN, Math.min(top, maxTop))
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isAnchored, anchorEl]);

  const cancel = () => onClose();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;

      const stop = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      if (event.key === 'Escape') {
        stop();
        cancel();
        return;
      }

      if (event.key === 'Enter') {
        stop();
        onSelect(options[activeIndex]?.id ?? '');
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' ||
          event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        stop();
        const delta = event.key === 'ArrowRight' ? 1
          : event.key === 'ArrowLeft' ? -1
            : event.key === 'ArrowDown' ? GRID_COLUMNS : -GRID_COLUMNS;
        setActiveIndex(prev => Math.min(options.length - 1, Math.max(0, prev + delta)));
        return;
      }

      // 数字キーは 0 がト書き、1〜9 が「有効キャラクターの並び順」
      if (!event.ctrlKey && !event.altKey && !event.metaKey) {
        if (event.key === TOGAKI_NUMBER_KEY) {
          stop();
          onSelect('');
          return;
        }
        const numberIndex = CHARACTER_NUMBER_KEYS.indexOf(event.key);
        if (numberIndex >= 0) {
          const target = characters[numberIndex];
          if (target) {
            stop();
            onSelect(target.id);
          }
          return;
        }
      }
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [activeIndex, characters, options, onSelect]);

  const gridItems = (
    <div
      // パネル自体は左右の余白を持たず、グリッド側で左右を同量空ける。
      // これでスクロールバーがパネル端に収まり、カードの左右余白が揃う。
      className={`grid grid-cols-2 gap-2 overflow-y-auto px-5 py-0.5 ${
        // 狭い画面は2列×4行のまま。それ以上では数字キー(0・1〜9)で選べる10件
        // ＝ト書き＋キャラ9名をスクロールせず出せるよう5行分を確保する。
        // 縦が短い環境ではみ出さないよう vh でも上限をかける。
        isNarrowScreen ? 'max-h-[260px]' : 'max-h-[min(325px,50vh)]'
      }`}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      {options.map((option, index) => {
        // 先頭のト書きは 0、以降のキャラクターは 1〜9
        const numberKey = index === 0 ? TOGAKI_NUMBER_KEY : CHARACTER_NUMBER_KEYS[index - 1];
        return (
          <button
            key={option.id || 'togaki'}
            ref={el => { itemRefs.current[index] = el; }}
            type="button"
            className={`p-2 rounded-xl text-left text-[13px] text-fg flex items-center gap-2 transition-colors ${
              index === activeIndex
                ? 'bg-primary-tint shadow-[inset_0_0_0_1.5px_var(--color-primary)] font-bold'
                : 'bg-well'
            }`}
            onClick={() => onSelect(option.id)}
            onMouseEnter={() => setActiveIndex(index)}
          >
            {option.character ? (
              <CharacterGridAvatar character={option.character} />
            ) : (
              // ツールバーのト書き追加ボタンと表記・色を揃える
              <div className="size-10 rounded-full flex items-center justify-center text-[15px] font-bold leading-none bg-togaki-button text-togaki-button-fg shadow-[inset_0_0_0_1px_var(--color-hairline)] shrink-0">
                ト
              </div>
            )}
            <span className="truncate flex-1">{option.name}</span>
            {numberKey && (
              <span className="shrink-0 min-w-5 text-center text-[10px] font-bold text-fg-sub bg-field rounded-full px-1.5 py-px">
                {numberKey}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const header = <DialogHeader icon={UsersIcon} title={title} onClose={cancel} />;

  const hint = (
    <p className="text-[10.5px] text-fg-sub px-5 pt-2.5">
      ↑↓←→で移動 / Enterで決定 / 数字キーで直接選択 / Escでキャンセル
    </p>
  );

  if (isMobileView) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={cancel}>
        <div
          ref={panelRef}
          tabIndex={-1}
          className="w-full bg-panel text-fg rounded-t-[22px] shadow-(--shadow-dialog) pb-[max(1.25rem,env(safe-area-inset-bottom))] focus:outline-none"
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {header}
          {gridItems}
          {hint}
        </div>
      </div>
    );
  }

  if (isAnchored) {
    // 背景は暗くせず、アイコンの横にポップオーバーとして重ねる（外側クリックで閉じる）
    return (
      <div className="fixed inset-0 z-50" onClick={cancel}>
        <div
          ref={panelRef}
          tabIndex={-1}
          className="fixed w-96 max-w-[calc(100vw-16px)] bg-panel text-fg rounded-[22px] ring-1 ring-hairline shadow-(--shadow-dialog) pb-5 focus:outline-none"
          // 位置が決まるまでは見せない（中央から飛ぶように見えないように）
          style={anchoredPosition
            ? { left: anchoredPosition.left, top: anchoredPosition.top }
            : { left: 0, top: 0, visibility: 'hidden' }}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {header}
          {gridItems}
          {hint}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={cancel}>
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-sm bg-panel text-fg rounded-[22px] shadow-(--shadow-dialog) pb-5 focus:outline-none"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        {header}
        {gridItems}
        {hint}
      </div>
    </div>
  );
}
