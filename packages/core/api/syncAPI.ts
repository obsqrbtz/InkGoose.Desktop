import { config } from '../../../src/config/config';
import { AuthAPI } from './authAPI';
import { HttpClient, Logger } from "../platform/platform";

export interface FileSyncInfo {
    relativePath: string;
    version: number;
    contentHash: string;
}

export interface SyncCheckRequest {
    files: FileSyncInfo[];
}

export interface FileSyncAction {
    relativePath: string;
    action: SyncAction;
    serverVersion: number;
    fileId?: string;
}

export interface SyncCheckResponse {
    actions: FileSyncAction[];
}

export interface UploadFileRequest {
    relativePath: string;
    version: number;
    sizeBytes: number;
    contentHash: string;
    encryptedFileKey: string;
    force?: boolean;
}

export interface UploadResponse {
    fileId: string;
    version: number;
    uploadedAt: string;
    success: boolean;
    conflict?: VersionConflictInfo;
    uploadUrl: string;
}

export interface VersionConflictInfo {
    currentServerVersion: number;
    attemptedVersion: number;
    currentContentHash: string;
    message: string;
}

export interface FileVersionDto {
    fileId: string;
    version: number;
    encryptedContent: string;
    contentHash: string;
    uploadedBy: string;
    timestamp: string;
    sizeBytes: number;
    encryptedFileKey: string;
    url: string;
}

export interface FileVersionSummary {
    version: number;
    uploadedBy: string;
    timestamp: string;
    sizeBytes: number;
}

export interface ResolveConflictRequest {
    resolution: ConflictResolution;
    newVersion?: number;
}

export interface ConflictResolutionChoice {
    type: 'keep-local' | 'use-server' | 'merge';
    mergedContent?: string;
}

export interface VaultSummary {
    id: string;
    name: string;
    lastModified: string;
}

export interface CreateVaultRequest {
    name: string;
    description: string;
}

export interface CreateVaultResponse {
    id: string;
    name: string;
    description: string;
    createdAt: string;
}

export interface VaultDetails {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    lastModified: string;
    collaborators: VaultCollaborator[];
}

export interface VaultCollaborator {
    userId: string;
    username: string;
    email: string;
    permission: VaultPermission;
    addedAt: string;
}

export interface AddCollaboratorRequest {
    userId: string;
    permission: VaultPermission;
}

export interface UpdatePermissionRequest {
    permission: VaultPermission;
}

export enum SyncAction {
    None = 0,
    Upload = 1,
    Download = 2,
    Conflict = 3
}

export enum ConflictResolution {
    KeepLocal = 0,
    UseServer = 1,
    Manual = 2
}

export enum VaultPermission {
    Read = 0,
    Write = 1,
    Admin = 2
}

const createRequest = (method: string, data?: unknown): RequestInit => {
    const request: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };

    if (data) {
        request.body = JSON.stringify(data);
    }

    return request;
};

const handleError = (url: string, status: number, text: string) => {
    console.error('Sync API request failed:', url, 'status:', status, 'error:', text);

    try {
        const errorData = JSON.parse(text);
        throw new Error(errorData.errors?.[0] || errorData.message || text);
    } catch {
        throw new Error(text || `HTTP ${status}`);
    }
};

export class SyncAPI {
    constructor(private http: HttpClient, private logger: Logger = console) {}

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        if (!this.http) {
            throw new Error("SyncAPI not configured. Call SyncAPI.configure() first.");
        }
        const url = `${config.apiBaseUrl}${endpoint}`;
        const token = AuthAPI.getAccessToken();

        const response = await this.http.request<T>(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...options.headers,
        },
        });

        return response;
    }

    // Vault operations
    getUserVaults = () => this.request<VaultSummary[]>('/vault');

    createVault = (data: CreateVaultRequest) =>
        this.request<CreateVaultResponse>('/vault', createRequest('POST', data));

    getVault = (vaultId: string) =>
        this.request<VaultDetails>(`/vault/${vaultId}`);

    // Collaborator operations
    addCollaborator = (vaultId: string, data: AddCollaboratorRequest) =>
        this.request<void>(`/vault/${vaultId}/collaborators`, createRequest('POST', data));

    removeCollaborator = (vaultId: string, userId: string) =>
        this.request<void>(`/vault/${vaultId}/collaborators/${userId}`, createRequest('DELETE'));

    updatePermission = (vaultId: string, userId: string, data: UpdatePermissionRequest) =>
        this.request<void>(`/vault/${vaultId}/collaborators/${userId}/permission`, createRequest('PUT', data));

    // Sync operations
    checkSync = (vaultId: string, data: SyncCheckRequest) =>
        this.request<SyncCheckResponse>(`/sync/${vaultId}/check`, createRequest('POST', data));

    uploadFile = async (vaultId: string, data: UploadFileRequest, encryptedContent: string) => {
        const uploadResponse = await this.request<UploadResponse>(`/sync/${vaultId}/upload`, createRequest('POST', data));
        const contentUploaded = await this.uploadFileContent(uploadResponse.uploadUrl, encryptedContent);
        if (!contentUploaded) {
            uploadResponse.success = false;
        }
        return uploadResponse;
    };

    forceUploadFile = async (vaultId: string, data: UploadFileRequest, encryptedContent: string) => {
        const uploadResponse = await this.request<UploadResponse>(`/sync/${vaultId}/upload`, createRequest('POST', { ...data, force: true }));
        const contentUploaded = await this.uploadFileContent(uploadResponse.uploadUrl, encryptedContent);
        if (!contentUploaded) {
            uploadResponse.success = false;
        }
        return uploadResponse;
    };

    downloadFile = async (vaultId: string, fileId: string, version?: number) => {
        const versionParam = version ? `?version=${version}` : '';
        const fileVersion = await this.request<FileVersionDto>(`/sync/${vaultId}/download/${fileId}${versionParam}`);
        const content = await this.downloadFileContent(fileVersion.url);
        return { ...fileVersion, encryptedContent: content };
    };

    downloadFileByPath = async (vaultId: string, relativePath: string, version?: number) => {
        const versionParam = version ? `?version=${version}` : '';
        const fileVersion = await this.request<FileVersionDto>(`/sync/${vaultId}/download-by-path/${encodeURIComponent(relativePath)}${versionParam}`);
        const content = await this.downloadFileContent(fileVersion.url);
        return { ...fileVersion, encryptedContent: content };
    };

    getFileHistory = (vaultId: string, fileId: string) =>
        this.request<FileVersionSummary[]>(`/sync/${vaultId}/files/${fileId}/history`);

    async downloadFileContent(url: string): Promise<string> {
        return await this.http.download(url); 
    }
    
    async uploadFileContent(url: string, content: string): Promise<boolean> {
        return await this.http.upload(url, content);
    }

    async batchDownloadFiles(downloads: Array<{ vaultId: string; fileId: string; version?: number }>): Promise<Array<{ fileId: string; content: string; error?: string }>> {
        const promises = downloads.map(async ({ vaultId, fileId, version }) => {
            try {
                const result = await this.downloadFile(vaultId, fileId, version);
                return { fileId, content: result.encryptedContent };
            } catch (error) {
                return { fileId, content: '', error: error instanceof Error ? error.message : String(error) };
            }
        });
        return Promise.all(promises);
    }
}
