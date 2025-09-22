export interface SecureStorage {
  storeKey(keyId: string, keyData: string): Promise<void>;
  getKey(keyId: string): Promise<string | null>;
  deleteKey(keyId: string): Promise<void>;
}