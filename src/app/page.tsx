'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import ScriptEditor from '@/components/ScriptEditor';
import Settings from '@/components/Settings';
import ProjectDialog from '@/components/ProjectDialog';
import CSVExportDialog from '@/components/CSVExportDialog';
import CharacterManager from '@/components/CharacterManager';
import { Project, Character, ScriptBlock } from '@/types';

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
    selectedSceneId
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
    handleImportCharacterCSV
  } = characterManagement;
  
  // エクスポート・インポートフック
  const exportImport = useExportImport(
    project,
    characters,
    selectedBlockIds,
    dataManagement,
    showNotification,
    setProject,
    setProjectId,
    setProjectList,
    setSelectedSceneId
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

  // キーボードショートカットフック
  const keyboardShortcuts = useKeyboardShortcuts(
    undoRedo,
    () => {
      const newProject = blockOperations.handleAddBlock(project, selectedSceneId, characters);
      setProject(newProject);
    },
    () => {
      // 選択されたブロックを削除
      if (selectedBlockIds.length > 0) {
        let newProject = project;
        for (const blockId of selectedBlockIds) {
          newProject = blockOperations.handleDeleteBlock(newProject, selectedSceneId, blockId);
        }
        setProject(newProject);
        setSelectedBlockIds([]);
      }
    },
    () => {
      // 選択されたブロックを複製
      if (selectedBlockIds.length > 0) {
        let newProject = project;
        for (const blockId of selectedBlockIds) {
          newProject = blockOperations.handleDuplicateBlock(newProject, selectedSceneId, blockId);
        }
        setProject(newProject);
      }
    },
    () => {
      // 選択されたブロックを上に移動
      if (selectedBlockIds.length > 0) {
        let newProject = project;
        for (const blockId of selectedBlockIds) {
          newProject = blockOperations.handleMoveBlock(newProject, selectedSceneId, blockId, 'up');
        }
        setProject(newProject);
      }
    },
    () => {
      // 選択されたブロックを下に移動
      if (selectedBlockIds.length > 0) {
        let newProject = project;
        for (const blockId of selectedBlockIds) {
          newProject = blockOperations.handleMoveBlock(newProject, selectedSceneId, blockId, 'down');
        }
        setProject(newProject);
      }
    },
    () => setSelectedBlockIds(blockOperations.handleSelectAllBlocks(project, selectedSceneId)),
    () => setSelectedBlockIds(blockOperations.handleDeselectAllBlocks())
  );

  // 初期化処理
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const last = localStorage.getItem('voiscripter_lastProject');
      if (last && last !== 'lastProject') setProjectId(last);
    }
  }, []);

  // プロジェクト変更時の履歴保存
  useEffect(() => {
    if (project.id && !undoRedo.isUndoRedoOperation.current) {
      undoRedo.pushToHistory(project, selectedSceneId);
    }
  }, [project, selectedSceneId]);

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
      localStorage.setItem('voiscripter_lastProject', projectId);
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
    <div className={`min-h-screen ${theme.isDarkMode ? 'dark bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
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
        onExportSceneCSV={exportImport.handleExportSceneCSV}
        onNewProject={handleNewProject}
        project={project}
        onOpenSettings={() => uiState.setIsSettingsOpen(true)}
        onDeleteProject={() => {
          // プロジェクト削除の確認ダイアログを表示
          setDeleteConfirmation({ projectId: project.id, confirmed: null });
        }}
        projectList={projectList}
        onProjectChange={async (projectId) => {
          setProjectId(projectId);
          try {
            // プロジェクトデータを読み込み
            const projectData = await dataManagement.loadData(`voiscripter_project_${projectId}`);
            if (projectData) {
              const parsedProject = JSON.parse(projectData);
              setProject(parsedProject);
              
              // 最後に開いていたシーンを読み込み
              const lastScene = await dataManagement.loadData(`voiscripter_project_${projectId}_lastScene`);
              if (lastScene && parsedProject.scenes.some((s: any) => s.id === lastScene)) {
                setSelectedSceneId(lastScene);
              } else if (parsedProject.scenes.length > 0) {
                setSelectedSceneId(parsedProject.scenes[0].id);
              }
              
              // キャラクターとグループを読み込み
              const charactersData = await dataManagement.loadData(`voiscripter_project_${projectId}_characters`);
              if (charactersData) {
                setCharacters(JSON.parse(charactersData));
              }
              
              const groupsData = await dataManagement.loadData(`voiscripter_project_${projectId}_groups`);
              if (groupsData) {
                setGroups(JSON.parse(groupsData));
              }
              
              showNotification('プロジェクトを切り替えました', 'success');
            }
          } catch (error) {
            console.error('プロジェクト読み込みエラー:', error);
            showNotification('プロジェクトの読み込みに失敗しました', 'error');
          }
        }}
      />
      
      <main className="container mx-auto px-4 py-8">
        {project && selectedSceneId ? (
          <ScriptEditor
            script={project.scenes.find(s => s.id === selectedSceneId)?.scripts[0] || { id: '', title: '', blocks: [], characters: [] }}
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
              // インデックスベースの移動を実装する必要があります
              // 現在はdirectionベースの移動のみサポート
              console.log('Move block from', fromIndex, 'to', toIndex);
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
          />
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">プロジェクトまたはシーンが選択されていません</h2>
            <p className="text-gray-600 dark:text-gray-400">
              プロジェクトを作成し、シーンを選択してください。
            </p>
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
      />

      {/* Settings */}
      <Settings
        isOpen={uiState.isSettingsOpen}
        onClose={() => uiState.setIsSettingsOpen(false)}
        saveDirectory={settings.saveDirectory}
        onSaveDirectoryChange={settings.handleSaveDirectoryChange}
      />

      {/* 通知 */}
      {renderNotification()}

      {/* 削除確認ダイアログ */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">プロジェクトの削除</h3>
            <p className="mb-6">このプロジェクトを削除しますか？この操作は元に戻せません。</p>
            <div className="flex space-x-4">
                              <button
                  onClick={() => setDeleteConfirmation(null)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
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
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
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