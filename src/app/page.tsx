'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import ScriptEditor from '@/components/ScriptEditor';
import Settings from '@/components/Settings';
import ProjectDialog from '@/components/ProjectDialog';
import CSVExportDialog from '@/components/CSVExportDialog';
import CharacterManager from '@/components/CharacterManager';
import { Project, Character, ScriptBlock } from '@/types';
import { buildEmptyScript } from '@/utils/scriptDefaults';

// カスタムフックのインポート
import { useDataManagement } from '@/hooks/useDataManagement';
import { useProjectManagement } from '@/hooks/useProjectManagement';
import { useExportImport } from '@/hooks/useExportImport';
import { useCharacterManagement } from '@/hooks/useCharacterManagement';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useTheme } from '@/hooks/useTheme';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useBlockOperations } from '@/hooks/useBlockOperations';
import { useScriptManagement } from '@/hooks/useScriptManagement';
import { useSettings } from '@/hooks/useSettings';
import { useUIState } from '@/hooks/useUIState';
import { useDataProcessing } from '@/hooks/useDataProcessing';

export default function Home() {
  // テキストエリアref配列（ScriptEditorとuseKeyboardShortcutsで共有）
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const setIsUndoRedoOperationRef = useRef<((isUndoRedo: boolean) => void) | null>(null);
  const setIsCtrlEnterBlockRef = useRef<((isCtrlEnter: boolean) => void) | null>(null);

  // カスタムフックの初期化
  const dataManagement = useDataManagement();
  const dataProcessing = useDataProcessing(dataManagement);
  
  // UI状態管理フック
  const uiState = useUIState();
  const {
    isProjectDialogOpen,
    setIsProjectDialogOpen,
    notification,
    showNotification,
    deleteConfirmation,
    setDeleteConfirmation,
    selectedBlockIds,
    setSelectedBlockIds
  } = uiState;
  
  // プロジェクト管理フック
  const projectManagement = useProjectManagement(dataManagement, showNotification);
  const {
    project,
    setProject,
    projectId,
    setProjectId,
    selectedSceneId,
    setSelectedSceneId,
    projectList,
    setProjectList,
    handleCreateProject
  } = projectManagement;
    
  // キャラクター管理フック
  const characterManagement = useCharacterManagement(
    dataManagement,
    showNotification,
    setProject,
    selectedSceneId,
    projectList || []
  );
  
  const {
    characters,
    setCharacters,
    groups,
    setGroups,
    handleAddCharacter,
    handleUpdateCharacter,
    handleDeleteCharacter,
    handleAddGroup,
    handleDeleteGroup,
    handleReorderCharacters,
    handleReorderGroups,
    handleImportCharacterCSV,
    getCharacterProjectStates,
    saveCharacterProjectStates
  } = characterManagement;
  
  // エクスポート・インポートフック
  const exportImport = useExportImport(
    project,
    characters,
    groups,
    selectedBlockIds,
    selectedSceneId,
    dataManagement,
    showNotification,
    setProject,
    setProjectId,
    projectManagement.setProjectList,
    setSelectedSceneId,
    setCharacters,
    setGroups
  );

  // Undo/Redoフック
  const undoRedo = useUndoRedo(projectId, dataManagement);

  // テーマフック
  const theme = useTheme();

  // ブロック操作フック
  const blockOperations = useBlockOperations();

  // スクリプト管理フック
  const scriptManagement = useScriptManagement();

  // 設定フック
  const settings = useSettings(dataManagement);

  // selectedSceneIdの自動初期化
  useEffect(() => {
    if (!selectedSceneId && project.scenes.length > 0) {
      setSelectedSceneId(project.scenes[0].id);
    }
  }, [selectedSceneId, project.scenes]);

  // キーボードショートカットフック
  const keyboardShortcuts = useKeyboardShortcuts(
    undoRedo,
    () => {
      // 現在のシーンとブロックを取得
      // console.log('page.tsx - onAddBlock callback - selectedSceneId:', selectedSceneId);
      if (!selectedSceneId) {
        // console.log('page.tsx - onAddBlock callback - selectedSceneId is null, returning');
        return;
      }
      
      const currentScene = project.scenes.find(s => s.id === selectedSceneId);
      if (!currentScene) return;
      
      const currentScript = currentScene.scripts[0];
      if (!currentScript) return;
      
      // 最後のセリフブロックからキャラクター情報を引き継ぐ
      const lastSerif = [...currentScript.blocks].reverse().find(b => b.characterId);
      const charId = lastSerif?.characterId || characters[0]?.id || '';
      const emotion = lastSerif?.emotion || 'normal';
      
      const newBlock: ScriptBlock = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        characterId: charId,
        emotion,
        text: ''
      };
      
      // 最後のブロックの後に挿入
      const insertIndex = currentScript.blocks.length;
      const newProject = blockOperations.handleInsertBlock(project, selectedSceneId, newBlock, insertIndex);
      setProject(newProject);
    },
    () => {}, // onDeleteSelectedBlocks - 使用しない
    () => {}, // onDuplicateSelectedBlocks - 使用しない
    () => {}, // onMoveBlockUp - 使用しない
    () => {}, // onMoveBlockDown - 使用しない
    () => {}, // onSelectAll - 使用しない
    () => {}, // onDeselectAll - 使用しない
    // ScriptEditor用の追加パラメータ
    (block: ScriptBlock, index: number) => {
      const newProject = blockOperations.handleInsertBlock(project, selectedSceneId, block, index);
      setProject(newProject);
    },
    (blockId: string) => {
      const newProject = blockOperations.handleDeleteBlock(project, selectedSceneId, blockId);
      setProject(newProject);
    },
    (blockId: string, updates: Partial<ScriptBlock>) => {
      const newProject = blockOperations.handleUpdateBlock(project, selectedSceneId, blockId, updates);
      setProject(newProject);
    },
    (fromIndex: number, toIndex: number) => {
      const newProject = blockOperations.handleMoveBlockByIndex(project, selectedSceneId, fromIndex, toIndex);
      setProject(newProject);
    },
    () => uiState.setIsCSVExportDialogOpen(true),
    () => {
      // 最下段へスクロール
      window.scrollTo(0, document.body.scrollHeight);
    },
    () => {
      // 最上段へスクロール
      window.scrollTo(0, 0);
    },
    // ScriptEditorの状態
    project.scenes.find(s => s.id === selectedSceneId)?.scripts[0]?.blocks || [],
    characters,
    undefined,
    projectId,
    textareaRefs,
    (target) => {
      // ScriptEditorのmanualFocusTargetを設定
      // この関数はScriptEditor内で使用される
    },
    (isCtrlEnter) => {
      // ScriptEditorのisCtrlEnterBlockフラグを設定
      if (setIsCtrlEnterBlockRef.current) {
        setIsCtrlEnterBlockRef.current(isCtrlEnter);
        // console.log('page.tsx - Set isCtrlEnterBlock to:', isCtrlEnter);
      }
    }
  );

  // 初期化処理は useProjectManagement フック内で行われるため、ここでは不要

  // プロジェクト変更時の履歴保存
  useEffect(() => {
    if (project.id && !undoRedo.isUndoRedoOperation.current) {
      // console.log('page.tsx - Pushing to history:', { projectId: project.id, selectedSceneId });
      undoRedo.pushToHistory(project, selectedSceneId);
    }
  }, [project, selectedSceneId]);

  // プロジェクト切り替え時に他のプロジェクトの履歴を削除
  useEffect(() => {
    if (project.id) {
      undoRedo.clearOtherProjectHistory(project.id);
    }
  }, [project.id]);

  // アンドゥ・リドゥの結果を処理
  useEffect(() => {
    if (keyboardShortcuts.undoResult) {
      // console.log('page.tsx - Undo result:', keyboardShortcuts.undoResult);
      // console.log('page.tsx - Current project before undo:', project.id);
      // console.log('page.tsx - Current selectedSceneId before undo:', selectedSceneId);
      
      // アンドゥ操作であることをScriptEditorに通知
      if (setIsUndoRedoOperationRef.current) {
        setIsUndoRedoOperationRef.current(true);
        // console.log('page.tsx - Set isUndoRedoOperation to true');
      }
      
      setProject(keyboardShortcuts.undoResult.project);
      setSelectedSceneId(keyboardShortcuts.undoResult.selectedSceneId);
      
      // console.log('page.tsx - Set project to:', keyboardShortcuts.undoResult.project.id);
      // console.log('page.tsx - Set selectedSceneId to:', keyboardShortcuts.undoResult.selectedSceneId);
      
      // アンドゥ操作後にisUndoRedoOperationをリセット
      setTimeout(() => {
        undoRedo.isUndoRedoOperation.current = false;
        // console.log('page.tsx - Reset isUndoRedoOperation after undo');
      }, 100);
    }
  }, [keyboardShortcuts.undoResult]);

  useEffect(() => {
    if (keyboardShortcuts.redoResult) {
      // console.log('page.tsx - Redo result:', keyboardShortcuts.redoResult);
      // console.log('page.tsx - Current project before redo:', project.id);
      // console.log('page.tsx - Current selectedSceneId before redo:', selectedSceneId);
      
      // リドゥ操作であることをScriptEditorに通知
      if (setIsUndoRedoOperationRef.current) {
        setIsUndoRedoOperationRef.current(true);
        // console.log('page.tsx - Set isUndoRedoOperation to true');
      }
      
      setProject(keyboardShortcuts.redoResult.project);
      setSelectedSceneId(keyboardShortcuts.redoResult.selectedSceneId);
      
      // console.log('page.tsx - Set project to:', keyboardShortcuts.redoResult.project.id);
      // console.log('page.tsx - Set selectedSceneId to:', keyboardShortcuts.redoResult.selectedSceneId);
      
      // リドゥ操作後にisUndoRedoOperationをリセット
      setTimeout(() => {
        undoRedo.isUndoRedoOperation.current = false;
        // console.log('page.tsx - Reset isUndoRedoOperation after redo');
      }, 100);
    }
  }, [keyboardShortcuts.redoResult]);

  // プロジェクト変更時の最終シーン保存
  useEffect(() => {
    if (project.id && selectedSceneId) {
      dataManagement.saveData(`voiscripter_project_${project.id}_lastScene`, selectedSceneId);
    }
  }, [project.id, selectedSceneId]);

  // プロジェクト変更時のキャラクター保存（遅延実行）
  useEffect(() => {
    if (project.id) {
      const timeoutId = setTimeout(() => {
        dataManagement.saveData(`voiscripter_project_${project.id}_characters`, JSON.stringify(characters));
      }, 3000); // 3秒後に保存
      
      return () => clearTimeout(timeoutId);
    }
  }, [project.id, characters]);

  // プロジェクト変更時のグループ保存（遅延実行）
  useEffect(() => {
    if (project.id) {
      const timeoutId = setTimeout(() => {
        dataManagement.saveData(`voiscripter_project_${project.id}_groups`, JSON.stringify(groups));
      }, 3000); // 3秒後に保存
      
      return () => clearTimeout(timeoutId);
    }
  }, [project.id, groups]);

  // プロジェクト変更時の設定保存
  useEffect(() => {
    if (project.id) {
      dataManagement.saveData(`voiscripter_project_${project.id}`, JSON.stringify(project));
    }
  }, [project.id, project]);

  // プロジェクト変更時のプロジェクトリスト保存
  useEffect(() => {
    if (projectList.length > 0) {
      dataManagement.saveData('voiscripter_projectList', JSON.stringify(projectList));
    }
  }, [projectList]);

  // プロジェクト変更時のプロジェクトID保存
  useEffect(() => {
    if (projectId) {
      dataManagement.saveData('voiscripter_lastProject', projectId);
    }
  }, [projectId]);

  // ブロック選択状態の管理
  const handleBlockSelection = (blockId: string) => {
    setSelectedBlockIds(blockOperations.handleToggleBlockSelection(blockId, selectedBlockIds));
  };

  // ブロック更新処理
  const handleBlockUpdate = (blockId: string, updates: Partial<ScriptBlock>) => {
    const newProject = blockOperations.handleUpdateBlock(project, selectedSceneId, blockId, updates);
    setProject(newProject);
  };

  // スクリプト更新処理
  const handleScriptUpdate = (updates: any) => {
    const newProject = scriptManagement.handleUpdateScript(project, selectedSceneId, updates);
    setProject(newProject);
  };

  // スクリプトタイトル更新処理
  const handleScriptTitleUpdate = (newTitle: string) => {
    const newProject = scriptManagement.handleUpdateScriptTitle(project, selectedSceneId, newTitle);
    setProject(newProject);
  };

  // プロジェクト新規作成
  const handleNewProject = () => {
    setIsProjectDialogOpen(true);
  };







  // データ保存先変更
  const handleSaveDirectoryChange = async (directory: string) => {
    try {
      await settings.handleSaveDirectoryChange(directory);
      showNotification('保存先を変更しました', 'success');
    } catch (error) {
      showNotification('保存先の変更に失敗しました', 'error');
    }
  };

  // テーマ変更
  const handleThemeChange = (isDark: boolean) => {
    theme.setTheme(isDark);
  };

  // 通知表示
  const renderNotification = () => {
    if (!notification) return null;
    
    const bgColor = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      info: 'bg-blue-500'
    }[notification.type];
    
    return (
      <div className={`fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded shadow-lg z-50`}>
        {notification.message}
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${theme.isDarkMode ? 'dark bg-background text-foreground ' : 'bg-background text-foreground'} transition-colors duration-300 `}>
      <Header
        characters={characters}
        onAddCharacter={characterManagement.handleAddCharacter}
        onUpdateCharacter={characterManagement.handleUpdateCharacter}
        onDeleteCharacter={characterManagement.handleDeleteCharacter}
        onThemeChange={handleThemeChange}
        onExportCSV={exportImport.handleExportCSV}
        onExportSerifOnly={exportImport.handleExportSerifOnly}
        onExportCharacterCSV={exportImport.handleExportCharacterCSV}
        onExportByGroups={exportImport.handleExportByGroups}
        onExportToClipboard={exportImport.handleExportToClipboard}
        onExportProjectJson={exportImport.handleExportProjectJson}
        onImportCSV={exportImport.handleImportCSV}
        onImportCharacterCSV={exportImport.handleImportCharacterCSV}
        onImportJson={exportImport.handleImportJson}
        isDarkMode={theme.isDarkMode}
        saveDirectory={settings.saveDirectory}
        onSaveDirectoryChange={handleSaveDirectoryChange}
        groups={groups}
        onAddGroup={characterManagement.handleAddGroup}
        onDeleteGroup={characterManagement.handleDeleteGroup}
        onReorderCharacters={characterManagement.handleReorderCharacters}
        onReorderGroups={characterManagement.handleReorderGroups}
        projectName={project.name}
        onRenameProject={projectManagement.handleRenameProject}
        selectedBlockIds={uiState.selectedBlockIds}
        scenes={project.scenes}
        selectedSceneId={selectedSceneId}
        onAddScene={projectManagement.handleAddScene}
        onRenameScene={projectManagement.handleRenameScene}
        onDeleteScene={projectManagement.handleDeleteScene}
        onSelectScene={projectManagement.handleSelectScene}
        onReorderScenes={projectManagement.handleReorderScenes}
        onExportSceneCSV={exportImport.handleExportSceneCSV}
        onNewProject={handleNewProject}
        project={project}
        onOpenSettings={() => uiState.setIsSettingsOpen(true)}
        projectList={projectManagement.projectList}
        onProjectChange={(projectId) => {
          setProjectId(projectId);
          // 最後に開いたプロジェクトを保存
          dataManagement.saveData('voiscripter_lastProject', projectId);
          console.log('💾 プロジェクト変更: 最後のプロジェクトを保存:', projectId);
          // プロジェクトを読み込む処理は既存のuseEffectで実行される
        }}
        onDeleteProject={() => {
          // プロジェクト削除の確認ダイアログを表示
          setDeleteConfirmation({ projectId: project.id, confirmed: null });
        }}
        getCharacterProjectStates={characterManagement.getCharacterProjectStates}
        saveCharacterProjectStates={characterManagement.saveCharacterProjectStates}
      />
      
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 md:py-8">
        {project && selectedSceneId ? (
          <ScriptEditor
            script={project.scenes.find(s => s.id === selectedSceneId)?.scripts[0] || buildEmptyScript({ id: 'placeholder', title: 'placeholder' })}
            onUpdateBlock={handleBlockUpdate}
            onAddBlock={() => {
              if (project && selectedSceneId) {
                const newProject = blockOperations.handleAddBlock(project, selectedSceneId, characters);
                setProject(newProject);
              }
            }}
            onDeleteBlock={(blockId) => {
              if (project && selectedSceneId) {
                const newProject = blockOperations.handleDeleteBlock(project, selectedSceneId, blockId);
                setProject(newProject);
              }
            }}
            onInsertBlock={(block, index) => {
              if (project && selectedSceneId) {
                const newProject = blockOperations.handleInsertBlock(project, selectedSceneId, block, index);
                setProject(newProject);
              }
            }}
            onMoveBlock={(fromIndex, toIndex) => {
              if (project && selectedSceneId) {
                const newProject = blockOperations.handleMoveBlockByIndex(project, selectedSceneId, fromIndex, toIndex);
                setProject(newProject);
              }
            }}
            selectedBlockIds={uiState.selectedBlockIds}
            onSelectedBlockIdsChange={uiState.setSelectedBlockIds}
            onOpenCSVExport={() => {
              uiState.setIsCSVExportDialogOpen(true);
            }}
            characters={characters}
            onDuplicateBlock={(blockId) => {
              if (project && selectedSceneId) {
                const newProject = blockOperations.handleDuplicateBlock(project, selectedSceneId, blockId);
                setProject(newProject);
              }
            }}
            onSelectAllBlocks={() => {
              if (project && selectedSceneId) {
                const allBlockIds = blockOperations.handleSelectAllBlocks(project, selectedSceneId);
                uiState.setSelectedBlockIds(allBlockIds);
              }
            }}
            onDeselectAllBlocks={uiState.handleDeselectAllBlocks}
            onToggleBlockSelection={(blockId) => {
              const newSelectedBlockIds = uiState.handleToggleBlockSelection(blockId, uiState.selectedBlockIds);
              uiState.setSelectedBlockIds(newSelectedBlockIds);
            }}
            textareaRefs={textareaRefs}
            setIsCtrlEnterBlock={(setIsCtrlEnterBlockFn) => {
              // ScriptEditorのsetIsCtrlEnterBlock関数を参照に保存
              setIsCtrlEnterBlockRef.current = setIsCtrlEnterBlockFn;
            }}
            setIsUndoRedoOperation={(setIsUndoRedoOperationFn) => {
              // ScriptEditorのsetIsUndoRedoOperation関数を参照に保存
              setIsUndoRedoOperationRef.current = setIsUndoRedoOperationFn;
            }}
            enterOnlyBlockAdd={settings.enterOnlyBlockAdd}
            currentProjectId={projectId}
            onUpdateScript={handleScriptUpdate}
          />
        ) : (
          // 現在開いているプロジェクトが存在しない、かつ、シーンがひとつもない場合
            // プロジェクトリストにdefaultのみしか存在しない場合（初回起動時、または、プロジェクトをすべて削除した場合）
            <div className="text-center py-12">
            <div>
              <h2 className="text-foreground text-2xl font-bold mb-4">VoiScripter.へようこそ！</h2>
              <p className="text-muted-foreground mb-8">
                ここから台本を作りましょう。<br />新しいプロジェクトを作成するか、登場キャラクターの設定を行ってください。<br />すでに作った台本は上部のリストから読み込めます。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setIsProjectDialogOpen(true)}
                  className="px-6 py-3 bg-primary hover:bg-primary/80 text-primary-foreground font-medium rounded-lg transition-colors duration-200"
                >
                  新しいプロジェクトを作成
                </button>
                <button
                  onClick={() => uiState.setIsCharacterManagerOpen(true)}
                  className="px-6 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium rounded-lg transition-colors duration-200"
                >
                  キャラクター設定を開く
                </button>
              </div>
              <p className="text-muted-foreground mt-4 mb-4">
                詳しい使い方は設定からヘルプをご覧ください。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => uiState.setIsSettingsOpen(true)}
                  className="px-6 py-3 bg-muted hover:bg-muted/80 text-muted-foreground font-medium rounded-lg transition-colors duration-200"
                >
                  アプリ設定・ヘルプを開く
                </button>
              </div>

            </div>
            
          </div>
        )}
      </main>

      {/* ProjectDialog */}
      <ProjectDialog
        isOpen={uiState.isProjectDialogOpen}
        onClose={() => uiState.setIsProjectDialogOpen(false)}
        onConfirm={(projectName) => {
          try {
            const newProject = projectManagement.handleNewProject(projectName);
            setProject(newProject);
            showNotification('プロジェクトを作成しました', 'success');
            uiState.setIsProjectDialogOpen(false);
          } catch (error) {
            showNotification('プロジェクトの作成に失敗しました', 'error');
          }
        }}
        existingProjects={projectManagement.projects.map(p => p.name)}
        title="新しいプロジェクト"
        submitButtonText="作成"
        placeholder="プロジェクト名を入力"
      />

      {/* CSVExportDialog */}
      <CSVExportDialog
        isOpen={uiState.isCSVExportDialogOpen}
        onClose={() => uiState.setIsCSVExportDialogOpen(false)}
        characters={characters}
        groups={groups}
        selectedBlockIds={uiState.selectedBlockIds}
        onExportCSV={(includeTogaki = false, selectedOnly = false, fileFormat = 'csv') => {
          exportImport.handleExportCSV(includeTogaki, selectedOnly, fileFormat);
        }}
        onExportSerifOnly={(selectedOnly = false, fileFormat = 'csv', includeTogaki = false) => {
          exportImport.handleExportSerifOnly(selectedOnly, fileFormat, includeTogaki);
        }}
        onExportByGroups={(selectedGroups, exportType, includeTogaki = false, selectedOnly = false, sceneIds, fileFormat = 'csv') => {
          exportImport.handleExportByGroups(selectedGroups, exportType, includeTogaki, selectedOnly, sceneIds, fileFormat);
        }}
        onExportCharacterCSV={() => {
          exportImport.handleExportCharacterCSV();
        }}
        onExportToClipboard={(serifOnly = false, selectedOnly = false, includeTogaki = false) => {
          exportImport.handleExportToClipboard(serifOnly, selectedOnly, includeTogaki);
        }}
        scenes={project.scenes}
        selectedSceneId={selectedSceneId}
        onExportSceneCSV={(sceneIds, exportType, includeTogaki, selectedOnly, fileFormat = 'csv') => {
          exportImport.handleExportSceneCSV(sceneIds, exportType, includeTogaki, selectedOnly, fileFormat);
        }}
        onExportProjectJson={() => {
          exportImport.handleExportProjectJson();
        }}
        project={project}
      />

      {/* CharacterManager */}
      <CharacterManager
        isOpen={uiState.isCharacterManagerOpen}
        onClose={() => uiState.setIsCharacterManagerOpen(false)}
        characters={characters}
        onAddCharacter={characterManagement.handleAddCharacter}
        onUpdateCharacter={characterManagement.handleUpdateCharacter}
        onDeleteCharacter={characterManagement.handleDeleteCharacter}
        groups={groups}
        onAddGroup={characterManagement.handleAddGroup}
        onDeleteGroup={characterManagement.handleDeleteGroup}
        onReorderCharacters={characterManagement.handleReorderCharacters}
        onReorderGroups={characterManagement.handleReorderGroups}
        currentProjectId={projectId}
        projectList={projectList}
        getCharacterProjectStates={characterManagement.getCharacterProjectStates}
        saveCharacterProjectStates={characterManagement.saveCharacterProjectStates}
      />

      {/* Settings */}
      <Settings
        isOpen={uiState.isSettingsOpen}
        onClose={() => uiState.setIsSettingsOpen(false)}
        saveDirectory={settings.saveDirectory}
        onSaveDirectoryChange={settings.handleSaveDirectoryChange}
        enterOnlyBlockAdd={settings.enterOnlyBlockAdd}
        onEnterOnlyBlockAddChange={settings.handleEnterOnlyBlockAddChange}
      />

      {/* 通知 */}
      {renderNotification()}

      {/* 削除確認ダイアログ */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 transition-opacity duration-300 p-4">
          <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">プロジェクトの削除</h3>
            <p className="mb-6">このプロジェクトを削除しますか？この操作は元に戻せません。</p>
            <div className="flex space-x-4">
                              <button
                  onClick={() => setDeleteConfirmation(null)}
                  className="px-4 py-2 text-muted-foreground hover:bg-accent rounded"
                >
                  キャンセル
                </button>
                <button
                  onClick={async () => {
                    try {
                      await projectManagement.handleDeleteProject();
                      showNotification('プロジェクトを削除しました', 'success');
                      setDeleteConfirmation(null);
                    } catch (error) {
                      showNotification('プロジェクトの削除に失敗しました', 'error');
                    }
                  }}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/80"
                >
                  削除
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}