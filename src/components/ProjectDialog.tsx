'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (projectName: string) => void;
  existingProjects: string[];
}

export default function ProjectDialog({
  isOpen,
  onClose,
  onConfirm,
  existingProjects
}: ProjectDialogProps) {
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectName.trim()) {
      setError('プロジェクト名を入力してください');
      return;
    }
    
    if (existingProjects.includes(projectName.trim())) {
      setError('同名のプロジェクトが既に存在します');
      return;
    }
    
    onConfirm(projectName.trim());
    setProjectName('');
    setError('');
    onClose();
  };

  const handleCancel = () => {
    setProjectName('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-foreground">新しいプロジェクト</h2>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-foreground" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-foreground mb-2">
              プロジェクト名
            </label>
            <input
              type="text"
              id="projectName"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                setError('');
              }}
              className="w-full p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
              placeholder="プロジェクト名を入力"
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              作成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 