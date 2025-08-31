import { useState } from 'react';

export interface UIStateHook {
  isProjectDialogOpen: boolean;
  setIsProjectDialogOpen: (open: boolean) => void;
  isCSVExportDialogOpen: boolean;
  setIsCSVExportDialogOpen: (open: boolean) => void;
  isCharacterManagerOpen: boolean;
  setIsCharacterManagerOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  deleteConfirmation: { projectId: string; confirmed: boolean | null } | null;
  setDeleteConfirmation: (confirmation: { projectId: string; confirmed: boolean | null } | null) => void;
  selectedBlockIds: string[];
  setSelectedBlockIds: (ids: string[]) => void;
  handleSelectAllBlocks: () => void;
  handleDeselectAllBlocks: () => void;
  handleToggleBlockSelection: (blockId: string, selectedBlockIds: string[]) => string[];
}

export const useUIState = (): UIStateHook => {
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isCSVExportDialogOpen, setIsCSVExportDialogOpen] = useState(false);
  const [isCharacterManagerOpen, setIsCharacterManagerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ projectId: string; confirmed: boolean | null } | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);

  // 通知関数
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // 全ブロック選択
  const handleSelectAllBlocks = () => {
    // この関数は実際のブロックIDリストを取得する必要があるため、
    // 親コンポーネントから渡される必要があります
  };

  // 全選択解除
  const handleDeselectAllBlocks = () => {
    setSelectedBlockIds([]);
  };

  // ブロック選択切り替え
  const handleToggleBlockSelection = (blockId: string, selectedBlockIds: string[]): string[] => {
    if (selectedBlockIds.includes(blockId)) {
      return selectedBlockIds.filter(id => id !== blockId);
    } else {
      return [...selectedBlockIds, blockId];
    }
  };

  return {
    isProjectDialogOpen,
    setIsProjectDialogOpen,
    isCSVExportDialogOpen,
    setIsCSVExportDialogOpen,
    isCharacterManagerOpen,
    setIsCharacterManagerOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    notification,
    showNotification,
    deleteConfirmation,
    setDeleteConfirmation,
    selectedBlockIds,
    setSelectedBlockIds,
    handleSelectAllBlocks,
    handleDeselectAllBlocks,
    handleToggleBlockSelection
  };
};
