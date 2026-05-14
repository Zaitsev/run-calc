import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from '../useTheme';
import type { ThemeState } from '../useTheme';

type ThemeContextValue = {
    theme: ThemeState;
    setTheme: (t: ThemeState) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const { theme, setTheme } = useTheme();

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useThemeContext(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useThemeContext must be used inside ThemeProvider');
    return ctx;
}
