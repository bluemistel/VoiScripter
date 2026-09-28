'use client';

import { ComponentType, ReactNode, SVGProps } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>;

/** ダイアログ右上の丸い閉じるボタン（フィールド面＋x-mark） */
export function DialogCloseButton({ onClick, title = '閉じる' }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="size-[30px] shrink-0 rounded-full bg-field text-fg-sub flex items-center justify-center transition-colors hover:text-fg"
      title={title}
      aria-label={title}
    >
      <XMarkIcon className="size-4" strokeWidth={2} />
    </button>
  );
}

interface DialogHeaderProps {
  title: ReactNode;
  /** タイトル左のアイコン（primary-text 色・19px） */
  icon?: HeroIcon;
  onClose?: () => void;
  /** アイコンより左に置くもの（検索のドラッグ用グリップなど） */
  leading?: ReactNode;
  /** 閉じるボタンの左に置くもの */
  actions?: ReactNode;
  className?: string;
}

/**
 * ダイアログ共通のヘッダー（docs/ui-guidelines.md §11）
 * 左に primary-text のアイコン＋16px/700 のタイトル、右に丸い閉じるボタン。
 */
export default function DialogHeader({ title, icon: Icon, onClose, leading, actions, className = '' }: DialogHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-3 px-5 pt-[18px] pb-3.5 ${className}`}>
      <div className="flex items-center gap-[9px] min-w-0">
        {leading}
        {Icon && <Icon className="size-[19px] shrink-0 text-primary-text" />}
        <h2 className="text-base font-bold text-fg truncate">{title}</h2>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {onClose && <DialogCloseButton onClick={onClose} />}
      </div>
    </div>
  );
}
