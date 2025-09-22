import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store';
import './SyncStatus.css';

interface SyncStatusProps {
    className?: string;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ className = '' }) => {
    const [showPopup, setShowPopup] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const {
        isOnline,
        isSyncing,
        lastSyncTime,
        syncConflicts,
        syncProgress,
        currentVaultId,
        syncVault,
        syncAllVaults,
        isAuthenticated,
    } = useAppStore();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowPopup(false);
            }
        };

        if (showPopup) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showPopup]);

    const handleSync = async () => {
        if (!isAuthenticated || isSyncing) return;

        try {
            if (currentVaultId) {
                await syncVault();
            } else {
                await syncAllVaults();
            }
        } catch (error) {
            console.error('Sync failed:', error);
        }
    };

    const formatLastSync = (date: Date | null) => {
        if (!date) return 'Never';
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;

        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    if (!isAuthenticated) {
        return null;
    }

    const togglePopup = () => {
        setShowPopup(!showPopup);
    };

    return (
        <div className={`sync-status-container ${className}`} ref={containerRef}>
            {/* Inline status icon */}
            <div className="sync-status-inline" onClick={togglePopup}>
                <span className="sync-label">Sync</span>
                <div className={`sync-indicator ${isOnline ? 'online' : 'offline'}`}>
                    <div className={`sync-dot ${isSyncing ? 'syncing' : ''}`} />
                </div>
                {syncConflicts.length > 0 && (
                    <span className="sync-conflict-count">{syncConflicts.length}</span>
                )}
            </div>

            {/* Popup with detailed sync status */}
            {showPopup && (
                <div className="sync-status-popup" ref={popupRef}>
                    <div className="sync-status-main">
                        <div className={`sync-indicator ${isOnline ? 'online' : 'offline'}`}>
                            <div className={`sync-dot ${isSyncing ? 'syncing' : ''}`} />
                        </div>

                        <div className="sync-info">
                            <div className="sync-state">
                                {isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline'}
                            </div>
                            <div className="sync-last">
                                Last sync: {formatLastSync(lastSyncTime)}
                            </div>
                        </div>

                        {syncConflicts.length > 0 && (
                            <div className="sync-conflicts">
                                <span className="conflict-badge">{syncConflicts.length}</span>
                                <span className="conflict-text">conflicts</span>
                            </div>
                        )}
                    </div>

                    {syncProgress && (
                        <div className="sync-progress">
                            <div className="sync-progress-bar">
                                <div
                                    className="sync-progress-fill"
                                    style={{ width: `${syncProgress.progress}%` }}
                                />
                            </div>
                            <div className="sync-progress-text">{syncProgress.message}</div>
                        </div>
                    )}

                    <button
                        className="sync-button"
                        onClick={handleSync}
                        disabled={!isOnline || isSyncing}
                        title={currentVaultId ? "Sync vault" : "Sync all vaults"}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M4 12a8 8 0 0 1 8-8V2l3 3-3 3V6a6 6 0 1 0 6 6h2a8 8 0 0 1-16 0z"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                            />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};
