import React, { useState } from 'react';
import { FileNode } from '../../../packages/core/types';
import { useAppStore } from '../../store';
import FileTree from './FileTree';
import SearchPanel from './SearchPanel';
import './Sidebar.css';
import FolderIcon from '../icons/FolderIcon';
import SearchIcon from '../icons/SearchIcon';
import TagIcon from '../icons/TagIcon';
import PlusIcon from '../icons/PlusIcon';
import TagExplorer from './TagExplorer';
import FolderOpenIcon from '../icons/FolderOpenIcon';
import InputModal from '../InputModal/InputModal';

interface SidebarProps {
  vault: string | null;
  files: FileNode[];
  onOpenVault: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ vault, files, onOpenVault }) => {
  const [activeTab, setActiveTab] = useState<'files' | 'search' | 'tags'>('files');
  const [showCreateNoteModal, setShowCreateNoteModal] = useState(false);
  const [showCreateDirModal, setShowCreateDirModal] = useState(false);
  const { createNote, createDirectory } = useAppStore();

  const handleCreateNote = async (noteName: string) => {
    if (!vault || !noteName) return;

    try {
      await createNote(vault, noteName);
      setShowCreateNoteModal(false);
    } catch (error) {
      alert('Failed to create note: ' + (error as Error).message);
    }
  };

  const handleCreateDirectory = async (dirName: string) => {
    if (!vault || !dirName) return;

    try {
      await createDirectory(vault, dirName);
      setShowCreateDirModal(false);
    } catch (error) {
      alert('Failed to create directory: ' + (error as Error).message);
    }
  };

  const handleCreateNoteClick = () => {
    setShowCreateNoteModal(true);
  };

  const handleCreateDirClick = () => {
    setShowCreateDirModal(true);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
            title="Files"
          >
            <FolderIcon />
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
            title="Search"
          >
            <SearchIcon />
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'tags' ? 'active' : ''}`}
            onClick={() => setActiveTab('tags')}
            title="Tags"
          >
            <TagIcon />
          </button>
        </div>
      </div>

      <div className="sidebar-content">
        {!vault ? (
          <div className="no-vault">
            <p>No vault selected</p>
            <button onClick={onOpenVault} className="open-vault-btn">
              Open Vault
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'files' && (
              <div className="files-panel">
                <div className="vault-header">
                  <h3 className="vault-name">
                    {vault.split(/[/\\]/).pop()}
                  </h3>
                  <div className="vault-actions">
                    <button
                      onClick={handleCreateNoteClick}
                      className="new-note-btn"
                      title="New Note"
                    >
                      <PlusIcon />
                    </button>
                    <button
                      onClick={handleCreateDirClick}
                      className="new-dir-btn"
                      title="New Folder"
                    >
                      <FolderIcon />
                    </button>
                    <button
                      onClick={onOpenVault}
                      className="change-vault-btn"
                      title="Open Vault"
                    >
                      <FolderOpenIcon />
                    </button>
                  </div>
                </div>
                <FileTree files={files} />
              </div>
            )}

            {activeTab === 'search' && (
              <SearchPanel />
            )}

            {activeTab === 'tags' && (
              <div className="tags-panel">
                <h3>Tags</h3>
                <TagExplorer />
              </div>
            )}
          </>
        )}
      </div>

      <InputModal
        isOpen={showCreateNoteModal}
        title="Create New Note"
        placeholder="Enter note name"
        onSubmit={handleCreateNote}
        onCancel={() => setShowCreateNoteModal(false)}
      />

      <InputModal
        isOpen={showCreateDirModal}
        title="Create New Folder"
        placeholder="Enter folder name"
        onSubmit={handleCreateDirectory}
        onCancel={() => setShowCreateDirModal(false)}
      />
    </div>
  );
};

export default Sidebar;
