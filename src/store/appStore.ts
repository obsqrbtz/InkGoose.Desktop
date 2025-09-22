import { create } from 'zustand';
import { FileNode, Note, AppSettings, SearchResult, TagsByName, NoteTagsMap, TagFileRef, SyncConflict } from '../types';
import { resolveTheme } from '../utils/theme';
import { FileSystemAPI } from '../api/fileSystemAPI';
import { AuthAPI, User, KdfParams } from '../../packages/core/api/authAPI';
import { SyncAPI, VaultSummary, CreateVaultResponse } from '../../packages/core/api/syncAPI';
import { SyncService } from '../services/syncService';
import { CryptoService } from '../services/cryptoService';
import { extractTags } from '../utils/tags';
import { searchService } from '../utils/searchService';
import { config } from '../config/config';
import { electronHttpClient } from '../adapters/electronHttpClient';
import { ElectronConflictDialog } from '../components/ConflictResolutionModal/conflictDialog';
import { ConflictResolver } from '../../packages/core/services/conflictResolver';

const http = electronHttpClient;
const syncAPI = new SyncAPI(http);
const conflictResolver = new ConflictResolver(syncAPI, new ElectronConflictDialog());
const syncService = new SyncService(syncAPI, conflictResolver);

interface AppState {
  // Vault and files
  vault: string | null;
  files: FileNode[];
  currentFile: Note | null;
  openTabs: Note[];
  // Tags
  tagsByName: TagsByName;
  noteTags: NoteTagsMap;

  // Authentication
  user: User | null;
  isAuthenticated: boolean;

  // Sync state
  currentVaultId: string | null;
  availableVaults: VaultSummary[];
  localVaults: Array<{ name: string; path: string; lastModified: Date }>;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncConflicts: SyncConflict[];
  syncProgress: { message: string; progress: number } | null;

  // UI state
  sidebarOpen: boolean;
  previewMode: boolean;
  editorMode: 'source' | 'preview' | 'split';
  theme: 'light' | 'dark';
  themePreference: 'light' | 'dark' | 'system';
  settings: AppSettings;

  // Search
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  isSearchIndexReady: boolean;

