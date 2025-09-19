import { SyncAPI, SyncAction, FileSyncInfo } from '../api/syncAPI';
import { FileSystemAPI } from '../api/fileSystemAPI';
import { FileNode, LocalFileInfo, SyncConflict } from '../types';
import { CryptoService } from './cryptoService';
import { ConflictResolver } from './conflictResolver';

export class SyncService {
    private static readonly SYNC_METADATA_FILE = '.ink-goose-sync.json';

    private static async calculateContentHash(content: string): Promise<string> {
        return CryptoService.generateContentHash(content);
    }

    private static getRelativePath(fullPath: string, vaultPath: string): string {
        if (fullPath.startsWith(vaultPath)) {
            return fullPath.substring(vaultPath.length + 1).replace(/\\/g, '/');
        }
        return fullPath.replace(/\\/g, '/');
    }

    private static async readSyncMetadata(vaultPath: string): Promise<Record<string, { version: number; hash: string; lastSynced: string }>> {
        try {
            const metadataPath = `${vaultPath}/${this.SYNC_METADATA_FILE}`;
            const content = await FileSystemAPI.readFile(metadataPath);
            return JSON.parse(content);
        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError?.code === 'ENOENT' || nodeError?.errno === -4058) {
                try {
                    await this.writeSyncMetadata(vaultPath, {});
                } catch (writeError) {
                    console.warn('Could not create sync metadata file:', writeError);
                }
            }
            return {};
        }
    }

    private static async writeSyncMetadata(vaultPath: string, metadata: Record<string, { version: number; hash: string; lastSynced: string }>): Promise<void> {
        try {
            const metadataPath = `${vaultPath}/${this.SYNC_METADATA_FILE}`;
            await FileSystemAPI.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        } catch (error) {
            console.error('Failed to write sync metadata:', error);
            throw error;
        }
    }

    static async getLocalFiles(vaultPath: string, fileTree: FileNode[]): Promise<LocalFileInfo[]> {
        const localFiles: LocalFileInfo[] = [];
        const metadata = await this.readSyncMetadata(vaultPath);

        const collectFiles = async (nodes: FileNode[]): Promise<void> => {
            for (const node of nodes) {
                if (node.type === 'directory' && node.children) {
                    await collectFiles(node.children);
                } else if (node.type === 'file' && node.extension === '.md' && !node.name.startsWith('.ink-goose')) {
                    try {
                        const content = await FileSystemAPI.readFile(node.path);
                        const relativePath = this.getRelativePath(node.path, vaultPath);
                        const contentHash = await this.calculateContentHash(content);
                        const fileMetadata = metadata[relativePath];

                        localFiles.push({
                            path: node.path,
                            relativePath,
                            content,
                            contentHash,
                            version: fileMetadata?.version || 1,
                            lastModified: node.lastModified || new Date(),
                        });
                    } catch (error) {
                        console.error(`Failed to read file ${node.path}:`, error);
                    }
                }
            }
        };

        await collectFiles(fileTree);
        return localFiles;
    }

    static async checkSync(vaultId: string, vaultPath: string, fileTree: FileNode[]): Promise<{
        actions: Array<{ path: string; action: SyncAction; serverVersion: number; fileId?: string }>;
        conflicts: SyncConflict[];
    }> {
        try {
            const localFiles = await this.getLocalFiles(vaultPath, fileTree);

            const syncRequest: FileSyncInfo[] = localFiles.map(file => ({
                relativePath: file.relativePath,
                version: file.version,
                contentHash: file.contentHash,
            }));

            const response = await SyncAPI.checkSync(vaultId, { files: syncRequest });

            const actions = response.actions.map((action) => {
                const localFile = localFiles.find(f => f.relativePath === action.relativePath);

                if (action.action === SyncAction.Conflict && localFile) {
                    return {
                        path: localFile.path,
                        action: SyncAction.Upload,
                        serverVersion: action.serverVersion,
                        fileId: action.fileId,
                    };
                }

                return {
                    path: localFile?.path || action.relativePath,
                    action: action.action,
                    serverVersion: action.serverVersion,
                    fileId: action.fileId,
                };
            });

            return { actions, conflicts: [] };
        } catch (error) {
            console.error('Sync check failed:', error);
            throw error;
        }
    }

    static async uploadFile(vaultId: string, vaultPath: string, localFile: LocalFileInfo): Promise<void> {
        try {
            if (!CryptoService.getMasterKey()) {
                throw new Error('Encryption not available. Please log in to upload files.');
            }

            const { encryptedContent, encryptedFileKey } = CryptoService.prepareFileForUpload(localFile.content);

            const metadata = await this.readSyncMetadata(vaultPath);
            const currentMetadata = metadata[localFile.relativePath];
            const nextVersion = currentMetadata ? currentMetadata.version + 1 : 1;

            const uploadRequest = {
                relativePath: localFile.relativePath,
                version: nextVersion,
                sizeBytes: new TextEncoder().encode(encryptedContent).length, // TODO: Ensure sizeBytes is correct
                encryptedFileKey,
                contentHash: localFile.contentHash,
            };

            const response = await SyncAPI.uploadFile(vaultId, uploadRequest, encryptedContent);

            if (response.success) {
                const updatedMetadata = await this.readSyncMetadata(vaultPath);
                updatedMetadata[localFile.relativePath] = {
                    version: response.version,
                    hash: localFile.contentHash,
                    lastSynced: new Date().toISOString(),
                };
                await this.writeSyncMetadata(vaultPath, updatedMetadata);
            } else {
                if (response.conflict) {
                    const resolvedResponse = await ConflictResolver.handleUploadConflict(
                        vaultId,
                        uploadRequest,
                        encryptedContent,
                        response.conflict
                    );

                    if (resolvedResponse.success) {
                        const updatedMetadata = await this.readSyncMetadata(vaultPath);
                        updatedMetadata[localFile.relativePath] = {
                            version: resolvedResponse.version,
                            hash: localFile.contentHash,
                            lastSynced: new Date().toISOString(),
                        };
                        await this.writeSyncMetadata(vaultPath, updatedMetadata);
                    } else {
                        throw new Error('Failed to resolve conflict during upload');
                    }
                } else {
                    throw new Error('Upload failed - server returned success: false');
                }
            }
        } catch (error) {
            console.error(`Failed to upload file ${localFile.path}:`, error);
            throw error;
        }
    }

    static async downloadFile(vaultId: string, vaultPath: string, fileId: string, relativePath: string, version?: number): Promise<void> {
        try {
            const fullPath = `${vaultPath}/${relativePath}`;
            const metadata = await this.readSyncMetadata(vaultPath);
            const fileMetadata = metadata[relativePath];

            let hasLocalConflict = false;
            let localContent = '';
            let localVersion = 0;

            try {
                const existsCheck = await FileSystemAPI.readFile(fullPath);
                localContent = existsCheck;
                localVersion = fileMetadata?.version || 1;

                const localHash = await this.calculateContentHash(localContent);
                const lastSyncedHash = fileMetadata?.hash;

                if (lastSyncedHash && localHash !== lastSyncedHash) {
                    hasLocalConflict = true;
                }
            } catch (error) {
                // todo: handle errors
            }

            if (hasLocalConflict) {
                const resolution = await ConflictResolver.handleDownloadConflict(
                    vaultId,
                    fileId,
                    relativePath,
                    version || 1,
                    localContent,
                    localVersion
                );

                const pathParts = relativePath.split('/');
                if (pathParts.length > 1) {
                    const dirPath = `${vaultPath}/${pathParts.slice(0, -1).join('/')}`;
                    await FileSystemAPI.ensureDirectory(dirPath);
                }

                await FileSystemAPI.writeFile(fullPath, resolution.content);

                const contentHash = CryptoService.generateContentHash(resolution.content);
                metadata[relativePath] = {
                    version: version || 1,
                    hash: contentHash,
                    lastSynced: new Date().toISOString(),
                };
                await this.writeSyncMetadata(vaultPath, metadata);

                if (resolution.shouldUpload && resolution.uploadRequest) {
                    const nextVersion = (version || 1) + 1;
                    const uploadRequest = {
                        ...resolution.uploadRequest,
                        version: nextVersion
                    };

                    try {
                        const uploadResponse = await SyncAPI.forceUploadFile(vaultId, uploadRequest, resolution.encryptedContent);
                        if (uploadResponse.success) {
                            metadata[relativePath].version = uploadResponse.version;
                            await this.writeSyncMetadata(vaultPath, metadata);
                        }
                    } catch (uploadError) {
                        console.error('Failed to upload resolved content:', uploadError);
                    }
                }

                return;
            }

            const fileVersion = await SyncAPI.downloadFile(vaultId, fileId, version);

            if (!CryptoService.getMasterKey()) {
                throw new Error('Encryption not available. Please log in to download files.');
            }

            const content = CryptoService.prepareDownloadedFile(fileVersion.encryptedContent, fileVersion.encryptedFileKey);

            const pathParts = relativePath.split('/');
            if (pathParts.length > 1) {
                const dirPath = `${vaultPath}/${pathParts.slice(0, -1).join('/')}`;
                await FileSystemAPI.ensureDirectory(dirPath);
            }

            await FileSystemAPI.writeFile(fullPath, content);

            metadata[relativePath] = {
                version: fileVersion.version,
                hash: fileVersion.contentHash,
                lastSynced: new Date().toISOString(),
            };
            await this.writeSyncMetadata(vaultPath, metadata);
        } catch (error) {
            console.error(`Failed to download file ${relativePath}:`, error);
            throw error;
        }
    }

    static async performFullSync(
        vaultId: string,
        vaultPath: string,
        fileTree: FileNode[],
        onProgress?: (status: string, progress: number) => void
    ): Promise<SyncConflict[]> {
        try {
            onProgress?.('Checking for changes...', 0);

            const { actions } = await this.checkSync(vaultId, vaultPath, fileTree);

            const localFiles = await this.getLocalFiles(vaultPath, fileTree);
            let completed = 0;
            const total = actions.length;

            for (const action of actions) {
                const localFile = localFiles.find(f => f.path === action.path);

                switch (action.action) {
                    case SyncAction.Upload:
                        if (localFile) {
                            onProgress?.(`Uploading ${localFile.relativePath}...`, (completed / total) * 100);
                            await this.uploadFile(vaultId, vaultPath, localFile);
                        }
                        break;
                    case SyncAction.Download:
                        if (action.fileId) {
                            const relativePath = localFile ? this.getRelativePath(action.path, vaultPath) : action.path;
                            onProgress?.(`Downloading ${relativePath}...`, (completed / total) * 100);
                            await this.downloadFile(vaultId, vaultPath, action.fileId, relativePath, action.serverVersion);
                        }
                        break;
                }

                completed++;
            }

            onProgress?.('Sync completed', 100);
            return [];
        } catch (error) {
            console.error('Full sync failed:', error);
            throw error;
        }
    }
}
