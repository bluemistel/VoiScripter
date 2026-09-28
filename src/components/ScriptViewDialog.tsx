'use client';

import { useState, useEffect, useMemo } from 'react';
import { Project, Character } from '@/types';
import { SearchResult } from '@/components/SearchDialog';
import { getEmotionIconUrl } from '@/utils/emotionUtils';
import { buildChatSideMap } from '@/utils/chatUtils';
import { ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';
import { bubbleFill, nameBadgeText } from '@/utils/colorUtils';
import DialogFrame from '@/components/common/DialogFrame';
import DialogHeader from '@/components/common/DialogHeader';
import TabBar from '@/components/common/TabBar';

type ViewTab = 'chat' | 'lines';

interface ScriptViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  characters: Character[];
  selectedSceneId: string | null;
  onNavigateToResult: (result: SearchResult, shouldScroll: boolean) => void;
  /** フキダシの薄塗りの濃さをテーマに合わせるため */
  isDarkMode?: boolean;
}

interface ChatItem {
  block: { id: string; characterId: string; emotion: string; text: string };
  character?: Character;
  side: 'left' | 'right' | 'center';
  showHeader: boolean; // 連続発言の2件目以降は名前・アイコンを省略
  sceneId: string;
  sceneName: string;
  blockIndex: number;
}

/**
 * 台本ビュー（タブ切替式）
 * - チャット: チャットアプリ風の閲覧・推敲ビュー（既定）
 * - キャラ台詞: 特定キャラクターの台詞だけを通しで確認するビュー
 * どちらもクリックでエディタの該当ブロックへ移動できる。
 */
