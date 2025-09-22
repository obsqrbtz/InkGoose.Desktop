import { FileSystemAPI } from "../../packages/core/api/fileSystemAPI";
import { FileNode } from "../../packages/core/types";

export class ElectronFileSystem implements FileSystemAPI {
  async selectVaultFolder() { return window.electronAPI?.selectVaultFolder() ?? null; }
  async loadVault(vaultPath: string): Promise<FileNode[]> { return window.electronAPI?.loadVault(vaultPath) ?? []; }
  async readFile(filePath: string) { return window.electronAPI?.readFile(filePath) ?? ""; }
  async writeFile(filePath: string, content: string) { await window.electronAPI?.writeFile(filePath, content); }
  async createFile(filePath: string, content = "") { await window.electronAPI?.createFile(filePath, content); }
  async createDirectory(dirPath: string) { await window.electronAPI?.createDirectory(dirPath); }
  async deleteFile(filePath: string) { await window.electronAPI?.deleteFile(filePath); }
  async renameFile(oldPath: string, newPath: string) { await window.electronAPI?.renameFile(oldPath, newPath); }

  async watchVault(vaultPath: string, onChange: (event: string, filePath: string) => void) {
    await window.electronAPI?.watchVault(vaultPath);
    const unsubscribe = window.electronAPI?.onVaultChanged?.(({ event, path }: { event: string; path: string }) => onChange(event, path));
    return () => {
      try { if (typeof unsubscribe === "function") unsubscribe(); } catch {}
      try { window.electronAPI?.unwatchVault?.(); } catch {}
    };
  }

  async getDefaultAppPath() { return window.electronAPI?.getDefaultAppPath() ?? ""; }
  async getUserDataPath(username: string) { return window.electronAPI?.getUserDataPath(username) ?? ""; }
  async getVaultsPath(username: string) { return window.electronAPI?.getVaultsPath(username) ?? ""; }
  async getVaultPath(username: string, vaultName: string) { return window.electronAPI?.getVaultPath(username, vaultName) ?? ""; }
  async initializeUserDirectories(username: string) { return window.electronAPI?.initializeUserDirectories(username) ?? false; }
  async ensureDirectory(dirPath: string) { return window.electronAPI?.ensureDirectory(dirPath) ?? false; }
  async listUserVaults(username: string) { return window.electronAPI?.listUserVaults(username) ?? []; }
  async copyFolderContents(sourcePath: string, destPath: string) { return window.electronAPI?.copyFolderContents(sourcePath, destPath) ?? false; }
  async checkDirectoryContent(dirPath: string) { return window.electronAPI?.checkDirectoryContent(dirPath) ?? { isDirectory: false, hasContent: false, fileCount: 0 }; }
}
