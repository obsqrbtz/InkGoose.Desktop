import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import started from 'electron-squirrel-startup';
import { FileNode } from './types';
import chokidar, { FSWatcher } from 'chokidar';
import { config } from './config/config';

if (started) {
	app.quit();
}

if (!app.isPackaged) {
	// Allow attaching a debugger to renderer processes (DevTools protocol)
	// Use a port different from Vite's dev server (5173) to avoid conflicts
	app.commandLine.appendSwitch('remote-debugging-port', '9222');
	process.env.ELECTRON_ENABLE_LOGGING = 'true';
}

const createWindow = () => {
	const mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		titleBarStyle: 'hidden',
		titleBarOverlay: false,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	if (process.platform === 'darwin') {
		mainWindow.setWindowButtonVisibility(false);
	}

	// TOOD: set proper env depending on keyring provider
	// or use another solution for wms and composiutors that don't have keyrings
	if (process.platform === 'linux') {
		process.env.XDG_CURRENT_DESKTOP = 'GNOME';
	}

	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
	}

	mainWindow.on('maximize', () => {
		mainWindow.webContents.send('window:maximized', true);
	});
	mainWindow.on('unmaximize', () => {
		mainWindow.webContents.send('window:maximized', false);
	});

	return mainWindow;
};

const watchers = new Map<number, FSWatcher>();

// Utility functions for default directory management
const getDefaultAppDataPath = () => {
	return path.join(os.homedir(), config.directories.appData);
};

const getUserDataPath = (username: string) => {
	return path.join(getDefaultAppDataPath(), username);
};

const getVaultsPath = (username: string) => {
	return path.join(getUserDataPath(username), config.directories.vaultPrefix);
};

const getVaultPath = (username: string, vaultName: string) => {
	return path.join(getVaultsPath(username), vaultName);
};

const ensureDirectoryExists = async (dirPath: string) => {
	try {
		await fs.promises.mkdir(dirPath, { recursive: true });
		return true;
	} catch (error) {
		console.error(`Failed to create directory ${dirPath}:`, error);
		return false;
	}
};

const initializeUserDirectories = async (username: string) => {
	const appDataPath = getDefaultAppDataPath();
	const userDataPath = getUserDataPath(username);
	const vaultsPath = getVaultsPath(username);

	const success = await ensureDirectoryExists(appDataPath) &&
		await ensureDirectoryExists(userDataPath) &&
		await ensureDirectoryExists(vaultsPath);

	return success;
};

// File system handlers
ipcMain.handle('select-vault-folder', async () => {
	const result = await dialog.showOpenDialog({
		properties: ['openDirectory'],
		title: 'Select Vault Folder',
	});

	if (!result.canceled && result.filePaths.length > 0) {
		return result.filePaths[0];
	}
	return null;
});

ipcMain.handle('load-vault', async (_, vaultPath: string) => {
	try {
		const stats = await fs.promises.stat(vaultPath);
		if (!stats.isDirectory()) {
			throw new Error(`Path is not a directory: ${vaultPath}`);
		}

		await fs.promises.access(vaultPath, fs.constants.R_OK);

		// TODO: implement proper system path exclusion
		const isSystemPath = (
			vaultPath.includes('/System/') ||
			vaultPath.includes('/private/') ||
			vaultPath.includes('/var/') ||
			vaultPath.includes('/usr/') ||
			vaultPath.includes('/bin/') ||
			vaultPath.includes('/sbin/') ||
			vaultPath.includes('/etc/') ||
			vaultPath.includes('/opt/') ||
			vaultPath.includes('/proc/') ||
			vaultPath.includes('/dev/') ||
			vaultPath.endsWith('/Library') ||
			(vaultPath.includes('/Library/') && (
				vaultPath.includes('/Application Support') ||
				vaultPath.includes('/Caches') ||
				vaultPath.includes('/Preferences') ||
				vaultPath.includes('/Cookies') ||
				vaultPath.includes('/Keychains') ||
				vaultPath.includes('/Accounts') ||
				vaultPath.includes('com.apple.')
			))
		);

		if (isSystemPath) {
			throw new Error(`Cannot use system directory as vault: ${vaultPath}`);
		}

		return await loadDirectoryTree(vaultPath);
	} catch (error) {
		console.error('Failed to load vault:', error);
		return [];
	}
});

