export const config = {
    apiBaseUrl: 'http://localhost:5197/api',

    tokenKeys: {
        accessToken: 'ink-goose-access-token',
        refreshToken: 'ink-goose-refresh-token',
    },
    localStorage: {
        vaultPath: 'inkgoose_vault_path',
        themePreference: 'inkgoose_theme_pref',
        sidebarWidth: 'inkgoose_sidebar_width',
    },

    // Default directories
    directories: {
        appData: 'inkgoose',  // ~/inkgoose
        globalConfig: 'config.json',  // ~/inkgoose/config.json
        userPrefix: '',  // ~/inkgoose/<username>/
        vaultPrefix: 'vaults',  // ~/inkgoose/<username>/vaults/
        syncMetadata: '.ink-goose-sync.json',
    },
};

export default config;
