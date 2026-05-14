import { useAI, useDisplaySettings, useThemeStore, useWindow } from '../contexts';

/**
 * Lightweight facade hook that composes all settings-related hooks.
 * Used by SettingsPanel component for convenient access to settings state and actions.
 */
export function useSettingsPanelState() {
    const themeStore = useThemeStore();

    return {
        display: useDisplaySettings(),
        theme: themeStore,
        themeStore,
        window: useWindow(),
        ai: useAI(),
    };
}
