import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { config } from '../config/config';
import { ElectronFileSystem } from '../adapters/electronfileSystem';

const fileSystem = new ElectronFileSystem();

export const useAppInitialization = () => {
    const [loading, setLoading] = useState(true);
    const {
        initializeAuth,
        setVault,
        setFiles,
        rebuildTagsIndex,
        buildSearchIndex,
        setOnlineStatus,
        initializeUserVaults,
        isAuthenticated
    } = useAppStore();

    useEffect(() => {
        const initializeApp = async () => {
            try {
                await initializeAuth();

                const savedVaultPath = localStorage.getItem(config.localStorage.vaultPath);
                if (savedVaultPath) {
                    try {
                        const fileTree = await fileSystem.loadVault(savedVaultPath);
                        if (fileTree.length > 0) {
                            setVault(savedVaultPath);
                            setFiles(fileTree);
                            await rebuildTagsIndex(fileTree);
                            await buildSearchIndex();
                        } else {
                            console.warn('Vault loaded with no files, may be invalid or inaccessible');
                            localStorage.removeItem(config.localStorage.vaultPath);
                        }
                    } catch (error) {
                        console.error('Failed to load saved vault:', error);
                        localStorage.removeItem(config.localStorage.vaultPath);
                    }
                }
            } catch (error) {
                console.error('Failed to initialize app:', error);
            } finally {
                setLoading(false);
            }
        };

        initializeApp();
    }, [initializeAuth, setVault, setFiles, rebuildTagsIndex, buildSearchIndex]);

    useEffect(() => {
        const handleOnline = () => setOnlineStatus(true);
        const handleOffline = () => setOnlineStatus(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        setOnlineStatus(navigator.onLine);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [setOnlineStatus]);

    useEffect(() => {
        if (isAuthenticated) {
            initializeUserVaults().catch(error => {
                console.error('Failed to initialize user vaults:', error);
            });
        }
    }, [isAuthenticated, initializeUserVaults]);

    return { loading };
};