export default function ScriptViewDialog({
  isOpen,
  onClose,
  project,
  characters,
  selectedSceneId,
  onNavigateToResult,
  isDarkMode = false
}: ScriptViewDialogProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('chat');
  const [allScenes, setAllScenes] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState('');

  const targetScenes = useMemo(() => (
    allScenes ? project.scenes : project.scenes.filter(s => s.id === selectedSceneId)
  ), [project, allScenes, selectedSceneId]);

  // ===== チャットタブ =====
  const sideOf = useMemo(() => buildChatSideMap(characters), [characters]);

  const chatItems = useMemo((): ChatItem[] => {
    const result: ChatItem[] = [];
    targetScenes.forEach(scene => {
      const script = scene.scripts[0];
      if (!script) return;
      let prevCharacterId: string | null = null;
      script.blocks.forEach((block, index) => {
        if (!block.characterId) {
          result.push({
            block, side: 'center', showHeader: false,
            sceneId: scene.id, sceneName: scene.name, blockIndex: index
          });
          prevCharacterId = null;
          return;
        }
        const character = characters.find(c => c.id === block.characterId);
        result.push({
          block,
          character,
          side: sideOf.get(block.characterId) || 'left',
          showHeader: block.characterId !== prevCharacterId,
          sceneId: scene.id, sceneName: scene.name, blockIndex: index
        });
        prevCharacterId = block.characterId;
      });
    });
    return result;
  }, [targetScenes, characters, sideOf]);

  // ===== キャラ台詞タブ =====
  const usedCharacterIds = useMemo(() => {
    const ids = new Set<string>();
    project.scenes.forEach(scene => {
      scene.scripts.forEach(script => {
        script.blocks.forEach(block => {
          if (block.characterId) ids.add(block.characterId);
        });
      });
    });
    return ids;
  }, [project]);

  // 未選択なら使用中の先頭キャラクターを初期選択
  useEffect(() => {
    if (!isOpen) return;
    setSelectedCharacterId(prev => {
      if (prev && characters.some(c => c.id === prev)) return prev;
      const firstUsed = characters.find(c => usedCharacterIds.has(c.id));
      return firstUsed?.id || characters[0]?.id || '';
    });
  }, [isOpen, characters, usedCharacterIds]);

  const lines = useMemo((): SearchResult[] => {
    if (!selectedCharacterId) return [];
    const results: SearchResult[] = [];
    targetScenes.forEach(scene => {
      const script = scene.scripts[0];
      if (!script) return;
      script.blocks.forEach((block, index) => {
        if (block.characterId === selectedCharacterId) {
          results.push({
            blockId: block.id,
            sceneId: scene.id,
            sceneName: scene.name,
            blockIndex: index,
            text: block.text
          });
        }
      });
    });
    return results;
  }, [targetScenes, selectedCharacterId]);

  const totalChars = useMemo(
    () => lines.reduce((sum, line) => sum + line.text.replace(/\n/g, '').length, 0),
    [lines]
  );

  if (!isOpen) return null;

  const jumpTo = (result: SearchResult) => {
    onClose();
    onNavigateToResult(result, true);
  };

  const selectedCharacter = characters.find(c => c.id === selectedCharacterId);

  const renderChatIcon = (item: ChatItem) => {
    const character = item.character;
    if (!character || !item.showHeader) return <div className="size-9 shrink-0" />;
    const iconUrl = getEmotionIconUrl(character, item.block.emotion);
    const color = character.backgroundColor || '#e5e7eb';
    return iconUrl ? (
      <img src={iconUrl} alt={character.name} className="size-9 rounded-full object-cover shrink-0" />
    ) : (
      <div
        className="size-9 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
        style={{ backgroundColor: color, color: nameBadgeText(color) }}
      >
        {character.name.slice(0, 2)}
      </div>
    );
  };

  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={onClose}
      panelClassName="w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
    >
        <DialogHeader
          icon={ChatBubbleBottomCenterTextIcon}
          title="ビュー"
          onClose={onClose}
          className="shrink-0"
          actions={
            <label className="flex items-center gap-2 text-[13px] font-semibold text-fg whitespace-nowrap cursor-pointer mr-1">
              <input
                type="checkbox"
                checked={allScenes}
                onChange={e => setAllScenes(e.target.checked)}
                className="ui-checkbox"
              />
              すべてのシーン
            </label>
          }
        />
        {/* タブはシーンタブと同じ形状。アクティブ面は下のコンテンツ（キャンバス色）とつなげる */}
        <TabBar
          items={[
            { id: 'chat', label: 'チャット' },
            { id: 'lines', label: 'キャラ台詞' }
          ]}
          activeId={activeTab}
          onChange={setActiveTab}
          activeSurfaceClass="bg-canvas"
        />

        {activeTab === 'chat' ? (
          <>
            <p className="shrink-0 px-5 pt-3 pb-1 text-[11px] leading-[1.55] text-fg-sub bg-canvas">
              フキダシをクリックするとエディタの該当ブロックへ移動します。左右の振り分けはキャラクター編集の「チャットビュー」設定で変更できます。
            </p>
            <div className="flex-1 overflow-y-auto px-5 py-4 bg-canvas">
              {chatItems.length === 0 ? (
                <p className="text-fg-sub text-sm text-center py-8">表示するブロックがありません</p>
              ) : (
                chatItems.map((item, i) => {
                  if (item.side === 'center') {
                    return (
                      <div key={item.block.id} className="text-center my-3">
                        <button
                          onClick={() => jumpTo({ blockId: item.block.id, sceneId: item.sceneId, sceneName: item.sceneName, blockIndex: item.blockIndex, text: item.block.text })}
                          className="inline-block text-[13px] text-fg-sub bg-field rounded-full px-4 py-1 italic hover:text-fg transition-colors max-w-full truncate"
                          title="クリックで該当ブロックへ移動"
                        >
                          ─ {item.block.text || '（ト書き）'} ─
                        </button>
                      </div>
                    );
                  }
                  const isRight = item.side === 'right';
                  const charColor = item.character?.backgroundColor || '#e5e7eb';
                  return (
                    <div
                      key={item.block.id}
                      className={`flex gap-2 items-end ${isRight ? 'flex-row-reverse' : ''} ${item.showHeader && i > 0 ? 'mt-3' : 'mt-1'}`}
                    >
                      {renderChatIcon(item)}
                      <div className={`max-w-[74%] ${isRight ? 'text-right' : ''}`}>
                        {item.showHeader && (
                          <p className="text-[10px] mb-1 px-1">
                            <span className="font-bold text-fg-sub">{item.character?.name || '不明'}</span>
                            {item.block.emotion && item.block.emotion !== 'normal' && (
                              <span className="ml-1.5 text-fg-faint">{item.block.emotion}</span>
                            )}
                          </p>
                        )}
                        {/* エディタのチャットテーマと同じフキダシ（アバター側の角だけ小さく） */}
                        <button
                          onClick={() => jumpTo({ blockId: item.block.id, sceneId: item.sceneId, sceneName: item.sceneName, blockIndex: item.blockIndex, text: item.block.text })}
                          className={`text-left text-[15px] leading-[1.6] text-fg whitespace-pre-wrap break-words px-[15px] py-[11px] transition-[filter] hover:brightness-95 ${isRight ? 'rounded-[18px_18px_6px_18px]' : 'rounded-[18px_18px_18px_6px]'}`}
                          style={{
                            backgroundColor: bubbleFill(charColor, isDarkMode),
                            border: `1.5px solid ${charColor}`
                          }}
                          title="クリックで該当ブロックへ移動"
                        >
                          {item.block.text || '（空のセリフ）'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            <div className="shrink-0 px-5 py-3 bg-canvas">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  {selectedCharacter?.emotions.normal.iconUrl ? (
                    <img
                      src={selectedCharacter.emotions.normal.iconUrl}
                      alt={selectedCharacter.name}
                      className="size-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="size-8 rounded-full shrink-0"
                      style={{ backgroundColor: selectedCharacter?.backgroundColor || '#e5e7eb' }}
                    />
                  )}
                  <select
                    value={selectedCharacterId}
                    onChange={e => setSelectedCharacterId(e.target.value)}
                    className="ui-input"
                  >
                    {characters.map(char => (
                      <option key={char.id} value={char.id}>
                        {char.name}{usedCharacterIds.has(char.id) ? '' : '（未使用）'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-[13px] text-fg-sub">
                  台詞数: <span className="font-bold text-fg">{lines.length}</span> 件
                  <span className="mx-2 text-fg-faint">/</span>
                  合計文字数: <span className="font-bold text-fg">{totalChars.toLocaleString()}</span> 文字
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4 bg-canvas">
              {lines.length === 0 ? (
                <p className="text-fg-sub text-sm text-center py-8">
                  {selectedCharacterId ? '該当する台詞がありません' : 'キャラクターを選択してください'}
                </p>
              ) : (
                <div className="space-y-1">
                  {lines.map((line, index) => (
                    <button
                      key={line.blockId}
                      onClick={() => jumpTo(line)}
                      className="w-full text-left px-2 py-2 rounded-xl hover:bg-field transition-colors group"
                      title="クリックで該当ブロックへ移動"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-fg-faint shrink-0 w-8 text-right">{index + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-fg whitespace-pre-wrap break-words">{line.text || '（空の台詞）'}</p>
                          {allScenes && (
                            <p className="text-[11px] text-fg-sub mt-0.5">{line.sceneName}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
    </DialogFrame>
  );
}
