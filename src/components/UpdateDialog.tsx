import { UpdateInfo } from '@/hooks/useAppUpdate';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import DialogFrame from '@/components/common/DialogFrame';
import DialogHeader from '@/components/common/DialogHeader';
import { buttonClass } from '@/components/common/Button';

interface UpdateDialogProps {
  isOpen: boolean;
  updateInfo: UpdateInfo | null;
  skipChecked: boolean;
  onSkipCheckedChange: (checked: boolean) => void;
  onClose: () => void;
}

const formatPublishedAt = (value?: string) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('ja-JP');
  } catch {
    return '';
  }
};

export default function UpdateDialog({
  isOpen,
  updateInfo,
  skipChecked,
  onSkipCheckedChange,
  onClose
}: UpdateDialogProps) {
  if (!isOpen || !updateInfo) return null;

  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={onClose}
      panelClassName="w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
      overlayClassName="p-4"
    >
        <DialogHeader icon={ArrowPathIcon} title="アップデートがあります" onClose={onClose} className="shrink-0" />

        <div className="px-5 pb-5 space-y-5 overflow-y-auto">
          <div className="text-[13px] text-fg-sub">
            現在のバージョン: <span className="text-fg font-semibold">v{updateInfo.currentVersion}</span>
            {' / '}
            最新バージョン: <span className="text-fg font-semibold">v{updateInfo.latestVersion}</span>
          </div>

          <div className="space-y-3">
            <h3 className="text-[14.5px] font-bold text-fg">未更新の内容</h3>
            {updateInfo.releasesToShow.map(release => (
              <div key={release.tagName} className="rounded-2xl p-3.5 bg-well">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[13.5px] font-bold text-fg">{release.name}</div>
                  <div className="text-[11px] text-fg-faint">{formatPublishedAt(release.publishedAt)}</div>
                </div>
                <pre className="text-[11px] leading-[1.55] whitespace-pre-wrap text-fg-sub font-sans">
                  {release.body || '更新内容の詳細はリリースページをご確認ください。'}
                </pre>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="text-[14.5px] font-bold text-fg">ダウンロード先</h3>
            <div className="text-sm">
              <a
                href={updateInfo.boothDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-text underline-offset-2 hover:underline break-all"
              >
                Booth: {updateInfo.boothDownloadUrl}
              </a>
            </div>
            <div className="text-sm">
              <a
                href={updateInfo.githubReleaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-text underline-offset-2 hover:underline break-all"
              >
                GitHub Release: {updateInfo.githubReleaseUrl}
              </a>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 shadow-[0_-1px_0_var(--color-hairline)] flex items-center justify-between gap-3">
          <label className="flex items-center gap-[11px] text-[13px] font-semibold text-fg cursor-pointer">
            <input
              type="checkbox"
              checked={skipChecked}
              onChange={(e) => onSkipCheckedChange(e.target.checked)}
              className="ui-checkbox"
            />
            このバージョンのアップデート通知をスキップする
          </label>
          <button
            type="button"
            onClick={onClose}
            className={buttonClass('secondary')}
          >
            閉じる
          </button>
        </div>
    </DialogFrame>
  );
}
