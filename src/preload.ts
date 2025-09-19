import { contextBridge, ipcRenderer } from 'electron';
import { FileNode } from './types';

contextBridge.exposeInMainWorld('electronAPI', {
  selectVaultFolder: () => ipcRenderer.invoke('select-vault-folder'),
  loadVault: (vaultPath: string) => ipcRenderer.invoke('load-vault', vaultPath),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', filePath, content),
  createFile: (filePath: string, content: string) => ipcRenderer.invoke('create-file', filePath, content),
  createDirectory: (dirPath: string) => ipcRenderer.invoke('create-directory', dirPath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  watchVault: (vaultPath: string) => ipcRenderer.invoke('watch-vault', vaultPath),
  unwatchVault: () => ipcRenderer.invoke('unwatch-vault'),

  getDefaultAppPath: () => ipcRenderer.invoke('get-default-app-path'),
  getUserDataPath: (username: string) => ipcRenderer.invoke('get-user-data-path', username),
  getVaultsPath: (username: string) => ipcRenderer.invoke('get-vaults-path', username),
  getVaultPath: (username: string, vaultName: string) => ipcRenderer.invoke('get-vault-path', username, vaultName),
  initializeUserDirectories: (username: string) => ipcRenderer.invoke('initialize-user-directories', username),
  ensureDirectory: (dirPath: string) => ipcRenderer.invoke('ensure-directory', dirPath),
  listUserVaults: (username: string) => ipcRenderer.invoke('list-user-vaults', username),
  copyFolderContents: (sourcePath: string, destPath: string) => ipcRenderer.invoke('copy-folder-contents', sourcePath, destPath),
  checkDirectoryContent: (dirPath: string) => ipcRenderer.invoke('check-directory-content', dirPath),

  safeStorage: {
    storeSecureKey: (key: string, value: string) => ipcRenderer.invoke('safe-storage-store', key, value),
    getSecureKey: (key: string) => ipcRenderer.invoke('safe-storage-get', key),
    deleteSecureKey: (key: string) => ipcRenderer.invoke('safe-storage-delete', key),
    isAvailable: () => ipcRenderer.invoke('safe-storage-available'),
  },

  downloadFileContent: (url: string) => ipcRenderer.invoke('download-file-content', url),
  uploadFileContent: (url: string, content: string) => ipcRenderer.invoke('upload-file-content', url, content),

  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onVaultChanged: (callback: (payload: { event: string; path: string }) => void) => {
    const listener = (_: unknown, payload: { event: string; path: string }) => callback(payload);
    ipcRenderer.on('vault:changed', listener);
    return () => ipcRenderer.removeListener('vault:changed', listener);
  },
  onWindowMaximized: (callback: (isMaximized: boolean) => void) => {
    const listener = (_: unknown, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window:maximized', listener);
    return () => ipcRenderer.removeListener('window:maximized', listener);
  },
});

declare global {
  interface Window {
    electronAPI: {
      selectVaultFolder: () => Promise<string | null>;
      loadVault: (vaultPath: string) => Promise<FileNode[]>;
      readFile: (filePath: string) => Promise<string>;
      writeFile: (filePath: string, content: string) => Promise<boolean>;
      createFile: (filePath: string, content: string) => Promise<boolean>;
      createDirectory: (dirPath: string) => Promise<boolean>;
      deleteFile: (filePath: string) => Promise<boolean>;
      renameFile: (oldPath: string, newPath: string) => Promise<boolean>;
      watchVault: (vaultPath: string) => Promise<boolean>;
      unwatchVault: () => Promise<boolean>;

      getDefaultAppPath: () => Promise<string>;
      getUserDataPath: (username: string) => Promise<string>;
      getVaultsPath: (username: string) => Promise<string>;
      getVaultPath: (username: string, vaultName: string) => Promise<string>;
      initializeUserDirectories: (username: string) => Promise<boolean>;
      ensureDirectory: (dirPath: string) => Promise<boolean>;
      listUserVaults: (username: string) => Promise<Array<{ name: string; path: string; lastModified: Date }>>;
      copyFolderContents: (sourcePath: string, destPath: string) => Promise<boolean>;
      checkDirectoryContent: (dirPath: string) => Promise<{ isDirectory: boolean; hasContent: boolean; fileCount: number }>;

      safeStorage: {
        storeSecureKey: (key: string, value: string) => Promise<void>;
        getSecureKey: (key: string) => Promise<string | null>;
        deleteSecureKey: (key: string) => Promise<void>;
        isAvailable: () => Promise<boolean>;
      };

      downloadFileContent: (url: string) => Promise<string>;
      uploadFileContent: (url: string, content: string) => Promise<boolean>;

      onVaultChanged: (callback: (payload: { event: string; path: string }) => void) => () => void;
      minimizeWindow: () => void;
      toggleMaximizeWindow: () => void;
      closeWindow: () => void;
      onWindowMaximized: (callback: (isMaximized: boolean) => void) => () => void;
    };
  }
}
