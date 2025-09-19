import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';

export const useTheme = () => {
    const { theme, themePreference, setThemePreference } = useAppStore();

    const setTheme = useCallback((newTheme: 'light' | 'dark' | 'system') => {
        setThemePreference(newTheme);
    }, [setThemePreference]);

    const toggleTheme = useCallback(() => {
        setThemePreference(theme === 'dark' ? 'light' : 'dark');
    }, [theme, setThemePreference]);

    return {
        theme,
        themePreference,
        setTheme,
        toggleTheme
    };
};