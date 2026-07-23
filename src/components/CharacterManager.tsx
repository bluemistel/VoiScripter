'use client';

import { useState, useEffect, useRef } from 'react';
import { Character, Emotion, EmotionSetting, UserPreset, MaterialCredit, GroupCredits } from '@/types';
import { PlusIcon, TrashIcon, PencilIcon, Cog6ToothIcon, ListBulletIcon, IdentificationIcon, FaceSmileIcon } from '@heroicons/react/24/outline';
import IconCropperDialog from '@/components/IconCropperDialog';
import StandingViewAdjustDialog from '@/components/StandingViewAdjustDialog';
import { generateStandingAssetId, saveStandingAsset, removeStandingAsset } from '@/utils/standingImageAssets';
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
import DialogFrame from '@/components/common/DialogFrame';

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
  groupCredits: GroupCredits;
  onSetGroupCredit: (group: string, credit: string) => void;
  onReorderCharacters?: (newOrder: Character[]) => void; // 並び替え用
  onReorderGroups?: (newOrder: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
  currentProjectId?: string; // 現在のプロジェクトID
  projectList: string[]; // プロジェクトリスト
  getCharacterProjectStates: (currentProjectId: string, projectList?: string[]) => {[characterId: string]: boolean};
  saveCharacterProjectStates: (currentProjectId: string, characterStates: {[characterId: string]: boolean}, projectList?: string[]) => void;
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

function SortablePreset({ preset, children, ...props }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: `preset-${preset.id}` });
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
  groupCredits,
  onSetGroupCredit,
  onReorderCharacters,
  onReorderGroups,
  isOpen,
  onClose,
  currentProjectId,
  projectList,
  getCharacterProjectStates,
  saveCharacterProjectStates
}: CharacterManagerProps) {
  // デバッグ用ログ
  //console.log('CharacterManager - received projectList:', projectList, 'type:', typeof projectList);
  
  const [isAdding, setIsAdding] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const [newCharacter, setNewCharacter] = useState<Partial<Character>>({
    name: '',
    group: 'なし',
    emotions: { ...emptyEmotions },
    disabledProjects: []
  });

  // 編集用
  const [editCharacter, setEditCharacter] = useState<Partial<Character> | null>(null);

  // ユーザープリセット設定ダイアログ
  const [isPresetSettingsOpen, setIsPresetSettingsOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // 素材クレジット設定ダイアログ
  const [isCreditSettingsOpen, setIsCreditSettingsOpen] = useState(false);

  // 表情差分設定ダイアログ（表情はユーザープリセットから選択して追加する）
  const [isEmotionSettingsOpen, setIsEmotionSettingsOpen] = useState(false);
  const [newEmotionPresetId, setNewEmotionPresetId] = useState('');

  // 立ち絵の表示調整ダイアログ（調整対象の表情）
  const [standingAdjustEmotion, setStandingAdjustEmotion] = useState<Emotion | null>(null);

  // アイコン切り抜きダイアログ（適用先はコールバックで指定）
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const cropperCallbackRef = useRef<((dataUrl: string) => void) | null>(null);
  const openCropper = (file: File, apply: (dataUrl: string) => void) => {
    cropperCallbackRef.current = apply;
    setCropperFile(file);
  };

  // カラーピッカー用の状態
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [tempBackgroundColor, setTempBackgroundColor] = useState<string>('#e5e7eb');
  
  // キャラクターのプロジェクト使用状況を管理
  const [characterProjectStates, setCharacterProjectStates] = useState<{[characterId: string]: boolean}>({});
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  // フォールバック用の関数を定義
  const fallbackGetCharacterProjectStates = (currentProjectId: string, projectList: string[]) => {
    const initialState: {[characterId: string]: boolean} = {};
    
    // projectListがundefinedの場合はデフォルトで全キャラクターを有効にする
    if (!projectList) {
      characters.forEach(char => {
        initialState[char.id] = true;
      });
      return initialState;
    }
    
    // 新規プロジェクトかどうかを判定
    const isNewProject = projectList.length === 0 || !projectList.includes(currentProjectId);
    
    characters.forEach(char => {
      if (isNewProject) {
        // 新規プロジェクトの場合はすべてON
        initialState[char.id] = true;
      } else {
        // 既存プロジェクトの場合はdisabledProjectsの設定に従う
        // disabledProjectsが空配列またはundefinedの場合は全プロジェクトで有効
        const isEnabled = !char.disabledProjects || char.disabledProjects.length === 0 || !char.disabledProjects.includes(currentProjectId);
        initialState[char.id] = isEnabled;
      }
    });
    
    return initialState;
  };

  // ダイアログが開かれた時またはプロジェクトが切り替わった時にキャラクターの現在の状態を初期化
  useEffect(() => {
    if (isOpen && currentProjectId) {
      // projectListがundefinedの場合は空配列を渡す
      const safeProjectList = projectList || [];
      
      // getCharacterProjectStatesが関数でない場合はフォールバック処理
      if (typeof getCharacterProjectStates !== 'function') {
        console.error('getCharacterProjectStates is not a function:', typeof getCharacterProjectStates);
        const initialState = fallbackGetCharacterProjectStates(currentProjectId, safeProjectList);
        setCharacterProjectStates(initialState);
        return;
      }
      
      const initialState = getCharacterProjectStates(currentProjectId, safeProjectList);
      setCharacterProjectStates(initialState);
      
    }
  }, [isOpen, currentProjectId, projectList, getCharacterProjectStates]);

  // ダイアログを閉じる処理（未保存の編集がある場合は確認を挟む）
  const handleClose = () => {
    guardUnsavedEdit(() => proceedClose());
  };

  const proceedClose = () => {
    if (currentProjectId) {
      // 無効にされたキャラクターがあるかチェック
      const disabledCharacters = characters.filter(char => {
        const wasEnabled = !char.disabledProjects || char.disabledProjects.length === 0 || !char.disabledProjects.includes(currentProjectId);
        const isNowDisabled = !characterProjectStates[char.id];
        return wasEnabled && isNowDisabled;
      });

      if (disabledCharacters.length > 0) {
        setShowCloseDialog(true);
        return;
      }
    }
    
    // 変更を保存してダイアログを閉じる
    saveCharacterStates();
    onClose();
  };

  // フォールバック用の保存関数を定義
  const fallbackSaveCharacterProjectStates = (currentProjectId: string, characterStates: {[characterId: string]: boolean}, projectList: string[]) => {
    // projectListがundefinedの場合は処理をスキップ
    if (!projectList) {
      //console.log('fallbackSaveCharacterProjectStates - projectList is undefined, skipping...');
      return;
    }
    
    // 新規プロジェクトかどうかを判定
    const isNewProject = projectList.length === 0 || !projectList.includes(currentProjectId);

    characters.forEach(char => {
      const isEnabled = characterStates[char.id];
      const disabledProjects = char.disabledProjects || [];
      
      if (isNewProject) {
        // 新規プロジェクトの場合はdisabledProjectsを更新
        if (!isEnabled && !disabledProjects.includes(currentProjectId)) {
          char.disabledProjects = [...disabledProjects, currentProjectId];
        } else if (isEnabled && disabledProjects.includes(currentProjectId)) {
          char.disabledProjects = disabledProjects.filter(id => id !== currentProjectId);
        }
      } else {
        // 既存プロジェクトの場合はdisabledProjectsを更新
        if (!isEnabled && !disabledProjects.includes(currentProjectId)) {
          char.disabledProjects = [...disabledProjects, currentProjectId];
        } else if (isEnabled && disabledProjects.includes(currentProjectId)) {
          char.disabledProjects = disabledProjects.filter(id => id !== currentProjectId);
        }
      }
      
      // キャラクターを更新
      onUpdateCharacter(char);
    });
  };

  // キャラクターの状態を保存
  const saveCharacterStates = () => {
    if (!currentProjectId) return;
    // projectListがundefinedの場合は空配列を渡す
    const safeProjectList = projectList || [];
    
    // saveCharacterProjectStatesが関数でない場合はフォールバック処理
    if (typeof saveCharacterProjectStates !== 'function') {
      console.error('saveCharacterProjectStates is not a function:', typeof saveCharacterProjectStates);
      fallbackSaveCharacterProjectStates(currentProjectId, characterProjectStates, safeProjectList);
      return;
    }
    
    saveCharacterProjectStates(currentProjectId, characterProjectStates, safeProjectList);
  };

  // 編集中キャラクターの感情設定を部分更新するヘルパー（他の感情を保持する）
  const setEditEmotion = (emotion: Emotion, patch: Partial<EmotionSetting>) => {
    setEditCharacter(prev => prev ? {
      ...prev,
      emotions: {
        ...(prev.emotions || { normal: { iconUrl: '' } }),
        [emotion]: { iconUrl: '', ...(prev.emotions?.[emotion] || {}), ...patch }
      }
    } : prev);
  };

  const removeEditEmotion = (emotion: Emotion) => {
    if (emotion === 'normal') return;
    setEditCharacter(prev => {
      if (!prev?.emotions) return prev;
      const assetId = prev.emotions[emotion]?.standingAssetId;
      if (assetId) void removeStandingAsset(assetId);
      const next = { ...prev.emotions };
      delete next[emotion];
      return { ...prev, emotions: next };
    });
  };

  // 立ち絵画像の登録（アセット保存し、参照IDだけをキャラ設定に持たせる）
  const handleStandingImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, emotion: Emotion) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const assetId = generateStandingAssetId();
      const ok = await saveStandingAsset(assetId, reader.result as string);
      if (!ok) return;
      const oldId = editCharacter?.emotions?.[emotion]?.standingAssetId;
      if (oldId) void removeStandingAsset(oldId);
      // 画像を差し替えたら表示調整はリセット
      setEditEmotion(emotion, { standingAssetId: assetId, standingView: undefined });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveStandingImage = (emotion: Emotion) => {
    const oldId = editCharacter?.emotions?.[emotion]?.standingAssetId;
    if (oldId) void removeStandingAsset(oldId);
    setEditEmotion(emotion, { standingAssetId: undefined, standingView: undefined });
  };

  // 画像ファイル選択 → 切り抜きダイアログ経由でDataURLを適用
  const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルの再選択を許可
    if (!file) return;
    openCropper(file, (dataUrl) => {
      if (isEdit) {
        setEditEmotion('normal', { iconUrl: dataUrl });
      } else {
        setNewCharacter(prev => ({
          ...prev,
          emotions: {
            ...(prev.emotions || {}),
            normal: { ...(prev.emotions?.normal || {}), iconUrl: dataUrl }
          }
        } as Partial<Character>));
      }
    });
  };

  // 表情差分用の画像ファイル選択
  const handleEmotionIconFileChange = (e: React.ChangeEvent<HTMLInputElement>, emotion: Emotion) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    openCropper(file, (dataUrl) => setEditEmotion(emotion, { iconUrl: dataUrl }));
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
        emotions: {
          ...(newCharacter.emotions || {}),
          normal: { iconUrl: newCharacter.emotions?.normal?.iconUrl || '' }
        },
        backgroundColor: '#e5e7eb' // デフォルトの背景色
      } as Character);
      setNewCharacter({ name: '', group: 'なし', emotions: { ...emptyEmotions } });
      setIsAdding(false);
    }
  };

  // 全項目が空なら undefined に正規化（データを汚さない）
  const normalizeMaterialCredit = (credit?: MaterialCredit): MaterialCredit | undefined => {
    if (!credit) return undefined;
    const normalized: MaterialCredit = {
      ...(credit.url?.trim() ? { url: credit.url.trim() } : {}),
      ...(credit.id?.trim() ? { id: credit.id.trim() } : {}),
      ...(credit.creator?.trim() ? { creator: credit.creator.trim() } : {}),
      ...(credit.memo?.trim() ? { memo: credit.memo.trim() } : {})
    };
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  };

  // 編集フォームの内容から保存形の Character を組み立てる（保存・変更検知で共用）
  const buildNormalizedCharacter = (source: Partial<Character>): Character => ({
    id: source.id!,
    name: source.name || '',
    group: source.group || 'なし',
    emotions: {
      ...(source.emotions || {}),
      normal: { ...(source.emotions?.normal || {}), iconUrl: source.emotions?.normal?.iconUrl || '' }
    },
    backgroundColor: source.backgroundColor || '#e5e7eb',
    disabledProjects: source.disabledProjects || [],
    userPresets: source.userPresets || [],
    materialCredit: normalizeMaterialCredit(source.materialCredit),
    chatSide: source.chatSide
  } as Character);

  // 編集中かつ未保存の変更があるか
  const isEditDirty = (): boolean => {
    if (!isEditingId || !editCharacter) return false;
    const original = characters.find(c => c.id === isEditingId);
    if (!original) return false;
    return JSON.stringify(buildNormalizedCharacter(editCharacter)) !== JSON.stringify(buildNormalizedCharacter(original));
  };

  // 編集状態のリセット（サブダイアログも閉じる）
  const resetEditState = () => {
    setIsEditingId(null);
    setEditCharacter(null);
    setIsPresetSettingsOpen(false);
    setIsCreditSettingsOpen(false);
    setIsEmotionSettingsOpen(false);
  };

  // 未保存の編集がある状態での操作をガードする。破棄/保存の確認後に action を実行
  const [unsavedAction, setUnsavedAction] = useState<(() => void) | null>(null);
  const guardUnsavedEdit = (action: () => void) => {
    if (isEditDirty()) {
      setUnsavedAction(() => action);
    } else {
      action();
    }
  };

  const saveEditCharacter = (): boolean => {
    if (!editCharacter || !editCharacter.name) return false;
    onUpdateCharacter(buildNormalizedCharacter(editCharacter));
    return true;
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saveEditCharacter()) {
      resetEditState();
    }
  };

  // プリセット並び替え
  const presetSensors = useSensors(useSensor(PointerSensor));
  const handlePresetDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const presets = editCharacter?.userPresets || [];
      const oldIndex = presets.findIndex(p => `preset-${p.id}` === active.id);
      const newIndex = presets.findIndex(p => `preset-${p.id}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newOrder = [...presets];
        const [removed] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, removed);
        setEditCharacter(prev => prev ? { ...prev, userPresets: newOrder } : prev);
      }
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
      // active.id と over.id は "${group}-${index}" の形式
      const oldIndex = parseInt(active.id.toString().split('-').pop() || '0');
      const newIndex = parseInt(over.id.toString().split('-').pop() || '0');
      
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newOrder = [...groups];
        const [removed] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, removed);
        onReorderGroups(newOrder);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <DialogFrame
      isOpen={isOpen}
      onCancel={handleClose}
      panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-sm sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
    >
        <div className="shrink-0 p-6 pb-4 border-b">
          <div className="flex justify-between items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground">キャラクター管理</h3>
            <div className="flex items-center gap-2">
              {currentProjectId && characters.length > 0 && (() => {
                // 「現在の台本で使用する」の一括チェック/解除
                const allChecked = characters.every(char => characterProjectStates[char.id]);
                return (
                  <button
                    onClick={() => {
                      const next: {[characterId: string]: boolean} = {};
                      characters.forEach(char => { next[char.id] = !allChecked; });
                      setCharacterProjectStates(next);
                    }}
                    className="px-2.5 py-1 text-xs border rounded text-foreground hover:bg-accent whitespace-nowrap"
                    title="「現在の台本で使用する」のチェックを一括で切り替えます"
                  >
                    使用チェックを{allChecked ? 'すべて外す' : 'すべて付ける'}
                  </button>
                );
              })()}
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground text-2xl"
                title="閉じる"
              >
                ×
              </button>
            </div>
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
                          <select
                            value={editCharacter?.chatSide || ''}
                            onChange={e => setEditCharacter(prev => ({
                              ...(prev ?? {}),
                              chatSide: (e.target.value || undefined) as Character['chatSide']
                            }))}
                            className="w-full p-2 border rounded bg-background text-foreground"
                            title="チャットビューでフキダシを表示するサイド"
                          >
                            <option value="">チャットビュー: 自動</option>
                            <option value="left">チャットビュー: 左</option>
                            <option value="right">チャットビュー: 右</option>
                          </select>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground shrink-0">パーソナルカラー</label>
                            <input
                              type="color"
                              value={editCharacter?.backgroundColor || '#e5e7eb'}
                              onChange={e => setEditCharacter(prev => ({
                                ...(prev ?? {}),
                                backgroundColor: e.target.value
                              }))}
                              className="w-9 h-7 border rounded cursor-pointer bg-background p-0.5"
                              title="フキダシテーマ・チャットビュー・アイコン未設定時の背景色に使用されます"
                            />
                            <span className="text-[10px] text-muted-foreground">フキダシテーマ・チャットビューの色に使用</span>
                          </div>
                          <div className="flex items-center space-x-2 mb-1">
                            <input
                              type="text"
                              value={editCharacter?.emotions?.normal?.iconUrl || ''}
                              onChange={e => setEditEmotion('normal', { iconUrl: e.target.value })}
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
                          <button
                            type="button"
                            onClick={() => setIsPresetSettingsOpen(true)}
                            className="w-full flex items-center justify-center space-x-2 p-2 border rounded hover:bg-muted/80 text-foreground text-sm"
                            style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}
                          >
                            <ListBulletIcon className="w-4 h-4" />
                            <span>ユーザープリセット設定</span>
                            <span className="text-xs text-muted-foreground">
                              ({(editCharacter?.userPresets || []).length}件)
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEmotionSettingsOpen(true)}
                            className="w-full flex items-center justify-center space-x-2 p-2 border rounded hover:bg-muted/80 text-foreground text-sm"
                            style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}
                          >
                            <FaceSmileIcon className="w-4 h-4" />
                            <span>表情差分設定</span>
                            <span className="text-xs text-muted-foreground">
                              ({Object.keys(editCharacter?.emotions || {}).filter(k => k !== 'normal').length}件)
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCreditSettingsOpen(true)}
                            className="w-full flex items-center justify-center space-x-2 p-2 border rounded hover:bg-muted/80 text-foreground text-sm"
                            style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}
                          >
                            <IdentificationIcon className="w-4 h-4" />
                            <span>素材クレジット設定</span>
                            {normalizeMaterialCredit(editCharacter?.materialCredit) && (
                              <span className="text-xs text-muted-foreground">(設定済み)</span>
                            )}
                          </button>
                          <div className="flex justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => { setIsEditingId(null); setEditCharacter(null); setIsPresetSettingsOpen(false); setIsCreditSettingsOpen(false); setIsEmotionSettingsOpen(false); }}
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
                              <div className="flex-1">
                                <h3 className="font-semibold text-foreground ">{character.name}</h3>
                                <p className="text-sm text-muted-foreground mt-1">グループ: {character.group || 'なし'}</p>
                                {currentProjectId && (
                                  <div className="flex items-center space-x-2 mt-2">
                                    <input
                                      type="checkbox"
                                      id={`project-enabled-${character.id}`}
                                      checked={characterProjectStates[character.id] || false}
                                      onChange={e => {
                                        setCharacterProjectStates(prev => ({
                                          ...prev,
                                          [character.id]: e.target.checked
                                        }));
                                      }}
                                      className="w-4 h-4 text-primary bg-background border-gray-300 rounded focus:ring-primary focus:ring-2"
                                    />
                                    <label htmlFor={`project-enabled-${character.id}`} className="text-xs text-foreground">
                                      現在の台本で使用する
                                    </label>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 ml-auto items-end">
                            <button onClick={() => {
                              guardUnsavedEdit(() => {
                                setIsEditingId(character.id);
                                setEditCharacter({ ...character });
                              });
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
      
      {/* グループ設定ダイアログ */}
      {isGroupSettingsOpen && (
        <DialogFrame
          isOpen={isGroupSettingsOpen}
          onCancel={() => setIsGroupSettingsOpen(false)}
          panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6"
          overlayClassName="bg-black/50"
        >
            <h3 className="text-lg font-semibold text-foreground mb-4">グループ設定</h3>
            
            {/* グループ追加 */}
            <div className="mb-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newGroup}
                  onChange={e => setNewGroup(e.target.value)}
                  placeholder="新しいグループ名"
                  className="flex-1 p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-transparent focus:outline-none"
                  autoFocus
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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-foreground truncate">{group}</span>
                            <button
                              onClick={() => onDeleteGroup(group)}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded shrink-0"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <input
                            type="text"
                            defaultValue={groupCredits[group] || ''}
                            onBlur={e => onSetGroupCredit(group, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            placeholder="クレジット表記（例: VOICEVOX:ずんだもん）"
                            className="w-full mt-1 p-1.5 text-xs border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-transparent focus:outline-none"
                            title="動画概要欄などに記載するクレジット表記。クレジット出力機能で使用します。"
                          />
                        </div>
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
        </DialogFrame>
      )}

      {/* ユーザープリセット設定ダイアログ */}
      {isPresetSettingsOpen && editCharacter && (
        <DialogFrame
          isOpen={isPresetSettingsOpen}
          onCancel={() => { setIsPresetSettingsOpen(false); setNewPresetName(''); }}
          panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6"
          overlayClassName="bg-black/50"
        >
            <h3 className="text-lg font-semibold text-foreground mb-1">ユーザープリセット設定</h3>
            <p className="text-xs text-muted-foreground mb-4">
              「{editCharacter.name}」のユーザープリセットを管理します。
            </p>

            {/* プリセット追加 */}
            <div className="mb-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = newPresetName.trim();
                      if (trimmed && !(editCharacter.userPresets || []).some(p => p.name === trimmed)) {
                        const newPreset: UserPreset = { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), name: trimmed };
                        setEditCharacter(prev => prev ? { ...prev, userPresets: [...(prev.userPresets || []), newPreset] } : prev);
                        setNewPresetName('');
                      }
                    }
                  }}
                  placeholder="新しいプリセット名"
                  className="flex-1 p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-transparent focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    const trimmed = newPresetName.trim();
                    if (trimmed && !(editCharacter.userPresets || []).some(p => p.name === trimmed)) {
                      const newPreset: UserPreset = { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), name: trimmed };
                      setEditCharacter(prev => prev ? { ...prev, userPresets: [...(prev.userPresets || []), newPreset] } : prev);
                      setNewPresetName('');
                    }
                  }}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  追加
                </button>
              </div>
            </div>

            {/* プリセット一覧 */}
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">プリセット一覧</h4>
              {(editCharacter.userPresets || []).length === 0 ? (
                <p className="text-muted-foreground text-sm">プリセットがありません</p>
              ) : (
                <DndContext sensors={presetSensors} collisionDetection={closestCenter} onDragEnd={handlePresetDragEnd}>
                  <SortableContext items={(editCharacter.userPresets || []).map(p => `preset-${p.id}`)} strategy={rectSortingStrategy}>
                    {(editCharacter.userPresets || []).map(preset => (
                      <SortablePreset key={preset.id} preset={preset}>
                        <span className="text-foreground flex-1">{preset.name}</span>
                        <button
                          onClick={() => {
                            setEditCharacter(prev => prev ? {
                              ...prev,
                              userPresets: (prev.userPresets || []).filter(p => p.id !== preset.id)
                            } : prev);
                          }}
                          className="p-1 text-destructive hover:bg-destructive/10 rounded ml-2"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </SortablePreset>
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => { setIsPresetSettingsOpen(false); setNewPresetName(''); }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                閉じる
              </button>
            </div>
        </DialogFrame>
      )}

      {/* 表情差分設定ダイアログ */}
      {isEmotionSettingsOpen && editCharacter && (
        <DialogFrame
          isOpen={isEmotionSettingsOpen}
          onCancel={() => { setIsEmotionSettingsOpen(false); setNewEmotionPresetId(''); }}
          panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto p-6"
          overlayClassName="bg-black/50"
        >
            <h3 className="text-lg font-semibold text-foreground mb-1">表情差分設定</h3>
            <p className="text-xs text-muted-foreground mb-4">
              「{editCharacter.name}」の表情差分を管理します。表情はユーザープリセット（音声の感情）から追加し、台本のブロックで表情を選ぶとフキダシのアイコンとプリセットが同時に切り替わります。<br />
              立ち絵を登録すると、立ち絵ステージ（設定でON）に表情連動で表示されます。
            </p>

            {/* 表情追加（ユーザープリセット＝音声の感情から選択。表情名はプリセット名と共通） */}
            <div className="mb-4">
              {(() => {
                const availablePresets = (editCharacter.userPresets || []).filter(
                  p => p.name !== 'normal' && !(editCharacter.emotions && p.name in editCharacter.emotions)
                );
                if ((editCharacter.userPresets || []).length === 0) {
                  return (
                    <p className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
                      表情はユーザープリセット（音声の感情）から追加します。先に「ユーザープリセット設定」からプリセットを登録してください。
                    </p>
                  );
                }
                return (
                  <div className="flex space-x-2">
                    <select
                      value={newEmotionPresetId}
                      onChange={e => setNewEmotionPresetId(e.target.value)}
                      className="flex-1 p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-transparent focus:outline-none"
                    >
                      <option value="">追加するプリセット（表情）を選択…</option>
                      {availablePresets.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const preset = availablePresets.find(p => p.id === newEmotionPresetId);
                        if (preset) {
                          setEditEmotion(preset.name, { iconUrl: '', userPresetId: preset.id });
                          setNewEmotionPresetId('');
                        }
                      }}
                      disabled={!newEmotionPresetId}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                    >
                      追加
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* 表情一覧 */}
            <div className="space-y-2">
              {['normal', ...Object.keys(editCharacter.emotions || {}).filter(k => k !== 'normal')].map(emotion => {
                const setting = editCharacter.emotions?.[emotion] || { iconUrl: '' };
                const isNormal = emotion === 'normal';
                return (
                  <div key={emotion} className="border rounded p-3 bg-muted/30">
                    <div className="flex items-center gap-3">
                      {setting.iconUrl ? (
                        <img src={setting.iconUrl} alt={emotion} className="w-12 h-12 rounded-full border object-cover shrink-0" />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-full border shrink-0 flex items-center justify-center text-[10px] text-muted-foreground"
                          style={{ backgroundColor: editCharacter.backgroundColor || '#e5e7eb' }}
                        >
                          未設定
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground text-sm">
                            {isNormal ? '標準（normal）' : emotion}
                          </span>
                          {!isNormal && (
                            <button
                              onClick={() => removeEditEmotion(emotion)}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded"
                              title="この表情を削除（使用中のブロックは標準アイコンで表示されます）"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="text"
                            value={setting.iconUrl}
                            onChange={e => setEditEmotion(emotion, { iconUrl: e.target.value })}
                            placeholder="アイコンURLまたは画像を選択"
                            className="flex-1 min-w-0 p-1.5 text-xs border rounded bg-background text-foreground"
                          />
                          <label className="cursor-pointer bg-primary text-primary-foreground px-2 py-1.5 rounded text-xs hover:bg-primary/90 transition-colors shrink-0">
                            画像を選択
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handleEmotionIconFileChange(e, emotion)}
                              className="hidden"
                            />
                          </label>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-muted-foreground shrink-0">立ち絵</span>
                          {setting.standingAssetId ? (
                            <>
                              <span className="text-xs text-foreground">登録済み</span>
                              <button
                                type="button"
                                onClick={() => setStandingAdjustEmotion(emotion)}
                                className="text-xs text-primary hover:underline"
                                title="立ち絵ステージでの見え方（ズーム・位置）を調整"
                              >
                                表示調整
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveStandingImage(emotion)}
                                className="text-xs text-destructive hover:underline"
                              >
                                削除
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">未登録</span>
                          )}
                          <label className="ml-auto cursor-pointer bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs hover:bg-secondary/90 transition-colors shrink-0">
                            画像を選択
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handleStandingImageFileChange(e, emotion)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              ※ 入力内容はキャラクター編集の「保存」を押すと確定されます。
            </p>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => { setIsEmotionSettingsOpen(false); setNewEmotionPresetId(''); }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                閉じる
              </button>
            </div>
        </DialogFrame>
      )}

      {/* 素材クレジット設定ダイアログ */}
      {isCreditSettingsOpen && editCharacter && (
        <DialogFrame
          isOpen={isCreditSettingsOpen}
          onCancel={() => setIsCreditSettingsOpen(false)}
          panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6"
          overlayClassName="bg-black/50"
        >
            <h3 className="text-lg font-semibold text-foreground mb-1">素材クレジット設定</h3>
            <p className="text-xs text-muted-foreground mb-4">
              「{editCharacter.name}」の立ち絵などの素材情報を記録します。クレジット出力や制作時の確認に使用できます。
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">制作者</label>
                <input
                  type="text"
                  value={editCharacter.materialCredit?.creator || ''}
                  onChange={e => setEditCharacter(prev => prev ? {
                    ...prev,
                    materialCredit: { ...(prev.materialCredit || {}), creator: e.target.value }
                  } : prev)}
                  placeholder="例: ○○様"
                  className="w-full p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-transparent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">素材ID</label>
                <input
                  type="text"
                  value={editCharacter.materialCredit?.id || ''}
                  onChange={e => setEditCharacter(prev => prev ? {
                    ...prev,
                    materialCredit: { ...(prev.materialCredit || {}), id: e.target.value }
                  } : prev)}
                  placeholder="例: im〜 / nc〜"
                  className="w-full p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-transparent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">URL</label>
                <input
                  type="text"
                  value={editCharacter.materialCredit?.url || ''}
                  onChange={e => setEditCharacter(prev => prev ? {
                    ...prev,
                    materialCredit: { ...(prev.materialCredit || {}), url: e.target.value }
                  } : prev)}
                  placeholder="素材の配布ページURL"
                  className="w-full p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-transparent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">メモ（クレジット出力には含まれません）</label>
                <textarea
                  value={editCharacter.materialCredit?.memo || ''}
                  onChange={e => setEditCharacter(prev => prev ? {
                    ...prev,
                    materialCredit: { ...(prev.materialCredit || {}), memo: e.target.value }
                  } : prev)}
                  placeholder="例: 利用規約は改変OK・クレジット必須"
                  rows={3}
                  className="w-full p-2 border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-transparent focus:outline-none resize-none"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              ※ 入力内容はキャラクター編集の「保存」を押すと確定されます。
            </p>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setIsCreditSettingsOpen(false)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                閉じる
              </button>
            </div>
        </DialogFrame>
      )}

      {/* カラーピッカーダイアログ */}
      {showColorPicker && (
        <DialogFrame
          isOpen={!!showColorPicker}
          onCancel={() => setShowColorPicker(null)}
          panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-sm mx-4 p-6"
          overlayClassName="bg-black/50"
        >
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
        </DialogFrame>
      )}
      
      {/* 確認ダイアログ */}
      {showCloseDialog && (
        <DialogFrame
          isOpen={showCloseDialog}
          onCancel={() => setShowCloseDialog(false)}
          panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6"
        >
            <h3 className="text-lg font-semibold text-foreground mb-4">確認</h3>
            <p className="mb-4 text-foreground">
              ・編集中の台本で使用しないキャラクターをプルダウンから非表示にします。<br />
              ・非表示にするキャラクターのセリフはそのまま残ります。不要な場合はセリフを削除してください。
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCloseDialog(false)}
                className="px-4 py-2 text-muted-foreground hover:bg-accent rounded"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  saveCharacterStates();
                  setShowCloseDialog(false);
                  onClose();
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-semibold"
              >
                OK
              </button>
            </div>
        </DialogFrame>
      )}

      {/* 未保存の編集確認ダイアログ */}
      {unsavedAction && (
        <DialogFrame
          isOpen={!!unsavedAction}
          onCancel={() => setUnsavedAction(null)}
          panelClassName="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6"
          overlayClassName="bg-black/50"
        >
            <h3 className="text-lg font-semibold text-foreground mb-3">編集中の情報があります</h3>
            <p className="text-sm text-foreground mb-4">
              キャラクターの編集内容がまだ保存されていません。<br />
              保存せずに続行すると変更内容は破棄されます。
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setUnsavedAction(null)}
                className="px-4 py-2 text-muted-foreground hover:bg-accent rounded"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  const action = unsavedAction;
                  setUnsavedAction(null);
                  resetEditState();
                  action();
                }}
                className="px-4 py-2 border rounded text-destructive hover:bg-destructive/10"
              >
                破棄して続行
              </button>
              <button
                onClick={() => {
                  if (!saveEditCharacter()) return;
                  const action = unsavedAction;
                  setUnsavedAction(null);
                  resetEditState();
                  action();
                }}
                disabled={!editCharacter?.name}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-semibold disabled:opacity-50"
              >
                保存して続行
              </button>
            </div>
        </DialogFrame>
      )}

      {/* 立ち絵の表示調整ダイアログ */}
      {standingAdjustEmotion && editCharacter && (
        <StandingViewAdjustDialog
          isOpen={!!standingAdjustEmotion}
          assetId={editCharacter.emotions?.[standingAdjustEmotion]?.standingAssetId || null}
          initialView={editCharacter.emotions?.[standingAdjustEmotion]?.standingView}
          characterName={editCharacter.name || ''}
          emotionLabel={standingAdjustEmotion === 'normal' ? '標準' : standingAdjustEmotion}
          onCancel={() => setStandingAdjustEmotion(null)}
          onApply={(view) => {
            setEditEmotion(standingAdjustEmotion, { standingView: view });
            setStandingAdjustEmotion(null);
          }}
        />
      )}

      {/* アイコン切り抜きダイアログ */}
      <IconCropperDialog
        isOpen={!!cropperFile}
        file={cropperFile}
        onCancel={() => setCropperFile(null)}
        onApply={(dataUrl) => {
          cropperCallbackRef.current?.(dataUrl);
          cropperCallbackRef.current = null;
          setCropperFile(null);
        }}
      />
    </DialogFrame>
  );
}