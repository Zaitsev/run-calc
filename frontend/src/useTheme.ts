import { useEffect, useState } from 'react';

export type ThemeType = 'light' | 'dark' | 'system' | 'custom';

export interface ThemeState {
    type: ThemeType;
    customColors?: Record<string, string>;
    customId?: string;
}

const THEME_KEY = 'calc.theme';
const DEFAULT_THEME: ThemeState = { type: 'system' };

function applyTheme(themeState: ThemeState): void {
    const root = document.documentElement;

    // Clear existing inline custom color styles
    for (const key of Array.from(root.style)) {
        if (key.startsWith('--')) {
            root.style.removeProperty(key);
        }
    }

    if (themeState.type === 'custom' && themeState.customColors) {
        root.setAttribute('data-theme', 'custom');
        for (const [key, value] of Object.entries(themeState.customColors)) {
            // Convert e.g. editor.background -> --editor-background
            const cssVar = '--' + key.replace(/\./g, '-');
            root.style.setProperty(cssVar, value);
            
            // Standard mapping fallback keys exactly as requested
            if (key === 'editor.background') root.style.setProperty('--html-bg', value);
            if (key === 'sideBar.background') root.style.setProperty('--window-bg', value);
            if (key === 'textLink.foreground') root.style.setProperty('--gutter-mark-color', value);
        }
    } else {
        const resolved =
            themeState.type === 'system'
                ? window.matchMedia('(prefers-color-scheme: dark)').matches
                    ? 'dark'
                    : 'light'
                : themeState.type;
        root.setAttribute('data-theme', resolved);
    }
}

export function useTheme() {
    const [theme, setThemeState] = useState<ThemeState>(() => {
        const raw = localStorage.getItem(THEME_KEY);
        if (!raw) return DEFAULT_THEME;
        try {
            const parsed = JSON.parse(raw);
            return parsed.type ? parsed : { type: parsed }; 
        } catch {
            return { type: raw as ThemeType };
        }
    });

    useEffect(() => {
        applyTheme(theme);
        localStorage.setItem(THEME_KEY, JSON.stringify(theme));

        if (theme.type !== 'system') {
            return;
        }

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = () => applyTheme({ type: 'system' });
        mq.addEventListener('change', listener);
        return () => mq.removeEventListener('change', listener);
    }, [theme]);

    return { theme, setTheme: setThemeState };
}
