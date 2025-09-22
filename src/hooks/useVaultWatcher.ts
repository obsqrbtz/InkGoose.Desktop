import { useEffect } from 'react';
import { useAppStore } from '../store';
import { ElectronFileSystem } from '../adapters/electronfileSystem';

export const useVaultWatcher = () => {
    const { vault, setFiles, rebuildTagsIndex, buildSearchIndex } = useAppStore();
    const fileSystem = new ElectronFileSystem();

    useEffect(() => {
        if (!vault) return;

        let disposed = false;
        let disposeWatch: (() => void) | undefined;
        let debounceTimer: number | undefined;

        const triggerRefresh = () => {
            if (debounceTimer) window.clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(async () => {
                if (!vault || disposed) return;
                try {
                    const tree = await fileSystem.loadVault(vault);
                    setFiles(tree);
                    await rebuildTagsIndex(tree);
                    await buildSearchIndex();
                } catch (e) {
                    console.warn('Failed to refresh vault after change:', e);
                }
            }, 200);
        };

        fileSystem.watchVault(vault, (evt, p) => {
            void evt; void p;
            triggerRefresh();
        }).then((dispose) => {
            disposeWatch = dispose;
        }).catch((e) => {
            console.warn('Failed to start vault watcher:', e);
        });

        return () => {
            disposed = true;
            try {
                if (disposeWatch) disposeWatch();
            } catch {
                /* ignore */
            }
        };
    }, [vault, setFiles, rebuildTagsIndex, buildSearchIndex]);
};