'use client';

import { useState } from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import DialogFrame from '@/components/common/DialogFrame';
import DialogHeader from '@/components/common/DialogHeader';
import { buttonClass } from '@/components/common/Button';

interface ProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (projectName: string) => void;
  existingProjects: string[];
  title?: string;
  submitButtonText?: string;
  placeholder?: string;
}

export default function ProjectDialog({
  isOpen,
  onClose,
  onConfirm,
  existingProjects,
  title = '新しいプロジェクト',
  submitButtonText = '作成',
  placeholder = 'プロジェクト名を入力'
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

  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={handleCancel}
      panelClassName="w-full max-w-md mx-4"
    >
        <DialogHeader icon={DocumentTextIcon} title={title} onClose={handleCancel} />
        
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-5">
          <div>
            <label htmlFor="projectName" className="block ui-section-label mb-2">
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
              className="ui-input w-full"
              placeholder={placeholder}
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive mt-2">{error}</p>
            )}
          </div>
          
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className={buttonClass('secondary')}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className={buttonClass('primary')}
            >
              {submitButtonText}
            </button>
          </div>
        </form>
    </DialogFrame>
  );
} 