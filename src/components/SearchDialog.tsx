'use client';

import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, ArrowUpIcon, ArrowDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ダイアログが開いた時に初期位置を設定し、フォーカスを設定
  useEffect(() => {
    if (isOpen) {
      // ウィンドウの上から2/5の位置に配置
      const initialY = window.innerHeight * 0.4;
      const initialX = (window.innerWidth - 672) / 2; // max-w-2xl (672px) を考慮
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

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose}>
      <div
        ref={dialogRef}
        className="bg-background border rounded-lg shadow-lg w-full max-w-2xl p-6 absolute"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between mb-4 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <h3 className="text-lg font-semibold text-foreground flex items-center">
            <MagnifyingGlassIcon className="w-5 h-5 mr-2" />
            検索
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            title="閉じる (Esc)"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4">
          <div className="relative">
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
              className="w-full p-2 border rounded mb-3 text-foreground bg-background pr-8"
              autoFocus
            />
            {showHistory && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-background border rounded shadow-lg z-10 max-h-60 overflow-y-auto">
                {searchHistory.slice(0, 10).map((historyItem, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSearchQuery(historyItem);
                      setShowHistory(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-accent text-foreground text-sm"
                  >
                    {historyItem}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center text-sm text-foreground">
            <input
              type="checkbox"
              checked={searchAllScenes}
              onChange={(e) => setSearchAllScenes(e.target.checked)}
              className="mr-2"
            />
            すべてのシーンを検索する
          </label>
        </div>

        {searchQuery.trim() && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-foreground">
                {totalResults > 0 ? (
                  <span>
                    {currentResultIndex + 1} / {totalResults} 件見つかりました
                  </span>
                ) : (
                  <span className="text-muted-foreground">見つかりませんでした</span>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    onNavigatePrevious();
                    // ナビゲーションボタンで検索が確定されたので履歴に追加
                    if (searchQuery.trim() && !searchHistory.includes(searchQuery.trim())) {
                      onAddToHistory(searchQuery.trim());
                    }
                  }}
                  disabled={totalResults === 0}
                  className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  title="前へ (Shift+Enter)"
                >
                  <ArrowUpIcon className="w-4 h-4 mr-1" />
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
                  className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  title="次へ (Enter)"
                >
                  次へ
                  <ArrowDownIcon className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>ショートカット: Ctrl+F で検索、Enter で次へ、Shift+Enter で前へ、Esc で閉じる</p>
        </div>
      </div>
    </div>
  );
}

