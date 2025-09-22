import { SecureStorage } from '../../packages/core/services/cryptoService/secureStorage';
export class ElectronSafeStorage implements SecureStorage {
  async storeKey(keyId: string, keyData: string) {
    await window.electronAPI.safeStorage.storeSecureKey(keyId, keyData);
  }
  async getKey(keyId: string) {
    return window.electronAPI.safeStorage.getSecureKey(keyId);
  }
  async deleteKey(keyId: string) {
    await window.electronAPI.safeStorage.deleteSecureKey(keyId);
  }
}