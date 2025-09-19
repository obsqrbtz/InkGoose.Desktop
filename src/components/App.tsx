import React, { useState } from 'react';
import Sidebar from './Sidebar/Sidebar';
import Editor from './Editor/Editor';
import StatusBar from './StatusBar/StatusBar';
import AuthModal from './AuthModal/AuthModal';
import ConfirmModal from './ConfirmModal/ConfirmModal';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { VaultSelector } from './VaultSelector';
import LoadingIcon from './icons/LoadingIcon';
import UserMenu from './UserMenu/UserMenu';
import { ThemeToggle } from './common/ThemeToggle';
import { useVaultWatcher } from '../hooks/useVaultWatcher';
import { usePeriodicSync } from '../hooks/usePeriodicSync';
import { useAppStore } from '../store/appStore';
import { FileSystemAPI } from '../api/fileSystemAPI';
import { config } from '../config/config';

export const App: React.FC = () => {
  const {
    theme,
    vault,
    files,
    isAuthenticated,
    sidebarOpen,
    setSidebarOpen,
    initializeAuth,
    selectLocalVault
  } = useAppStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [vaultSelectorOpen, setVaultSelectorOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  useVaultWatcher();
  usePeriodicSync();

  React.useEffect(() => {
    const init = async () => {
      try {
        await initializeAuth();

        const savedVaultPath = localStorage.getItem(config.localStorage.vaultPath);
        if (savedVaultPath) {
          await selectLocalVault(savedVaultPath);
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [initializeAuth, selectLocalVault]);

  React.useEffect(() => {
    const unsubscribe = window.electronAPI?.onWindowMaximized?.((state: boolean) => {
      setIsMaximized(state);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    const isDark = theme === 'dark';
    const light = document.getElementById('hljs-theme-light') as HTMLLinkElement | null;
    const dark = document.getElementById('hljs-theme-dark') as HTMLLinkElement | null;

    if (light) {
      light.disabled = isDark;
      light.media = isDark ? 'not all' : 'all';
    }
    if (dark) {
      dark.disabled = !isDark;
      dark.media = !isDark ? 'not all' : 'all';
    }
  }, [theme]);

  const handleOpenVault = async () => {
    try {
      const vaultPath = await FileSystemAPI.selectVaultFolder();
      if (vaultPath) {
        await selectLocalVault(vaultPath);
      }
    } catch (error) {
      console.error('Failed to open vault:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="app-loading" data-theme={theme}>
        <div className="loading-content">
          <div className="loading-logo">
            <LoadingIcon size={48} className="loading-icon" />
          </div>
          <h1 className="loading-title">Ink Goose</h1>
          <p className="loading-subtitle">Loading your notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${isMaximized ? 'maximized' : ''}`} data-theme={theme}>
      <div className="app-header">
        <div className="title-bar">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle Sidebar"
          >
            <span className="hamburger-icon">☰</span>
          </button>
          <h1 className="app-title">Ink Goose</h1>

          <button
            className="open-vault-btn"
            onClick={() => setVaultSelectorOpen(true)}
            title="Switch Vault"
          >
            Vault: {vault ? vault.split(/[/\\]/).pop() : 'None'}
          </button>

          <div className="title-spacer" />

          <ThemeToggle
            isOpen={themeMenuOpen}
            onToggle={() => setThemeMenuOpen(!themeMenuOpen)}
            onClose={() => setThemeMenuOpen(false)}
          />

          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <button
              className="auth-sign-in-btn"
              onClick={() => setAuthModalOpen(true)}
            >
              Sign In
            </button>
          )}

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

      <div className="app-body">
        {sidebarOpen && (
          <Sidebar
            vault={vault}
            files={files}
            onOpenVault={handleOpenVault}
          />
        )}
        <div className="main-content">
          {vault ? (
            <Editor />
          ) : (
            <div className="welcome-screen">
              <div className="welcome-content">
                <h2>Welcome to Ink Goose</h2>
                <p>A modern Markdown note-taking app</p>
                <button
                  className="open-vault-btn-large"
                  onClick={handleOpenVault}
                >
                  Open Vault
                </button>
                <p className="welcome-subtitle">
                  Choose a folder to use as your note vault
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <StatusBar />

      {/* Modals */}
      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
        />
      )}

      {vaultSelectorOpen && (
        <VaultSelector
          isOpen={vaultSelectorOpen}
          onClose={() => setVaultSelectorOpen(false)}
        />
      )}

      <ConflictResolutionModal />

      <ConfirmModal
        isOpen={false}
        title=""
        message=""
        onConfirm={() => console.log('Confirm')}
        onCancel={() => console.log('Cancel')}
      />
    </div>
  );
};

export default App;
