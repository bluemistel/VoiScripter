'use client';

import { useState } from 'react';
import { Character, Emotion } from '@/types';
import { PlusIcon, TrashIcon, PencilIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  onReorderCharacters?: (newOrder: Character[]) => void; // 並び替え用
  onReorderGroups?: (newOrder: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

function SortableCharacter({ character, isEditing, children, ...props }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: character.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };
  return (
    <div ref={setNodeRef} style={style} className="border rounded p-3 flex items-center justify-items-start bg-background">
      <div {...attributes} {...listeners} className="cursor-grab mr-2 select-none">
        <svg width="20" height="20" fill="none"><rect width="4" height="4" x="2" y="2" rx="1" fill="#888"/><rect width="4" height="4" x="2" y="10" rx="1" fill="#888"/><rect width="4" height="4" x="10" y="2" rx="1" fill="#888"/><rect width="4" height="4" x="10" y="10" rx="1" fill="#888"/></svg>
      </div>
      {children}
    </div>
  );
}

function SortableGroup({ group, children, ...props }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: `${group}-${props.index || 0}` });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-2 border rounded bg-muted/30 mb-1">
      <div {...attributes} {...listeners} className="cursor-grab mr-2 select-none">
        <svg width="16" height="16" fill="none"><rect width="3" height="3" x="1" y="1" rx="1" fill="#888"/><rect width="3" height="3" x="1" y="7" rx="1" fill="#888"/><rect width="3" height="3" x="7" y="1" rx="1" fill="#888"/><rect width="3" height="3" x="7" y="7" rx="1" fill="#888"/></svg>
      </div>
      {children}
    </div>
  );
}

