import { FileNode } from "../types";

export interface FileSystemAPI {
  selectVaultFolder(): Promise<string | null>;
  loadVault(vaultPath: string): Promise<FileNode[]>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  createFile(filePath: string, content?: string): Promise<void>;
  createDirectory(dirPath: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  renameFile(oldPath: string, newPath: string): Promise<void>;
  watchVault(vaultPath: string, onChange: (event: string, filePath: string) => void): Promise<() => void>;
  getDefaultAppPath(): Promise<string>;
  getUserDataPath(username: string): Promise<string>;
  getVaultsPath(username: string): Promise<string>;
  getVaultPath(username: string, vaultName: string): Promise<string>;
  initializeUserDirectories(username: string): Promise<boolean>;
  ensureDirectory(dirPath: string): Promise<boolean>;
  listUserVaults(username: string): Promise<Array<{name: string; path: string; lastModified: Date}>>;
  copyFolderContents(sourcePath: string, destPath: string): Promise<boolean>;
  checkDirectoryContent(dirPath: string): Promise<{isDirectory: boolean; hasContent: boolean; fileCount: number}>;
}
