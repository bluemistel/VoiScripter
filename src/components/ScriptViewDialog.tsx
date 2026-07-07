'use client';

import { useState, useEffect, useMemo } from 'react';
import { Project, Character } from '@/types';
import { SearchResult } from '@/components/SearchDialog';
import { getEmotionIconUrl } from '@/utils/emotionUtils';
import { buildChatSideMap } from '@/utils/chatUtils';
import DialogFrame from '@/components/common/DialogFrame';

type ViewTab = 'chat' | 'lines';

interface ScriptViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  characters: Character[];
  selectedSceneId: string | null;
  onNavigateToResult: (result: SearchResult, shouldScroll: boolean) => void;
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
  onNavigateToResult
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
    if (!character || !item.showHeader) return <div className="w-9 h-9 shrink-0" />;
    const iconUrl = getEmotionIconUrl(character, item.block.emotion);
    return iconUrl ? (
      <img src={iconUrl} alt={character.name} className="w-9 h-9 rounded-full border object-cover shrink-0" />
    ) : (
      <div
        className="w-9 h-9 rounded-full border shrink-0 flex items-center justify-center text-[10px] font-bold text-foreground"
        style={{ backgroundColor: character.backgroundColor || '#e5e7eb' }}
      >
        {character.name.slice(0, 2)}
      </div>
    );
  };

  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={onClose}
      panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
    >
        <div className="shrink-0 px-5 py-3 border-b flex items-center justify-between gap-3">
          {/* タブ切替 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${activeTab === 'chat' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent border'}`}
            >
              チャット
            </button>
            <button
              onClick={() => setActiveTab('lines')}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${activeTab === 'lines' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent border'}`}
            >
              キャラ台詞
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center text-sm text-foreground whitespace-nowrap">
              <input
                type="checkbox"
                checked={allScenes}
                onChange={e => setAllScenes(e.target.checked)}
                className="mr-2"
              />
              すべてのシーン
            </label>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-2xl"
              title="閉じる (Esc)"
            >
              ×
            </button>
          </div>
        </div>

        {activeTab === 'chat' ? (
          <>
            <p className="shrink-0 px-5 py-1.5 text-xs text-muted-foreground border-b bg-muted/30">
              フキダシをクリックするとエディタの該当ブロックへ移動します。左右の振り分けはキャラクター編集の「チャットビュー」設定で変更できます。
            </p>
            <div className="flex-1 overflow-y-auto px-5 py-4 bg-muted/20">
              {chatItems.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">表示するブロックがありません</p>
              ) : (
                chatItems.map((item, i) => {
                  if (item.side === 'center') {
                    return (
                      <div key={item.block.id} className="text-center my-3">
                        <button
                          onClick={() => jumpTo({ blockId: item.block.id, sceneId: item.sceneId, sceneName: item.sceneName, blockIndex: item.blockIndex, text: item.block.text })}
                          className="inline-block text-xs text-muted-foreground bg-muted rounded-full px-4 py-1 italic hover:bg-accent transition-colors max-w-full truncate"
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
                      <div className={`max-w-[75%] ${isRight ? 'text-right' : ''}`}>
                        {item.showHeader && (
                          <p className="text-[10px] text-muted-foreground mb-0.5 px-1">{item.character?.name || '不明'}</p>
                        )}
                        <button
                          onClick={() => jumpTo({ blockId: item.block.id, sceneId: item.sceneId, sceneName: item.sceneName, blockIndex: item.blockIndex, text: item.block.text })}
                          className={`text-left text-sm text-foreground whitespace-pre-wrap break-words px-3 py-2 border transition-colors hover:brightness-95 dark:hover:brightness-110 ${isRight ? 'rounded-[16px_16px_4px_16px]' : 'rounded-[16px_16px_16px_4px]'}`}
                          style={{
                            // 左右ともパーソナルカラーの淡色（複数キャラ登場時に話者を色で判別できるように）
                            backgroundColor: `${charColor}33`,
                            borderColor: `${charColor}55`
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
            <div className="shrink-0 px-5 py-3 border-b">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  {selectedCharacter?.emotions.normal.iconUrl ? (
                    <img
                      src={selectedCharacter.emotions.normal.iconUrl}
                      alt={selectedCharacter.name}
                      className="w-8 h-8 rounded-full border object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full border shrink-0"
                      style={{ backgroundColor: selectedCharacter?.backgroundColor || '#e5e7eb' }}
                    />
                  )}
                  <select
                    value={selectedCharacterId}
                    onChange={e => setSelectedCharacterId(e.target.value)}
                    className="p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-transparent focus:outline-none"
                  >
                    {characters.map(char => (
                      <option key={char.id} value={char.id}>
                        {char.name}{usedCharacterIds.has(char.id) ? '' : '（未使用）'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-sm text-muted-foreground">
                  台詞数: <span className="font-semibold text-foreground">{lines.length}</span> 件
                  <span className="mx-2">/</span>
                  合計文字数: <span className="font-semibold text-foreground">{totalChars.toLocaleString()}</span> 文字
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {lines.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  {selectedCharacterId ? '該当する台詞がありません' : 'キャラクターを選択してください'}
                </p>
              ) : (
                <div className="space-y-1">
                  {lines.map((line, index) => (
                    <button
                      key={line.blockId}
                      onClick={() => jumpTo(line)}
                      className="w-full text-left p-2 rounded hover:bg-accent transition-colors group"
                      title="クリックで該当ブロックへ移動"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-muted-foreground shrink-0 w-8 text-right">{index + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{line.text || '（空の台詞）'}</p>
                          {allScenes && (
                            <p className="text-xs text-muted-foreground mt-0.5">{line.sceneName}</p>
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
