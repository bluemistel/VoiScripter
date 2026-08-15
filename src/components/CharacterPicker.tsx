'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Character } from '@/types';
import CharacterGridAvatar from '@/components/common/CharacterGridAvatar';

interface CharacterPickerProps {
  /** 現在のプロジェクトで有効なキャラクター（表示順・ト書きは含めない） */
  characters: Character[];
  /** 初期選択（直前の話者。ト書きの場合は ''） */
  initialCharacterId: string;
  onSelect: (characterId: string) => void;
  onClose: () => void;
  title?: string;
}

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
  title = '話者を選択'
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
      // パネルの左右パディング分だけ外側へ広げ、内側で同量を戻す。
      // これでスクロールバーがパネル端に収まり、カードの左右余白が揃う。
      className={`grid grid-cols-2 gap-2 overflow-y-auto -mx-4 px-4 ${
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
            className={`p-2 border rounded text-left text-xs flex items-center gap-2 ${index === activeIndex ? 'border-primary bg-primary/10 ring-1 ring-primary/40' : ''}`}
            onClick={() => onSelect(option.id)}
            onMouseEnter={() => setActiveIndex(index)}
          >
            {option.character ? (
              <CharacterGridAvatar character={option.character} />
            ) : (
              <div className="w-10 h-10 rounded-full border flex items-center justify-center text-xs font-bold bg-muted shrink-0">
                ト
              </div>
            )}
            <span className="truncate flex-1">{option.name}</span>
            {numberKey && (
              <span className="shrink-0 text-[10px] text-muted-foreground border rounded px-1 py-px">
                {numberKey}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const header = (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <button type="button" className="text-xs px-2 py-1 rounded border" onClick={cancel}>
        閉じる
      </button>
    </div>
  );

  const hint = (
    <p className="text-[10px] text-muted-foreground mt-2">
      ↑↓←→で移動 / Enterで決定 / 数字キーで直接選択 / Escでキャンセル
    </p>
  );

  if (isMobileView) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={cancel}>
        <div
          ref={panelRef}
          tabIndex={-1}
          className="w-full bg-background border-t rounded-t-xl p-4 focus:outline-none"
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
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={cancel}>
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-sm bg-popover border rounded-xl shadow-lg p-4 focus:outline-none"
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
