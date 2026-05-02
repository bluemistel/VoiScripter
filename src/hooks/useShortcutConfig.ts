import { useState, useCallback } from 'react';
import { ShortcutMap, ShortcutId, ShortcutBinding, defaultShortcuts } from '@/types/shortcuts';

const STORAGE_KEY = 'voiscripter_keyboard_shortcuts';

const loadShortcuts = (): ShortcutMap => {
  try {
    if (typeof window === 'undefined') return { ...defaultShortcuts };
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...defaultShortcuts };
    // Merge with defaults so newly added shortcuts in updates get their defaults
    return { ...defaultShortcuts, ...JSON.parse(stored) };
  } catch {
    return { ...defaultShortcuts };
  }
};

export const useShortcutConfig = () => {
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(loadShortcuts);

  const updateShortcut = useCallback((id: ShortcutId, binding: ShortcutBinding) => {
    setShortcuts(prev => {
      const next = { ...prev, [id]: binding };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetShortcuts = useCallback(() => {
    setShortcuts({ ...defaultShortcuts });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { shortcuts, updateShortcut, resetShortcuts };
};
