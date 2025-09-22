import { createAppStore, AppStoreDependencies } from '../../packages/core/store/appStore';
import { electronHttpClient } from '../adapters/electronHttpClient';
import { ElectronConflictDialog } from '../components/ConflictResolutionModal/conflictDialog';
import { ConflictResolver } from '../../packages/core/services/conflictResolver';
import { ElectronFileSystem } from '../adapters/electronfileSystem';
import { CryptoService } from '../../packages/core/services/cryptoService/cryptoService';
import { SyncAPI } from '../../packages/core/api/syncAPI';
import { SyncService } from '../../packages/core/services/syncService';

const createElectronDependencies = (): AppStoreDependencies => {
  const http = electronHttpClient;
  const cryptoService = new CryptoService();
  const syncAPI = new SyncAPI(http);
  const conflictResolver = new ConflictResolver(syncAPI, new ElectronConflictDialog(), cryptoService);
  const fileSystem = new ElectronFileSystem();
  const syncService = new SyncService(syncAPI, conflictResolver, fileSystem, cryptoService);
  
  return {
    http,
    cryptoService,
    syncAPI,
    conflictResolver,
    fileSystem,
    syncService
  };
};

export const useAppStore = createAppStore(createElectronDependencies());

export { createAppStore };
export type { AppState } from '../../packages/core/store/appStore';