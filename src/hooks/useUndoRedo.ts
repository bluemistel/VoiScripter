import { useState, useEffect, useRef } from 'react';
import { Project } from '@/types';
import { DataManagementHook } from './useDataManagement';

export interface UndoRedoHook {
  undoStack: ProjectHistory[];
  redoStack: ProjectHistory[];
  isUndoRedoOperation: React.MutableRefObject<boolean>;
  canUndo: boolean;
  canRedo: boolean;
  pushToHistory: (project: Project, selectedSceneId: string | null) => void;
  undo: () => ProjectHistory | null;
  redo: () => ProjectHistory | null;
  clearHistory: () => void;
}

export type ProjectHistory = { project: Project; selectedSceneId: string | null };

export const useUndoRedo = (
  projectId: string,
  dataManagement: DataManagementHook
): UndoRedoHook => {
  const [undoStack, setUndoStack] = useState<ProjectHistory[]>([]);
  const [redoStack, setRedoStack] = useState<ProjectHistory[]>([]);
  const isUndoRedoOperation = useRef(false);

  // Undo/Redoスタックの保存
  useEffect(() => {
    if (!projectId || undoStack.length === 0) return;
    
    // 前回の保存内容と比較して、実際に変更があった場合のみ保存
    const currentUndoData = JSON.stringify(undoStack);
    const lastSavedUndoData = localStorage.getItem(`voiscripter_project_${projectId}_undo_lastSaved`);
    
    if (lastSavedUndoData === currentUndoData) {
      return; // 変更がない場合は保存しない
    }
    
    const timeoutId = setTimeout(() => {
      dataManagement.saveData(`voiscripter_project_${projectId}_undo`, currentUndoData);
      // 保存完了後に最終保存内容を記録
      localStorage.setItem(`voiscripter_project_${projectId}_undo_lastSaved`, currentUndoData);
    }, 1000); // 1秒後に保存
    
    return () => clearTimeout(timeoutId);
  }, [undoStack, projectId]);

  useEffect(() => {
    if (!projectId || redoStack.length === 0) return;
    
    // 前回の保存内容と比較して、実際に変更があった場合のみ保存
    const currentRedoData = JSON.stringify(redoStack);
    const lastSavedRedoData = localStorage.getItem(`voiscripter_project_${projectId}_redo_lastSaved`);
    
    if (lastSavedRedoData === currentRedoData) {
      return; // 変更がない場合は保存しない
    }
    
    const timeoutId = setTimeout(() => {
      dataManagement.saveData(`voiscripter_project_${projectId}_redo`, currentRedoData);
      // 保存完了後に最終保存内容を記録
      localStorage.setItem(`voiscripter_project_${projectId}_redo_lastSaved`, currentRedoData);
    }, 1000); // 1秒後に保存
    
    return () => clearTimeout(timeoutId);
  }, [redoStack, projectId]);

  // Undo/Redoスタックの復元（プロジェクト切替時）
  useEffect(() => {
    if (!projectId) return;
    
    const loadUndoRedo = async () => {
      const undoJson = await dataManagement.loadData(`voiscripter_project_${projectId}_undo`);
      const redoJson = await dataManagement.loadData(`voiscripter_project_${projectId}_redo`);
      
      if (undoJson) {
        try {
          const parsed = JSON.parse(undoJson);
          if (Array.isArray(parsed)) setUndoStack(parsed);
        } catch {}
      } else {
        setUndoStack([]);
      }
      
      if (redoJson) {
        try {
          const parsed = JSON.parse(redoJson);
          if (Array.isArray(parsed)) setRedoStack(parsed);
        } catch {}
      } else {
        setRedoStack([]);
      }
    };
    
    loadUndoRedo();
  }, [projectId]); // dataManagementを依存配列から削除

  // 履歴に追加
  const pushToHistory = (project: Project, selectedSceneId: string | null) => {
    if (isUndoRedoOperation.current) {
      isUndoRedoOperation.current = false;
      return;
    }
    
    setUndoStack(prev => {
      const newStack = [...prev, { project, selectedSceneId }];
      return newStack.length > 50 ? newStack.slice(newStack.length - 50) : newStack;
    });
    
    setRedoStack([]);
  };

  // Undo実行
  const undo = (): ProjectHistory | null => {
    if (undoStack.length === 0) return null;
    
    isUndoRedoOperation.current = true;
    
    const currentState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    
    setUndoStack(newUndoStack);
    setRedoStack(prev => [currentState, ...prev]);
    
    return currentState;
  };

  // Redo実行
  const redo = (): ProjectHistory | null => {
    if (redoStack.length === 0) return null;
    
    isUndoRedoOperation.current = true;
    
    const nextState = redoStack[0];
    const newRedoStack = redoStack.slice(1);
    
    setRedoStack(newRedoStack);
    setUndoStack(prev => [...prev, nextState]);
    
    return nextState;
  };

  // 履歴をクリア
  const clearHistory = () => {
    setUndoStack([]);
    setRedoStack([]);
  };

  return {
    undoStack,
    redoStack,
    isUndoRedoOperation,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pushToHistory,
    undo,
    redo,
    clearHistory
  };
};
