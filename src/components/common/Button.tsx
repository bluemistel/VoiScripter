'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/**
 * ボタンは3種のみ（docs/ui-guidelines.md §5）
 * - primary: 画面に1つだけの主行動
 * - secondary: 同格に並ぶ操作（フィールド面の塗り）
 * - secondary-outline: 同上（パネル面＋ヘアラインのリング。色面の上で使う）
 * - destructive: 削除など（強: 塗り）
 * - destructive-weak: データが巻き戻る操作など（弱: 薄塗り＋注意アイコン）
 *
 * primary / destructive は DialogFrame の Enter キー確定の対象になる（ui-btn-primary / ui-btn-destructive）。
 */
export type ButtonVariant = 'primary' | 'secondary' | 'secondary-outline' | 'destructive' | 'destructive-weak';
export type ButtonSize = 'md' | 'sm';

/**
 * <button> にそのまま渡せるクラス。見た目の定義は globals.css の .ui-btn-*（既定スタイル）にある。
 * アイコン付きの弱い destructive は Button コンポーネントを使う。
 */
export const buttonClass = (variant: ButtonVariant = 'secondary', size: ButtonSize = 'md') =>
  `ui-btn ui-btn-${variant}${size === 'sm' ? ' ui-btn-sm' : ''}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className = '', type = 'button', children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${buttonClass(variant, size)} ${className}`}
      {...rest}
    >
      {variant === 'destructive-weak' && (
        <ExclamationTriangleIcon className={size === 'sm' ? 'size-3.5 shrink-0' : 'size-[15px] shrink-0'} strokeWidth={2} />
      )}
      {children}
    </button>
  );
});

export default Button;
