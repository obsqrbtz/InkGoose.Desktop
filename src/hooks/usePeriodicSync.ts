import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export const usePeriodicSync = () => {
    const { isAuthenticated, isOnline, isSyncing, syncAllVaults } = useAppStore();

    useEffect(() => {
        if (!isAuthenticated || !isOnline) return;

        const syncInterval = setInterval(() => {
            if (!isSyncing && isOnline && isAuthenticated) {
                syncAllVaults().catch(error => {
                    console.error('Periodic sync failed:', error);
                });
            }
        }, 5 * 60 * 1000); // 5 minutes

        return () => clearInterval(syncInterval);
    }, [isAuthenticated, isOnline, isSyncing, syncAllVaults]);
};