'use client';

import { ReactNode } from 'react';

export interface TabBarItem<T extends string> {
  id: T;
  label: ReactNode;
}

interface TabBarProps<T extends string> {
  items: TabBarItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  /** アクティブなタブの面（下のコンテンツと同じ色にしてつなげる） */
  activeSurfaceClass?: string;
  className?: string;
  /** タブ行の右端に置くもの（閉じるボタンなど） */
  trailing?: ReactNode;
}

/**
 * アプリ内のタブはすべてシーンタブと同じ形状（docs/ui-guidelines.md §7）
 * 上角のみ12pxの角丸。アクティブはコンテンツ面と同色＋上辺3pxのアクセント罫、非アクティブは背景なし。
 * タブ行はコンテンツより一段暗い帯。
 */
export default function TabBar<T extends string>({
  items,
  activeId,
  onChange,
  activeSurfaceClass = 'bg-panel',
  className = '',
  trailing
}: TabBarProps<T>) {
  return (
    <div role="tablist" className={`flex items-end gap-[3px] px-5 bg-tab-band overflow-x-auto no-scrollbar shrink-0 ${className}`}>
      {items.map(item => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={`shrink-0 rounded-t-xl px-[18px] text-[12.5px] whitespace-nowrap transition-colors ${
              isActive
                ? `${activeSurfaceClass} py-[9px] font-bold text-fg shadow-[inset_0_3px_0_var(--color-primary)]`
                : 'py-2 text-fg-sub hover:text-fg'
            }`}
          >
            {item.label}
          </button>
        );
      })}
      {trailing && <div className="ml-auto self-center shrink-0 pl-2">{trailing}</div>}
    </div>
  );
}
