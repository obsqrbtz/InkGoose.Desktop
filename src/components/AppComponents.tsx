import React from 'react';
import { useAppStore } from '../store';
import { useToggle } from '../hooks/useCommon';
import LoadingIcon from './icons/LoadingIcon';
import UserMenu from './UserMenu/UserMenu';
import { ThemeToggle } from './common/ThemeToggle';

export const LoadingScreen: React.FC = () => (
    <div className="app-loading" data-theme={useAppStore.getState().theme}>
        <div className="loading-content">
            <div className="loading-logo">
                <LoadingIcon size={48} className="loading-icon" />
            </div>
            <h1 className="loading-title">Ink Goose</h1>
            <p className="loading-subtitle">Loading your workspace...</p>
            <div className="loading-progress">
                <div className="loading-bar">
                    <div className="loading-bar-fill"></div>
                </div>
            </div>
        </div>
    </div>
);

export const WelcomeScreen: React.FC<{ onOpenVault: () => void }> = ({ onOpenVault }) => (
    <div className="main-content">
        <div className="welcome-screen">
            <div className="welcome-content">
                <h2>Welcome to Ink Goose</h2>
                <p>A modern Markdown note-taking app</p>
                <button
                    className="open-vault-btn-large"
                    onClick={onOpenVault}
                >
                    Open Vault
                </button>
                <p className="welcome-subtitle">
                    Choose a folder to use as your note vault
                </p>
            </div>
        </div>
    </div>
);

interface AppHeaderProps {
    onToggleSidebar: () => void;
    onOpenVault: () => void;
    onShowAuth: () => void;
    onShowVaultSelector: () => void;
    isMaximized: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    onToggleSidebar,
    onOpenVault,
    onShowAuth,
    onShowVaultSelector,
    isMaximized
}) => {
    const { isAuthenticated, vault } = useAppStore();
    const { value: themeMenuOpen, toggle: toggleThemeMenu, setFalse: closeThemeMenu } = useToggle();

    return (
        <div className="app-header">
            <div className="title-bar">
                <button
                    className="sidebar-toggle"
                    onClick={onToggleSidebar}
                    title="Toggle Sidebar"
                >
                    <span className="hamburger-icon">☰</span>
                </button>
                <h1 className="app-title">Ink Goose</h1>

                {isAuthenticated ? (
                    <button
                        className="open-vault-btn"
                        onClick={onShowVaultSelector}
                    >
                        Manage Vaults
                    </button>
                ) : !vault ? (
                    <button
                        className="open-vault-btn"
                        onClick={onOpenVault}
                    >
                        Open Vault
                    </button>
                ) : null}

                <div className="title-spacer" />

                {isAuthenticated ? (
                    <UserMenu />
                ) : (
                    <button
                        className="auth-sign-in-btn"
                        onClick={onShowAuth}
                    >
                        Sign In
                    </button>
                )}

                <ThemeToggle
                    isOpen={themeMenuOpen}
                    onToggle={toggleThemeMenu}
                    onClose={closeThemeMenu}
                />

                <div className="window-controls" aria-label="Window controls">
                    <button
                        className="window-btn window-minimize"
                        title="Minimize"
                        onClick={() => window.electronAPI?.minimizeWindow?.()}
                    >
                        <span aria-hidden>—</span>
                    </button>
                    <button
                        className="window-btn window-maximize"
                        title={isMaximized ? 'Restore' : 'Maximize'}
                        onClick={() => window.electronAPI?.toggleMaximizeWindow?.()}
                    >
                        <span aria-hidden>{isMaximized ? '🗗' : '🗖'}</span>
                    </button>
                    <button
                        className="window-btn window-close"
                        title="Close"
                        onClick={() => window.electronAPI?.closeWindow?.()}
                    >
                        <span aria-hidden>✖</span>
                    </button>
                </div>
            </div>
        </div>
    );
};