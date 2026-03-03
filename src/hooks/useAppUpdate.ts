import { useCallback, useState } from 'react';
import { DataManagementHook } from './useDataManagement';

const GITHUB_RELEASES_API = 'https://api.github.com/repos/bluemistel/VoiScripter/releases?per_page=20';
const BOOTH_DOWNLOAD_URL = 'https://bluemist.booth.pm/items/7272767';
const UPDATE_SKIP_KEY = 'voiscripter_update_skip_version';

export interface UpdateReleaseNote {
  version: string;
  tagName: string;
  name: string;
  body: string;
  htmlUrl: string;
  publishedAt?: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  githubReleaseUrl: string;
  boothDownloadUrl: string;
  releasesToShow: UpdateReleaseNote[];
}

interface CheckForUpdatesOptions {
  openDialogIfNeeded?: boolean;
}

interface GithubReleaseResponse {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
}

const normalizeVersion = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().replace(/^v/i, '').split('-')[0];
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return `${match[1]}.${match[2]}.${match[3]}`;
};

const compareVersion = (a: string, b: string): number => {
  const ap = a.split('.').map(Number);
  const bp = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const diff = (ap[i] || 0) - (bp[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
};

const isTrustedGithubReleaseUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      parsed.hostname === 'github.com' &&
      parsed.pathname.startsWith('/bluemistel/VoiScripter/releases/tag/');
  } catch {
    return false;
  }
};

export const useAppUpdate = (dataManagement: DataManagementHook) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isUpdateSkipped, setIsUpdateSkipped] = useState(false);

  const setSkipForLatest = useCallback(async (skip: boolean) => {
    if (!updateInfo) return;
    setIsUpdateSkipped(skip);
    if (skip) {
      await dataManagement.saveData(UPDATE_SKIP_KEY, updateInfo.latestVersion);
    } else {
      await dataManagement.deleteData(UPDATE_SKIP_KEY);
    }
  }, [dataManagement, updateInfo]);

  const checkForUpdates = useCallback(async (
    options: CheckForUpdatesOptions = {}
  ): Promise<UpdateInfo | null> => {
    if (typeof window === 'undefined' || !window.electronAPI) return null;

    const currentVersionRaw = await window.electronAPI.getAppVersion();
    const currentVersion = normalizeVersion(currentVersionRaw);
    if (!currentVersion) return null;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 7000);

    let releases: GithubReleaseResponse[] = [];
    try {
      const response = await fetch(GITHUB_RELEASES_API, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/vnd.github+json'
        }
      });
      if (!response.ok) {
        clearTimeout(timeoutId);
        return null;
      }
      releases = await response.json();
    } catch {
      clearTimeout(timeoutId);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }

    const normalizedReleases: UpdateReleaseNote[] = releases
      .filter(release => !release.draft && !release.prerelease)
      .flatMap((release): UpdateReleaseNote[] => {
        const version = normalizeVersion(release.tag_name);
        if (!version) return [];
        const htmlUrl = release.html_url || '';
        return [{
          version,
          tagName: release.tag_name || `v${version}`,
          name: release.name || release.tag_name || `v${version}`,
          body: release.body || '',
          htmlUrl: isTrustedGithubReleaseUrl(htmlUrl)
            ? htmlUrl
            : `https://github.com/bluemistel/VoiScripter/releases/tag/v${version}`,
          publishedAt: release.published_at
        }];
      })
      .sort((a, b) => compareVersion(b.version, a.version));

    if (normalizedReleases.length === 0) return null;

    const latest = normalizedReleases[0];
    const hasUpdate = compareVersion(latest.version, currentVersion) > 0;
    if (!hasUpdate) {
      setUpdateInfo(null);
      setIsUpdateSkipped(false);
      return null;
    }

    const skippedVersionRaw = await dataManagement.loadData(UPDATE_SKIP_KEY);
    const skippedVersion = normalizeVersion(skippedVersionRaw);
    const skippedLatest = skippedVersion === latest.version;
    setIsUpdateSkipped(skippedLatest);

    const releasesToShow = normalizedReleases.filter(
      release => compareVersion(release.version, currentVersion) > 0
    );

    const info: UpdateInfo = {
      currentVersion,
      latestVersion: latest.version,
      githubReleaseUrl: latest.htmlUrl,
      boothDownloadUrl: BOOTH_DOWNLOAD_URL,
      releasesToShow
    };

    setUpdateInfo(info);
    if (options.openDialogIfNeeded && !skippedLatest) {
      setIsUpdateDialogOpen(true);
    }
    return info;
  }, [dataManagement]);

  return {
    updateInfo,
    isUpdateDialogOpen,
    setIsUpdateDialogOpen,
    isUpdateSkipped,
    setSkipForLatest,
    checkForUpdates
  };
};
