'use client';

import { useState } from 'react';
import { Character, Emotion } from '@/types';
import { PlusIcon, TrashIcon, PencilIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

const defaultEmotions: Emotion[] = ['normal'];

const emptyEmotions = {
  normal: { iconUrl: '' }
};

interface CharacterManagerProps {
  characters: Character[];
  onAddCharacter: (character: Character) => void;
  onUpdateCharacter: (character: Character) => void;
  onDeleteCharacter: (id: string) => void;
  groups: string[];
  onAddGroup: (group: string) => void;
  onDeleteGroup: (group: string) => void;
}

export default function CharacterManager({
  characters,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  groups,
  onAddGroup,
  onDeleteGroup
}: CharacterManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const [newCharacter, setNewCharacter] = useState<Partial<Character>>({
    name: '',
    group: 'なし',
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
        group: newCharacter.group || 'なし',
        emotions: { normal: { iconUrl: newCharacter.emotions.normal.iconUrl } }
      } as Character);
      setNewCharacter({ name: '', group: 'なし', emotions: { ...emptyEmotions } });
      setIsAdding(false);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editCharacter && editCharacter.name && editCharacter.emotions?.normal?.iconUrl) {
      onUpdateCharacter({
        id: editCharacter.id!,
        name: editCharacter.name,
        group: editCharacter.group || 'なし',
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
                <select
                  value={editCharacter?.group || 'なし'}
                  onChange={e => setEditCharacter(prev => ({
                    ...(prev ?? {}),
                    group: e.target.value
                  }))}
                  className="w-full p-2 border rounded bg-background text-foreground"
                >
                  <option value="なし">なし</option>
                  {groups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
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
                    <div>
                      <h3 className="font-semibold text-foreground">{character.name}</h3>
                      <p className="text-sm text-muted-foreground">グループ: {character.group || 'なし'}</p>
                    </div>
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
            <select
              value={newCharacter.group || 'なし'}
              onChange={e => setNewCharacter(prev => ({ ...prev, group: e.target.value }))}
              className="w-full p-2 border rounded bg-background text-foreground"
            >
              <option value="なし">なし</option>
              {groups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
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
          <div className="flex space-x-2">
            <button
              onClick={() => setIsGroupSettingsOpen(true)}
              className="flex-1 flex items-center justify-center space-x-2 p-2 border rounded hover:bg-accent text-foreground"
              style={{ flex: '0 0 33.333%' }}
            >
              <Cog6ToothIcon className="w-4 h-4" />
              <span className="text-xs">グループ設定</span>
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="flex-1 flex items-center justify-center space-x-2 p-2 border rounded hover:bg-accent text-foreground"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              <PlusIcon className="w-5 h-5" />
              <span>キャラクターを追加</span>
            </button>
          </div>
        )}
      
      {/* グループ設定ダイアログ */}
      {isGroupSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">グループ設定</h3>
            
            {/* グループ追加 */}
            <div className="mb-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newGroup}
                  onChange={e => setNewGroup(e.target.value)}
                  placeholder="新しいグループ名"
                  className="flex-1 p-2 border rounded bg-background text-foreground"
                />
                <button
                  onClick={() => {
                    if (newGroup.trim() && !groups.includes(newGroup.trim())) {
                      onAddGroup(newGroup.trim());
                      setNewGroup('');
                    }
                  }}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  追加
                </button>
              </div>
            </div>
            
            {/* グループ一覧 */}
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">既存のグループ</h4>
              {groups.length === 0 ? (
                <p className="text-muted-foreground text-sm">グループがありません</p>
              ) : (
                groups.map(group => (
                  <div key={group} className="flex items-center justify-between p-2 border rounded bg-muted/30">
                    <span className="text-foreground">{group}</span>
                    <button
                      onClick={() => onDeleteGroup(group)}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setIsGroupSettingsOpen(false)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}