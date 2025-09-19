import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';

export const useVaultOperations = () => {
    const {
        vault,
        createVault,
        createLocalVault,
        selectVault,
        selectLocalVault,
        createNote,
        createDirectory,
        deleteFileOrDir,
        renameFileOrDir,
        refreshFiles
    } = useAppStore();

    const handleCreateVault = useCallback(async (name: string, description: string) => {
        try {
            const result = await createVault(name, description);
            return { success: true, vault: result };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create vault'
            };
        }
    }, [createVault]);

    const handleCreateLocalVault = useCallback(async (name: string) => {
        try {
            const path = await createLocalVault(name);
            return { success: true, path };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create local vault'
            };
        }
    }, [createLocalVault]);

    const handleSelectVault = useCallback(async (vaultId: string) => {
        try {
            await selectVault(vaultId);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to select vault'
            };
        }
    }, [selectVault]);

    const handleSelectLocalVault = useCallback(async (vaultPath: string) => {
        try {
            await selectLocalVault(vaultPath);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to select local vault'
            };
        }
    }, [selectLocalVault]);

    const handleCreateNote = useCallback(async (dirPath: string, name: string) => {
        try {
            await createNote(dirPath, name);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create note'
            };
        }
    }, [createNote]);

    const handleCreateDirectory = useCallback(async (parentPath: string, name: string) => {
        try {
            await createDirectory(parentPath, name);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create directory'
            };
        }
    }, [createDirectory]);

    const handleDeleteFileOrDir = useCallback(async (path: string) => {
        try {
            await deleteFileOrDir(path);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete file/directory'
            };
        }
    }, [deleteFileOrDir]);

    const handleRenameFileOrDir = useCallback(async (oldPath: string, newNameOrPath: string) => {
        try {
            await renameFileOrDir(oldPath, newNameOrPath);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to rename file/directory'
            };
        }
    }, [renameFileOrDir]);

    const handleRefreshFiles = useCallback(async () => {
        try {
            await refreshFiles();
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to refresh files'
            };
        }
    }, [refreshFiles]);

    return {
        vault,
        createVault: handleCreateVault,
        createLocalVault: handleCreateLocalVault,
        selectVault: handleSelectVault,
        selectLocalVault: handleSelectLocalVault,
        createNote: handleCreateNote,
        createDirectory: handleCreateDirectory,
        deleteFileOrDir: handleDeleteFileOrDir,
        renameFileOrDir: handleRenameFileOrDir,
        refreshFiles: handleRefreshFiles
    };
};