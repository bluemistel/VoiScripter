'use client';

import { Character } from '@/types';

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
        className="w-10 h-10 rounded-full object-cover border shrink-0"
      />
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0"
      style={{ backgroundColor: character.backgroundColor || '#e5e7eb' }}
    >
      {character.name?.slice(0, 2) || '?'}
    </div>
  );
}
