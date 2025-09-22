import React, { useState } from 'react';
import { FileNode } from '../../../packages/core/types';
import { useAppStore } from '../../store';
import { extractTags } from '../../../packages/core/utils/tags';
import FolderIcon from '../icons/FolderIcon';
import FolderOpenIcon from '../icons/FolderOpenIcon';
import FileIcon from '../icons/FileIcon';
import NoteIcon from '../icons/NoteIcon';
import DeleteIcon from '../icons/DeleteIcon';
import RenameIcon from '../icons/RenameIcon';
import PlusIcon from '../icons/PlusIcon';
import ContextMenu, { ContextMenuItem } from '../ContextMenu/ContextMenu';
import InputModal from '../InputModal/InputModal';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { ElectronFileSystem } from '../../adapters/electronfileSystem';
import { parseMarkdownFile, extractLinks } from '../../../packages/core/utils/markdown';

interface FileTreeProps {
  files: FileNode[];
}

interface FileItemProps {
  file: FileNode;
  level: number;
  onContextMenu: (file: FileNode | null, x: number, y: number) => void;
}

const FileTree: React.FC<FileTreeProps> = ({ files }) => {
  const [contextMenu, setContextMenu] = useState<{
    file: FileNode | null; // null for root context menu
    x: number;
    y: number;
  } | null>(null);


  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    defaultValue: string;
    onSubmit: (value: string) => void;
  }>({
    isOpen: false,
    title: '',
    placeholder: '',
    defaultValue: '',
    onSubmit: () => { /* will be overridden */ },
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { /* will be overridden */ },
  });

  const { createNote, createDirectory, deleteFileOrDir, renameFileOrDir, vault } = useAppStore();

  const handleContextMenu = (file: FileNode | null, x: number, y: number) => {
    setContextMenu({ file, x, y });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleRootContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleContextMenu(null, e.clientX, e.clientY);
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!vault) return;

    const draggedPath = e.dataTransfer.getData('text/plain');
    if (!draggedPath) return;

    try {
      const draggedName = draggedPath.split(/[/\\]/).pop();
      if (!draggedName) return;

      const currentParent = draggedPath.split(/[/\\]/).slice(0, -1).join('/');
      if (currentParent === vault) {
        return;
      }

      const newPath = `${vault}/${draggedName}`;
      await renameFileOrDir(draggedPath, newPath);
    } catch (error) {
      alert('Failed to move to root: ' + (error as Error).message);
    }
  };

  const handleCreateNote = async (targetDir: string) => {
    setInputModal({
      isOpen: true,
      title: 'Create New Note',
      placeholder: 'Enter note name',
      defaultValue: '',
      onSubmit: async (noteName: string) => {
        try {
          await createNote(targetDir, noteName);
          setInputModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          alert('Failed to create note: ' + (error as Error).message);
        }
      }
    });
  };

  const handleCreateDirectory = async (parentDir: string) => {
    setInputModal({
      isOpen: true,
      title: 'Create New Folder',
      placeholder: 'Enter folder name',
      defaultValue: '',
      onSubmit: async (dirName: string) => {
        try {
          await createDirectory(parentDir, dirName);
          setInputModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          alert('Failed to create directory: ' + (error as Error).message);
        }
      }
    });
  };

  const handleRename = async (file: FileNode) => {
    const currentName = file.name.replace(/\.md$/, '');
    setInputModal({
      isOpen: true,
      title: `Rename ${file.type === 'directory' ? 'Folder' : 'Note'}`,
      placeholder: 'Enter new name',
      defaultValue: currentName,
      onSubmit: async (newName: string) => {
        if (newName === currentName) {
          setInputModal(prev => ({ ...prev, isOpen: false }));
          return;
        }

        const finalName = file.type === 'file' && file.extension === '.md' ? `${newName}.md` : newName;

        try {
          await renameFileOrDir(file.path, finalName);
          setInputModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          alert('Failed to rename: ' + (error as Error).message);
        }
      }
    });
  };

  const handleDelete = async (file: FileNode) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete ${file.type === 'directory' ? 'Folder' : 'Note'}`,
      message: `Are you sure you want to delete "${file.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteFileOrDir(file.path);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          alert('Failed to delete: ' + (error as Error).message);
        }
      }
    });
  };

  const getContextMenuItems = (file: FileNode | null): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    if (!file) {
      // Root context menu
      if (vault) {
        items.push({
          label: 'New Note',
          icon: <PlusIcon />,
          onClick: () => handleCreateNote(vault)
        });
        items.push({
          label: 'New Folder',
          icon: <PlusIcon />,
          onClick: () => handleCreateDirectory(vault)
        });
      }
      return items;
    }

    if (file.type === 'directory') {
      items.push({
        label: 'New Note',
        icon: <PlusIcon />,
        onClick: () => handleCreateNote(file.path)
      });
      items.push({
        label: 'New Folder',
        icon: <PlusIcon />,
        onClick: () => handleCreateDirectory(file.path)
      });
    }

    items.push({
      label: 'Rename',
      icon: <RenameIcon />,
      onClick: () => handleRename(file)
    });

    items.push({
      label: 'Delete',
      icon: <DeleteIcon />,
      onClick: () => handleDelete(file),
      danger: true
    });

    return items;
  };

  if (!files || files.length === 0) {
    return (
      <div className="empty-vault">
        <p>No files found in vault</p>
      </div>
    );
  }

  return (
    <div
      className={`file-tree`}
      onContextMenu={handleRootContextMenu}
      onDragOver={handleRootDragOver}
      onDrop={handleRootDrop}
    >
      {files.map((file, index) => (
        <FileItem
          key={`${file.path}-${index}`}
          file={file}
          level={0}
          onContextMenu={handleContextMenu}
        />
      ))}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          items={getContextMenuItems(contextMenu.file)}
        />
      )}

      <InputModal
        isOpen={inputModal.isOpen}
        title={inputModal.title}
        placeholder={inputModal.placeholder}
        defaultValue={inputModal.defaultValue}
        onSubmit={inputModal.onSubmit}
        onCancel={() => setInputModal(prev => ({ ...prev, isOpen: false }))}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Delete"
        danger={true}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

