import { FileNode } from '../types';

// implemented in preload.ts
export class FileSystemAPI {
  static async selectVaultFolder(): Promise<string | null> {
    return window.electronAPI?.selectVaultFolder() ?? null;
  }

  static async loadVault(vaultPath: string): Promise<FileNode[]> {
    return window.electronAPI?.loadVault(vaultPath) ?? [];
  }

  static async readFile(filePath: string): Promise<string> {
    return window.electronAPI?.readFile(filePath) ?? '';
  }

  static async writeFile(filePath: string, content: string): Promise<void> {
    await window.electronAPI?.writeFile(filePath, content);
  }

  static async createFile(filePath: string, content = ''): Promise<void> {
    await window.electronAPI?.createFile(filePath, content);
  }

  static async createDirectory(dirPath: string): Promise<void> {
    await window.electronAPI?.createDirectory(dirPath);
  }

  static async deleteFile(filePath: string): Promise<void> {
    await window.electronAPI?.deleteFile(filePath);
  }

  static async renameFile(oldPath: string, newPath: string): Promise<void> {
    await window.electronAPI?.renameFile(oldPath, newPath);
  }

  static async watchVault(vaultPath: string, onChange: (event: string, filePath: string) => void): Promise<() => void> {
    await window.electronAPI?.watchVault(vaultPath);
    const unsubscribe = window.electronAPI?.onVaultChanged?.(({ event, path }: { event: string; path: string }) => onChange(event, path));
    return () => {
      try { if (typeof unsubscribe === 'function') unsubscribe(); } catch { /* ignore */ }
      try { window.electronAPI?.unwatchVault?.(); } catch { /* ignore */ }
    };
  }

  static parseMarkdownFile(content: string): { frontMatter: Record<string, unknown>, body: string } {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (match) {
      try {
        // Simple YAML parser for frontmatter
        const frontMatterText = match[1];
        const frontMatter: Record<string, unknown> = {};

        frontMatterText.split('\n').forEach(line => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            frontMatter[key] = value;
          }
        });

        return {
          frontMatter,
          body: match[2]
        };
      } catch (error) {
        console.error('Error parsing frontmatter:', error);
        return { frontMatter: {}, body: content };
      }
    }

    return { frontMatter: {}, body: content };
  }

  static extractLinks(content: string): string[] {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      links.push(match[1]);
    }

    return links;
  }

  static extractTags(content: string): string[] {
    const tagRegex = /#([a-zA-Z0-9_-]+)/g;
    const tags: string[] = [];
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      tags.push(match[1]);
    }

    return tags;
  }

  static async getDefaultAppPath(): Promise<string> {
    return window.electronAPI?.getDefaultAppPath() ?? '';
  }

  static async getUserDataPath(username: string): Promise<string> {
    return window.electronAPI?.getUserDataPath(username) ?? '';
  }

  static async getVaultsPath(username: string): Promise<string> {
    return window.electronAPI?.getVaultsPath(username) ?? '';
  }

  static async getVaultPath(username: string, vaultName: string): Promise<string> {
    return window.electronAPI?.getVaultPath(username, vaultName) ?? '';
  }

  static async initializeUserDirectories(username: string): Promise<boolean> {
    return window.electronAPI?.initializeUserDirectories(username) ?? false;
  }

  static async ensureDirectory(dirPath: string): Promise<boolean> {
    return window.electronAPI?.ensureDirectory(dirPath) ?? false;
  }

  static async listUserVaults(username: string): Promise<Array<{name: string; path: string; lastModified: Date}>> {
    return window.electronAPI?.listUserVaults(username) ?? [];
  }

  static async copyFolderContents(sourcePath: string, destPath: string): Promise<boolean> {
    return window.electronAPI?.copyFolderContents(sourcePath, destPath) ?? false;
  }

  static async checkDirectoryContent(dirPath: string): Promise<{isDirectory: boolean; hasContent: boolean; fileCount: number}> {
    return window.electronAPI?.checkDirectoryContent(dirPath) ?? { isDirectory: false, hasContent: false, fileCount: 0 };
  }
}
