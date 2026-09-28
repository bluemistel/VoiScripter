'use client';

import { useState, useEffect } from 'react';
import { FolderIcon, DocumentTextIcon, ArrowUturnLeftIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import DialogFrame from '@/components/common/DialogFrame';
import DialogHeader from '@/components/common/DialogHeader';
import { buttonClass } from '@/components/common/Button';

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
      panelClassName="w-full max-w-md mx-4"
    >
      <DialogHeader icon={PencilSquareIcon} title={title} onClose={onClose} />
      <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-5">
        <div>
          <label className="block ui-section-label mb-2">{label}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            className="ui-input w-full"
            placeholder={placeholder}
            autoFocus
          />
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
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
      panelClassName="w-full max-w-md mx-4 pb-5"
    >
      <DialogHeader icon={TrashIcon} title="プロジェクトの削除" onClose={onClose} />
      <div className="px-5">
      <p className="text-[13.5px] text-fg leading-relaxed mb-2">
        プロジェクト「<span className="font-semibold">{projectId}</span>」を削除します。
        <span className="text-destructive font-semibold">この操作は元に戻せません。</span>
      </p>
      {isCurrent && (
        <p className="text-xs text-fg-sub mb-2">現在編集中のプロジェクトです。削除後は別のプロジェクトに切り替わります。</p>
      )}
      </div>
      <div className="flex justify-end gap-2 mt-5 px-5">
        <button
          onClick={onClose}
          className={buttonClass('secondary')}
        >
          キャンセル
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className={buttonClass('destructive')}
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
      panelClassName="w-full max-w-md mx-4 pb-5"
    >
      <DialogHeader icon={TrashIcon} title="フォルダの削除" onClose={onClose} />
      <div className="px-5">
      {hasContents ? (
        <>
          <p className="text-[13.5px] text-fg leading-relaxed mb-3">
            フォルダ「<span className="font-semibold">{folderName}</span>」と、その中の
            {childFolderNames.length > 0 && <span className="font-semibold">フォルダ{childFolderNames.length}個</span>}
            {childFolderNames.length > 0 && childProjectIds.length > 0 && '・'}
            {childProjectIds.length > 0 && <span className="font-semibold">プロジェクト{childProjectIds.length}個</span>}
            をすべて削除します。
            <span className="text-destructive font-semibold">この操作は元に戻せません。</span>
          </p>
          <div className="bg-well rounded-2xl p-3 text-sm max-h-40 overflow-y-auto mb-1 space-y-1">
            {childFolderNames.map((name, i) => (
              <div key={`f-${i}`} className="flex items-center gap-2 text-fg">
                <FolderIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{name}</span>
              </div>
            ))}
            {childProjectIds.map((id) => (
              <div key={`p-${id}`} className="flex items-center gap-2 text-fg">
                <DocumentTextIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{id}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[13.5px] text-fg leading-relaxed">
          フォルダ「<span className="font-semibold">{folderName}</span>」を削除します。（中身は空です）
        </p>
      )}
      </div>
      <div className="flex justify-end gap-2 mt-5 px-5">
        <button
          onClick={onClose}
          className={buttonClass('secondary')}
        >
          キャンセル
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className={buttonClass('destructive')}
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
      panelClassName="w-full max-w-md mx-4 flex flex-col max-h-[70vh]"
    >
      <DialogHeader icon={FolderIcon} title={<>「{targetName}」の移動先</>} onClose={onClose} />
      <div className="px-3 pb-2 overflow-y-auto flex-1">
        {options.map((option) => (
          <button
            key={option.id ?? '__root__'}
            disabled={option.disabled}
            onClick={() => { onMove(option.id); onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13.5px] text-left text-fg hover:bg-field transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ paddingLeft: `${12 + option.depth * 20}px` }}
          >
            {option.id === null ? (
              <ArrowUturnLeftIcon className="w-5 h-5 shrink-0 text-fg-faint" />
            ) : (
              <FolderIcon className="w-5 h-5 shrink-0 text-secondary" />
            )}
            <span className="truncate">{option.name}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-end px-5 py-4 shadow-[0_-1px_0_var(--color-hairline)]">
        <button
          onClick={onClose}
          className={buttonClass('secondary')}
        >
          キャンセル
        </button>
      </div>
    </DialogFrame>
  );
}
