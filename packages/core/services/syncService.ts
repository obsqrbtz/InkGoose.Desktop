import { SyncAPI, SyncAction, FileSyncInfo } from '../api/syncAPI';
import { FileSystemAPI } from '../api/fileSystemAPI';
import { FileNode, LocalFileInfo, SyncConflict } from '../../../packages/core/types';
import { ConflictResolver } from './conflictResolver';
import { CryptoService } from './cryptoService/cryptoService';

interface QueuedOperation {
    id: string;
    type: 'upload' | 'download';
    priority: number;
    vaultId: string;
    vaultPath: string;
    data: any;
    retries: number;
    maxRetries: number;
}

interface SyncProgress {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
    status: string;
}

export class SyncService {
    constructor(private sync: SyncAPI, private conflictResolver: ConflictResolver, private fileSystem: FileSystemAPI, private cryptoService: CryptoService) { }
    private readonly SYNC_METADATA_FILE = '.ink-goose-sync.json';
    private readonly MAX_CONCURRENT_OPERATIONS = 5;
    private readonly MAX_RETRIES = 3;

    private operationQueue: QueuedOperation[] = [];
    private activeOperations = new Set<string>();
    private isProcessingQueue = false;
    private progressCallbacks = new Map<string, (progress: SyncProgress) => void>();
    private syncProgress = new Map<string, SyncProgress>();

    private async calculateContentHash(content: string): Promise<string> {
        return this.cryptoService.generateContentHash(content);
    }

    private getRelativePath(fullPath: string, vaultPath: string): string {
        if (fullPath.startsWith(vaultPath)) {
            return fullPath.substring(vaultPath.length + 1).replace(/\\/g, '/');
        }
        return fullPath.replace(/\\/g, '/');
    }

