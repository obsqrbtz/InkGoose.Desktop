import React, { useState, useEffect } from 'react';
import { ConflictResolutionChoice } from '../../api/syncAPI';
import './ConflictResolutionModal.css';

interface ConflictDialogData {
    conflictInfo: {
        relativePath: string;
        localVersion: number;
        serverVersion: number;
        localContent: string;
        conflictType: 'upload' | 'download';
        conflict: {
            currentServerVersion: number;
            attemptedVersion: number;
            currentContentHash: string;
            message: string;
        };
    };
    serverContent: string;
    resolve: (choice: ConflictResolutionChoice) => void;
    reject: (error: Error) => void;
}

export const ConflictResolutionModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [conflictData, setConflictData] = useState<ConflictDialogData | null>(null);
    const [selectedResolution, setSelectedResolution] = useState<'keep-local' | 'use-server' | 'merge'>('keep-local');
    const [mergedContent, setMergedContent] = useState('');
    const [isResolving, setIsResolving] = useState(false);

    useEffect(() => {
        console.log('ConflictResolutionModal mounted, setting up event listener');

        const handleShowConflictDialog = (event: CustomEvent<ConflictDialogData>) => {
            console.log('Received showConflictDialog event:', event);
            console.log('Event detail:', event.detail);
            setConflictData(event.detail);
            setIsOpen(true);
            setSelectedResolution('keep-local');
            setMergedContent(event.detail.conflictInfo.localContent);
            setIsResolving(false);
        };

        window.addEventListener('showConflictDialog', handleShowConflictDialog as EventListener);

        return () => {
            console.log('ConflictResolutionModal unmounting, removing event listener');
            window.removeEventListener('showConflictDialog', handleShowConflictDialog as EventListener);
        };
    }, []);

    const handleClose = () => {
        if (conflictData && !isResolving) {
            conflictData.reject(new Error('User cancelled conflict resolution'));
            setIsOpen(false);
            setConflictData(null);
        }
    };

    const handleResolve = async () => {
        if (!conflictData) return;

        setIsResolving(true);
        try {
            const choice: ConflictResolutionChoice = {
                type: selectedResolution,
                mergedContent: selectedResolution === 'merge' ? mergedContent : undefined
            };

            conflictData.resolve(choice);
            setIsOpen(false);
            setConflictData(null);
        } catch (error) {
            console.error('Failed to resolve conflict:', error);
            conflictData.reject(error instanceof Error ? error : new Error('Failed to resolve conflict'));
        } finally {
            setIsResolving(false);
        }
    };

    if (!isOpen || !conflictData) return null;

    const { conflictInfo, serverContent } = conflictData;
    const fileName = conflictInfo.relativePath.split('/').pop() || 'Unknown file';

    return (
        <div className="conflict-modal-overlay" onClick={handleClose}>
            <div className="conflict-modal" onClick={(e) => e.stopPropagation()}>
                <div className="conflict-modal-header">
                    <h3>Resolve {conflictInfo.conflictType === 'upload' ? 'Upload' : 'Download'} Conflict</h3>
                    <button className="close-button" onClick={handleClose}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M18 6L6 18M6 6l12 12"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>

                <div className="conflict-modal-content">
                    <div className="conflict-info">
                        <h4>{fileName}</h4>
                        <p>{conflictInfo.conflict.message}</p>
                        <div className="version-info">
                            <span>Local version: {conflictInfo.localVersion}</span>
                            <span>Server version: {conflictInfo.serverVersion}</span>
                        </div>
                    </div>

                    <div className="resolution-options">
                        <label className="resolution-option">
                            <input
                                type="radio"
                                name="resolution"
                                value="keep-local"
                                checked={selectedResolution === 'keep-local'}
                                onChange={(e) => setSelectedResolution(e.target.value as 'keep-local')}
                            />
                            <div className="option-content">
                                <div className="option-title">Keep Local Version</div>
                                <div className="option-description">
                                    {conflictInfo.conflictType === 'upload'
                                        ? 'Use your local changes and discard server changes'
                                        : 'Keep your local changes and upload them later'
                                    }
                                </div>
                            </div>
                        </label>

                        <label className="resolution-option">
                            <input
                                type="radio"
                                name="resolution"
                                value="use-server"
                                checked={selectedResolution === 'use-server'}
                                onChange={(e) => setSelectedResolution(e.target.value as 'use-server')}
                            />
                            <div className="option-content">
                                <div className="option-title">Use Server Version</div>
                                <div className="option-description">
                                    {conflictInfo.conflictType === 'upload'
                                        ? 'Discard your local changes and use the server version'
                                        : 'Use the server version and discard your local changes'
                                    }
                                </div>
                            </div>
                        </label>

                        <label className="resolution-option">
                            <input
                                type="radio"
                                name="resolution"
                                value="merge"
                                checked={selectedResolution === 'merge'}
                                onChange={(e) => setSelectedResolution(e.target.value as 'merge')}
                            />
                            <div className="option-content">
                                <div className="option-title">Manual Merge</div>
                                <div className="option-description">Manually edit the content to merge both versions</div>
                            </div>
                        </label>
                    </div>

                    {selectedResolution === 'merge' && (
                        <div className="manual-merge-section">
                            <div className="version-comparison">
                                <div className="version-panel">
                                    <h5>Local Version (v{conflictInfo.localVersion})</h5>
                                    <pre className="version-content">{conflictInfo.localContent}</pre>
                                </div>
                                <div className="version-panel">
                                    <h5>Server Version (v{conflictInfo.serverVersion})</h5>
                                    <pre className="version-content">{serverContent}</pre>
                                </div>
                            </div>

                            <div className="merged-content">
                                <h5>Merged Content</h5>
                                <textarea
                                    value={mergedContent}
                                    onChange={(e) => setMergedContent(e.target.value)}
                                    rows={15}
                                    placeholder="Edit the content to merge both versions..."
                                />
                            </div>
                        </div>
                    )}

                    {selectedResolution === 'keep-local' && (
                        <div className="preview-section">
                            <h5>Local Content Preview</h5>
                            <pre className="content-preview">{conflictInfo.localContent}</pre>
                        </div>
                    )}

                    {selectedResolution === 'use-server' && (
                        <div className="preview-section">
                            <h5>Server Content Preview</h5>
                            <pre className="content-preview">{serverContent}</pre>
                        </div>
                    )}
                </div>

                <div className="conflict-modal-footer">
                    <button className="cancel-button" onClick={handleClose} disabled={isResolving}>
                        Cancel
                    </button>
                    <button
                        className="resolve-button"
                        onClick={handleResolve}
                        disabled={isResolving || (selectedResolution === 'merge' && !mergedContent.trim())}
                    >
                        {isResolving ? 'Resolving...' : 'Resolve Conflict'}
                    </button>
                </div>
            </div>
        </div>
    );
};
