import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'calc.theme';

function applyTheme(theme: Theme): void {
    const resolved =
        theme === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
            : theme;
    document.documentElement.setAttribute('data-theme', resolved);
}

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(
        () => (localStorage.getItem(THEME_KEY) as Theme | null) ?? 'system'
    );

    useEffect(() => {
        applyTheme(theme);
        localStorage.setItem(THEME_KEY, theme);

        if (theme !== 'system') {
            return;
        }

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = () => applyTheme('system');
        mq.addEventListener('change', listener);
        return () => mq.removeEventListener('change', listener);
    }, [theme]);

    return { theme, setTheme: setThemeState };
}
