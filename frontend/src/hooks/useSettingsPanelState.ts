import { useAI, useDisplaySettings, useThemeStore, useWindow } from '../contexts';
import { useTheme } from '../useTheme';

/**
 * Lightweight facade hook that composes all settings-related hooks.
 * Used by SettingsPanel component for convenient access to settings state and actions.
 */
export function useSettingsPanelState() {
    const themeStore = useThemeStore();
    const theme = useTheme();

    return {
        display: useDisplaySettings(),
        theme,
        themeStore,
        window: useWindow(),
        ai: useAI(),
    };
}
