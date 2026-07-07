'use client';

import { useState, useEffect, useMemo } from 'react';
import { Project, Character, GroupCredits } from '@/types';
import { collectUsedCharacterIds, buildCreditText } from '@/utils/creditUtils';
import { ClipboardDocumentIcon, ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface CreditExportPanelProps {
  project: Project;
  characters: Character[];
  groups: string[];
  groupCredits: GroupCredits;
  selectedSceneId: string | null;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * 台本で使用中のキャラクターを集計し、動画概要欄にそのまま貼れる
 * クレジットテキストを生成するパネル（エクスポートダイアログの
 * クレジットタブに埋め込んで使用する）。
 * - 合成音声側: グループのクレジット表記（例: VOICEVOX:ずんだもん）
 * - 立ち絵側: キャラクターの素材クレジット（制作者・ID・URL。メモは含めない）
 */
export default function CreditExportPanel({
  project,
  characters,
  groups,
  groupCredits,
  selectedSceneId,
  onNotification
}: CreditExportPanelProps) {
  const [currentSceneOnly, setCurrentSceneOnly] = useState(false);
  const [creditText, setCreditText] = useState('');

  // 対象シーンのブロックから使用中キャラクターIDを集計
  const usedCharacterIds = useMemo(() => {
    const scenes = currentSceneOnly
      ? project.scenes.filter(s => s.id === selectedSceneId)
      : project.scenes;
    return collectUsedCharacterIds(scenes);
  }, [project, currentSceneOnly, selectedSceneId]);

  // クレジットテキストの生成
  const generateCreditText = (): string =>
    buildCreditText(usedCharacterIds, characters, groups, groupCredits);

  // 表示時と対象範囲の切り替え時に再生成
  useEffect(() => {
    setCreditText(generateCreditText());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usedCharacterIds]);

  const usedCount = usedCharacterIds.size;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(creditText);
      onNotification('クレジットをクリップボードにコピーしました。', 'success');
    } catch {
      onNotification('クリップボードへのコピーに失敗しました。', 'error');
    }
  };

  const handleSave = async () => {
    const defaultName = `${project.name || 'project'}_credits.txt`;
    if (window.electronAPI) {
      try {
        await window.electronAPI.saveCSVFile(defaultName, creditText);
      } catch (error) {
        console.error('ファイル保存エラー:', error);
        onNotification('ファイルの保存に失敗しました。', 'error');
      }
    } else {
      const blob = new Blob([creditText], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div>
        <p className="text-xs text-muted-foreground mb-3">
          台本で使用中のキャラクターから、動画概要欄用のクレジットを生成します。<br />
          音声はグループ設定の「クレジット表記」、立ち絵はキャラクターの「素材クレジット」を参照します。
        </p>

        <label className="flex items-center text-sm text-foreground mb-3">
          <input
            type="checkbox"
            checked={currentSceneOnly}
            onChange={e => setCurrentSceneOnly(e.target.checked)}
            className="mr-2"
          />
          現在のシーンのみを対象にする
        </label>

        <div className="text-xs text-muted-foreground mb-2">
          使用中キャラクター: {usedCount}人
          {creditText.trim() === '' && usedCount > 0 && (
            <span className="text-destructive ml-2">
              クレジット情報が未設定です（キャラクター設定から登録できます）
            </span>
          )}
        </div>

        <textarea
          value={creditText}
          onChange={e => setCreditText(e.target.value)}
          rows={10}
          placeholder="生成されたクレジットがここに表示されます。コピー前に自由に編集できます。"
          className="w-full p-3 border rounded bg-background text-foreground text-sm font-mono focus:ring-2 focus:ring-primary/50 focus:border-transparent focus:outline-none resize-y"
        />

        <div className="flex flex-wrap justify-end gap-2 mt-3">
          <button
            onClick={() => setCreditText(generateCreditText())}
            className="px-3 py-2 text-sm border rounded text-foreground hover:bg-accent flex items-center"
            title="編集内容を破棄して再生成"
          >
            <ArrowPathIcon className="w-4 h-4 mr-1" />
            再生成
          </button>
          <button
            onClick={handleSave}
            disabled={!creditText.trim()}
            className="px-3 py-2 text-sm border rounded text-foreground hover:bg-accent flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
            ファイル保存
          </button>
          <button
            onClick={handleCopy}
            disabled={!creditText.trim()}
            className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClipboardDocumentIcon className="w-4 h-4 mr-1" />
            コピー
          </button>
        </div>
    </div>
  );
}
