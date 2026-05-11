import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SavedThemeEntry } from '../types/app';
import type { ThemeState } from '../useTheme';
import { ACCEPTED_THEMES_STORAGE_KEY } from '../constants';

type ThemeStoreContextValue = {
    savedThemes: SavedThemeEntry[];
    setSavedThemes: React.Dispatch<React.SetStateAction<SavedThemeEntry[]>>;
    pendingThemePreview: SavedThemeEntry | null;
    startThemePreview: (candidate: SavedThemeEntry, theme: ThemeState, setTheme: (t: ThemeState) => void) => void;
    cancelThemePreview: (setTheme: (t: ThemeState) => void) => void;
    acceptThemePreview: (candidate: SavedThemeEntry, setTheme: (t: ThemeState) => void) => void;
    deleteSavedTheme: (themeId: string) => void;
    previewRestoreThemeRef: React.RefObject<ThemeState | null>;
};

const ThemeStoreContext = createContext<ThemeStoreContextValue | null>(null);

export function ThemeStoreProvider({ children }: { children: ReactNode }) {
    const [savedThemes, setSavedThemes] = useState<SavedThemeEntry[]>(() => {
        const raw = localStorage.getItem(ACCEPTED_THEMES_STORAGE_KEY);
        if (!raw) return [];
        try {
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((item): item is SavedThemeEntry => {
                if (!item || typeof item !== 'object') return false;
                const maybe = item as SavedThemeEntry;
                return typeof maybe.id === 'string' && typeof maybe.name === 'string' && !!maybe.colors && typeof maybe.colors === 'object';
            });
        } catch { return []; }
    });

    const [pendingThemePreview, setPendingThemePreview] = useState<SavedThemeEntry | null>(null);
    const previewRestoreThemeRef = useRef<ThemeState | null>(null);

    // Persist savedThemes
    const setSavedThemesWithPersist: typeof setSavedThemes = (updater) => {
        setSavedThemes((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            localStorage.setItem(ACCEPTED_THEMES_STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const startThemePreview = (candidate: SavedThemeEntry, currentTheme: ThemeState, setTheme: (t: ThemeState) => void) => {
        if (!previewRestoreThemeRef.current) previewRestoreThemeRef.current = currentTheme;
        setTheme({ type: 'custom', customColors: candidate.colors, customId: candidate.id, customThemeBase: candidate.themeBase });
        setPendingThemePreview(candidate);
    };

    const cancelThemePreview = (setTheme: (t: ThemeState) => void) => {
        if (previewRestoreThemeRef.current) {
            setTheme(previewRestoreThemeRef.current);
            previewRestoreThemeRef.current = null;
        }
        setPendingThemePreview(null);
    };

    const acceptThemePreview = (candidate: SavedThemeEntry, setTheme: (t: ThemeState) => void) => {
        setSavedThemesWithPersist((prev) => {
            const withoutDup = prev.filter((e) => e.id !== candidate.id);
            return [candidate, ...withoutDup];
        });
        setTheme({ type: 'custom', customColors: candidate.colors, customId: candidate.id, customThemeBase: candidate.themeBase });
        previewRestoreThemeRef.current = null;
        setPendingThemePreview(null);
    };

    const deleteSavedTheme = (themeId: string) => {
        setSavedThemesWithPersist((prev) => prev.filter((e) => e.id !== themeId));
    };

    return (
        <ThemeStoreContext.Provider value={{
            savedThemes,
            setSavedThemes: setSavedThemesWithPersist,
            pendingThemePreview,
            startThemePreview,
            cancelThemePreview,
            acceptThemePreview,
            deleteSavedTheme,
            previewRestoreThemeRef,
        }}>
            {children}
        </ThemeStoreContext.Provider>
    );
}

export function useThemeStore(): ThemeStoreContextValue {
    const ctx = useContext(ThemeStoreContext);
    if (!ctx) throw new Error('useThemeStore must be used inside ThemeStoreProvider');
    return ctx;
}
