export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
  size?: number;
  lastModified?: Date;
}

export interface Note {
  path: string;
  name: string;
  content: string;
  frontMatter?: Record<string, unknown>;
  tags?: string[];
  links?: string[];
  backlinks?: string[];
  lastModified: Date;
  created: Date;
}

export interface SearchResult {
  file: FileNode;
  excerpt: string;
  matches: number;
  score: number;
}

export interface TagFileRef {
  path: string;
  name: string;
}

export interface TagsByName {
  [tag: string]: {
    files: TagFileRef[];
  };
}

export interface NoteTagsMap {
  [notePath: string]: string[]; // tags for each note
}

export interface AppTheme {
  name: string;
  displayName: string;
  isDark: boolean;
}

export interface AppSettings {
  theme: string;
  fontSize: number;
  fontFamily: string;
  editorWidth: number;
  showLineNumbers: boolean;
  wrapText: boolean;
  spellCheck: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
}

export interface VaultStats {
  totalFiles: number;
  totalWords: number;
  totalCharacters: number;
  lastModified: Date;
}

// Sync-related types
export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingUploads: string[];
  currentVaultId: string | null;
}

export interface FileSyncStatus {
  path: string;
  status: 'synced' | 'uploading' | 'downloading' | 'conflict' | 'error';
  version: number;
  lastSynced?: Date;
  error?: string;
}

export interface LocalFileInfo {
  path: string;
  relativePath: string;
  content: string;
  contentHash: string;
  version: number;
  lastModified: Date;
}

// TODO: remove
export interface SyncConflict {
  id: string;
  filePath: string;
  localVersion: number;
  serverVersion: number;
  localContent: string;
  serverContent: string;
  timestamp: Date;
}
