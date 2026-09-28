'use client';

import { useState, useEffect, useRef } from 'react';
import { StandingView } from '@/types';
import { loadStandingAsset } from '@/utils/standingImageAssets';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import DialogFrame from '@/components/common/DialogFrame';
import DialogHeader from '@/components/common/DialogHeader';
import { buttonClass } from '@/components/common/Button';

const DEFAULT_VIEW: StandingView = { scale: 1, offsetX: 0, offsetY: 0 };

interface StandingViewAdjustDialogProps {
  isOpen: boolean;
  assetId: string | null;
  initialView?: StandingView;
  characterName: string;
  emotionLabel: string;
  onCancel: () => void;
  onApply: (view: StandingView | undefined) => void;
}

/**
 * 立ち絵の見え方調整ダイアログ。
 * 立ち絵ステージと同じ「上部中央起点・原寸」描画でプレビューし、
 * ドラッグで位置、ホイール/スライダーでズームを調整する。
 */
export default function StandingViewAdjustDialog({
  isOpen,
  assetId,
  initialView,
  characterName,
  emotionLabel,
  onCancel,
  onApply
}: StandingViewAdjustDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [view, setView] = useState<StandingView>(initialView || DEFAULT_VIEW);
  const pointer = useRef({ isDragging: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    if (!isOpen) return;
    setView(initialView || DEFAULT_VIEW);
    if (!assetId) {
      setImageUrl(null);
      return;
    }
    let cancelled = false;
    loadStandingAsset(assetId).then(dataUrl => {
      if (!cancelled) setImageUrl(dataUrl);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, assetId]);

  if (!isOpen) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointer.current = { isDragging: true, lastX: e.clientX, lastY: e.clientY };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointer.current.isDragging) return;
    const dx = e.clientX - pointer.current.lastX;
    const dy = e.clientY - pointer.current.lastY;
    pointer.current.lastX = e.clientX;
    pointer.current.lastY = e.clientY;
    setView(v => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointer.current.isDragging = false;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
  };
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const zoomFactor = Math.exp(-e.deltaY * 0.0007);
    setView(v => ({ ...v, scale: Math.max(0.05, Math.min(5, v.scale * zoomFactor)) }));
  };

  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={onCancel}
      panelClassName="w-full max-w-sm mx-4 pb-5"
      overlayClassName="bg-black/60"
      enableEnterShortcut={false}
    >
        <DialogHeader icon={AdjustmentsHorizontalIcon} title="立ち絵の表示調整" onClose={onCancel} />
        <div className="px-5">
        <p className="text-[11px] leading-[1.55] text-fg-sub mb-3">
          「{characterName}」（{emotionLabel}）の立ち絵ステージでの見え方を調整します。<br />
          ドラッグで位置、ホイールまたはスライダーで拡大縮小。
        </p>

        <div
          className="relative w-full h-[380px] rounded-2xl bg-well ring-1 ring-hairline overflow-hidden cursor-move touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={characterName}
              draggable={false}
              className="absolute top-0 left-1/2 pointer-events-none"
              style={{
                maxWidth: 'none',
                transform: `translateX(-50%) translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.scale})`,
                transformOrigin: 'top center'
              }}
            />
          ) : (
            <p className="text-xs text-fg-sub text-center pt-16">画像を読み込み中…</p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="ui-section-label shrink-0">ズーム</span>
          <input
            type="range"
            min={0.05}
            max={3}
            step={0.01}
            value={Math.min(3, view.scale)}
            onChange={e => setView(v => ({ ...v, scale: parseFloat(e.target.value) }))}
            className="flex-1 accent-primary"
          />
          <span className="text-xs text-fg-faint w-12 text-right">{Math.round(view.scale * 100)}%</span>
        </div>

        <div className="flex flex-wrap justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className={buttonClass('secondary')}
          >
            キャンセル
          </button>
          <button
            onClick={() => setView(DEFAULT_VIEW)}
            className={buttonClass('secondary')}
            title="原寸・上部中央起点に戻す"
          >
            リセット
          </button>
          <button
            onClick={() => {
              const isDefault = view.scale === 1 && view.offsetX === 0 && view.offsetY === 0;
              onApply(isDefault ? undefined : view);
            }}
            className={buttonClass('primary')}
          >
            適用
          </button>
        </div>
        </div>
    </DialogFrame>
  );
}
