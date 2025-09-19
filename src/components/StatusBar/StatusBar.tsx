import React from 'react';
import { useAppStore } from '../../store/appStore';
import { FileNode } from '../../types';
import { SyncStatus } from '../SyncStatus';
import './StatusBar.css';
import FolderIcon from '../icons/FolderIcon';

const StatusBar: React.FC = () => {
  const { currentFile, vault, files } = useAppStore();

  const getFileCount = (files: FileNode[]): number => {
    let count = 0;
    files.forEach(file => {
      if (file.type === 'file' && file.extension === '.md') {
        count++;
      } else if (file.type === 'directory' && file.children) {
        count += getFileCount(file.children);
      }
    });
    return count;
  };

  const fileCount = getFileCount(files);

  const getWordCount = (content: string): number => {
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const getCharCount = (content: string): number => {
    return content.length;
  };

  const wordCount = currentFile ? getWordCount(currentFile.content) : 0;
  const charCount = currentFile ? getCharCount(currentFile.content) : 0;

  return (
    <div className="status-bar">
      <div className="status-left">
        {vault && (
          <span className="vault-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FolderIcon />
            <span>{fileCount} files</span>
          </span>
        )}
      </div>

      <div className="status-center">
        {currentFile && (
          <span className="file-stats">
            {wordCount} words • {charCount} characters
          </span>
        )}
      </div>

      <div className="status-right">
        <SyncStatus />
      </div>
    </div>
  );
};

export default StatusBar;