  // Actions
  setVault: (vault: string | null) => void;
  setFiles: (files: FileNode[]) => void;
  setCurrentFile: (file: Note | null) => void;
  addTab: (file: Note) => void;
  closeTab: (filePath: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setPreviewMode: (preview: boolean) => void;
  setEditorMode: (mode: 'source' | 'preview' | 'split') => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setThemePreference: (pref: 'light' | 'dark' | 'system') => void;
  setSettings: (settings: Partial<AppSettings>) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
  performSearch: (query: string) => Promise<void>;
  buildSearchIndex: () => Promise<void>;
  setTagsIndex: (index: TagsByName, noteTags: NoteTagsMap) => void;
  rebuildTagsIndex: (files: FileNode[]) => Promise<void>;
  updateNoteTags: (notePath: string, name: string, content: string) => void;
  refreshFiles: () => Promise<void>;
  createNote: (dirPath: string, name: string) => Promise<void>;
  createDirectory: (parentPath: string, name: string) => Promise<void>;
  deleteFileOrDir: (path: string) => Promise<void>;
  renameFileOrDir: (oldPath: string, newNameOrPath: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, encMasterKey_pw: string, encMasterKey_recovery: string, kdfParams: KdfParams) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  reauthenticateWithPassword: (password: string) => Promise<void>;
  initializeUserVaults: () => Promise<void>;
  loadVaults: () => Promise<void>;
  loadLocalVaults: () => Promise<void>;
  createVault: (name: string, description: string) => Promise<CreateVaultResponse>;
  createLocalVault: (name: string) => Promise<string>;
  selectVault: (vaultId: string) => Promise<void>;
  selectLocalVault: (vaultPath: string) => Promise<void>;
  syncAllVaults: () => Promise<void>;
  syncVault: () => Promise<void>;
  getSyncQueueStatus: () => { pending: number; active: number };
  setOnlineStatus: (isOnline: boolean) => void;
  addCurrentFolderToAccount: (currentFolderPath: string, vaultName: string) => Promise<{ vault: CreateVaultResponse; path: string }>;
  openLocalVault: (vaultName: string) => Promise<string>;
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'Monaco, "Courier New", monospace',
  editorWidth: 50,
  showLineNumbers: true,
  wrapText: true,
  spellCheck: true,
  autoSave: true,
  autoSaveDelay: 2000,
};

const handleAsyncError = (operation: string) => (error: unknown) => {
  console.error(`${operation} failed:`, error);
  throw error;
};

const safeLocalStorage = {
  get: (key: string, fallback = 'system') => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
};

const getInitialTheme = () => {
  const preference = safeLocalStorage.get(config.localStorage.themePreference) as 'light' | 'dark' | 'system';
  return { themePreference: preference, theme: resolveTheme(preference) };
};

const withAuth = <T>(fn: () => Promise<T> | T): Promise<T> | T | undefined => {
  const state = useAppStore.getState();
  if (!state.user || !state.isAuthenticated) {
    console.warn('Operation requires authentication');
    return undefined as T;
  }
  return fn();
};

const withVault = <T>(fn: () => Promise<T> | T): Promise<T> | T | undefined => {
  const state = useAppStore.getState();
  if (!state.vault) {
    console.warn('Operation requires active vault');
    return undefined as T;
  }
  return fn();
};

const storeMasterKeySecurely = async (userId: string) => {
  const masterKey = CryptoService.getMasterKey();
  if (masterKey) {
    try {
      await CryptoService.storeMasterKeySecurely(userId, masterKey);
    } catch (error) {
      console.warn('Failed to store master key securely:', error);
    }
  }
};

const initializeAfterAuth = async () => {
  const state = useAppStore.getState();
  await state.initializeUserVaults();
};

const ensureUserDirectories = async (username: string) => {
  try {
    await FileSystemAPI.initializeUserDirectories(username);
  } catch (error) {
    console.error('Failed to initialize user directories:', error);
  }
};

const syncOperationsAvailable = () => {
  const state = useAppStore.getState();
  return state.user && state.isAuthenticated && CryptoService.getMasterKey();
};

export const useAppStore = create<AppState>((set) => ({

  // Initial state
  vault: null,
  files: [],
  currentFile: null,
  openTabs: [],
  tagsByName: {},
  noteTags: {},
  user: null,
  isAuthenticated: false,

  // Sync state
  currentVaultId: null,
  availableVaults: [],
  localVaults: [],
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSyncTime: null,
  syncConflicts: [],
  syncProgress: null,

  sidebarOpen: true,
  previewMode: false,
  editorMode: 'source',
  ...getInitialTheme(),
  settings: defaultSettings,
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  isSearchIndexReady: false,

  // Actions
  setVault: (vault) => set({ vault }),
  setFiles: (files) => set({ files }),
  setCurrentFile: (file) => set({ currentFile: file }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setTagsIndex: (index, noteTags) => set({ tagsByName: index, noteTags }),
  setOnlineStatus: (isOnline) => set({ isOnline }),
  setTheme: (theme) => set({ theme }),

  addTab: (file) => set((state) => {
    const exists = state.openTabs.find(tab => tab.path === file.path);
    if (!exists) {
      return { openTabs: [...state.openTabs, file] };
    }
    return state;
  }),

  closeTab: (filePath) => set((state) => ({
    openTabs: state.openTabs.filter(tab => tab.path !== filePath),
    currentFile: state.currentFile?.path === filePath ? null : state.currentFile
  })),
  setPreviewMode: (preview) => set(() => {
    const newMode = preview ? 'preview' : 'source';
    return { previewMode: preview, editorMode: newMode };
  }),
  setEditorMode: (mode) => set(() => {
    const newPreviewMode = mode === 'preview';
    return { editorMode: mode, previewMode: newPreviewMode };
  }),
  setThemePreference: (pref) => set(() => {
    safeLocalStorage.set(config.localStorage.themePreference, pref);
    return { themePreference: pref, theme: resolveTheme(pref) };
  }),

  setSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),

  performSearch: async (query) => {
    set({ isSearching: true });
    try {
      const results = await searchService.search(query);
      set({ searchResults: results, isSearching: false });
    } catch (error) {
      console.error('Search failed:', error);
      set({ searchResults: [], isSearching: false });
    }
  },

  buildSearchIndex: async () => {
    const state = useAppStore.getState();
    try {
      await searchService.buildIndex(state.files);
      set({ isSearchIndexReady: true });
    } catch (error) {
      console.error('Failed to build search index:', error);
      set({ isSearchIndexReady: false });
    }
  },
  rebuildTagsIndex: async (files: FileNode[]) => {
    const tagIndex: TagsByName = {};
    const noteTags: NoteTagsMap = {};

    const walk = async (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'directory' && node.children) {
          await walk(node.children);
        } else if (node.type === 'file' && node.extension === '.md') {
          try {
            const content = await FileSystemAPI.readFile(node.path);
            const tags = extractTags(content);
            noteTags[node.path] = tags;
            const ref: TagFileRef = { path: node.path, name: node.name };
            for (const t of tags) {
              if (!tagIndex[t]) tagIndex[t] = { files: [] };
              // avoid duplicates
              if (!tagIndex[t].files.find(f => f.path === ref.path)) {
                tagIndex[t].files.push(ref);
              }
            }
          } catch (e) {
            console.warn('Tag index: failed reading', node.path, e);
          }
        }
      }
    };

    await walk(files);
    Object.values(tagIndex).forEach(entry => entry.files.sort((a, b) => a.name.localeCompare(b.name)));
    set({ tagsByName: tagIndex, noteTags });
  },
  updateNoteTags: (notePath, name, content) => set((state) => {
    const tags = extractTags(content);
    const prevTags = state.noteTags[notePath] || [];
    const nextNoteTags = { ...state.noteTags, [notePath]: tags };
    const nextIndex: TagsByName = { ...state.tagsByName };
    const ref: TagFileRef = { path: notePath, name };
    for (const t of prevTags) {
      if (!tags.includes(t) && nextIndex[t]) {
        nextIndex[t] = { files: nextIndex[t].files.filter(f => f.path !== notePath) };
        if (nextIndex[t].files.length === 0) delete nextIndex[t];
      }
    }
    for (const t of tags) {
      if (!nextIndex[t]) nextIndex[t] = { files: [] };
      if (!nextIndex[t].files.find(f => f.path === notePath)) {
        nextIndex[t].files.push(ref);
        nextIndex[t].files.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    searchService.updateNote(notePath, content, name).catch(error => {
      console.error('Failed to update search index:', error);
    });

    return { tagsByName: nextIndex, noteTags: nextNoteTags };
  }),

  refreshFiles: async () => {
    const state = useAppStore.getState();
    return withVault(async () => {
      try {
        const files = await FileSystemAPI.loadVault(state.vault as string);
        set({ files });
        await state.rebuildTagsIndex(files);
        await state.buildSearchIndex();
      } catch (error) {
        handleAsyncError('Refresh files')(error);
      }
    });
  },

  createNote: async (dirPath, name) => {
    const state = useAppStore.getState();
    return withVault(async () => {
      try {
        const notePath = `${dirPath}/${name}.md`;
        await FileSystemAPI.createFile(notePath, '# ' + name + '\n\n');
        await state.refreshFiles();
      } catch (error) {
        handleAsyncError('Create note')(error);
      }
    });
  },

  createDirectory: async (parentPath, name) => {
    const state = useAppStore.getState();
    return withVault(async () => {
      try {
        const dirPath = `${parentPath}/${name}`;
        await FileSystemAPI.createDirectory(dirPath);
        await state.refreshFiles();
      } catch (error) {
        handleAsyncError('Create directory')(error);
      }
    });
  },

  deleteFileOrDir: async (path) => {
    const state = useAppStore.getState();
    return withVault(async () => {
      try {
        await FileSystemAPI.deleteFile(path);
        if (state.currentFile?.path === path) {
          set({ currentFile: null });
        }
        set((prevState) => ({
          openTabs: prevState.openTabs.filter(tab => tab.path !== path)
        }));
        await state.refreshFiles();
      } catch (error) {
        handleAsyncError('Delete file/directory')(error);
      }
    });
  },

  renameFileOrDir: async (oldPath, newNameOrPath) => {
    const state = useAppStore.getState();
    return withVault(async () => {
      try {
        let newPath: string;

        if (newNameOrPath.includes('/') || newNameOrPath.includes('\\')) {
          newPath = newNameOrPath;
        } else {
          const pathParts = oldPath.split(/[/\\]/);
          pathParts[pathParts.length - 1] = newNameOrPath;
          newPath = pathParts.join('/');
        }

        await FileSystemAPI.renameFile(oldPath, newPath);

        const finalName = newPath.split(/[/\\]/).pop() || newNameOrPath;

        if (state.currentFile?.path === oldPath) {
          const updatedFile = { ...state.currentFile, path: newPath, name: finalName };
          set({ currentFile: updatedFile });
        }

        set((prevState) => ({
          openTabs: prevState.openTabs.map(tab =>
            tab.path === oldPath
              ? { ...tab, path: newPath, name: finalName }
              : tab
          )
        }));

        await state.refreshFiles();
      } catch (error) {
        handleAsyncError('Rename/move file/directory')(error);
      }
    });
  },

  login: async (email, password) => {
    try {
      const response = await AuthAPI.login({ email, password });
      CryptoService.decryptMasterKey(password, response.encMasterKey_pw, response.kdfParams);

      const user = AuthAPI.getCurrentUser();
      set({ user, isAuthenticated: true });

      if (user) {
        await storeMasterKeySecurely(user.id.toString());
        await initializeAfterAuth();
      }
    } catch (error) {
      handleAsyncError('Login')(error);
    }
  },

  register: async (username, email, password, encMasterKey_pw, encMasterKey_recovery, kdfParams) => {
    try {
      await AuthAPI.register({
        username,
        email,
        password,
        encryptionMode: 0,
        encMasterKey_pw,
        encMasterKey_recovery,
        kdfParams
      });

      await AuthAPI.login({ email, password });
      CryptoService.decryptMasterKey(password, encMasterKey_pw, kdfParams);

      const user = AuthAPI.getCurrentUser();
      set({ user, isAuthenticated: true });

      if (user) {
        await storeMasterKeySecurely(user.id.toString());
        await initializeAfterAuth();
      }
    } catch (error) {
      handleAsyncError('Registration')(error);
    }
  },

  logout: async () => {
    const user = useAppStore.getState().user;

    try {
      await AuthAPI.logout();
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      CryptoService.clearMasterKey();

      if (user) {
        try {
          await CryptoService.deleteMasterKeySecurely(user.id.toString());
        } catch (error) {
          console.warn('Failed to clear secure storage:', error);
        }
      }

      set({
        user: null,
        isAuthenticated: false,
        currentVaultId: null,
        availableVaults: [],
        lastSyncTime: null,
        syncConflicts: [],
        isSyncing: false,
        syncProgress: null
      });
      localStorage.removeItem('ink-goose-current-vault');
    }
  },

  initializeAuth: async () => {
    try {
      if (!AuthAPI.isAuthenticated()) {
        set({ user: null, isAuthenticated: false });
        return;
      }

      const user = AuthAPI.getCurrentUser();
      if (!user) {
        set({ user: null, isAuthenticated: false });
        return;
      }

      set({ user, isAuthenticated: true });

      try {
        const storedMasterKey = await CryptoService.retrieveMasterKeySecurely(user.id.toString());
        if (storedMasterKey) {
          CryptoService.setMasterKey(storedMasterKey);
          await useAppStore.getState().initializeUserVaults();
        } else {
          console.log('No stored master key found');
          await ensureUserDirectories(user.username);
          await useAppStore.getState().loadLocalVaults();
        }
      } catch (error) {
        console.error('Failed to restore master key from secure storage:', error);
        try {
          await ensureUserDirectories(user.username);
          await useAppStore.getState().loadLocalVaults();
        } catch (initError) {
          console.error('Failed to initialize user directories:', initError);
        }
      }

      const savedVaultId = localStorage.getItem('ink-goose-current-vault');
      if (savedVaultId) {
        set({ currentVaultId: savedVaultId });
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      set({ user: null, isAuthenticated: false });
    }
  },

  reauthenticateWithPassword: async (password: string) => {
    const state = useAppStore.getState();
    if (!state.user || !state.isAuthenticated) {
      throw new Error('User not authenticated');
    }

    try {
      const loginResponse = await AuthAPI.login({
        email: state.user.email,
        password
      });

      CryptoService.decryptMasterKey(
        password,
        loginResponse.encMasterKey_pw,
        loginResponse.kdfParams
      );

      await storeMasterKeySecurely(state.user.id.toString());
      await state.initializeUserVaults();
    } catch (error) {
      handleAsyncError('Re-authentication')(error);
    }
  },

  initializeUserVaults: async () => {
    return withAuth(async () => {
      const state = useAppStore.getState();
      const user = state.user as User;

      if (!syncOperationsAvailable()) {
        console.warn('Cannot sync vaults: encryption not available. User needs to log in with password.');
        try {
          await ensureUserDirectories(user.username);
          await state.loadLocalVaults();
        } catch (error) {
          console.error('Failed to initialize user directories:', error);
        }
        return;
      }

      try {
        await ensureUserDirectories(user.username);
        await state.loadLocalVaults();
        await state.syncAllVaults();
      } catch (error) {
        console.error('Failed to initialize user vaults:', error);
      }
    });
  }, loadVaults: async () => {
    try {
      const vaults = await syncAPI.getUserVaults();
      set({ availableVaults: vaults });
    } catch (error) {
      handleAsyncError('Load vaults')(error);
    }
  },

  loadLocalVaults: async () => {
    return withAuth(async () => {
      const state = useAppStore.getState();
      const user = state.user as User;
      try {
        const vaults = await FileSystemAPI.listUserVaults(user.username);
        set({ localVaults: vaults });
      } catch (error) {
        handleAsyncError('Load local vaults')(error);
      }
    });
  },

  createVault: async (name, description) => {
    const state = useAppStore.getState();
    if (!state.user || !state.isAuthenticated) {
      throw new Error('Authentication required');
    }

    try {
      const newVault = await syncAPI.createVault({ name, description });
      const vaultPath = await FileSystemAPI.getVaultPath(state.user.username, name);
      await FileSystemAPI.ensureDirectory(vaultPath);

      set((currentState) => ({
        availableVaults: [...currentState.availableVaults, {
          id: newVault.id,
          name: newVault.name,
          lastModified: newVault.createdAt,
        }],
      }));

      await state.loadLocalVaults();
      return newVault;
    } catch (error) {
      handleAsyncError('Create vault')(error);
      throw error;
    }
  },

  createLocalVault: async (name) => {
    const state = useAppStore.getState();
    if (!state.user) {
      throw new Error('Authentication required');
    }

    try {
      const vaultPath = await FileSystemAPI.getVaultPath(state.user.username, name);
      await FileSystemAPI.ensureDirectory(vaultPath);
      await state.loadLocalVaults();
      return vaultPath;
    } catch (error) {
      handleAsyncError('Create local vault')(error);
      throw error;
    }
  },

  selectVault: async (vaultId) => {
    const state = useAppStore.getState();
    if (!state.user || !state.isAuthenticated) {
      console.warn('Cannot select vault: not authenticated');
      return;
    }

    try {
      const vault = state.availableVaults.find(v => v.id === vaultId);
      if (!vault) {
        console.error('Vault not found:', vaultId);
        return;
      }

      const vaultPath = await FileSystemAPI.getVaultPath(state.user.username, vault.name);
      await FileSystemAPI.ensureDirectory(vaultPath);
      await state.selectLocalVault(vaultPath);

      set({ currentVaultId: vaultId });
      localStorage.setItem('ink-goose-current-vault', vaultId);
    } catch (error) {
      handleAsyncError('Select vault')(error);
      throw error;
    }
  },

  selectLocalVault: async (vaultPath) => {
    try {
      const fileTree = await FileSystemAPI.loadVault(vaultPath);
      set({ vault: vaultPath, files: fileTree });

      const state = useAppStore.getState();
      await state.rebuildTagsIndex(fileTree);
      await state.buildSearchIndex();

      localStorage.setItem(config.localStorage.vaultPath, vaultPath);
    } catch (error) {
      console.error('Failed to select local vault:', error);
      throw error;
    }
  },

  syncAllVaults: async () => {
    const state = useAppStore.getState();
    if (!state.user || !state.isAuthenticated) {
      console.warn('Cannot sync vaults: not authenticated');
      return;
    }

    if (!CryptoService.getMasterKey()) {
      console.warn('Cannot sync vaults: encryption not available. User needs to log in with password.');
      return;
    }

    try {
      set({ isSyncing: true, syncProgress: { message: 'Loading vaults...', progress: 0 } });

      await state.loadVaults();
      const updatedState = useAppStore.getState();

      if (updatedState.availableVaults.length === 0) {
        console.warn('No vaults available for sync');
        set({ isSyncing: false, syncProgress: null });
        return;
      }

      let vaultToSync = updatedState.currentVaultId;

      if (!vaultToSync && updatedState.vault) {
        const savedVaultName = updatedState.vault.split(/[/\\]/).pop();
        const matchingVault = updatedState.availableVaults.find(v => v.name === savedVaultName);
        vaultToSync = matchingVault?.id || null;
      }

      if (!vaultToSync) {
        vaultToSync = updatedState.availableVaults[0].id;
      }

      if (vaultToSync) {
        const vault = updatedState.availableVaults.find(v => v.id === vaultToSync);
        if (vault && updatedState.user) {
          const vaultPath = await FileSystemAPI.getVaultPath(updatedState.user.username, vault.name);
          await FileSystemAPI.ensureDirectory(vaultPath);

          await state.selectLocalVault(vaultPath);
          set({ currentVaultId: vaultToSync });
          localStorage.setItem('ink-goose-current-vault', vaultToSync);

          await state.syncVault();
        }
      }

      await state.loadLocalVaults();
      set({ isSyncing: false, syncProgress: null, lastSyncTime: new Date() });
    } catch (error) {
      console.error('Failed to sync all vaults:', error);
      set({ isSyncing: false, syncProgress: null });
    }
  },

  syncVault: async () => {
    const state = useAppStore.getState();
    if (!state.currentVaultId || !state.vault || !state.isAuthenticated) {
      console.warn('Cannot sync: missing vault ID, vault path, or not authenticated');
      return;
    }

    if (!CryptoService.getMasterKey()) {
      console.warn('Cannot sync vault: encryption not available. User needs to log in with password.');
      return;
    }

    try {
      set({ isSyncing: true, syncProgress: { message: 'Starting background sync...', progress: 0 } });

      await syncService.performBackgroundSync(
        state.currentVaultId,
        state.vault,
        state.files,
        (progress) => {
          const percent = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
          
          const isComplete = progress.status === 'completed' || 
                           (progress.completed + progress.failed >= progress.total && progress.inProgress === 0);
          
          if (isComplete) {
            set({
              isSyncing: false,
              lastSyncTime: new Date(),
              syncProgress: null,
            });
            
            state.refreshFiles().then(() => {
              const updatedState = useAppStore.getState();
              state.rebuildTagsIndex(updatedState.files);
              state.buildSearchIndex();
            });
          } else {
            set({ 
              syncProgress: { 
                message: `${progress.status} (${progress.completed}/${progress.total})${progress.failed > 0 ? ` - ${progress.failed} failed` : ''}`, 
                progress: percent 
              } 
            });
          }
        }
      );

      // Return immediately - sync continues in background
      set({ 
        isSyncing: false, // Allow app to continue
        syncProgress: { message: 'Sync running in background...', progress: 0 },
        lastSyncTime: new Date()
      });

    } catch (error) {
      console.error('Sync failed:', error);
      set({ isSyncing: false, syncProgress: null });
      throw error;
    }
  },

  addCurrentFolderToAccount: async (currentFolderPath: string, vaultName: string) => {
    const state = useAppStore.getState();
    if (!state.user || !state.isAuthenticated) {
      throw new Error('Authentication required');
    }

    try {
      const dirCheck = await FileSystemAPI.checkDirectoryContent(currentFolderPath);
      if (!dirCheck.isDirectory) {
        throw new Error('Source path is not a directory');
      }

      const newVault = await syncAPI.createVault({ name: vaultName, description: `Imported from ${currentFolderPath}` });
      const vaultPath = await FileSystemAPI.getVaultPath(state.user.username, vaultName);
      await FileSystemAPI.ensureDirectory(vaultPath);

      if (dirCheck.hasContent) {
        await FileSystemAPI.copyFolderContents(currentFolderPath, vaultPath);
      }

      set((currentState) => ({
        availableVaults: [...currentState.availableVaults, {
          id: newVault.id,
          name: newVault.name,
          lastModified: newVault.createdAt,
        }],
      }));

      await state.loadLocalVaults();
      return { vault: newVault, path: vaultPath };
    } catch (error) {
      handleAsyncError('Add current folder to account')(error);
      throw error;
    }
  },

  getSyncQueueStatus: () => {
    return syncService.getQueueStatus();
  },

  openLocalVault: async (vaultName: string) => {
    const state = useAppStore.getState();
    if (!state.user) {
      throw new Error('Authentication required');
    }

    try {
      const vaultPath = await FileSystemAPI.getVaultPath(state.user.username, vaultName);
      const dirCheck = await FileSystemAPI.checkDirectoryContent(vaultPath);

      if (!dirCheck.isDirectory) {
        throw new Error(`Vault directory not found: ${vaultPath}`);
      }

      const serverVault = state.availableVaults.find(v => v.name === vaultName);
      await state.selectLocalVault(vaultPath);

      if (serverVault) {
        set({ currentVaultId: serverVault.id });
        localStorage.setItem('ink-goose-current-vault', serverVault.id);
      }

      return vaultPath;
    } catch (error) {
      handleAsyncError('Open local vault')(error);
      throw error;
    }
  },
}));