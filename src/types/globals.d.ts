// Global variables provided by Electron Forge Vite plugin
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Vite environment variables
interface ImportMetaEnv {
	readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

interface ElectronWindowAPI {
	selectVaultFolder: () => Promise<string | null>;
	loadVault: (vaultPath: string) => Promise<import('.').FileNode[]>;
	readFile: (filePath: string) => Promise<string>;
	writeFile: (filePath: string, content: string) => Promise<boolean>;
	createFile: (filePath: string, content: string) => Promise<boolean>;
	createDirectory: (dirPath: string) => Promise<boolean>;
	deleteFile: (filePath: string) => Promise<boolean>;
	renameFile: (oldPath: string, newPath: string) => Promise<boolean>;
	watchVault: (vaultPath: string) => Promise<boolean>;
	unwatchVault: () => Promise<boolean>;
	onVaultChanged: (callback: (payload: { event: string; path: string }) => void) => () => void;
	minimizeWindow: () => void;
	toggleMaximizeWindow: () => void;
	closeWindow: () => void;
	onWindowMaximized: (callback: (isMaximized: boolean) => void) => () => void;
}

declare global {
	interface Window {
		electronAPI?: ElectronWindowAPI;
	}
}
