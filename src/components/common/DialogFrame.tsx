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
  const isTypingRef = useRef(false);
  const lastTypingAtRef = useRef(0);
  // onCancel を ref で保持し、useEffect の依存配列から除外する
  // （毎レンダーで新しい参照になるアロー関数が渡されても effect が再実行されないようにする）
  const onCancelRef = useRef(onCancel);
  useEffect(() => { onCancelRef.current = onCancel; });

  const isEditableElement = (el: HTMLElement | null) => {
    if (!el) return false;
    const tagName = el.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || el.isContentEditable;
  };

  useEffect(() => {
    if (!isOpen) return;
    isTypingRef.current = false;
    lastTypingAtRef.current = 0;

    // 入力要素がある場合はそちらへ優先フォーカスし、なければパネルへフォーカス
    const focusTimer = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const preferred = panel.querySelector<HTMLElement>(
        'input[autofocus], textarea[autofocus], input:not([disabled]), textarea:not([disabled]), [contenteditable="true"]'
      );
      if (preferred) {
        preferred.focus();
        if (isEditableElement(preferred)) {
          isTypingRef.current = true;
          lastTypingAtRef.current = Date.now();
        }
        return;
      }
      panel.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current();
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

    const panel = panelRef.current;
    const handleFocusIn = (event: FocusEvent) => {
      const typing = isEditableElement(event.target as HTMLElement | null);
      isTypingRef.current = typing;
      if (typing) {
        lastTypingAtRef.current = Date.now();
      }
    };
    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        const typing = !!(panel && active && panel.contains(active) && isEditableElement(active));
        isTypingRef.current = typing;
        if (typing) {
          lastTypingAtRef.current = Date.now();
        }
      }, 0);
    };

    panel?.addEventListener('focusin', handleFocusIn);
    panel?.addEventListener('focusout', handleFocusOut);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      panel?.removeEventListener('focusin', handleFocusIn);
      panel?.removeEventListener('focusout', handleFocusOut);
      isTypingRef.current = false;
      lastTypingAtRef.current = 0;
    };
  }, [isOpen, enableEnterShortcut]); // onCancel は onCancelRef 経由で参照するため deps 不要

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/40 flex items-center justify-center z-50 ${overlayClassName}`.trim()}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          const active = document.activeElement as HTMLElement | null;
          const isAnyTyping = isEditableElement(active);
          const visualViewport = typeof window !== 'undefined' ? window.visualViewport : null;
          const keyboardInset = visualViewport
            ? Math.max(0, Math.round(window.innerHeight - (visualViewport.height + visualViewport.offsetTop)))
            : 0;
          const isMobileKeyboardOpen = keyboardInset > 80;
          if (
            isTypingRef.current ||
            isAnyTyping ||
            isMobileKeyboardOpen ||
            Date.now() - lastTypingAtRef.current < 350
          ) {
            return;
          }
          onCancelRef.current();
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
