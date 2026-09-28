'use client';

import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import DialogHeader from '@/components/common/DialogHeader';
import { buttonClass } from '@/components/common/Button';
import { Project, ScriptBlock, Scene } from '@/types';

export interface SearchResult {
  blockId: string;
  sceneId: string;
  sceneName: string;
  blockIndex: number;
  text: string;
}

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  selectedSceneId: string | null;
  onSearch: (query: string, searchAllScenes: boolean) => SearchResult[];
  onNavigateToResult: (result: SearchResult, shouldScroll: boolean) => void;
  currentResultIndex: number;
  totalResults: number;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  searchHistory: string[];
  onAddToHistory: (query: string) => void;
}

export default function SearchDialog({
  isOpen,
  onClose,
  project,
  selectedSceneId,
  onSearch,
  onNavigateToResult,
  currentResultIndex,
  totalResults,
  onNavigatePrevious,
  onNavigateNext,
  searchHistory,
  onAddToHistory
}: SearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAllScenes, setSearchAllScenes] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMobileView, setIsMobileView] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isTypingRef = useRef(false);
  const lastTypingAtRef = useRef(0);

  // ダイアログが開いた時に初期位置を設定し、フォーカスを設定
  useEffect(() => {
    if (isOpen) {
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const mobile = coarsePointer || window.innerWidth < 768;
      setIsMobileView(mobile);
      // モバイル時は中央寄せ、PC時は従来位置
      const initialY = mobile ? Math.max(24, window.innerHeight * 0.18) : window.innerHeight * 0.4;
      const dialogWidth = mobile ? Math.min(window.innerWidth - 16, 672) : 672;
      const initialX = Math.max(8, (window.innerWidth - dialogWidth) / 2);
      setPosition({ x: initialX, y: initialY });
      
      if (inputRef.current) {
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 100);
      }
    }
  }, [isOpen]);

  // ドラッグ開始
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobileView) return;
    if (dialogRef.current) {
      setIsDragging(true);
      const rect = dialogRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  // ドラッグ中
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // 検索クエリが変更されたら検索を実行（履歴には追加しない）
  useEffect(() => {
    if (searchQuery.trim()) {
      onSearch(searchQuery, searchAllScenes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchAllScenes]);

  // ダイアログが閉じられた時に検索クエリをリセット
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Enterキーで次の結果へ、Shift+Enterで前の結果へ
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && totalResults > 0) {
      if (e.shiftKey) {
        onNavigatePrevious();
      } else {
        onNavigateNext();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (isTypingRef.current || Date.now() - lastTypingAtRef.current < 350) {
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onPointerDown={handleOverlayClick}>
      <div
        ref={dialogRef}
        className={`bg-panel text-fg rounded-[22px] shadow-(--shadow-dialog) ${isMobileView ? 'w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)]' : 'w-full max-w-2xl'} absolute`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onFocusCapture={(e) => {
          const target = e.target as HTMLElement;
          const tagName = target.tagName.toLowerCase();
          const typing = tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
          isTypingRef.current = typing;
          if (typing) {
            lastTypingAtRef.current = Date.now();
          }
        }}
        onBlurCapture={() => {
          setTimeout(() => {
            const active = document.activeElement as HTMLElement | null;
            if (!active || !dialogRef.current?.contains(active)) {
              isTypingRef.current = false;
              return;
            }
            const tagName = active.tagName.toLowerCase();
            const typing = tagName === 'input' || tagName === 'textarea' || active.isContentEditable;
            isTypingRef.current = typing;
            if (typing) {
              lastTypingAtRef.current = Date.now();
            }
          }, 0);
        }}
      >
        <div
          className={`select-none ${isMobileView ? '' : 'cursor-move'}`}
          onMouseDown={handleMouseDown}
        >
          <DialogHeader
            icon={MagnifyingGlassIcon}
            title="検索"
            onClose={onClose}
            // ドラッグできることを示すグリップ（2×4のドット）。モバイルは移動しないので出さない
            leading={!isMobileView && (
              <span className="grid grid-cols-4 gap-[2.5px] mr-1" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className="size-[2.5px] rounded-full bg-fg-faint" />
                ))}
              </span>
            )}
          />
        </div>

        <div className="px-5 pb-5">
        <div className="mb-4">
          <div className="relative mb-3">
            <MagnifyingGlassIcon className="absolute left-[15px] top-1/2 -translate-y-1/2 size-[17px] text-primary-text pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowHistory(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              placeholder="検索する単語を入力..."
              className="ui-input w-full text-[15px] py-3 pl-11"
              autoFocus
            />
            {showHistory && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-panel rounded-xl ring-1 ring-hairline shadow-(--shadow-popover) z-10 max-h-60 overflow-y-auto py-1">
                {searchHistory.slice(0, 10).map((historyItem, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSearchQuery(historyItem);
                      setShowHistory(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-field text-fg text-[13.5px]"
                  >
                    {historyItem}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="inline-flex items-center gap-[11px] text-[13.5px] text-fg cursor-pointer">
            <input
              type="checkbox"
              checked={searchAllScenes}
              onChange={(e) => setSearchAllScenes(e.target.checked)}
              className="ui-checkbox"
            />
            すべてのシーンを検索する
          </label>
        </div>

        {searchQuery.trim() && (
          <div className="mb-4">
            {/* 件数と前へ／次へを1つの帯にまとめる */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-primary-tint">
              <div className="text-[13px] text-fg-sub">
                {totalResults > 0 ? (
                  <span>
                    <span className="text-lg font-bold text-primary-text mr-1">{currentResultIndex + 1}</span>
                    / {totalResults} 件見つかりました
                  </span>
                ) : (
                  <span>見つかりませんでした</span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    onNavigatePrevious();
                    // ナビゲーションボタンで検索が確定されたので履歴に追加
                    if (searchQuery.trim() && !searchHistory.includes(searchQuery.trim())) {
                      onAddToHistory(searchQuery.trim());
                    }
                  }}
                  disabled={totalResults === 0}
                  className={buttonClass('secondary-outline', 'sm')}
                  title="前へ (Shift+Enter)"
                >
                  <ArrowUpIcon className="size-4" />
                  前へ
                </button>
                <button
                  onClick={() => {
                    onNavigateNext();
                    // ナビゲーションボタンで検索が確定されたので履歴に追加
                    if (searchQuery.trim() && !searchHistory.includes(searchQuery.trim())) {
                      onAddToHistory(searchQuery.trim());
                    }
                  }}
                  disabled={totalResults === 0}
                  className={buttonClass('secondary-outline', 'sm')}
                  title="次へ (Enter)"
                >
                  次へ
                  <ArrowDownIcon className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5" aria-label="ショートカット">
          {['Ctrl+F 検索', 'Enter 次へ', 'Shift+Enter 前へ', 'Esc 閉じる'].map(label => (
            <span key={label} className="px-2.5 py-1 rounded-full bg-field text-[11px] text-fg-sub whitespace-nowrap">
              {label}
            </span>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}

