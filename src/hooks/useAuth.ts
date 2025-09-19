import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { KdfParams } from '../api/authAPI';

export const useAuth = () => {
    const {
        user,
        isAuthenticated,
        login,
        register,
        logout,
        reauthenticateWithPassword
    } = useAppStore();

    const handleLogin = useCallback(async (email: string, password: string) => {
        try {
            await login(email, password);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Login failed'
            };
        }
    }, [login]);

    const handleRegister = useCallback(async (
        username: string,
        email: string,
        password: string,
        encMasterKey_pw: string,
        encMasterKey_recovery: string,
        kdfParams: KdfParams
    ) => {
        try {
            await register(username, email, password, encMasterKey_pw, encMasterKey_recovery, kdfParams);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Registration failed'
            };
        }
    }, [register]);

    const handleLogout = useCallback(async () => {
        try {
            await logout();
            return { success: true };
        } catch (error) {
            console.warn('Logout error:', error);
            return { success: true }; // Even if logout API fails, clear local state
        }
    }, [logout]);

    const handleReauth = useCallback(async (password: string) => {
        try {
            await reauthenticateWithPassword(password);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Re-authentication failed'
            };
        }
    }, [reauthenticateWithPassword]);

    return {
        user,
        isAuthenticated,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        reauthenticate: handleReauth
    };
};