import { AES, enc, PBKDF2 } from 'crypto-js';
import { KdfParams } from '../api/authAPI';

export interface EncryptionKeys {
    masterKey: Uint8Array;
    recoveryKey: Uint8Array;
    encMasterKey_pw: string;
    encMasterKey_recovery: string;
    kdfParams: KdfParams;
}

export interface MasterKeyData {
    masterKey: Uint8Array;
    encMasterKey_pw: string;
    kdfParams: KdfParams;
}

export class CryptoService {
    private static masterKey: Uint8Array | null = null;

    private static generateRandomBytes(length: number): Uint8Array {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return array;
    }

    private static bytesToHex(bytes: Uint8Array): string {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    private static hexToBytes(hex: string): Uint8Array {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    private static uint8ArrayToBase64(uint8Array: Uint8Array): string {
        let binary = '';
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        return btoa(binary);
    }

    private static base64ToUint8Array(base64: string): Uint8Array {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    private static deriveKey(password: string, salt: Uint8Array, iterations: number, keyLength: number): Uint8Array {
        const saltHex = this.bytesToHex(salt);
        const derived = PBKDF2(password, saltHex, {
            keySize: keyLength / 4, // crypto-js uses words (32-bit), so divide by 4
            iterations: iterations
        });
        return this.hexToBytes(derived.toString());
    }

    static generateRegistrationKeys(password: string): EncryptionKeys {
        const masterKey = this.generateRandomBytes(32);
        const recoveryKey = this.generateRandomBytes(32);

        const salt = this.generateRandomBytes(16);
        const passwordKey = this.deriveKey(password, salt, 100000, 32);

        const encMasterKey_pw = AES.encrypt(
            this.bytesToHex(masterKey),
            this.bytesToHex(passwordKey)
        ).toString();

        const encMasterKey_recovery = AES.encrypt(
            this.bytesToHex(masterKey),
            this.bytesToHex(recoveryKey)
        ).toString();

        const kdfParams: KdfParams = {
            algorithm: 'PBKDF2',
            iterations: 100000,
            memoryKb: 0,      // not used for PBKDF2
            parallelism: 1,   // not used for PBKDF2
            salt: this.bytesToHex(salt)
        };

        return {
            masterKey,
            recoveryKey,
            encMasterKey_pw,
            encMasterKey_recovery,
            kdfParams
        };
    }

    static decryptMasterKey(password: string, encMasterKey_pw: string, kdfParams: KdfParams): Uint8Array {
        const salt = this.hexToBytes(kdfParams.salt);
        const passwordKey = this.deriveKey(password, salt, kdfParams.iterations, 32);
        const decryptedHex = AES.decrypt(encMasterKey_pw, this.bytesToHex(passwordKey)).toString(enc.Utf8);
        const masterKey = this.hexToBytes(decryptedHex);

        this.masterKey = masterKey;

        return masterKey;
    }

    static recoverMasterKey(recoveryKey: string, encMasterKey_recovery: string): Uint8Array {
        const recoveryKeyBuffer = this.hexToBytes(recoveryKey);
        const decryptedHex = AES.decrypt(encMasterKey_recovery, this.bytesToHex(recoveryKeyBuffer)).toString(enc.Utf8);
        const masterKey = this.hexToBytes(decryptedHex);

        this.masterKey = masterKey;

        return masterKey;
    }

    static generateFileKey(): Uint8Array {
        return this.generateRandomBytes(32);
    }

    static encryptFileContent(content: string, fileKey: Uint8Array): string {
        try {
            const keyHex = this.bytesToHex(fileKey);
            const encrypted = AES.encrypt(content, keyHex);
            return encrypted.toString();
        } catch (error) {
            console.error('Failed to encrypt file content:', error);
            throw new Error('File encryption failed');
        }
    }

    static decryptFileContent(encryptedContent: string, fileKey: Uint8Array): string {
        try {
            const keyHex = this.bytesToHex(fileKey);
            const decrypted = AES.decrypt(encryptedContent, keyHex);
            const content = decrypted.toString(enc.Utf8);

            if (!content) {
                throw new Error('Decryption resulted in empty content');
            }

            return content;
        } catch (error) {
            console.error('Failed to decrypt file content:', error);
            throw new Error('File decryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    static encryptFileKey(fileKey: Uint8Array): string {
        if (!this.masterKey) {
            throw new Error('Master key not available. Please login first.');
        }

        try {
            const fileKeyHex = this.bytesToHex(fileKey);
            const masterKeyHex = this.bytesToHex(this.masterKey);
            const encrypted = AES.encrypt(fileKeyHex, masterKeyHex);
            return encrypted.toString();
        } catch (error) {
            console.error('Failed to encrypt file key:', error);
            throw new Error('File key encryption failed');
        }
    }

    static decryptFileKey(encryptedFileKey: string): Uint8Array {
        if (!this.masterKey) {
            throw new Error('Master key not available. Please login first.');
        }

        if (!encryptedFileKey) {
            throw new Error('Encrypted file key is null, undefined, or empty');
        }

        try {
            const masterKeyHex = this.bytesToHex(this.masterKey);
            const decrypted = AES.decrypt(encryptedFileKey, masterKeyHex);
            const decryptedHex = decrypted.toString(enc.Utf8);

            if (!decryptedHex) {
                throw new Error('File key decryption resulted in empty data');
            }

            return this.hexToBytes(decryptedHex);
        } catch (error) {
            console.error('Failed to decrypt file key:', error);
            throw new Error('File key decryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    static getMasterKey(): Uint8Array | null {
        return this.masterKey;
    }

    static setMasterKey(masterKey: Uint8Array): void {
        this.masterKey = masterKey;
    }

    static clearMasterKey(): void {
        this.masterKey = null;
    }

    static async storeMasterKeySecurely(userId: string, masterKey: Uint8Array): Promise<void> {
        if (typeof window !== 'undefined' && window.electronAPI?.safeStorage) {
            try {
                const keyData = this.uint8ArrayToBase64(masterKey);
                await window.electronAPI.safeStorage.storeSecureKey(`ink-goose-master-key-${userId}`, keyData);
            } catch (error) {
                console.error('Failed to store master key:', error);
                throw error;
            }
        } else {
            // TODO: remove this fallback
            await this.storeMasterKeyOnDevice(masterKey);
        }
    }

    static async retrieveMasterKeySecurely(userId: string): Promise<Uint8Array | null> {
        if (typeof window !== 'undefined' && window.electronAPI?.safeStorage) {
            try {
                const keyData = await window.electronAPI.safeStorage.getSecureKey(`ink-goose-master-key-${userId}`);
                if (!keyData) return null;

                return this.base64ToUint8Array(keyData);
            } catch (error) {
                console.error('Failed to retrieve master key securely:', error);
                return null;
            }
        } else {
            // TODO: remove this fallback
            return await this.retrieveMasterKeyFromDevice();
        }
    }

    static async deleteMasterKeySecurely(userId: string): Promise<void> {
        if (typeof window !== 'undefined' && window.electronAPI?.safeStorage) {
            try {
                await window.electronAPI.safeStorage.deleteSecureKey(`ink-goose-master-key-${userId}`);
            } catch (error) {
                console.warn('Failed to delete secure master key:', error);
            }
        } else {
            // TODO: remove this fallback
            this.clearDeviceStorage();
        }
    }

    // TODO: remove device storage methods
    private static readonly DEVICE_KEY_STORAGE = 'ink-goose-device-key';
    private static readonly MASTER_KEY_STORAGE = 'ink-goose-enc-master-key';

    private static async generateDeviceKey(): Promise<string> {
        const key = await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        const exported = await window.crypto.subtle.exportKey('jwk', key);
        const deviceKey = JSON.stringify(exported);

        localStorage.setItem(this.DEVICE_KEY_STORAGE, deviceKey);
        return deviceKey;
    }

    private static async storeMasterKeyOnDevice(masterKey: Uint8Array): Promise<void> {
        let deviceKeyStr = localStorage.getItem(this.DEVICE_KEY_STORAGE);

        if (!deviceKeyStr) {
            deviceKeyStr = await this.generateDeviceKey();
        }

        const deviceKey = await window.crypto.subtle.importKey(
            'jwk',
            JSON.parse(deviceKeyStr),
            { name: 'AES-GCM' },
            false,
            ['encrypt']
        );

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            deviceKey,
            new Uint8Array(masterKey)
        );

        const encryptedData = {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted))
        };

        localStorage.setItem(this.MASTER_KEY_STORAGE, JSON.stringify(encryptedData));
    }

    private static async retrieveMasterKeyFromDevice(): Promise<Uint8Array | null> {
        const deviceKeyStr = localStorage.getItem(this.DEVICE_KEY_STORAGE);
        const encryptedDataStr = localStorage.getItem(this.MASTER_KEY_STORAGE);

        if (!deviceKeyStr || !encryptedDataStr) {
            return null;
        }

        try {
            const deviceKey = await window.crypto.subtle.importKey(
                'jwk',
                JSON.parse(deviceKeyStr),
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            const encryptedData = JSON.parse(encryptedDataStr);
            const iv = new Uint8Array(encryptedData.iv);
            const data = new Uint8Array(encryptedData.data);

            const decrypted = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                deviceKey,
                data
            );

            return new Uint8Array(decrypted);
        } catch (error) {
            console.error('Failed to retrieve master key from device:', error);
            return null;
        }
    }

    private static clearDeviceStorage(): void {
        localStorage.removeItem(this.DEVICE_KEY_STORAGE);
        localStorage.removeItem(this.MASTER_KEY_STORAGE);
    }

    static reEncryptMasterKey(newPassword: string, masterKey: Uint8Array): MasterKeyData {
        const salt = this.generateRandomBytes(16);

        const passwordKey = this.deriveKey(newPassword, salt, 100000, 32);

        const encMasterKey_pw = AES.encrypt(
            this.bytesToHex(masterKey),
            this.bytesToHex(passwordKey)
        ).toString();

        const kdfParams: KdfParams = {
            algorithm: 'PBKDF2',
            iterations: 100000,
            memoryKb: 0,
            parallelism: 1,
            salt: this.bytesToHex(salt)
        };

        return {
            masterKey,
            encMasterKey_pw,
            kdfParams
        };
    }

    static prepareFileForUpload(content: string): { encryptedContent: string; encryptedFileKey: string } {
        const fileKey = this.generateFileKey();
        const encryptedContent = this.encryptFileContent(content, fileKey);
        const encryptedFileKey = this.encryptFileKey(fileKey);

        return { encryptedContent, encryptedFileKey };
    }

    static prepareDownloadedFile(encryptedContent: string, encryptedFileKey: string): string {
        if (!encryptedContent) {
            throw new Error('Encrypted content is missing or empty');
        }
        
        if (!encryptedFileKey) {
            throw new Error('Encrypted file key is missing or empty');
        }        
        const fileKey = this.decryptFileKey(encryptedFileKey);
        return this.decryptFileContent(encryptedContent, fileKey);
    }

    static generateContentHash(content: string): string {
        // TODO: replace with proper hash function
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }
}