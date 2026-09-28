'use client';

import { Character } from '@/types';
import { nameBadgeText } from '@/utils/colorUtils';

interface CharacterGridAvatarProps {
  character: Character;
}

/** 話者選択グリッドで使う丸アイコン（アイコン未設定時はパーソナルカラー＋頭2文字） */
export default function CharacterGridAvatar({ character }: CharacterGridAvatarProps) {
  const iconUrl = character.emotions.normal?.iconUrl;
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={character.name}
        className="size-10 rounded-full object-cover ring-1 ring-hairline shrink-0"
      />
    );
  }
  const color = character.backgroundColor || '#e5e7eb';
  return (
    <div
      className="size-10 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
      style={{ backgroundColor: color, color: nameBadgeText(color) }}
    >
      {character.name?.slice(0, 2) || '?'}
    </div>
  );
}