export default function CharacterManager({
  characters,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  groups,
  onAddGroup,
  onDeleteGroup,
  onReorderCharacters,
  onReorderGroups,
  isOpen,
  onClose
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

  // カラーピッカー用の状態
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [tempBackgroundColor, setTempBackgroundColor] = useState<string>('#e5e7eb');

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

  // カラーピッカーで背景色を変更
  const handleBackgroundColorChange = (characterId: string, color: string) => {
    const character = characters.find(c => c.id === characterId);
    if (character) {
      const updatedCharacter = {
        ...character,
        backgroundColor: color
      };
      onUpdateCharacter(updatedCharacter);
    }
  };

  // カラーピッカーを開く
  const openColorPicker = (characterId: string, currentColor: string = '#e5e7eb') => {
    setShowColorPicker(characterId);
    setTempBackgroundColor(currentColor);
  };

  // カラーピッカーを閉じる
  const closeColorPicker = () => {
    if (showColorPicker) {
      handleBackgroundColorChange(showColorPicker, tempBackgroundColor);
      setShowColorPicker(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCharacter.name) {
      onAddCharacter({
        id: Date.now().toString(),
        name: newCharacter.name,
        group: newCharacter.group || 'なし',
        emotions: { normal: { iconUrl: newCharacter.emotions?.normal?.iconUrl || '' } },
        backgroundColor: '#e5e7eb' // デフォルトの背景色
      } as Character);
      setNewCharacter({ name: '', group: 'なし', emotions: { ...emptyEmotions } });
      setIsAdding(false);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editCharacter && editCharacter.name) {
      onUpdateCharacter({
        id: editCharacter.id!,
        name: editCharacter.name,
        group: editCharacter.group || 'なし',
        emotions: { normal: { iconUrl: editCharacter.emotions?.normal?.iconUrl || '' } },
        backgroundColor: editCharacter.backgroundColor || '#e5e7eb'
      } as Character);
      setIsEditingId(null);
      setEditCharacter(null);
    }
  };

  const sensors = useSensors(useSensor(PointerSensor));
  const handleDragEnd = (event: DragEndEvent) => {
    if (!onReorderCharacters) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = characters.findIndex(c => c.id === active.id);
      const newIndex = characters.findIndex(c => c.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...characters];
        const [removed] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, removed);
        onReorderCharacters(newOrder);
      }
    }
  };

  // グループ並び替え用
  const groupSensors = useSensors(useSensor(PointerSensor));
  const handleGroupDragEnd = (event: DragEndEvent) => {
    if (!onReorderGroups) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = groups.findIndex(g => g === active.id);
      const newIndex = groups.findIndex(g => g === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = [...groups];
        const [removed] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, removed);
        onReorderGroups(newOrder);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex-shrink-0 p-6 pb-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-foreground">キャラクター管理</h3>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-2xl"
              title="閉じる"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* キャラクター一覧を2段組グリッドで表示＋ドラッグ＆ドロップ */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={characters.map(c => c.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {characters.map(character => (
                    <SortableCharacter key={character.id} character={character} isEditing={isEditingId === character.id}>
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
                                {character.emotions.normal.iconUrl ? (
                                  <img src={character.emotions.normal.iconUrl} alt={character.name} className="w-14 h-14 rounded-full border object-cover" />
                                ) : (
                                  <div 
                                    className="relative w-14 h-14 rounded-full border flex items-center justify-center text-center overflow-hidden group"
                                    style={{ backgroundColor: character.backgroundColor || '#e5e7eb' }}
                                  >
                                    <span 
                                      className={`text-xs font-bold text-foreground px-1 max-w-[80px] whitespace-no-wrap overflow-hidden${character.name.length > 8 ? ' text-ellipsis' : ''}`}
                                      style={{
                                        textShadow: `
                                          -1px -1px 0 var(--color-background),  
                                           1px -1px 0 var(--color-background),
                                          -1px  1px 0 var(--color-background),
                                           1px  1px 0 var(--color-background)
                                        `
                                      }}
                                    >
                                      {character.name.length > 8 ? character.name.slice(0, 8) + '…' : character.name}
                                    </span>
                                    {/* ペンアイコン（hover時のみ表示） */}
                                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <button
                                        onClick={() => openColorPicker(character.id, character.backgroundColor || '#e5e7eb')}
                                        className="p-1 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                                      >
                                        <PencilIcon className="w-3 h-3 text-gray-700" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div>
                                <h3 className="font-semibold text-foreground ">{character.name}</h3>
                                <p className="text-sm text-muted-foreground mt-1">グループ: {character.group || 'なし'}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 ml-auto items-end">
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
                    </SortableCharacter>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
                  className="flex-1 flex items-center justify-center space-x-2 p-2 border rounded hover:bg-muted/80 text-foreground"
                  style={{ flex: '0 0 33.333%', backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}
                >
                  <Cog6ToothIcon className="w-4 h-4" />
                  <span>グループ設定</span>
                </button>
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex-1 flex items-center justify-center space-x-2 p-2 border rounded hover:bg-primary/80 text-foreground"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>キャラクターを追加</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
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
                <DndContext sensors={groupSensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
                  <SortableContext items={groups.map((group, index) => `${group}-${index}`)} strategy={rectSortingStrategy}>
                    {groups.map((group, index) => (
                      <SortableGroup key={`${group}-${index}`} group={group} index={index}>
                        <span className="text-foreground">{group}</span>
                        <button
                          onClick={() => onDeleteGroup(group)}
                          className="p-1 text-destructive hover:bg-destructive/10 rounded"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </SortableGroup>
                    ))}
                  </SortableContext>
                </DndContext>
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

      {/* カラーピッカーダイアログ */}
      {showColorPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">背景色を選択</h3>
            <div className="flex flex-col items-center space-y-4">
              <input
                type="color"
                value={tempBackgroundColor}
                onChange={(e) => setTempBackgroundColor(e.target.value)}
                className="w-32 h-32 cursor-pointer"
              />
              <div className="flex space-x-2">
                <button
                  onClick={closeColorPicker}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  適用
                </button>
                <button
                  onClick={() => setShowColorPicker(null)}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded hover:bg-muted/80"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}