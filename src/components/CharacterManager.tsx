'use client';

import { useState } from 'react';
import { Character, Emotion } from '@/types';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';

const defaultEmotions: Emotion[] = ['normal'];
const allEmotions: Emotion[] = ['normal', 'happy', 'sad', 'angry', 'surprised'];

const emptyEmotions = {
  happy: { iconUrl: '' },
  sad: { iconUrl: '' },
  angry: { iconUrl: '' },
  normal: { iconUrl: '' },
  surprised: { iconUrl: '' }
};

interface CharacterManagerProps {
  characters: Character[];
  onAddCharacter: (character: Character) => void;
  onUpdateCharacter: (character: Character) => void;
  onDeleteCharacter: (id: string) => void;
}

export default function CharacterManager({
  characters,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter
}: CharacterManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [newCharacter, setNewCharacter] = useState<Partial<Character>>({
    name: '',
    emotions: { ...emptyEmotions }
  });
  const [emotionList, setEmotionList] = useState<Emotion[]>([...defaultEmotions]);

  // 編集用
  const [editCharacter, setEditCharacter] = useState<Partial<Character> | null>(null);
  const [editEmotionList, setEditEmotionList] = useState<Emotion[]>([...defaultEmotions]);

  const handleAddEmotion = (emotion: Emotion, isEdit = false) => {
    if (isEdit) {
      if (editEmotionList && !editEmotionList.includes(emotion)) setEditEmotionList([...editEmotionList, emotion]);
    } else {
      if (!emotionList.includes(emotion)) setEmotionList([...emotionList, emotion]);
    }
  };
  const handleRemoveEmotion = (emotion: Emotion, isEdit = false) => {
    if (emotion !== 'normal') {
      if (isEdit) setEditEmotionList(editEmotionList.filter(e => e !== emotion));
      else setEmotionList(emotionList.filter(e => e !== emotion));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCharacter.name && newCharacter.emotions?.normal?.iconUrl) {
      const emotions: any = {};
      for (const emo of emotionList) {
        emotions[emo] = { iconUrl: newCharacter.emotions?.[emo]?.iconUrl || '' };
      }
      onAddCharacter({
        id: Date.now().toString(),
        name: newCharacter.name,
        emotions: { ...emptyEmotions, ...emotions }
      } as Character);
      setNewCharacter({ name: '', emotions: { ...emptyEmotions } });
      setEmotionList([...defaultEmotions]);
      setIsAdding(false);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editCharacter && editCharacter.name && editCharacter.emotions?.normal?.iconUrl) {
      const emotions: any = {};
      for (const emo of editEmotionList) {
        emotions[emo] = { iconUrl: editCharacter.emotions?.[emo]?.iconUrl || '' };
      }
      onUpdateCharacter({
        id: editCharacter.id!,
        name: editCharacter.name,
        emotions: { ...emptyEmotions, ...emotions }
      } as Character);
      setIsEditingId(null);
      setEditCharacter(null);
      setEditEmotionList([...defaultEmotions]);
    }
  };

  return (
      <div className="space-y-4">
        {characters.map(character => (
          <div key={character.id} className="border rounded p-3 flex items-center justify-between bg-background">
            {isEditingId === character.id ? (
              <form onSubmit={handleEditSubmit} className="flex-1 space-y-2">
                <input
                  type="text"
                  value={editCharacter?.name || ''}
                  onChange={e => setEditCharacter(prev => ({
                    ...(prev ?? {}),
                    name: e.target.value
                  }))}
                  placeholder="キャラクター名"
                  className="w-full p-2 border rounded bg-background text-foreground"
                  required
                />
                {editEmotionList.map(emotion => (
                  <div key={emotion} className="flex items-center space-x-2 mb-1">
                    <input
                      type="text"
                      value={editCharacter?.emotions?.[emotion]?.iconUrl || ''}
                      onChange={e => setEditCharacter(prev => ({
                        ...(prev ?? {}),
                        emotions: {
                          ...((prev && prev.emotions) ? prev.emotions : {}),
                          [emotion]: { iconUrl: e.target.value }
                        }
                      } as Partial<Character>))}
                      placeholder={`${emotion}のアイコンURL`}
                      className="flex-1 p-2 border rounded bg-background text-foreground"
                      required={emotion === 'normal'}
                    />
                    {emotion !== 'normal' && (
                      <button type="button" onClick={() => handleRemoveEmotion(emotion, true)} className="text-destructive">×</button>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 mb-2">
                  {allEmotions.filter(e => !editEmotionList.includes(e)).map(emotion => (
                    <button key={emotion} type="button" onClick={() => handleAddEmotion(emotion, true)} className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs">
                      {emotion}を追加
                    </button>
                  ))}
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => { setIsEditingId(null); setEditCharacter(null); setEditEmotionList([...defaultEmotions]); }}
                    className="px-3 py-1 text-sm text-muted-foreground hover:bg-accent rounded"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    保存
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold text-foreground">{character.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(character.emotions).map(([emotion, { iconUrl }]) => (
                      <div key={emotion} className="flex items-center space-x-1">
                        <img src={iconUrl} alt={emotion} className="w-8 h-8 rounded-full border" />
                        <span className="text-xs capitalize text-foreground">{emotion}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => {
                    setIsEditingId(character.id);
                    setEditCharacter({ ...character });
                    setEditEmotionList(Object.keys(character.emotions) as Emotion[]);
                  }} className="p-2 text-destructive hover:bg-destructive/10 rounded flex items-center">
                    <PencilIcon className="w-5 h-5" />
                    <span className="ml-1 text-xs">編集</span>
                  </button>
                  <button onClick={() => onDeleteCharacter(character.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded flex items-center">
                    <TrashIcon className="w-5 h-5" />
                    <span className="ml-1 text-xs">削除</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {isAdding ? (
          <form onSubmit={handleSubmit} className="border rounded p-3 space-y-3 bg-background">
            <input
              type="text"
              value={newCharacter.name}
              onChange={e => setNewCharacter(prev => ({ ...prev, name: e.target.value }))}
              placeholder="キャラクター名"
              className="w-full p-2 border rounded bg-background text-foreground"
              required
            />
            {emotionList.map(emotion => (
              <div key={emotion} className="flex items-center space-x-2 mb-1">
                <input
                  type="text"
                  value={newCharacter.emotions?.[emotion]?.iconUrl || ''}
                  onChange={e => setNewCharacter(prev => ({
                    ...prev,
                    emotions: {
                      ...(prev?.emotions ?? {}),
                      [emotion]: { iconUrl: e.target.value }
                    }
                  } as Partial<Character>))}
                  placeholder={`${emotion}のアイコンURL`}
                  className="flex-1 p-2 border rounded bg-background text-foreground"
                  required={emotion === 'normal'}
                />
                {emotion !== 'normal' && (
                  <button type="button" onClick={() => handleRemoveEmotion(emotion)} className="text-destructive">×</button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2 mb-2">
              {allEmotions.filter(e => !emotionList.includes(e)).map(emotion => (
                <button key={emotion} type="button" onClick={() => handleAddEmotion(emotion)} className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs">
                  {emotion}を追加
                </button>
              ))}
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1 text-sm text-muted-foreground hover:bg-accent rounded"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                追加
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center space-x-2 p-2 border rounded hover:bg-accent text-foreground"
          >
            <PlusIcon className="w-5 h-5" />
            <span>キャラクターを追加</span>
          </button>
        )}
      </div>
  );
}