'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import DialogFrame from '@/components/common/DialogFrame';

// icon-cropper (自作Webアプリ) の簡易移植版。
// 背景透明化・縁取り機能は除外し、ドラッグ/ホイール/ピンチで位置とズームを
// 調整して正方形PNGに切り抜く（表示側が rounded-full で丸く描画する）。

const CANVAS_SIZE = 512; // プレビューの内部解像度
const EXPORT_SIZE = 256; // 出力解像度

interface LoadedImage {
  element: HTMLImageElement;
  width: number;
  height: number;
}

interface IconCropperDialogProps {
  isOpen: boolean;
  file: File | null;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}

export default function IconCropperDialog({ isOpen, file, onCancel, onApply }: IconCropperDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadedImage, setLoadedImage] = useState<LoadedImage | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scale, setScale] = useState(1);

  const pointer = useRef({ isDragging: false, lastX: 0, lastY: 0 });
  const touch = useRef({ isPinching: false, initialDistance: 0, initialScale: 1 });

  // ファイル読み込み（開いた時）。DataURL 経由にして ObjectURL の失効管理を避ける
  useEffect(() => {
    if (!isOpen || !file) return;
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setLoadedImage({ element: img, width: img.naturalWidth, height: img.naturalHeight });
        // 初期表示: 短辺がキャンバスに収まる cover 配置
        const minSide = Math.min(img.naturalWidth, img.naturalHeight);
        const initialScale = CANVAS_SIZE / minSide;
        setScale(initialScale);
        setOffsetX((CANVAS_SIZE - img.naturalWidth * initialScale) / 2);
        setOffsetY((CANVAS_SIZE - img.naturalHeight * initialScale) / 2);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    return () => {
      cancelled = true;
      setLoadedImage(null);
    };
  }, [isOpen, file]);

  // プレビュー描画
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // チェッカーパターン（範囲外の視覚化）
    const gridSize = 32;
    for (let y = 0; y < canvas.height; y += gridSize) {
      for (let x = 0; x < canvas.width; x += gridSize) {
        const even = ((x / gridSize) + (y / gridSize)) % 2 === 0;
        ctx.fillStyle = even ? '#ddd' : '#fff';
        ctx.fillRect(x, y, gridSize, gridSize);
      }
    }

    if (loadedImage) {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        loadedImage.element,
        offsetX,
        offsetY,
        loadedImage.width * scale,
        loadedImage.height * scale
      );
    }

    // 円形ガイド（出力自体は正方形。丸表示時の見え方の目安）
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [loadedImage, offsetX, offsetY, scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    draw();
  }, [draw, isOpen]);

  // マウスドラッグで移動
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointer.current = { isDragging: true, lastX: e.clientX, lastY: e.clientY };
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointer.current.isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = CANVAS_SIZE / rect.width;
    const dx = (e.clientX - pointer.current.lastX) * ratio;
    const dy = (e.clientY - pointer.current.lastY) * ratio;
    pointer.current.lastX = e.clientX;
    pointer.current.lastY = e.clientY;
    setOffsetX(x => x + dx);
    setOffsetY(y => y + dy);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointer.current.isDragging = false;
    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
  };

  // ホイールでズーム（カーソル位置中心）
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const zoomFactor = Math.exp(-e.deltaY * 0.0005);
    const newScale = Math.max(0.05, Math.min(10, scale * zoomFactor));
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasX = ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE;
    const canvasY = ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE;
    const scaleRatio = newScale / scale;
    setOffsetX(canvasX - (canvasX - offsetX) * scaleRatio);
    setOffsetY(canvasY - (canvasY - offsetY) * scaleRatio);
    setScale(newScale);
  };

  // ピンチズーム
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      touch.current = { isPinching: true, initialDistance: getTouchDistance(e.touches), initialScale: scale };
    }
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && touch.current.isPinching) {
      const distance = getTouchDistance(e.touches);
      const newScale = Math.max(0.05, Math.min(10, touch.current.initialScale * (distance / touch.current.initialDistance)));
      // ピンチはキャンバス中心基準の簡易ズーム
      const center = CANVAS_SIZE / 2;
      const scaleRatio = newScale / scale;
      setOffsetX(center - (center - offsetX) * scaleRatio);
      setOffsetY(center - (center - offsetY) * scaleRatio);
      setScale(newScale);
    }
  };
  const onTouchEnd = () => {
    touch.current.isPinching = false;
  };

  const handleApply = () => {
    if (!loadedImage) return;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = EXPORT_SIZE;
    outCanvas.height = EXPORT_SIZE;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;
    const scaleRatio = EXPORT_SIZE / CANVAS_SIZE;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      loadedImage.element,
      offsetX * scaleRatio,
      offsetY * scaleRatio,
      loadedImage.width * scale * scaleRatio,
      loadedImage.height * scale * scaleRatio
    );
    onApply(outCanvas.toDataURL('image/png'));
  };

  // 切り抜かずに元画像をそのまま使う
  const handleUseOriginal = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onApply(reader.result as string);
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={onCancel}
      panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-sm mx-4 p-6"
      overlayClassName="bg-black/60"
      enableEnterShortcut={false}
    >
        <h3 className="text-lg font-semibold text-foreground mb-1">アイコンの切り抜き</h3>
        <p className="text-xs text-muted-foreground mb-3">
          ドラッグで移動、ホイール/ピンチで拡大縮小。点線の円は丸アイコン表示時の目安です。
        </p>

        <canvas
          ref={canvasRef}
          className="w-full aspect-square border rounded cursor-move touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />

        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-muted-foreground shrink-0">ズーム</span>
          <input
            type="range"
            min={0.05}
            max={4}
            step={0.01}
            value={Math.min(4, scale)}
            onChange={e => setScale(parseFloat(e.target.value))}
            className="flex-1"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm text-muted-foreground hover:bg-accent rounded"
          >
            キャンセル
          </button>
          <button
            onClick={handleUseOriginal}
            className="px-3 py-2 text-sm border rounded text-foreground hover:bg-accent"
            title="切り抜かずに元の画像をそのまま登録します"
          >
            そのまま使用
          </button>
          <button
            onClick={handleApply}
            disabled={!loadedImage}
            className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            切り抜いて使用
          </button>
        </div>
    </DialogFrame>
  );
}
