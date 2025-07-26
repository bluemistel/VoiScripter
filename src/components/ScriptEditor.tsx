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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start space-x-2 p-2 border rounded-lg shadow mb-2 transition-colors `}
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
              className="w-full p-2 pt-2 border rounded min-h-[40px] bg-muted text-foreground focus:ring-1 focus:ring-ring text-sm italic focus:outline-none focus:ring-ring-gray-400 focus:border-gray-400 resize-none overflow-hidden"
              rows={1}
              style={{ height: 'auto', borderRadius: '20px 20px 20px 0' }}
              onInput={e => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />

            {/* キャラ選択リストとアイコン群を横並びに */}
            <div className="flex flex-col justify-between items-center h-16 mr-2 mt-0">
              <select
                value={block.characterId}
                onChange={e => onUpdate({ characterId: e.target.value })}
                className="ml-1 p-2 pl-3 border rounded bg-background text-foreground focus:ring-1 focus:ring-ring text-xs w-36 mb-1"
                style={{ height: '2.5rem' }}
              >
                <option value="">ト書きを入力</option>
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="flex flex-row space-x-1.5 mt-0">
                <button
                  onClick={onMoveUp}
                  className="p-1 rounded hover:bg-accent"
                  title="Ctrl+↑:ブロックを上に移動"
                  style={{ height: '2rem', width: '2rem' }}
                >
                  <ArrowUpIcon className="w-6 h-6 text-foreground" />
                </button>
                <button
                  onClick={onMoveDown}
                  className="p-1 rounded hover:bg-accent"
                  title="Ctrl+↓:ブロックを下に移動"
                  style={{ height: '2rem', width: '2rem' }}
                >
                  <ArrowDownIcon className="w-6 h-6 text-foreground" />
                </button>
                <button
                  onClick={onDuplicate}
                  className="p-1 rounded hover:bg-accent"
                  title="Ctrl+B:ブロックを複製"
                  style={{ height: '2rem', width: '2rem' }}
                >
                  <DocumentDuplicateIcon className="w-6 h-6 text-foreground" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded"
                  title="Alt+B:ブロックを削除"
                  style={{ height: '2rem', width: '2rem' }}
                >
                  <TrashIcon className="w-6 h-6" />
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
                  className={`w-16 h-16 rounded-full object-cover mt-0 mr-2 transition-all duration-300 ${animateBorder ? 'outline-4 outline-primary outline-offset-2' : ''}`}
                />
              ) : (
                <div className={`w-16 h-16 rounded-full bg-muted flex items-center justify-center text-center mt-0 mr-2 overflow-hidden transition-all duration-300 ${animateBorder ? 'outline-4 outline-primary outline-offset-2' : ''}`}>
                  <span className={`text-xs font-bold text-foreground px-1 max-w-[80px] whitespace-no-wrap overflow-hidden${character.name.length > 8 ? ' text-ellipsis' : ''}`}>
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
                placeholder="セリフを入力"
                className="rounded-2xl border p-2 bg-card shadow-md min-h-[60px] text-sm w-full text-foreground focus:ring-1 focus:ring-ring focus:outline-none focus:ring-ring-gray-400 focus:border-gray-400 resize-none overflow-hidden"
                rows={1}
                style={{ height: 'auto', borderRadius: '20px 20px 20px 0' }}
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
            <div className="flex flex-col justify-between items-center h-16 mr-2 mt-0">
              <select
                value={block.characterId}
                onChange={e => onUpdate({ characterId: e.target.value })}
                className="ml-1 p-2 pl-3 border rounded bg-background text-foreground focus:ring-1 focus:ring-ring text-xs w-36 mb-1"
                style={{ height: '2.5rem' }}
              >
                <option value="">ト書きを入力</option>
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="flex flex-row space-x-1.5 mt-0">
                <button
                  onClick={onMoveUp}
                  className="p-1 rounded hover:bg-accent"
                  title="Ctrl+↑:ブロックを上に移動"
                  style={{ height: '2rem', width: '2rem' }}
                >
                  <ArrowUpIcon className="w-6 h-6 text-foreground" />
                </button>
                <button
                  onClick={onMoveDown}
                  className="p-1 rounded hover:bg-accent"
                  title="Ctrl+↓:ブロックを下に移動"
                  style={{ height: '2rem', width: '2rem' }}
                >
                  <ArrowDownIcon className="w-6 h-6 text-foreground" />
                </button>
                <button
                  onClick={onDuplicate}
                  className="p-1 rounded hover:bg-accent"
                  title="Ctrl+B:ブロックを複製"
                  style={{ height: '2rem', width: '2rem' }}
                >
                  <DocumentDuplicateIcon className="w-6 h-6 text-foreground" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded"
                  title="Alt+B:ブロックを削除"
                  style={{ height: '2rem', width: '2rem' }}
                >
                  <TrashIcon className="w-6 h-6" />
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
    if (script.blocks.length > 0 && script.blocks.length > prevBlockCount.current) {
      const lastIdx = script.blocks.length - 1;
      const lastRef = textareaRefs.current[lastIdx];
      if (lastRef) {
        // 下方向にスクロールが可能かチェック
        const documentHeight = document.documentElement.scrollHeight;
        const windowHeight = window.innerHeight;
        const currentScrollY = window.scrollY;
        const canScrollDown = currentScrollY + windowHeight < documentHeight;
        
        if (canScrollDown) {
          // 最下段までスクロール
          setTimeout(() => {
            window.scrollTo({
              top: documentHeight - windowHeight,
              behavior: 'smooth'
            });
          }, 50); // 少し遅延を入れてDOMの更新を待つ
        }
      }
    }
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
      textareaRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setSelectedBlockId(script.blocks[index]?.id || null);
    }
  };
  const handleScrollTop = () => {
    setSlideUp(true);
    setTimeout(() => setSlideUp(false), 300);
    scrollToY(0, 500);
    scrollToBlock(0);
  };
  const handleScrollBottom = () => {
    setSlideDown(true);
    setTimeout(() => setSlideDown(false), 300);
    scrollToY(document.body.scrollHeight, 500);
    scrollToBlock(script.blocks.length - 1);
  };

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
          setSelectedBlockId(script.blocks[activeIdx - 1]?.id || ''); // 追加
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
          setSelectedBlockId(script.blocks[activeIdx + 1]?.id || ''); // 追加
          setTimeout(() => {
            setManualFocusTarget({ index: activeIdx + 1, id: script.blocks[activeIdx + 1]?.id || '' });
          }, 10); // タイミングを調整
        }
      }
      // Ctrl+, : 最下段へ
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        handleScrollBottom();
      }
      // Ctrl+Alt+, : 最上段へ
      if (e.ctrlKey && e.altKey && e.key === ',') {
        e.preventDefault();
        handleScrollTop();
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
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
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
      <div className="script-editor-container min-h-auto">
        {script.blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <p className="text-lg mb-4">1.左上の新規作成から新しいプロジェクトを作成してください。</p>
            <p className="text-lg mb-4">2.キャラクターのアイコンからキャラクターを追加し、下のボタンからブロックを追加します。</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg shadow p-4 relative h-full flex flex-col justify-between">
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
      {/* 右下固定ボタン群 */}
      <div className="fixed right-6 z-40 flex flex-row items-end space-x-2 bottom-6">
        <button
          onClick={handleScrollTop}
          className={`px-3 py-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-full shadow-lg text-lg transition-transform duration-600 ${slideUp ? '-translate-y-2' : ''}`}
          title="Ctrl+Alt+↑: 最上段へ"
        >
          <ArrowUpIcon className="w-6 h-6" />
        </button>
        <button
          onClick={handleScrollBottom}
          className={`px-3 py-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-full shadow-lg text-lg transition-transform duration-600 ${slideDown ? 'translate-y-2' : ''}`}
          title="Ctrl+,: 最下段へ"
        >
          <ArrowDownIcon className="w-6 h-6" />
        </button>
        <button
          onClick={onAddBlock}
          className={`px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg transition-all text-lg`}
          title="Ctrl+B:新規ブロックを追加"
        >
          <PlusIcon className="w-6 h-6 inline-block mr-0.5 mb-0.5" />ブロックを追加
        </button>
      </div>
    </>
  );
}