ipcMain.handle('read-file', async (_, filePath: string) => {
	try {
		return await fs.promises.readFile(filePath, 'utf8');
	} catch (error) {
		const nodeError = error as NodeJS.ErrnoException;
		if (nodeError.code === 'ENOENT') {
            return ''; // or null
        }
		throw error;
	}
});

ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
	try {
		await fs.promises.writeFile(filePath, content, 'utf8');
		return true;
	} catch (error) {
		console.error('Failed to write file:', error);
		throw error;
	}
});

ipcMain.handle('create-file', async (_, filePath: string, content: string) => {
	try {
		const dir = path.dirname(filePath);
		await fs.promises.mkdir(dir, { recursive: true });
		await fs.promises.writeFile(filePath, content, 'utf8');
		return true;
	} catch (error) {
		console.error('Failed to create file:', error);
		throw error;
	}
});

ipcMain.handle('create-directory', async (_, dirPath: string) => {
	try {
		await fs.promises.mkdir(dirPath, { recursive: true });
		return true;
	} catch (error) {
		console.error('Failed to create directory:', error);
		throw error;
	}
});

ipcMain.handle('delete-file', async (_, filePath: string) => {
	try {
		const stats = await fs.promises.stat(filePath);
		if (stats.isDirectory()) {
			await fs.promises.rm(filePath, { recursive: true, force: true });
		} else {
			await fs.promises.unlink(filePath);
		}
		return true;
	} catch (error) {
		console.error('Failed to delete file/directory:', error);
		throw error;
	}
});

ipcMain.handle('rename-file', async (_, oldPath: string, newPath: string) => {
	try {
		const dir = path.dirname(newPath);
		await fs.promises.mkdir(dir, { recursive: true });
		await fs.promises.rename(oldPath, newPath);
		return true;
	} catch (error) {
		console.error('Failed to rename file:', error);
		throw error;
	}
});

ipcMain.handle('watch-vault', async (event, vaultPath: string) => {
	const wcId = event.sender.id;
	const prev = watchers.get(wcId);
	if (prev) {
		try { await prev.close(); } catch { /* ignore */ }
		watchers.delete(wcId);
	}

	const watcher = chokidar.watch(vaultPath, {
		ignored: [
			/(^|\\|\/)\../, //
			'**/node_modules/**',
			'**/.git/**',
			'**/.DS_Store',
			'**/Thumbs.db',
			'**/*.tmp',
			'**/~$*',
		],
		ignoreInitial: true,
		awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
		depth: undefined,
		persistent: true,
	});

	const send = (evt: string, p: string) => {
		try {
			event.sender.send('vault:changed', { event: evt, path: p });
		} catch (e) {
			try { watcher.close(); } catch { /* ignore */ }
			watchers.delete(wcId);
		}
	};

	watcher
		.on('add', (p) => send('add', p))
		.on('change', (p) => send('change', p))
		.on('unlink', (p) => send('unlink', p))
		.on('addDir', (p) => send('addDir', p))
		.on('unlinkDir', (p) => send('unlinkDir', p))
		.on('error', (err) => {
			console.error('Vault watcher error:', err);
			send('error', String(err));
		});

	watchers.set(wcId, watcher);

	event.sender.once('destroyed', () => {
		const w = watchers.get(wcId);
		if (w) {
			try { w.close(); } catch { /* ignore */ }
			watchers.delete(wcId);
		}
	});
	return true;
});

ipcMain.handle('unwatch-vault', async (event) => {
	const wcId = event.sender.id;
	const watcher = watchers.get(wcId);
	if (watcher) {
		try { await watcher.close(); } catch { /* ignore */ }
		watchers.delete(wcId);
		return true;
	}
	return false;
});

ipcMain.handle('get-default-app-path', async () => {
	return getDefaultAppDataPath();
});

ipcMain.handle('get-user-data-path', async (_, username: string) => {
	return getUserDataPath(username);
});

ipcMain.handle('get-vaults-path', async (_, username: string) => {
	return getVaultsPath(username);
});

ipcMain.handle('get-vault-path', async (_, username: string, vaultName: string) => {
	return getVaultPath(username, vaultName);
});