const FileItem: React.FC<FileItemProps> = ({ file, level, onContextMenu }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { setCurrentFile, addTab, updateNoteTags } = useAppStore();
  const fileSystem = new ElectronFileSystem();

  const handleFileClick = async () => {
    if (file.type === 'file' && file.extension === '.md') {
      try {
        const content = await fileSystem.readFile(file.path);
        const { frontMatter, body } = parseMarkdownFile(content);
        const links = extractLinks(body);
        const tags = extractTags(content);

        const note = {
          path: file.path,
          name: file.name,
          content: content,
          frontMatter,
          tags,
          links,
          backlinks: [],
          lastModified: file.lastModified || new Date(),
          created: file.lastModified || new Date(),
        };

        setCurrentFile(note);
        updateNoteTags(note.path, note.name, content);
        addTab(note);
      } catch (error) {
        console.error('Failed to open file:', error);
      }
    } else if (file.type === 'directory') {
      setIsExpanded(!isExpanded);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(file, e.clientX, e.clientY);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', file.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to parent
    setIsDragOver(false);

    const draggedPath = e.dataTransfer.getData('text/plain');
    if (!draggedPath) return;

    let targetDir: string;

    if (file.type === 'directory') {
      targetDir = file.path;
    } else {
      const parentParts = file.path.split(/[/\\]/);
      parentParts.pop();
      targetDir = parentParts.join('/');
    }

    if (draggedPath === targetDir) return;

    if (draggedPath && targetDir.startsWith(draggedPath + '/')) {
      alert('Cannot move a directory into itself');
      return;
    }

    try {
      const draggedName = draggedPath.split(/[/\\]/).pop();
      if (!draggedName) return;

      const currentParent = draggedPath.split(/[/\\]/).slice(0, -1).join('/');
      if (currentParent === targetDir) {

        return;
      }

      const newPath = `${targetDir}/${draggedName}`;
      const { renameFileOrDir } = useAppStore.getState();
      await renameFileOrDir(draggedPath, newPath);
    } catch (error) {
      alert('Failed to move: ' + (error as Error).message);
    }
  };

  const getFileIcon = (file: FileNode) => {
    if (file.type === 'directory') {
      return isExpanded ? <FolderOpenIcon /> : <FolderIcon />;
    }
    if (file.extension === '.md') {
      return <NoteIcon />;
    }
    return <FileIcon />;
  };

  return (
    <div className="file-item">
      <div
        className={`file-item-header ${file.type} ${isDragOver ? 'drag-over' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleFileClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="file-icon">{getFileIcon(file)}</span>
        <span className="file-name">{file.name}</span>
      </div>

      {file.type === 'directory' && isExpanded && file.children && (
        <div className="file-children">
          {file.children.map((child, index) => (
            <FileItem
              key={`${child.path}-${index}`}
              file={child}
              level={level + 1}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FileTree;
