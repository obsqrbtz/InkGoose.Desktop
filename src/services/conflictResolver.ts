import { SyncAPI, UploadFileRequest, UploadResponse, VersionConflictInfo, ConflictResolutionChoice, FileVersionDto } from '../../packages/core/api/syncAPI';
import { CryptoService } from './cryptoService';

export interface ConflictInfo {
    relativePath: string;
    localVersion: number;
    serverVersion: number;
    localContent: string;
    serverContent?: FileVersionDto;
    conflict: VersionConflictInfo;
    conflictType: 'upload' | 'download';
}

export class ConflictResolver {
    static async handleUploadConflict(
        vaultId: string,
        uploadRequest: UploadFileRequest,
        encryptedContent: string,
        conflict: VersionConflictInfo
    ): Promise<UploadResponse> {
        try {
            const serverFile = await SyncAPI.downloadFileByPath(
                vaultId,
                uploadRequest.relativePath,
                conflict.currentServerVersion
            );

            const localContent = await this.decryptContent(encryptedContent, uploadRequest.encryptedFileKey);
            const serverContent = await this.decryptContent(serverFile.encryptedContent, serverFile.encryptedFileKey);

            const conflictInfo: ConflictInfo = {
                relativePath: uploadRequest.relativePath,
                localVersion: uploadRequest.version,
                serverVersion: conflict.currentServerVersion,
                localContent,
                serverContent: serverFile,
                conflict,
                conflictType: 'upload'
            };

            const choice = await this.presentConflictDialog(conflictInfo, serverContent);

            return await this.executeResolution(vaultId, uploadRequest, encryptedContent, choice, conflict);
        } catch (error) {
            console.error('Error handling upload conflict:', error);
            throw new Error(`Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    static async handleDownloadConflict(
        vaultId: string,
        fileId: string,
        relativePath: string,
        serverVersion: number,
        localContent: string,
        localVersion: number
    ): Promise<{ content: string; encryptedContent: string; shouldUpload: boolean; uploadRequest?: UploadFileRequest }> {
        try {
            const serverFile = await SyncAPI.downloadFile(vaultId, fileId, serverVersion);
            const serverContent = await this.decryptContent(serverFile.encryptedContent, serverFile.encryptedFileKey);

            const conflictInfo: ConflictInfo = {
                relativePath,
                localVersion,
                serverVersion,
                localContent,
                serverContent: serverFile,
                conflict: {
                    currentServerVersion: serverVersion,
                    attemptedVersion: localVersion,
                    currentContentHash: serverFile.contentHash,
                    message: 'Local file has been modified. Choose how to resolve the download conflict.'
                },
                conflictType: 'download'
            };

            const choice = await this.presentConflictDialog(conflictInfo, serverContent);

            return await this.executeDownloadResolution(choice, localContent, serverContent, relativePath);
        } catch (error) {
            console.error('Error handling download conflict:', error);
            throw new Error(`Failed to resolve download conflict: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private static async executeDownloadResolution(
        choice: ConflictResolutionChoice,
        localContent: string,
        serverContent: string,
        relativePath: string
    ): Promise<{ content: string; encryptedContent: string; shouldUpload: boolean; uploadRequest?: UploadFileRequest }> {
        switch (choice.type) {
            case 'keep-local': {
                const localHash = CryptoService.generateContentHash(localContent);
                const { encryptedContent: localEncrypted, encryptedFileKey: localKey } =
                    await this.encryptContent(localContent);

                return {
                    content: localContent,
                    encryptedContent: localEncrypted,
                    shouldUpload: true,
                    uploadRequest: {
                        relativePath,
                        version: 1, // Will be updated by caller
                        sizeBytes: new TextEncoder().encode(localEncrypted).length, // TODO: Ensure sizeBytes is correct
                        encryptedFileKey: localKey,
                        contentHash: localHash
                    }
                };
            }

            case 'use-server':
                return {
                    content: serverContent,
                    encryptedContent: "",
                    shouldUpload: false
                };

            case 'merge': {
                if (!choice.mergedContent) {
                    throw new Error('Merged content is required for merge resolution');
                }

                const mergedHash = CryptoService.generateContentHash(choice.mergedContent);
                const { encryptedContent: mergedEncrypted, encryptedFileKey: mergedKey } =
                    await this.encryptContent(choice.mergedContent);

                return {
                    content: choice.mergedContent,
                    encryptedContent: mergedEncrypted,
                    shouldUpload: true,
                    uploadRequest: {
                        relativePath,
                        version: 1, // Will be updated by caller
                        sizeBytes: new TextEncoder().encode(mergedEncrypted).length, // TODO: Ensure sizeBytes is correct
                        encryptedFileKey: mergedKey,
                        contentHash: mergedHash
                    }
                };
            }

            default:
                throw new Error(`Unsupported resolution type: ${choice.type}`);
        }
    }

    private static async executeResolution(
        vaultId: string,
        uploadRequest: UploadFileRequest,
        encryptedContent: string,
        choice: ConflictResolutionChoice,
        conflict: VersionConflictInfo
    ): Promise<UploadResponse> {
        switch (choice.type) {
            case 'keep-local':
                return await SyncAPI.forceUploadFile(vaultId, {
                    ...uploadRequest,
                    version: conflict.currentServerVersion + 1
                }, encryptedContent);

            case 'use-server':
                return {
                    fileId: '', // Will be populated by caller
                    version: conflict.currentServerVersion,
                    uploadedAt: new Date().toISOString(),
                    success: true,
                    uploadUrl: ''
                };

            case 'merge': {
                if (!choice.mergedContent) {
                    throw new Error('Merged content is required for merge resolution');
                }

                const { encryptedContent, encryptedFileKey } = await this.encryptContent(choice.mergedContent);
                const mergedHash = CryptoService.generateContentHash(choice.mergedContent);

                return await SyncAPI.forceUploadFile(vaultId, {
                    ...uploadRequest,
                    sizeBytes: new TextEncoder().encode(encryptedContent).length, // TODO: Ensure sizeBytes is correct
                    encryptedFileKey,
                    contentHash: mergedHash,
                    version: conflict.currentServerVersion + 1
                }, encryptedContent);
            }

            default:
                throw new Error(`Unsupported resolution type: ${choice.type}`);
        }
    }

    private static async presentConflictDialog(
        conflictInfo: ConflictInfo,
        serverContent: string
    ): Promise<ConflictResolutionChoice> {
        return new Promise((resolve, reject) => {
            const event = new CustomEvent('showConflictDialog', {
                detail: {
                    conflictInfo,
                    serverContent,
                    resolve,
                    reject
                }
            });

            window.dispatchEvent(event);
        });
    }

    static async attemptAutoMerge(
        localContent: string,
        serverContent: string
    ): Promise<string | null> {
        if (localContent === serverContent) {
            return localContent;
        }

        // For now, return null to indicate manual merge is needed
        return null;
    }

    // TODO: remove, any plain text format should be mergeable
    static canAutoMerge(filePath: string): boolean {
        const textExtensions = ['.md', '.txt', '.js', '.ts', '.css', '.html', '.json', '.xml', '.yml', '.yaml'];
        return textExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
    }

    private static async decryptContent(encryptedContent: string, encryptedFileKey: string): Promise<string> {
        try {
            return CryptoService.prepareDownloadedFile(encryptedContent, encryptedFileKey);
        } catch (error) {
            throw new Error(`Failed to decrypt content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private static async encryptContent(content: string): Promise<{ encryptedContent: string; encryptedFileKey: string }> {
        try {
            return CryptoService.prepareFileForUpload(content);
        } catch (error) {
            throw new Error(`Failed to encrypt content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}