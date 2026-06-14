'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, FolderIcon, DocumentTextIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import DialogFrame from '@/components/common/DialogFrame';

// 新規作成・名前変更で共用する名前入力ダイアログ
interface NameInputDialogProps {
  isOpen: boolean;
  title: string;
  label: string;
  placeholder: string;
  submitButtonText: string;
  initialValue?: string;
  validate: (name: string) => string | null;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export function NameInputDialog({
  isOpen,
  title,
  label,
  placeholder,
  submitButtonText,
  initialValue = '',
  validate,
  onSubmit,
  onClose,
}: NameInputDialogProps) {
  const [name, setName] = useState(initialValue);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(initialValue);
      setError('');
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSubmit(name);
    onClose();
  };

  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={onClose}
      panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4"
    >
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <button onClick={onClose} className="p-1 hover:bg-accent rounded transition-colors">
          <XMarkIcon className="w-5 h-5 text-foreground" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            className="w-full p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
            placeholder={placeholder}
            autoFocus
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            {submitButtonText}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}

// プロジェクト削除確認
interface DeleteProjectConfirmDialogProps {
  isOpen: boolean;
  projectId: string;
  isCurrent: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteProjectConfirmDialog({ isOpen, projectId, isCurrent, onConfirm, onClose }: DeleteProjectConfirmDialogProps) {
  if (!isOpen) return null;
  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={onClose}
      panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">プロジェクトの削除</h3>
      <p className="text-sm text-foreground mb-2">
        プロジェクト「<span className="font-semibold">{projectId}</span>」を削除します。
        <span className="text-destructive font-semibold">この操作は元に戻せません。</span>
      </p>
      {isCurrent && (
        <p className="text-sm text-muted-foreground mb-2">現在編集中のプロジェクトです。削除後は別のプロジェクトに切り替わります。</p>
      )}
      <div className="flex justify-end space-x-2 mt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded transition-colors"
        >
          キャンセル
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
        >
          削除
        </button>
      </div>
    </DialogFrame>
  );
}

// フォルダ削除確認（中身ごと削除）
interface DeleteFolderConfirmDialogProps {
  isOpen: boolean;
  folderName: string;
  childFolderNames: string[];
  childProjectIds: string[];
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteFolderConfirmDialog({
  isOpen,
  folderName,
  childFolderNames,
  childProjectIds,
  onConfirm,
  onClose,
}: DeleteFolderConfirmDialogProps) {
  if (!isOpen) return null;
  const hasContents = childFolderNames.length > 0 || childProjectIds.length > 0;
  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={onClose}
      panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">フォルダの削除</h3>
      {hasContents ? (
        <>
          <p className="text-sm text-foreground mb-3">
            フォルダ「<span className="font-semibold">{folderName}</span>」と、その中の
            {childFolderNames.length > 0 && <span className="font-semibold">フォルダ{childFolderNames.length}個</span>}
            {childFolderNames.length > 0 && childProjectIds.length > 0 && '・'}
            {childProjectIds.length > 0 && <span className="font-semibold">プロジェクト{childProjectIds.length}個</span>}
            をすべて削除します。
            <span className="text-destructive font-semibold">この操作は元に戻せません。</span>
          </p>
          <div className="bg-muted rounded p-3 text-sm max-h-40 overflow-y-auto mb-4 space-y-1">
            {childFolderNames.map((name, i) => (
              <div key={`f-${i}`} className="flex items-center gap-2 text-foreground">
                <FolderIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{name}</span>
              </div>
            ))}
            {childProjectIds.map((id) => (
              <div key={`p-${id}`} className="flex items-center gap-2 text-foreground">
                <DocumentTextIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{id}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-foreground mb-4">
          フォルダ「<span className="font-semibold">{folderName}</span>」を削除します。（中身は空です）
        </p>
      )}
      <div className="flex justify-end space-x-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded transition-colors"
        >
          キャンセル
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
        >
          {hasContents ? 'すべて削除' : '削除'}
        </button>
      </div>
    </DialogFrame>
  );
}

// 移動先フォルダ選択
export interface FolderOption {
  id: string | null; // null = ルート
  name: string;
  depth: number;
  disabled: boolean;
}

interface MoveToFolderDialogProps {
  isOpen: boolean;
  targetName: string;
  options: FolderOption[];
  onMove: (folderId: string | null) => void;
  onClose: () => void;
}

export function MoveToFolderDialog({ isOpen, targetName, options, onMove, onClose }: MoveToFolderDialogProps) {
  if (!isOpen) return null;
  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={onClose}
      enableEnterShortcut={false}
      panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 flex flex-col max-h-[70vh]"
    >
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold text-foreground truncate">「{targetName}」の移動先</h2>
        <button onClick={onClose} className="p-1 hover:bg-accent rounded transition-colors shrink-0">
          <XMarkIcon className="w-5 h-5 text-foreground" />
        </button>
      </div>
      <div className="p-2 overflow-y-auto flex-1">
        {options.map((option) => (
          <button
            key={option.id ?? '__root__'}
            disabled={option.disabled}
            onClick={() => { onMove(option.id); onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ paddingLeft: `${12 + option.depth * 20}px` }}
          >
            {option.id === null ? (
              <ArrowUturnLeftIcon className="w-5 h-5 shrink-0 text-muted-foreground" />
            ) : (
              <FolderIcon className="w-5 h-5 shrink-0 text-secondary" />
            )}
            <span className="truncate">{option.name}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-end p-3 border-t">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded transition-colors"
        >
          キャンセル
        </button>
      </div>
    </DialogFrame>
  );
}
