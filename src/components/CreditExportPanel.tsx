'use client';

import { useState, useEffect, useMemo } from 'react';
import { Project, Character, GroupCredits } from '@/types';
import { collectUsedCharacterIds, buildCreditText } from '@/utils/creditUtils';
import { ClipboardDocumentIcon, ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { buttonClass } from '@/components/common/Button';

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
        <p className="text-[11px] leading-[1.55] text-fg-sub mb-3">
          台本で使用中のキャラクターから、動画概要欄用のクレジットを生成します。<br />
          音声はグループ設定の「クレジット表記」、立ち絵はキャラクターの「素材クレジット」を参照します。
        </p>

        <label className="flex items-center gap-[11px] text-[13px] font-semibold text-fg mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={currentSceneOnly}
            onChange={e => setCurrentSceneOnly(e.target.checked)}
            className="ui-checkbox"
          />
          現在のシーンのみを対象にする
        </label>

        <div className="text-[11px] text-fg-sub mb-2">
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
          className="ui-input w-full font-mono text-[13px] leading-relaxed resize-y"
        />

        <div className="flex flex-wrap justify-end gap-2 mt-4">
          <button
            onClick={() => setCreditText(generateCreditText())}
            className={buttonClass('secondary')}
            title="編集内容を破棄して再生成"
          >
            <ArrowPathIcon className="size-4" />
            再生成
          </button>
          <button
            onClick={handleSave}
            disabled={!creditText.trim()}
            className={buttonClass('secondary')}
          >
            <ArrowDownTrayIcon className="size-4" />
            ファイル保存
          </button>
          <button
            onClick={handleCopy}
            disabled={!creditText.trim()}
            className={buttonClass('primary')}
          >
            <ClipboardDocumentIcon className="size-4" />
            コピー
          </button>
        </div>
    </div>
  );
}