ipcMain.handle('initialize-user-directories', async (_, username: string) => {
	return await initializeUserDirectories(username);
});

ipcMain.handle('ensure-directory', async (_, dirPath: string) => {
	return await ensureDirectoryExists(dirPath);
});

ipcMain.handle('list-user-vaults', async (_, username: string) => {
	try {
		const vaultsPath = getVaultsPath(username);
		await ensureDirectoryExists(vaultsPath);

		const items = await fs.promises.readdir(vaultsPath, { withFileTypes: true });
		const vaults = [];

		for (const item of items) {
			if (item.isDirectory()) {
				const vaultPath = path.join(vaultsPath, item.name);
				const stats = await fs.promises.stat(vaultPath);

				vaults.push({
					name: item.name,
					path: vaultPath,
					lastModified: stats.mtime,
				});
			}
		}

		return vaults;
	} catch (error) {
		console.error('Failed to list user vaults:', error);
		return [];
	}
});

ipcMain.handle('copy-folder-contents', async (_, sourcePath: string, destPath: string) => {
	try {
		await ensureDirectoryExists(destPath);

		const items = await fs.promises.readdir(sourcePath, { withFileTypes: true });

		for (const item of items) {
			const sourceItemPath = path.join(sourcePath, item.name);
			const destItemPath = path.join(destPath, item.name);

			if (item.isDirectory()) {
				await fs.promises.cp(sourceItemPath, destItemPath, { recursive: true });
			} else {
				await fs.promises.copyFile(sourceItemPath, destItemPath);
			}
		}

		return true;
	} catch (error) {
		console.error('Failed to copy folder contents:', error);
		throw error;
	}
});

ipcMain.handle('check-directory-content', async (_, dirPath: string) => {
	try {
		const stats = await fs.promises.stat(dirPath);
		if (!stats.isDirectory()) {
			return { isDirectory: false, hasContent: false, fileCount: 0 };
		}

		const items = await fs.promises.readdir(dirPath);
		return {
			isDirectory: true,
			hasContent: items.length > 0,
			fileCount: items.length
		};
	} catch (error) {
		console.error('Failed to check directory content:', error);
		return { isDirectory: false, hasContent: false, fileCount: 0 };
	}
});

ipcMain.handle('safe-storage-available', async () => {
	return safeStorage.isEncryptionAvailable();
});

ipcMain.handle('safe-storage-store', async (_, key: string, value: string) => {
	try {
		if (!safeStorage.isEncryptionAvailable()) {
			throw new Error('Safe storage encryption not available');
		}

		const encrypted = safeStorage.encryptString(value);

		// TODO: consider using OS keyring/keychain instead of file storage
		const userDataPath = app.getPath('userData');
		const secureStorePath = path.join(userDataPath, 'secure-storage');

		await fs.promises.mkdir(secureStorePath, { recursive: true });

		const keyFilePath = path.join(secureStorePath, `${key}.enc`);
		await fs.promises.writeFile(keyFilePath, encrypted);
	} catch (error) {
		console.error('Failed to save secure key:', error);
		throw error;
	}
});

ipcMain.handle('safe-storage-get', async (_, key: string) => {
	try {
		if (!safeStorage.isEncryptionAvailable()) {
			throw new Error('Safe storage encryption not available');
		}

		const userDataPath = app.getPath('userData');
		const keyFilePath = path.join(userDataPath, 'secure-storage', `${key}.enc`);

		try {
			await fs.promises.access(keyFilePath);
		} catch {
			console.log('Secure key file not found:', key);
			return null;
		}

		const encrypted = await fs.promises.readFile(keyFilePath);
		const decrypted = safeStorage.decryptString(encrypted);
		return decrypted;
	} catch (error) {
		console.error('Failed to retrieve secure key:', error);
		return null;
	}
});

ipcMain.handle('safe-storage-delete', async (_, key: string) => {
	try {
		const userDataPath = app.getPath('userData');
		const keyFilePath = path.join(userDataPath, 'secure-storage', `${key}.enc`);

		try {
			await fs.promises.unlink(keyFilePath);
		} catch (error) {
			console.log('Secure key file not found for deletion:', key);
		}
	} catch (error) {
		console.error('Failed to delete secure key:', error);
		throw error;
	}
});

