'use client';

import { useState, useEffect } from 'react';
import { Character, ScriptBlock } from '@/types';
import { nameBadgeText } from '@/utils/colorUtils';
import { loadStandingAsset } from '@/utils/standingImageAssets';

interface StagePanelProps {
  characters: Character[];
  activeBlock: ScriptBlock | null;
}

/**
 * 立ち絵ステージ: 編集中（フォーカス中）のブロックの話者の立ち絵を
 * エディタ横に大きく表示する。表情差分（standingAssetId）と連動し、
 * 未登録の感情は normal の立ち絵にフォールバック。立ち絵未登録の
 * キャラクターはアイコン＋名前で代替表示する。
 */
export default function StagePanel({ characters, activeBlock }: StagePanelProps) {
  const character = activeBlock?.characterId
    ? characters.find(c => c.id === activeBlock.characterId)
    : undefined;
  const emotion = activeBlock?.emotion || 'normal';

  // 表情の立ち絵 → normal の立ち絵の順でフォールバック（表示調整も同じ設定から取る）
  const activeSetting = character
    ? (character.emotions[emotion]?.standingAssetId ? character.emotions[emotion] : character.emotions.normal)
    : undefined;
  const assetId = activeSetting?.standingAssetId;
  const view = activeSetting?.standingView;

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadedAssetId, setLoadedAssetId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!assetId) {
      setImageUrl(null);
      setLoadedAssetId(null);
      return;
    }
    if (assetId === loadedAssetId) return;
    loadStandingAsset(assetId).then(dataUrl => {
      if (cancelled) return;
      setImageUrl(dataUrl);
      setLoadedAssetId(assetId);
    });
    return () => { cancelled = true; };
  }, [assetId, loadedAssetId]);

  const presetName = character && activeBlock?.userPresetId
    ? character.userPresets?.find(p => p.id === activeBlock.userPresetId)?.name
    : undefined;

  const iconUrl = character
    ? (character.emotions[emotion]?.iconUrl || character.emotions.normal?.iconUrl)
    : '';

  return (
    <div className="hidden lg:flex w-56 xl:w-64 shrink-0 flex-col sticky top-32 self-start rounded-[20px] bg-block shadow-(--shadow-block) overflow-hidden" style={{ height: 'calc(100vh - 10rem)' }}>
      <div className="flex-1 relative flex items-end justify-center overflow-hidden">
        {character ? (
          assetId ? (
            // 立ち絵登録済み: 読み込み完了まではアイコン代替を出さず何も表示しない（チラつき防止）
            imageUrl ? (
              // 上部中央起点の原寸表示（キャラ/表情ごとの表示調整があれば適用）
              <img
                key={loadedAssetId}
                src={imageUrl}
                alt={character.name}
                draggable={false}
                className="absolute top-0 left-1/2 animate-[stage-fade_0.3s_ease] pointer-events-none select-none"
                style={{
                  maxWidth: 'none',
                  transform: `translateX(-50%) translate(${view?.offsetX || 0}px, ${view?.offsetY || 0}px) scale(${view?.scale ?? 1})`,
                  transformOrigin: 'top center'
                }}
              />
            ) : null
          ) : (
            // 立ち絵未登録: アイコンで代替
            <div className="flex flex-col items-center justify-center gap-3 pb-16 h-full">
              {iconUrl ? (
                <img src={iconUrl} alt={character.name} className="size-24 rounded-full ring-1 ring-hairline object-cover" />
              ) : (
                <div
                  className="size-24 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: character.backgroundColor || '#e5e7eb', color: nameBadgeText(character.backgroundColor || '#e5e7eb') }}
                >
                  {character.name.slice(0, 4)}
                </div>
              )}
              <p className="text-xs text-fg-sub text-center px-4">
                立ち絵未登録<br />（キャラクター設定 &gt; 表情差分設定）
              </p>
            </div>
          )
        ) : (
          <p className="text-xs text-fg-sub self-center pb-16">
            セリフブロックを選択すると<br />話者の立ち絵が表示されます
          </p>
        )}
      </div>

      {character && (
        <div className="shrink-0 m-2 px-3 py-2.5 rounded-2xl bg-panel/90 text-center">
          {/* 話者名はエディタと同じ話者名バッジで示す（キャラ色を使ってよい場所） */}
          <span
            className="inline-block max-w-full text-[11px] font-bold px-2.5 py-px rounded-full truncate"
            style={{ backgroundColor: character.backgroundColor || '#9ca3af', color: nameBadgeText(character.backgroundColor || '#9ca3af') }}
          >
            {character.name}
          </span>
          <p className="text-[10px] text-fg-sub truncate mt-1">
            表情: {emotion === 'normal' ? '標準' : emotion}
            {presetName ? ` ／ プリセット: ${presetName}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