    private async readSyncMetadata(vaultPath: string): Promise<Record<string, { version: number; hash: string; lastSynced: string }>> {
        try {
            const metadataPath = `${vaultPath}/${this.SYNC_METADATA_FILE}`;
            const content = await this.fileSystem.readFile(metadataPath);
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

    private async writeSyncMetadata(vaultPath: string, metadata: Record<string, { version: number; hash: string; lastSynced: string }>): Promise<void> {
        try {
            const metadataPath = `${vaultPath}/${this.SYNC_METADATA_FILE}`;
            await this.fileSystem.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        } catch (error) {
            console.error('Failed to write sync metadata:', error);
            throw error;
        }
    }

    private generateOperationId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    private updateProgress(
        vaultId: string,
        update: Partial<SyncProgress> | ((current: SyncProgress) => Partial<SyncProgress>)
    ): void {
        const current = this.syncProgress.get(vaultId) || {
            total: 0,
            completed: 0,
            failed: 0,
            inProgress: 0,
            status: 'idle'
        };

        const updated = typeof update === 'function'
            ? { ...current, ...update(current) }
            : { ...current, ...update };

        this.syncProgress.set(vaultId, updated);

        const callback = this.progressCallbacks.get(vaultId);
        if (callback) callback(updated);
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        try {
            const runNext = async () => {
                while (this.operationQueue.length > 0 && this.activeOperations.size < this.MAX_CONCURRENT_OPERATIONS) {
                    this.operationQueue.sort((a, b) => b.priority - a.priority);
                    const operation = this.operationQueue.shift();
                    if (!operation) break;

                    this.activeOperations.add(operation.id);
                    this.updateProgress(operation.vaultId, { inProgress: this.activeOperations.size });

                    this.processOperation(operation)
                        .finally(() => {
                            this.activeOperations.delete(operation.id);
                            this.updateProgress(operation.vaultId, { inProgress: this.activeOperations.size });
                            runNext().catch(console.error);
                        });
                }
            };

            await runNext();
        } finally {
            this.isProcessingQueue = false;
        }
    }
    private async processOperation(operation: QueuedOperation): Promise<void> {
        try {
            if (operation.type === 'upload') {
                await this.uploadFile(operation.vaultId, operation.vaultPath, operation.data);
            } else if (operation.type === 'download') {
                await this.downloadFile(
                    operation.vaultId,
                    operation.vaultPath,
                    operation.data.fileId,
                    operation.data.relativePath,
                    operation.data.version
                );
            }

            this.updateProgress(operation.vaultId, progress => ({
                completed: progress.completed + 1
            }));

            (operation as any).resolve?.();
        } catch (error) {
            if (operation.retries < operation.maxRetries) {
                operation.retries++;
                operation.priority = Math.max(0, operation.priority - 1); // Decrease priority on retry
                this.operationQueue.push(operation);
            } else {
                this.updateProgress(operation.vaultId, progress => ({
                    failed: progress.failed + 1
                }));
                (operation as any).reject?.(error);
            }
        }
    }

    private updateOperationProgress(vaultId: string, completedIncrement: number, failedIncrement: number) {
        const progress = this.syncProgress.get(vaultId);
        if (!progress) return;

        const updated = {
            ...progress,
            completed: progress.completed + completedIncrement,
            failed: progress.failed + failedIncrement,
            inProgress: this.activeOperations.size
        };

        this.syncProgress.set(vaultId, updated);

        const callback = this.progressCallbacks.get(vaultId);
        if (callback) callback(updated);
    }

    private checkIfVaultCompleted(vaultId: string) {
        const progress = this.syncProgress.get(vaultId);
        if (!progress) return;

        const pending = this.operationQueue.filter(op => op.vaultId === vaultId).length;
        const active = Array.from(this.activeOperations).filter(id =>
            !this.operationQueue.find(op => op.id === id)
        ).length;

        if (pending === 0 && active === 0) {
            this.updateProgress(vaultId, { status: 'completed', inProgress: 0 });
        }
    }

    private queueOperation<T extends 'upload' | 'download'>(
        type: T,
        vaultId: string,
        vaultPath: string,
        data: unknown,
        priority = 1
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const operation: QueuedOperation = {
                id: this.generateOperationId(),
                type,
                priority,
                vaultId,
                vaultPath,
                data,
                retries: 0,
                maxRetries: this.MAX_RETRIES,
            };

            (operation as any).resolve = resolve;
            (operation as any).reject = reject;

            this.operationQueue.push(operation);
            this.processQueue().catch(console.error);
        });
    }