// Due to CORS files should be downloaded via main process
ipcMain.handle('download-file-content', async (_, url: string) => {
	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Accept': '*/*'
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to download file content: ${response.status} ${response.statusText}`);
		}

		return await response.text();
	} catch (error) {
		console.error('Failed to download file from URL:', url, error);
		throw error;
	}
});

// Due to CORS files should be uploaded via main process
ipcMain.handle('upload-file-content', async (_, url: string, content: string) => {
	try {
		const response = await fetch(url, {
			method: 'PUT',
			body: content,
			headers: {
				'Accept': '*/*'
			}
		});

		if (!response.ok) {
			throw new Error(`Upload failed with status ${response.status}`);
		}
		return true;
	} catch (error) {
		console.error('Failed to upload file to URL:', url, error);
		return false;
	}
});

async function loadDirectoryTree(dirPath: string): Promise<FileNode[]> {
	try {
		const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
		const tree = [];

		for (const item of items) {
			try {
				const fullPath = path.join(dirPath, item.name);
				const stats = await fs.promises.stat(fullPath);

				if (item.isDirectory()) {
					if (!item.name.startsWith('.') && item.name !== 'node_modules') {
						// TODO: implement proper system dir exclusion
						const isSystemDir = (
							fullPath.includes('/Library/') && (
								fullPath.includes('/Application Support/') ||
								fullPath.includes('/Accounts') ||
								fullPath.includes('/Keychains') ||
								fullPath.includes('/Caches/') ||
								fullPath.includes('/Cookies') ||
								fullPath.includes('/Preferences') ||
								fullPath.includes('/Safari') ||
								fullPath.includes('/WebKit') ||
								fullPath.includes('/Logs') ||
								fullPath.includes('/Assistant') ||
								fullPath.includes('/Autosave Information') ||
								fullPath.includes('/Biome') ||
								fullPath.includes('/ContainerManager') ||
								fullPath.includes('com.apple.')
							)
						) ||
							fullPath.includes('/System/') ||
							fullPath.includes('/private/') ||
							fullPath.includes('/var/') ||
							fullPath.includes('/usr/') ||
							fullPath.includes('/bin/') ||
							fullPath.includes('/sbin/') ||
							fullPath.includes('/etc/') ||
							fullPath.includes('/opt/') ||
							fullPath.includes('/proc/') ||
							fullPath.includes('/dev/') ||
							fullPath.endsWith('/Library') ||
							item.name === 'Accounts' ||
							item.name === 'Keychains' ||
							item.name === 'ContainerManager';

						if (!isSystemDir) {
							try {
								const children = await loadDirectoryTree(fullPath);
								tree.push({
									name: item.name,
									path: fullPath,
									type: 'directory' as const,
									children,
									lastModified: stats.mtime,
								});
							} catch (error) {
								// Skip directories that can't be accessed due to permissions
								console.warn(`Skipping directory due to permission error: ${fullPath}`, error);
							}
						}
					}
				} else if (item.isFile()) {
					if (!item.name.startsWith('.')) {
						tree.push({
							name: item.name,
							path: fullPath,
							type: 'file' as const,
							extension: path.extname(item.name),
							size: stats.size,
							lastModified: stats.mtime,
						});
					}
				}
			} catch (error) {
				console.warn(`Skipping item due to error: ${item.name}`, error);
			}
		}

		// Dirs first, then files
		tree.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === 'directory' ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});

		return tree;
	} catch (error) {
		console.error(`Failed to read directory: ${dirPath}`, error);
		return [];
	}
}

app.whenReady().then(() => {
	const mainWindow = createWindow();

	ipcMain.on('window:minimize', () => {
		const win = BrowserWindow.getFocusedWindow() || mainWindow;
		if (win) win.minimize();
	});

	ipcMain.on('window:toggle-maximize', () => {
		const win = BrowserWindow.getFocusedWindow() || mainWindow;
		if (!win) return;
		if (win.isMaximized()) {
			win.unmaximize();
		} else {
			win.maximize();
		}
	});

	ipcMain.on('window:close', () => {
		const win = BrowserWindow.getFocusedWindow() || mainWindow;
		if (win) win.close();
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
