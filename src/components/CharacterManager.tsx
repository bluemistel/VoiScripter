'use client';

import { useState } from 'react';
import { Character, Emotion } from '@/types';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';

const defaultEmotions: Emotion[] = ['normal'];

const emptyEmotions = {
  normal: { iconUrl: '' }
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

  // 編集用
  const [editCharacter, setEditCharacter] = useState<Partial<Character> | null>(null);

  // 画像ファイル→DataURL変換
  const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (isEdit) {
        setEditCharacter(prev => ({
          ...(prev ?? {}),
          emotions: {
            normal: { iconUrl: reader.result as string }
          }
        } as Partial<Character>));
      } else {
        setNewCharacter(prev => ({
          ...prev,
          emotions: {
            normal: { iconUrl: reader.result as string }
          }
        } as Partial<Character>));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCharacter.name && newCharacter.emotions?.normal?.iconUrl) {
      onAddCharacter({
        id: Date.now().toString(),
        name: newCharacter.name,
        emotions: { normal: { iconUrl: newCharacter.emotions.normal.iconUrl } }
      } as Character);
      setNewCharacter({ name: '', emotions: { ...emptyEmotions } });
      setIsAdding(false);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editCharacter && editCharacter.name && editCharacter.emotions?.normal?.iconUrl) {
      onUpdateCharacter({
        id: editCharacter.id!,
        name: editCharacter.name,
        emotions: { normal: { iconUrl: editCharacter.emotions.normal.iconUrl } }
      } as Character);
      setIsEditingId(null);
      setEditCharacter(null);
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
                <div className="flex items-center space-x-2 mb-1">
                  <input
                    type="text"
                    value={editCharacter?.emotions?.normal?.iconUrl || ''}
                    onChange={e => setEditCharacter(prev => ({
                      ...(prev ?? {}),
                      emotions: {
                        normal: { iconUrl: e.target.value }
                      }
                    } as Partial<Character>))}
                    placeholder="アイコンURLまたは画像を選択"
                    className="flex-1 p-2 border rounded bg-background text-foreground"
                    required
                  />
                  <label className="cursor-pointer bg-primary text-primary-foreground px-3 py-1 rounded text-xs hover:bg-primary/90 transition-colors">
                    ファイルを選択
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleIconFileChange(e, true)}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => { setIsEditingId(null); setEditCharacter(null); }}
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
                  <div className="flex flex-wrap gap-2 md:mt-0">
                    <div className="flex items-center space-x-1">
                      <img src={character.emotions.normal.iconUrl} alt={character.name} className="w-14 h-14 rounded-full border" />
                    </div>
                    <h3 className="font-semibold text-foreground flex items-center justify-center">{character.name}</h3>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => {
                    setIsEditingId(character.id);
                    setEditCharacter({ ...character });
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
            <div className="flex items-center space-x-2 mb-1">
              <input
                type="text"
                value={newCharacter.emotions?.normal?.iconUrl || ''}
                onChange={e => setNewCharacter(prev => ({
                  ...prev,
                  emotions: {
                    normal: { iconUrl: e.target.value }
                  }
                } as Partial<Character>))}
                placeholder="アイコンURLまたは画像を選択"
                className="flex-1 p-2 border rounded text-foreground"
                required
              />
              <label className="cursor-pointer bg-primary text-primary-foreground px-3 py-1 rounded text-xs hover:bg-primary/90 transition-colors">
                ファイルを選択
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => handleIconFileChange(e, false)}
                  className="hidden"
                />
              </label>
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