    async getLocalFiles(vaultPath: string, fileTree: FileNode[]): Promise<LocalFileInfo[]> {
        const localFiles: LocalFileInfo[] = [];
        const metadata = await this.readSyncMetadata(vaultPath);

        const collectFiles = async (nodes: FileNode[]): Promise<void> => {
            for (const node of nodes) {
                if (node.type === 'directory' && node.children) {
                    await collectFiles(node.children);
                } else if (node.type === 'file' && node.extension === '.md' && !node.name.startsWith('.ink-goose')) {
                    try {
                        const content = await this.fileSystem.readFile(node.path);
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

    async checkSync(vaultId: string, vaultPath: string, fileTree: FileNode[]): Promise<{
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

            const response = await this.sync.checkSync(vaultId, { files: syncRequest });

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

    async uploadFile(vaultId: string, vaultPath: string, localFile: LocalFileInfo): Promise<void> {
        try {
            if (!this.cryptoService.getMasterKey()) {
                throw new Error('Encryption not available. Please log in to upload files.');
            }

            const { encryptedContent, encryptedFileKey } = this.cryptoService.prepareFileForUpload(localFile.content);

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

            const response = await this.sync.uploadFile(vaultId, uploadRequest, encryptedContent);

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
                    const resolvedResponse = await this.conflictResolver.handleUploadConflict(
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

    async downloadFile(vaultId: string, vaultPath: string, fileId: string, relativePath: string, version?: number): Promise<void> {
        try {
            const fullPath = `${vaultPath}/${relativePath}`;
            const metadata = await this.readSyncMetadata(vaultPath);
            const fileMetadata = metadata[relativePath];

            let hasLocalConflict = false;
            let localContent = '';
            let localVersion = 0;

            try {
                const existsCheck = await this.fileSystem.readFile(fullPath);
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
                const resolution = await this.conflictResolver.handleDownloadConflict(
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
                    await this.fileSystem.ensureDirectory(dirPath);
                }

                await this.fileSystem.writeFile(fullPath, resolution.content);

                const contentHash = this.cryptoService.generateContentHash(resolution.content);
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
                        const uploadResponse = await this.sync.forceUploadFile(vaultId, uploadRequest, resolution.encryptedContent);
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

            const fileVersion = await this.sync.downloadFile(vaultId, fileId, version);

            if (!this.cryptoService.getMasterKey()) {
                throw new Error('Encryption not available. Please log in to download files.');
            }

            const content = this.cryptoService.prepareDownloadedFile(fileVersion.encryptedContent, fileVersion.encryptedFileKey);

            const pathParts = relativePath.split('/');
            if (pathParts.length > 1) {
                const dirPath = `${vaultPath}/${pathParts.slice(0, -1).join('/')}`;
                await this.fileSystem.ensureDirectory(dirPath);
            }

            await this.fileSystem.writeFile(fullPath, content);

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

    async performBackgroundSync(
        vaultId: string,
        vaultPath: string,
        fileTree: FileNode[],
        onProgress?: (progress: SyncProgress) => void
    ): Promise<void> {
        this.operationQueue = this.operationQueue.filter(op => op.vaultId !== vaultId);

        if (onProgress) {
            this.progressCallbacks.set(vaultId, onProgress);
        }

        const { actions } = await this.checkSync(vaultId, vaultPath, fileTree);
        const localFiles = await this.getLocalFiles(vaultPath, fileTree);

        this.syncProgress.set(vaultId, {
            total: actions.length,
            completed: 0,
            failed: 0,
            inProgress: 0,
            status: actions.length > 0 ? 'syncing' : 'completed'
        });

        if (actions.length === 0) {
            return;
        }

        const promises: Promise<void>[] = [];

        for (const action of actions) {
            const localFile = localFiles.find(f => f.path === action.path);

            switch (action.action) {
                case SyncAction.Upload:
                    if (localFile) {
                        promises.push(this.queueOperation('upload', vaultId, vaultPath, localFile, 2));
                    }
                    break;
                case SyncAction.Download:
                    if (action.fileId) {
                        const relativePath = localFile
                            ? this.getRelativePath(action.path, vaultPath)
                            : action.path;
                        promises.push(
                            this.queueOperation('download', vaultId, vaultPath, {
                                fileId: action.fileId,
                                relativePath,
                                version: action.serverVersion
                            }, 1)
                        );
                    }
                    break;
            }
        }

        await Promise.allSettled(promises);

        this.updateProgress(vaultId, { status: 'completed', inProgress: 0 });
    }

    getSyncProgress(vaultId: string): SyncProgress | null {
        return this.syncProgress.get(vaultId) || null;
    }

    onSyncProgress(vaultId: string, callback: (progress: SyncProgress) => void): void {
        this.progressCallbacks.set(vaultId, callback);
    }

    offSyncProgress(vaultId: string): void {
        this.progressCallbacks.delete(vaultId);
    }

    getQueueStatus(): { pending: number; active: number } {
        return {
            pending: this.operationQueue.length,
            active: this.activeOperations.size
        };
    }

    clearSyncProgress(vaultId: string): void {
        this.syncProgress.delete(vaultId);
        this.progressCallbacks.delete(vaultId);
        this.operationQueue = this.operationQueue.filter(op => op.vaultId !== vaultId);
    }
}
