export type ThemePreference = 'light' | 'dark' | 'system';

export const isSystemDark = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const resolveTheme = (pref: ThemePreference): 'light' | 'dark' => {
  if (pref === 'system') {
    return isSystemDark() ? 'dark' : 'light';
  }
  return pref;
};

export const nextThemePreference = (pref: ThemePreference): ThemePreference => {
  switch (pref) {
    case 'light':
      return 'dark';
    case 'dark':
      return 'system';
    default:
      return 'light';
  }
};
