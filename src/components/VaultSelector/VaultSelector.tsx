import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import './VaultSelector.css';

interface VaultSelectorProps {
    isOpen: boolean;
    onClose: () => void;
}

export const VaultSelector: React.FC<VaultSelectorProps> = ({ isOpen, onClose }) => {
    const {
        availableVaults,
        currentVaultId,
        vault: currentVaultPath,
        loadVaults,
        createVault,
        selectVault,
        addCurrentFolderToAccount,
        isAuthenticated,
    } = useAppStore();

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showAddFolderForm, setShowAddFolderForm] = useState(false);
    const [newVaultName, setNewVaultName] = useState('');
    const [newVaultDescription, setNewVaultDescription] = useState('');
    const [folderVaultName, setFolderVaultName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isAddingFolder, setIsAddingFolder] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && isAuthenticated) {
            setIsLoading(true);
            loadVaults().finally(() => setIsLoading(false));
        }
    }, [isOpen, isAuthenticated, loadVaults]);

    const handleCreateVault = async () => {
        if (!newVaultName.trim()) return;

        setIsCreating(true);
        try {
            await createVault(newVaultName.trim(), newVaultDescription.trim());
            setNewVaultName('');
            setNewVaultDescription('');
            setShowCreateForm(false);
        } catch (error) {
            console.error('Failed to create vault:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleSelectVault = async (vaultId: string) => {
        try {
            await selectVault(vaultId);
            onClose();
        } catch (error) {
            console.error('Failed to select vault:', error);
        }
    };

    const handleAddCurrentFolder = async () => {
        if (!folderVaultName.trim() || !currentVaultPath) return;

        setIsAddingFolder(true);
        try {
            await addCurrentFolderToAccount(currentVaultPath, folderVaultName.trim());
            setFolderVaultName('');
            setShowAddFolderForm(false);
            await loadVaults();
        } catch (error) {
            console.error('Failed to add current folder to account:', error);
            alert(`Failed to add folder to account: ${error}`);
        } finally {
            setIsAddingFolder(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="vault-selector-overlay" onClick={onClose}>
            <div className="vault-selector" onClick={(e) => e.stopPropagation()}>
                <div className="vault-selector-header">
                    <h3>Vaults</h3>
                    <button className="close-button" onClick={onClose}>
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

                <div className="vault-selector-content">
                    {isLoading ? (
                        <div className="vault-loading">Loading vaults...</div>
                    ) : (
                        <>
                            <div className="vault-list">
                                {availableVaults.length > 0 ? (
                                    availableVaults.map((vault) => (
                                        <div
                                            key={vault.id}
                                            className={`vault-item ${currentVaultId === vault.id ? 'selected' : ''}`}
                                            onClick={() => handleSelectVault(vault.id)}
                                        >
                                            <div className="vault-name">{vault.name}</div>
                                            <div className="vault-last-modified">
                                                Last modified: {new Date(vault.lastModified).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-vaults">
                                        No vaults found. Create your first vault to get started.
                                    </div>
                                )}
                            </div>

                            {showCreateForm ? (
                                <div className="create-vault-form">
                                    <input
                                        type="text"
                                        placeholder="Vault name"
                                        value={newVaultName}
                                        onChange={(e) => setNewVaultName(e.target.value)}
                                        disabled={isCreating}
                                    />
                                    <textarea
                                        placeholder="Description (optional)"
                                        value={newVaultDescription}
                                        onChange={(e) => setNewVaultDescription(e.target.value)}
                                        disabled={isCreating}
                                        rows={3}
                                    />
                                    <div className="form-actions">
                                        <button
                                            className="cancel-button"
                                            onClick={() => setShowCreateForm(false)}
                                            disabled={isCreating}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="create-button"
                                            onClick={handleCreateVault}
                                            disabled={!newVaultName.trim() || isCreating}
                                        >
                                            {isCreating ? 'Creating...' : 'Create Vault'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="vault-actions">
                                    <button
                                        className="new-vault-button"
                                        onClick={() => setShowCreateForm(true)}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                            <path
                                                d="M12 5v14m-7-7h14"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                        Create New Vault
                                    </button>
                                    
                                    {currentVaultPath && (
                                        <>
                                            {showAddFolderForm ? (
                                                <div className="add-folder-form">
                                                    <input
                                                        type="text"
                                                        placeholder="Vault name for current folder"
                                                        value={folderVaultName}
                                                        onChange={(e) => setFolderVaultName(e.target.value)}
                                                        disabled={isAddingFolder}
                                                    />
                                                    <div className="form-actions">
                                                        <button
                                                            className="cancel-button"
                                                            onClick={() => setShowAddFolderForm(false)}
                                                            disabled={isAddingFolder}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            className="create-button"
                                                            onClick={handleAddCurrentFolder}
                                                            disabled={!folderVaultName.trim() || isAddingFolder}
                                                        >
                                                            {isAddingFolder ? 'Adding...' : 'Add to Account'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    className="add-folder-button"
                                                    onClick={() => setShowAddFolderForm(true)}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                        <path
                                                            d="M12 19l7-7 3 3-7 7-3-3z"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        />
                                                        <path
                                                            d="m9 11 3 3L22 4"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        />
                                                    </svg>
                                                    Add Current Folder to Account
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
