'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Character, Emotion, EmotionSetting, UserPreset, MaterialCredit, GroupCredits } from '@/types';
import { PlusIcon, TrashIcon, PencilIcon, PencilSquareIcon, Cog6ToothIcon, ListBulletIcon, IdentificationIcon, FaceSmileIcon, UsersIcon, SwatchIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
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
import DialogHeader from '@/components/common/DialogHeader';
import TabBar from '@/components/common/TabBar';
import Button, { buttonClass } from '@/components/common/Button';
import { nameBadgeText } from '@/utils/colorUtils';

const defaultEmotions: Emotion[] = ['normal'];

/** グループタブ: 全キャラクターを表示する既定タブ */
const ALL_GROUP_TAB = '__all__';
/** グループ未設定（または削除済みグループ）のキャラクターをまとめるタブ */
const NO_GROUP = 'なし';

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
  /** グループ名の変更。重複などで変更できなければ false */
  onRenameGroup?: (oldName: string, newName: string) => boolean;
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

/** 並び替え用のグリップ（2列×3行のドット） */
function GripDots() {
  return (
    <span className="grid grid-cols-2 gap-[3px] p-1" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="size-[3px] rounded-full bg-fg-faint" />
      ))}
    </span>
  );
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
    <div ref={setNodeRef} style={style} className={`rounded-2xl p-3 flex items-center justify-items-start ${isEditing ? 'bg-panel shadow-[inset_0_0_0_1.5px_var(--color-hairline)]' : 'bg-well'}`}>
      <div {...attributes} {...listeners} className="cursor-grab mr-2 select-none self-start mt-1">
        <GripDots />
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
    <div ref={setNodeRef} style={style} className="flex items-center justify-between px-[13px] py-[9px] rounded-2xl bg-well mb-2">
      <div {...attributes} {...listeners} className="cursor-grab mr-2 select-none">
        <GripDots />
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
    <div ref={setNodeRef} style={style} className="flex items-start px-[13px] py-[11px] rounded-2xl bg-well mb-2">
      <div {...attributes} {...listeners} className="cursor-grab mr-2 mt-1 select-none">
        <GripDots />
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
  onRenameGroup,
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
  // グループ名の編集中の対象と入力値（null のときは編集していない）
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [groupRenameError, setGroupRenameError] = useState('');
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

  // グループタブ（既定は「全て」）
  const [activeGroupTab, setActiveGroupTab] = useState<string>(ALL_GROUP_TAB);

  // キャラクターの所属グループ。未設定・削除済みグループは「なし」に寄せる
  const resolveGroup = (character: Character) =>
    character.group && groups.includes(character.group) ? character.group : NO_GROUP;

  // タブ構成: 全て → グループ設定の並び順 →（該当キャラがいれば）なし
  const groupTabs = useMemo(() => {
    const tabs = [ALL_GROUP_TAB, ...groups];
    if (characters.some(c => resolveGroup(c) === NO_GROUP)) tabs.push(NO_GROUP);
    return tabs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, characters]);

  // 現在のタブに表示するキャラクター
  const visibleCharacters = useMemo(
    () => activeGroupTab === ALL_GROUP_TAB
      ? characters
      : characters.filter(c => resolveGroup(c) === activeGroupTab),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeGroupTab, characters, groups]
  );

  // グループ削除などでタブが消えた場合は「全て」へ戻す
  useEffect(() => {
    if (!groupTabs.includes(activeGroupTab)) setActiveGroupTab(ALL_GROUP_TAB);
  }, [groupTabs, activeGroupTab]);

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
      panelClassName="w-full max-w-sm sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
    >
        <DialogHeader
          icon={UsersIcon}
          title="キャラクター管理"
          onClose={handleClose}
          className="shrink-0"
          actions={<>
              {currentProjectId && visibleCharacters.length > 0 && (() => {
                // 「現在の台本で使用する」の一括チェック/解除（表示中のタブのキャラクターが対象）
                const allChecked = visibleCharacters.every(char => characterProjectStates[char.id]);
                return (
                  <button
                    onClick={() => {
                      setCharacterProjectStates(prev => {
                        const next = { ...prev };
                        visibleCharacters.forEach(char => { next[char.id] = !allChecked; });
                        return next;
                      });
                    }}
                    className={buttonClass('secondary', 'sm')}
                    title={activeGroupTab === ALL_GROUP_TAB
                      ? '「現在の台本で使用する」のチェックを一括で切り替えます'
                      : `グループ「${activeGroupTab}」のキャラクターだけを一括で切り替えます`}
                  >
                    使用チェックを{allChecked ? 'すべて外す' : 'すべて付ける'}
                  </button>
                );
              })()}
          </>}
        />

        {/* グループタブ（全て＋グループ設定） */}
        {groupTabs.length > 1 && (
          <TabBar
            items={groupTabs.map(tab => {
              const count = tab === ALL_GROUP_TAB
                ? characters.length
                : characters.filter(c => resolveGroup(c) === tab).length;
              return {
                id: tab,
                label: (
                  <>
                    {tab === ALL_GROUP_TAB ? '全て' : tab}
                    <span className="ml-1 text-[11px] font-normal text-fg-faint">({count})</span>
                  </>
                )
              };
            })}
            activeId={activeGroupTab}
            onChange={setActiveGroupTab}
          />
        )}

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-4">
            {/* キャラクター一覧を2段組グリッドで表示＋ドラッグ＆ドロップ */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visibleCharacters.map(c => c.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {visibleCharacters.map(character => (
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
                            className="ui-input w-full"
                            required
                          />
                          <select
                            value={editCharacter?.group || 'なし'}
                            onChange={e => setEditCharacter(prev => ({
                              ...(prev ?? {}),
                              group: e.target.value
                            }))}
                            className="ui-input w-full"
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
                            className="ui-input w-full"
                            title="チャットビューでフキダシを表示するサイド"
                          >
                            <option value="">チャットビュー: 自動</option>
                            <option value="left">チャットビュー: 左</option>
                            <option value="right">チャットビュー: 右</option>
                          </select>
                          <div className="flex items-center gap-2">
                            <label className="ui-section-label shrink-0">パーソナルカラー</label>
                            <input
                              type="color"
                              value={editCharacter?.backgroundColor || '#e5e7eb'}
                              onChange={e => setEditCharacter(prev => ({
                                ...(prev ?? {}),
                                backgroundColor: e.target.value
                              }))}
                              className="w-10 h-8 rounded-lg cursor-pointer bg-field p-1"
                              title="フキダシテーマ・チャットビュー・アイコン未設定時の背景色に使用されます"
                            />
                            <span className="text-[10.5px] text-fg-sub">フキダシテーマ・チャットビューの色に使用</span>
                          </div>
                          <div className="flex items-center space-x-2 mb-1">
                            <input
                              type="text"
                              value={editCharacter?.emotions?.normal?.iconUrl || ''}
                              onChange={e => setEditEmotion('normal', { iconUrl: e.target.value })}
                              placeholder="アイコンURLまたは画像を選択"
                              className="ui-input flex-1 min-w-0"
                            />
                            <label className={`${buttonClass('secondary', 'sm')} cursor-pointer shrink-0`}>
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
                            className={`${buttonClass('secondary')} w-full`}
                          >
                            <ListBulletIcon className="size-4" />
                            <span>ユーザープリセット設定</span>
                            <span className="text-[11px] font-normal text-fg-faint">
                              ({(editCharacter?.userPresets || []).length}件)
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEmotionSettingsOpen(true)}
                            className={`${buttonClass('secondary')} w-full`}
                          >
                            <FaceSmileIcon className="size-4" />
                            <span>表情差分設定</span>
                            <span className="text-[11px] font-normal text-fg-faint">
                              ({Object.keys(editCharacter?.emotions || {}).filter(k => k !== 'normal').length}件)
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCreditSettingsOpen(true)}
                            className={`${buttonClass('secondary')} w-full`}
                          >
                            <IdentificationIcon className="size-4" />
                            <span>素材クレジット設定</span>
                            {normalizeMaterialCredit(editCharacter?.materialCredit) && (
                              <span className="text-[11px] font-normal text-fg-faint">(設定済み)</span>
                            )}
                          </button>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => { setIsEditingId(null); setEditCharacter(null); setIsPresetSettingsOpen(false); setIsCreditSettingsOpen(false); setIsEmotionSettingsOpen(false); }}
                              className={buttonClass('secondary')}
                            >
                              キャンセル
                            </button>
                            <button
                              type="submit"
                              className={buttonClass('primary')}
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
                                  <img src={character.emotions.normal.iconUrl} alt={character.name} className="size-14 rounded-full ring-1 ring-hairline object-cover" />
                                ) : (
                                  <div 
                                    className="relative size-14 rounded-full flex items-center justify-center text-center overflow-hidden group"
                                    style={{ backgroundColor: character.backgroundColor || '#e5e7eb' }}
                                  >
                                    <span
                                      className="text-[11px] font-bold leading-tight px-1 break-all line-clamp-2"
                                      style={{ color: nameBadgeText(character.backgroundColor || '#e5e7eb') }}
                                    >
                                      {character.name.length > 8 ? character.name.slice(0, 8) + '…' : character.name}
                                    </span>
                                    {/* ペンアイコン（hover時のみ表示） */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <button
                                        onClick={() => openColorPicker(character.id, character.backgroundColor || '#e5e7eb')}
                                        className="p-1.5 bg-panel text-fg rounded-full shadow-(--shadow-popover)"
                                        title="背景色を変更"
                                      >
                                        <PencilIcon className="size-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <h3 className="text-[14.5px] font-bold text-fg">{character.name}</h3>
                                <p className="text-[11px] text-fg-sub mt-0.5">グループ: {character.group || 'なし'}</p>
                                {currentProjectId && (
                                  <div className="flex items-center gap-2 mt-2">
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
                                      className="ui-checkbox"
                                    />
                                    <label htmlFor={`project-enabled-${character.id}`} className="text-xs font-semibold text-fg cursor-pointer">
                                      現在の台本で使用する
                                    </label>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5 ml-auto items-end">
                            <button onClick={() => {
                              guardUnsavedEdit(() => {
                                setIsEditingId(character.id);
                                setEditCharacter({ ...character });
                              });
                            }} className={buttonClass('secondary', 'sm')}>
                              <PencilSquareIcon className="size-3.5" />
                              編集
                            </button>
                            <button onClick={() => onDeleteCharacter(character.id)} className={buttonClass('destructive-weak', 'sm')}>
                              <TrashIcon className="size-3.5" />
                              削除
                            </button>
                          </div>
                        </>
                      )}
                    </SortableCharacter>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {visibleCharacters.length === 0 && characters.length > 0 && (
              <p className="text-sm text-fg-sub text-center py-6">
                このグループにはキャラクターがいません
              </p>
            )}
            {isAdding ? (
              <form onSubmit={handleSubmit} className="rounded-2xl p-4 space-y-3 bg-well">
                <input
                  type="text"
                  value={newCharacter.name}
                  onChange={e => setNewCharacter(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="キャラクター名"
                  className="ui-input w-full"
                  required
                />
                <select
                  value={newCharacter.group || 'なし'}
                  onChange={e => setNewCharacter(prev => ({ ...prev, group: e.target.value }))}
                  className="ui-input w-full"
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
                    className="ui-input flex-1 min-w-0"
                  />
                  <label className={`${buttonClass('secondary', 'sm')} cursor-pointer shrink-0`}>
                    ファイルを選択
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleIconFileChange(e, false)}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className={buttonClass('secondary')}
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className={buttonClass('primary')}
                  >
                    追加
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsGroupSettingsOpen(true)}
                  className={`${buttonClass('secondary')} basis-1/3 shrink-0`}
                >
                  <Cog6ToothIcon className="size-4" />
                  <span>グループ設定</span>
                </button>
                <button
                  onClick={() => {
                    // グループタブを開いているときは、追加後に一覧から消えないよう既定グループを合わせる
                    if (activeGroupTab !== ALL_GROUP_TAB) {
                      setNewCharacter(prev => ({ ...prev, group: activeGroupTab }));
                    }
                    setIsAdding(true);
                  }}
                  className={`${buttonClass('primary')} flex-1`}
                >
                  <PlusIcon className="size-[17px]" strokeWidth={2.2} />
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
          panelClassName="w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50"
        >
            <DialogHeader icon={UsersIcon} title="グループ設定" onClose={() => setIsGroupSettingsOpen(false)} />
            <div className="px-5 pb-5">
            {/* グループ追加 */}
            <div className="mb-5">
              <div className="ui-section-label mb-2">グループを追加</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGroup}
                  onChange={e => setNewGroup(e.target.value)}
                  placeholder="新しいグループ名"
                  className="ui-input flex-1 min-w-0"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (newGroup.trim() && !groups.includes(newGroup.trim())) {
                      onAddGroup(newGroup.trim());
                      setNewGroup('');
                    }
                  }}
                  className={buttonClass('primary')}
                >
                  <PlusIcon className="size-4" strokeWidth={2.2} />
                  追加
                </button>
              </div>
            </div>

            {/* グループ一覧 */}
            <div>
              <h4 className="text-[14.5px] font-bold text-fg mb-3">既存のグループ</h4>
              {groups.length === 0 ? (
                <p className="text-fg-sub text-sm">グループがありません</p>
              ) : (
                <DndContext sensors={groupSensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
                  <SortableContext items={groups.map((group, index) => `${group}-${index}`)} strategy={rectSortingStrategy}>
                    {groups.map((group, index) => (
                      <SortableGroup key={`${group}-${index}`} group={group} index={index}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            {editingGroup === group ? (
                              <input
                                type="text"
                                value={editingGroupName}
                                onChange={e => { setEditingGroupName(e.target.value); setGroupRenameError(''); }}
                                onKeyDown={e => {
                                  // ダイアログ側の Enter 確定・Esc で閉じる、に流さない
                                  if (e.key === 'Enter' || e.key === 'Escape') e.stopPropagation();
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    (e.target as HTMLInputElement).blur();
                                  }
                                  if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setEditingGroup(null);
                                    setGroupRenameError('');
                                  }
                                }}
                                onBlur={() => {
                                  if (editingGroup === null) return;
                                  if (onRenameGroup?.(group, editingGroupName)) {
                                    setEditingGroup(null);
                                    setGroupRenameError('');
                                  } else {
                                    setGroupRenameError('同じ名前のグループがあるか、使えない名前です');
                                  }
                                }}
                                className="ui-input flex-1 min-w-0 py-1.5 font-bold"
                                autoFocus
                              />
                            ) : (
                              // 名前にホバーしたときだけ右に編集ボタンを出す
                              <div className="flex items-center gap-1.5 min-w-0 group/name">
                                <span className="text-[13.5px] font-bold text-fg truncate">{group}</span>
                                {onRenameGroup && (
                                  <button
                                    type="button"
                                    onClick={() => { setEditingGroup(group); setEditingGroupName(group); setGroupRenameError(''); }}
                                    className="size-[26px] shrink-0 rounded-lg bg-field text-fg-sub flex items-center justify-center opacity-0 transition-opacity group-hover/name:opacity-100 focus-visible:opacity-100 hover:text-fg"
                                    title="グループ名を編集"
                                  >
                                    <PencilSquareIcon className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                            <button
                              onClick={() => onDeleteGroup(group)}
                              className={`${buttonClass('destructive-weak', 'sm')} shrink-0`}
                            >
                              <TrashIcon className="size-3.5" />
                              削除
                            </button>
                          </div>
                          {editingGroup === group && groupRenameError && (
                            <p className="text-[11px] text-destructive mt-1">{groupRenameError}</p>
                          )}
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
                            className="ui-input w-full mt-2 text-[13px]"
                            title="動画概要欄などに記載するクレジット表記。クレジット出力機能で使用します。"
                          />
                        </div>
                      </SortableGroup>
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* 変更は即時保存のため、フッターは「閉じる」のみ */}
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setIsGroupSettingsOpen(false)}
                className={buttonClass('secondary')}
              >
                閉じる
              </button>
            </div>
            </div>
        </DialogFrame>
      )}

      {/* ユーザープリセット設定ダイアログ */}
      {isPresetSettingsOpen && editCharacter && (
        <DialogFrame
          isOpen={isPresetSettingsOpen}
          onCancel={() => { setIsPresetSettingsOpen(false); setNewPresetName(''); }}
          panelClassName="w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50"
        >
            <DialogHeader icon={ListBulletIcon} title="ユーザープリセット設定" onClose={() => { setIsPresetSettingsOpen(false); setNewPresetName(''); }} />
            <div className="px-5 pb-5">
            <p className="text-[11px] leading-[1.55] text-fg-sub mb-4">
              「{editCharacter.name}」のユーザープリセットを管理します。
            </p>

            {/* プリセット追加 */}
            <div className="mb-4">
              <div className="flex gap-2">
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
                  className="ui-input flex-1 min-w-0"
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
                  className={buttonClass('primary')}
                >
                  <PlusIcon className="size-4" strokeWidth={2.2} />
                  追加
                </button>
              </div>
            </div>

            {/* プリセット一覧 */}
            <div>
              <h4 className="text-[14.5px] font-bold text-fg mb-3">プリセット一覧</h4>
              {(editCharacter.userPresets || []).length === 0 ? (
                <p className="text-fg-sub text-sm">プリセットがありません</p>
              ) : (
                <DndContext sensors={presetSensors} collisionDetection={closestCenter} onDragEnd={handlePresetDragEnd}>
                  <SortableContext items={(editCharacter.userPresets || []).map(p => `preset-${p.id}`)} strategy={rectSortingStrategy}>
                    {(editCharacter.userPresets || []).map(preset => (
                      <SortablePreset key={preset.id} preset={preset}>
                        <span className="text-[13.5px] text-fg flex-1 min-w-0 truncate">{preset.name}</span>
                        <button
                          onClick={() => {
                            setEditCharacter(prev => prev ? {
                              ...prev,
                              userPresets: (prev.userPresets || []).filter(p => p.id !== preset.id)
                            } : prev);
                          }}
                          className="size-7 rounded-lg text-destructive hover:bg-destructive-tint flex items-center justify-center ml-2 shrink-0"
                          title="プリセットを削除"
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </SortablePreset>
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <div className="flex justify-end mt-5">
              <button
                onClick={() => { setIsPresetSettingsOpen(false); setNewPresetName(''); }}
                className={buttonClass('secondary')}
              >
                閉じる
              </button>
            </div>
            </div>
        </DialogFrame>
      )}

      {/* 表情差分設定ダイアログ */}
      {isEmotionSettingsOpen && editCharacter && (
        <DialogFrame
          isOpen={isEmotionSettingsOpen}
          onCancel={() => { setIsEmotionSettingsOpen(false); setNewEmotionPresetId(''); }}
          panelClassName="w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50"
        >
            <DialogHeader icon={FaceSmileIcon} title="表情差分設定" onClose={() => { setIsEmotionSettingsOpen(false); setNewEmotionPresetId(''); }} />
            <div className="px-5 pb-5">
            <p className="text-[11px] leading-[1.55] text-fg-sub mb-4">
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
                    <p className="text-[11px] leading-[1.55] text-fg-sub rounded-2xl px-3.5 py-3 bg-well">
                      表情はユーザープリセット（音声の感情）から追加します。先に「ユーザープリセット設定」からプリセットを登録してください。
                    </p>
                  );
                }
                return (
                  <div className="flex gap-2">
                    <select
                      value={newEmotionPresetId}
                      onChange={e => setNewEmotionPresetId(e.target.value)}
                      className="ui-input flex-1 min-w-0"
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
                      className={buttonClass('primary')}
                    >
                      <PlusIcon className="size-4" strokeWidth={2.2} />
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
                  <div key={emotion} className="rounded-2xl px-[13px] py-[11px] bg-well">
                    <div className="flex items-center gap-3">
                      {setting.iconUrl ? (
                        <img src={setting.iconUrl} alt={emotion} className="size-12 rounded-full ring-1 ring-hairline object-cover shrink-0" />
                      ) : (
                        <div
                          className="size-12 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: editCharacter.backgroundColor || '#e5e7eb', color: nameBadgeText(editCharacter.backgroundColor || '#e5e7eb') }}
                        >
                          未設定
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-fg text-[13.5px]">
                            {isNormal ? '標準（normal）' : emotion}
                          </span>
                          {!isNormal && (
                            <button
                              onClick={() => removeEditEmotion(emotion)}
                              className="size-7 rounded-lg text-destructive hover:bg-destructive-tint flex items-center justify-center"
                              title="この表情を削除（使用中のブロックは標準アイコンで表示されます）"
                            >
                              <TrashIcon className="size-4" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="text"
                            value={setting.iconUrl}
                            onChange={e => setEditEmotion(emotion, { iconUrl: e.target.value })}
                            placeholder="アイコンURLまたは画像を選択"
                            className="ui-input flex-1 min-w-0 py-2 text-xs"
                          />
                          <label className={`${buttonClass('secondary', 'sm')} cursor-pointer shrink-0`}>
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
                          <span className="ui-section-label shrink-0">立ち絵</span>
                          {setting.standingAssetId ? (
                            <>
                              <span className="text-xs text-fg">登録済み</span>
                              <button
                                type="button"
                                onClick={() => setStandingAdjustEmotion(emotion)}
                                className="text-xs font-semibold text-primary-text hover:underline"
                                title="立ち絵ステージでの見え方（ズーム・位置）を調整"
                              >
                                表示調整
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveStandingImage(emotion)}
                                className="text-xs font-semibold text-destructive hover:underline"
                              >
                                削除
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-fg-faint">未登録</span>
                          )}
                          <label className={`${buttonClass('secondary', 'sm')} ml-auto cursor-pointer shrink-0`}>
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

            <p className="text-[11px] text-fg-sub mt-3">
              ※ 入力内容はキャラクター編集の「保存」を押すと確定されます。
            </p>

            <div className="flex justify-end mt-5">
              <button
                onClick={() => { setIsEmotionSettingsOpen(false); setNewEmotionPresetId(''); }}
                className={buttonClass('secondary')}
              >
                閉じる
              </button>
            </div>
            </div>
        </DialogFrame>
      )}

      {/* 素材クレジット設定ダイアログ */}
      {isCreditSettingsOpen && editCharacter && (
        <DialogFrame
          isOpen={isCreditSettingsOpen}
          onCancel={() => setIsCreditSettingsOpen(false)}
          panelClassName="w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50"
        >
            <DialogHeader icon={IdentificationIcon} title="素材クレジット設定" onClose={() => setIsCreditSettingsOpen(false)} />
            <div className="px-5 pb-5">
            <p className="text-[11px] leading-[1.55] text-fg-sub mb-4">
              「{editCharacter.name}」の立ち絵などの素材情報を記録します。クレジット出力や制作時の確認に使用できます。
            </p>

            <div className="space-y-3">
              <div>
                <label className="block ui-section-label mb-2">制作者</label>
                <input
                  type="text"
                  value={editCharacter.materialCredit?.creator || ''}
                  onChange={e => setEditCharacter(prev => prev ? {
                    ...prev,
                    materialCredit: { ...(prev.materialCredit || {}), creator: e.target.value }
                  } : prev)}
                  placeholder="例: ○○様"
                  className="ui-input w-full"
                />
              </div>
              <div>
                <label className="block ui-section-label mb-2">素材ID</label>
                <input
                  type="text"
                  value={editCharacter.materialCredit?.id || ''}
                  onChange={e => setEditCharacter(prev => prev ? {
                    ...prev,
                    materialCredit: { ...(prev.materialCredit || {}), id: e.target.value }
                  } : prev)}
                  placeholder="例: im〜 / nc〜"
                  className="ui-input w-full"
                />
              </div>
              <div>
                <label className="block ui-section-label mb-2">URL</label>
                <input
                  type="text"
                  value={editCharacter.materialCredit?.url || ''}
                  onChange={e => setEditCharacter(prev => prev ? {
                    ...prev,
                    materialCredit: { ...(prev.materialCredit || {}), url: e.target.value }
                  } : prev)}
                  placeholder="素材の配布ページURL"
                  className="ui-input w-full"
                />
              </div>
              <div>
                <label className="block ui-section-label mb-2">メモ（クレジット出力には含まれません）</label>
                <textarea
                  value={editCharacter.materialCredit?.memo || ''}
                  onChange={e => setEditCharacter(prev => prev ? {
                    ...prev,
                    materialCredit: { ...(prev.materialCredit || {}), memo: e.target.value }
                  } : prev)}
                  placeholder="例: 利用規約は改変OK・クレジット必須"
                  rows={3}
                  className="ui-input w-full resize-none"
                />
              </div>
            </div>

            <p className="text-[11px] text-fg-sub mt-3">
              ※ 入力内容はキャラクター編集の「保存」を押すと確定されます。
            </p>

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setIsCreditSettingsOpen(false)}
                className={buttonClass('secondary')}
              >
                閉じる
              </button>
            </div>
            </div>
        </DialogFrame>
      )}

      {/* カラーピッカーダイアログ */}
      {showColorPicker && (
        <DialogFrame
          isOpen={!!showColorPicker}
          onCancel={() => setShowColorPicker(null)}
          panelClassName="w-full max-w-sm mx-4"
          overlayClassName="bg-black/50"
        >
            <DialogHeader icon={SwatchIcon} title="背景色を選択" onClose={() => setShowColorPicker(null)} />
            <div className="px-5 pb-5 flex flex-col items-center gap-5">
              <input
                type="color"
                value={tempBackgroundColor}
                onChange={(e) => setTempBackgroundColor(e.target.value)}
                className="size-32 rounded-2xl bg-field p-1.5 cursor-pointer"
              />
              <div className="flex justify-end gap-2 self-stretch">
                <button
                  onClick={() => setShowColorPicker(null)}
                  className={buttonClass('secondary')}
                >
                  キャンセル
                </button>
                <button
                  onClick={closeColorPicker}
                  className={buttonClass('primary')}
                >
                  適用
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
          panelClassName="w-full max-w-md mx-4 pb-5"
        >
            <DialogHeader icon={UsersIcon} title="確認" onClose={() => setShowCloseDialog(false)} />
            <p className="px-5 text-[13.5px] leading-relaxed text-fg">
              ・編集中の台本で使用しないキャラクターをプルダウンから非表示にします。<br />
              ・非表示にするキャラクターのセリフはそのまま残ります。不要な場合はセリフを削除してください。
            </p>
            <div className="flex justify-end gap-2 mt-5 px-5">
              <button
                onClick={() => setShowCloseDialog(false)}
                className={buttonClass('secondary')}
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  saveCharacterStates();
                  setShowCloseDialog(false);
                  onClose();
                }}
                className={buttonClass('primary')}
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
          panelClassName="w-full max-w-md mx-4 pb-5"
          overlayClassName="bg-black/50"
        >
            <DialogHeader icon={ExclamationTriangleIcon} title="編集中の情報があります" onClose={() => setUnsavedAction(null)} />
            <p className="px-5 text-[13.5px] leading-relaxed text-fg">
              キャラクターの編集内容がまだ保存されていません。<br />
              保存せずに続行すると変更内容は破棄されます。
            </p>
            <div className="flex flex-wrap justify-end gap-2 mt-5 px-5">
              <button
                onClick={() => setUnsavedAction(null)}
                className={buttonClass('secondary')}
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
                className={buttonClass('destructive-weak')}
              >
                <ExclamationTriangleIcon className="size-[15px]" strokeWidth={2} />
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
                className={buttonClass('primary')}
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