import { config } from '../../../src/config/config';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface KdfParams {
    algorithm: string;
    iterations: number;
    memoryKb: number;
    parallelism: number;
    salt: string;
}

export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    encryptionMode: number;
    encMasterKey_pw: string;
    encMasterKey_recovery: string;
    kdfParams: KdfParams;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    encMasterKey_pw: string;
    kdfParams: KdfParams;
}

export interface RegisterResponse {
    userId: string;
    username: string;
    email: string;
    createdAt: string;
}

export interface User {
    id: string;
    email: string;
    username: string;
}

export interface RefreshTokenRequest {
    refreshToken: string;
}

export interface TokenResponse {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
}

const tokenStorage = {
    get: (key: string) => localStorage.getItem(key),
    set: (key: string, value: string) => localStorage.setItem(key, value),
    remove: (key: string) => localStorage.removeItem(key),
};

const parseJWT = (token: string) => {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch {
        return null;
    }
};

const createAuthRequest = (endpoint: string, data: unknown, method = 'POST') => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
});

export class AuthAPI {
    private static accessToken = tokenStorage.get(config.tokenKeys.accessToken);
    private static refreshToken = tokenStorage.get(config.tokenKeys.refreshToken);

    private static async request<T>(
        endpoint: string,
        options: RequestInit = {},
        requireAuth = true
    ): Promise<T> {
        const url = `${config.apiBaseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
            ...(requireAuth && this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
        };

        let response = await fetch(url, { ...options, headers });

        if (response.status === 401 && this.refreshToken && !endpoint.includes('/auth/')) {
            try {
                await this.refreshAccessToken();
                response = await fetch(url, {
                    ...options,
                    headers: { ...headers, Authorization: `Bearer ${this.accessToken}` }
                });
            } catch {
                this.clearTokens();
                throw new Error('Authentication failed');
            }
        }

        if (!response.ok) {
            const text = await response.text();
            let errorMessage = `HTTP ${response.status}`;

            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.errors?.[0] || errorData.message || text;
            } catch {
                errorMessage = text || errorMessage;
            }

            throw new Error(errorMessage);
        }

        if (response.status === 204) return {} as T;

        const text = await response.text();
        return text ? JSON.parse(text) : ({} as T);
    }

    static async login(credentials: LoginRequest): Promise<LoginResponse> {
        const response = await this.request<LoginResponse>(
            '/auth/login',
            createAuthRequest('/auth/login', credentials),
            false
        );

        this.setTokens(response.accessToken, response.refreshToken);
        return response;
    }

    static async register(data: RegisterRequest): Promise<RegisterResponse> {
        return this.request<RegisterResponse>(
            '/auth/register',
            createAuthRequest('/auth/register', data),
            false
        );
    }

    static async logout(): Promise<void> {
        if (this.refreshToken) {
            try {
                await this.request('/auth/logout',
                    createAuthRequest('/auth/logout', { refreshToken: this.refreshToken })
                );
            } catch (error) {
                console.warn('Logout request failed:', error);
            }
        }
        this.clearTokens();
    }

    static async refreshAccessToken(): Promise<void> {
        if (!this.refreshToken) throw new Error('No refresh token available');

        const response = await this.request<TokenResponse>(
            '/auth/refresh',
            createAuthRequest('/auth/refresh', { refreshToken: this.refreshToken }),
            false
        );

        this.setTokens(response.accessToken, response.refreshToken);
    }

    static getCurrentUser(): User | null {
        if (!this.accessToken) return null;

        const payload = parseJWT(this.accessToken);
        if (!payload) return null;

        return {
            id: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || payload.sub,
            email: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || payload.email,
            username: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
                payload.name ||
                payload.email?.split('@')[0] ||
                'User',
        };
    }

    static isAuthenticated(): boolean {
        if (!this.accessToken) return false;

        const payload = parseJWT(this.accessToken);
        return payload ? Date.now() < payload.exp * 1000 : false;
    }

    static getAccessToken(): string | null {
        return this.accessToken;
    }

    private static setTokens(accessToken: string, refreshToken: string): void {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        tokenStorage.set(config.tokenKeys.accessToken, accessToken);
        tokenStorage.set(config.tokenKeys.refreshToken, refreshToken);
    }

    private static clearTokens(): void {
        this.accessToken = null;
        this.refreshToken = null;
        tokenStorage.remove(config.tokenKeys.accessToken);
        tokenStorage.remove(config.tokenKeys.refreshToken);
    }
}
