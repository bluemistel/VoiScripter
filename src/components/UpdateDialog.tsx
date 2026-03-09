import { UpdateInfo } from '@/hooks/useAppUpdate';
import DialogFrame from '@/components/common/DialogFrame';

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
      panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
      overlayClassName="p-4"
    >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-foreground">アップデートがあります</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl" aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="text-sm text-muted-foreground">
            現在のバージョン: <span className="text-foreground font-medium">v{updateInfo.currentVersion}</span>
            {' / '}
            最新バージョン: <span className="text-foreground font-medium">v{updateInfo.latestVersion}</span>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">未更新の内容</h3>
            {updateInfo.releasesToShow.map(release => (
              <div key={release.tagName} className="rounded border p-3 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-foreground">{release.name}</div>
                  <div className="text-xs text-muted-foreground">{formatPublishedAt(release.publishedAt)}</div>
                </div>
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground font-sans">
                  {release.body || '更新内容の詳細はリリースページをご確認ください。'}
                </pre>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">ダウンロード先</h3>
            <div className="text-sm">
              <a
                href={updateInfo.boothDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline break-all"
              >
                Booth: {updateInfo.boothDownloadUrl}
              </a>
            </div>
            <div className="text-sm">
              <a
                href={updateInfo.githubReleaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline break-all"
              >
                GitHub Release: {updateInfo.githubReleaseUrl}
              </a>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={skipChecked}
              onChange={(e) => onSkipCheckedChange(e.target.checked)}
              className="w-4 h-4"
            />
            このバージョンのアップデート通知をスキップする
          </label>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
          >
            閉じる
          </button>
        </div>
    </DialogFrame>
  );
}
