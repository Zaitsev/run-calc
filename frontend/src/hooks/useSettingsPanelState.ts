import { useAI, useDisplaySettings, useThemeStore, useWindow } from '../contexts';
import { useTheme } from '../useTheme';

/**
 * Lightweight facade hook that composes all settings-related hooks.
 * Used by SettingsPanel component for convenient access to settings state and actions.
 */
export function useSettingsPanelState() {
    return {
        display: useDisplaySettings(),
        theme: useTheme(),
        themeStore: useThemeStore(),
        window: useWindow(),
        ai: useAI(),
    };
}
