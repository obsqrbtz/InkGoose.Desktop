import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { SyncService } from '../../packages/core/services/syncService';
import { electronHttpClient } from '../adapters/electronHttpClient';
import { SyncAPI } from '../../packages/core/api/syncAPI';
import { ElectronConflictDialog } from './ConflictResolutionModal/conflictDialog';
import { ConflictResolver } from '../../packages/core/services/conflictResolver';
import { ElectronFileSystem } from '../adapters/electronfileSystem';

interface BackgroundSyncStatusProps {
  className?: string;
}

export const BackgroundSyncStatus: React.FC<BackgroundSyncStatusProps> = ({ className = '' }) => {
  const { currentVaultId, getSyncQueueStatus } = useAppStore();
  const [queueStatus, setQueueStatus] = useState({ pending: 0, active: 0 });
  const [syncProgress, setSyncProgress] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  const http = electronHttpClient;
  const syncAPI = new SyncAPI(http);
  const conflictResolver = new ConflictResolver(syncAPI, new ElectronConflictDialog());
  const fileSystem = new ElectronFileSystem();
  const syncService = new SyncService(syncAPI, conflictResolver, fileSystem);


  
  useEffect(() => {
    if (!currentVaultId) return;

    // Set up progress monitoring
    syncService.onSyncProgress(currentVaultId, (progress) => {
      setSyncProgress(progress);
      
      // Hide component when sync is completed
      if (progress.status === 'completed') {
        setTimeout(() => {
          setIsVisible(false);
          setSyncProgress(null);
        }, 2000); // Show "completed" for 2 seconds then hide
      } else {
        setIsVisible(true);
      }
    });

    // Update queue status periodically
    const interval = setInterval(() => {
      const status = getSyncQueueStatus();
      setQueueStatus(status);
      
      // Show component if there's activity
      if (status.pending > 0 || status.active > 0) {
        setIsVisible(true);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      syncService.offSyncProgress(currentVaultId);
    };
  }, [currentVaultId, getSyncQueueStatus]);

  const hasActivity = queueStatus.pending > 0 || queueStatus.active > 0;
  const shouldShow = isVisible && (hasActivity || syncProgress);
  
  if (!shouldShow) {
    return null;
  }

  return (
    <div className={`background-sync-status ${className}`}>
      <div className="sync-indicator">
        <div className="sync-spinner" />
        <div className="sync-info">
          {syncProgress && (
            <div className="sync-progress">
              <span className="sync-message">{syncProgress.status}</span>
              <span className="sync-counts">
                {syncProgress.completed}/{syncProgress.total}
                {syncProgress.failed > 0 && ` (${syncProgress.failed} failed)`}
              </span>
            </div>
          )}
          {queueStatus.active > 0 && (
            <span className="queue-status">
              {queueStatus.active} active, {queueStatus.pending} pending
            </span>
          )}
        </div>
      </div>
    </div>
  );
};