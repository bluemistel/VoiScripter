'use client';

import { ReactNode, useEffect, useRef } from 'react';

interface DialogFrameProps {
  isOpen: boolean;
  onCancel: () => void;
  panelClassName: string;
  overlayClassName?: string;
  enableEnterShortcut?: boolean;
  children: ReactNode;
}

const isElementVisible = (el: HTMLElement) => {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
};

const getEnabledActionButtons = (root: ParentNode) => {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>('button.bg-primary, button.bg-destructive')
  ).filter((button) => !button.disabled && isElementVisible(button));
};

export default function DialogFrame({
  isOpen,
  onCancel,
  panelClassName,
  overlayClassName = '',
  enableEnterShortcut = true,
  children
}: DialogFrameProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }

      if (!enableEnterShortcut || event.key !== 'Enter' || event.isComposing) return;
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName.toLowerCase();
      if (tagName === 'textarea' || target.isContentEditable) return;
      if (tagName === 'button') return;

      const panel = panelRef.current;
      if (!panel || !panel.contains(target)) return;

      let scope: HTMLElement | null = target;
      let actionButton: HTMLButtonElement | null = null;

      while (scope && panel.contains(scope)) {
        const scopedButtons = getEnabledActionButtons(scope);
        if (scopedButtons.length > 0) {
          actionButton = scopedButtons.find((button) => button.type === 'submit') || scopedButtons[0];
          break;
        }
        scope = scope.parentElement;
      }

      if (!actionButton) {
        const panelButtons = getEnabledActionButtons(panel);
        actionButton = panelButtons.find((button) => button.type === 'submit')
          || panelButtons[panelButtons.length - 1]
          || null;
      }

      if (!actionButton) return;

      event.preventDefault();
      actionButton.click();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel, enableEnterShortcut]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/40 flex items-center justify-center z-50 ${overlayClassName}`.trim()}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={panelClassName}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
