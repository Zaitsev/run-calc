import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
    Events,
    Screens,
    System,
    Window,
} from '@wailsio/runtime';
import { SetMinimiseToTrayOnClose, SetWindowTheme } from '../../bindings/calc/app';
import {
    WINDOW_STATE_KEY,
    WINDOW_STATE_SAVE_DEBOUNCE_MS,
    WINDOW_STATE_SAVE_INTERVAL_MS,
    DEFAULT_WINDOW_WIDTH,
    DEFAULT_WINDOW_HEIGHT,
    MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY,
    SETTINGS_DRAWER_MIN_EDITOR_WIDTH,
    SETTINGS_DRAWER_MIN_WINDOW_WIDTH,
} from '../constants';
import { useThemeContext } from './ThemeContext';
import type { ThemeState } from '../useTheme';
import { inferCustomThemeMode } from '../utils/colorUtils';

type WindowContextValue = {
    runtimePlatform: string;
    minimiseToTrayOnClose: boolean;
    setMinimiseToTrayOnClose: (v: boolean) => void;
    resetWindowLayout: (onReset?: () => void) => void;
    expandWindowForThemeStore: () => Promise<void>;
    restoreWindowAfterThemeStore: () => Promise<void>;
    expandWindowForSettingsDrawer: (drawerWidth: number) => Promise<void>;
    restoreWindowAfterSettingsDrawer: () => Promise<void>;
    syncWindowTheme: (theme: ThemeState) => void;
};

const WindowContext = createContext<WindowContextValue | null>(null);

export function WindowProvider({ children }: { children: ReactNode }) {
    const { theme } = useThemeContext();
    const [runtimePlatform, setRuntimePlatform] = useState(() => {
        if (System.IsWindows()) return 'windows';
        if (System.IsMac()) return 'darwin';
        if (System.IsLinux()) return 'linux';
        return '';
    });
    const [minimiseToTrayOnClose, setMinimiseToTrayOnCloseState] = useState(() =>
        localStorage.getItem(MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY) !== 'false'
    );

    const themeStoreOriginalSizeRef = useRef<{ w: number; h: number } | null>(null);
    const settingsDrawerOriginalSizeRef = useRef<{ w: number; h: number } | null>(null);
    const isWindowHiddenRef = useRef(false);

    useEffect(() => {
        const unsubWindowHidden = Events.On('window:hidden', () => {
            isWindowHiddenRef.current = true;
        });
        const unsubWindowShown = Events.On('window:shown', () => {
            isWindowHiddenRef.current = false;
        });

        return () => {
            unsubWindowHidden();
            unsubWindowShown();
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        System.Environment()
            .then((env) => {
                if (!cancelled) {
                    const os = env.OS?.toLowerCase();
                    if (os) setRuntimePlatform(os);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        localStorage.setItem(MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY, String(minimiseToTrayOnClose));
        SetMinimiseToTrayOnClose(minimiseToTrayOnClose).catch(() => {});
    }, [minimiseToTrayOnClose]);

    // ── Window state persistence ──────────────────────────────────────────────
    useEffect(() => {
        const readStoredState = () => {
            const raw = localStorage.getItem(WINDOW_STATE_KEY);
            if (!raw) return null;
            try {
                const parsed: unknown = JSON.parse(raw);
                if (typeof parsed === 'object' && parsed !== null &&
                    'w' in parsed && 'h' in parsed && 'x' in parsed && 'y' in parsed) {
                    const s = parsed as { w: number; h: number; x: number; y: number };
                    const width = Math.round(s.w);
                    const height = Math.round(s.h);
                    const x = Math.round(s.x);
                    const y = Math.round(s.y);
                    if (width > 0 && height > 0) return { w: width, h: height, x, y };
                }
            } catch { /* ignore */ }
            return null;
        };

        const restoreWindowState = async () => {
            const stored = readStoredState();
            if (!stored) return;
            try {
                const screens = await Screens.GetAll().catch(() => []);
                const getScreenBounds = (s: (typeof screens)[number]) => {
                    const x = s.WorkArea?.X ?? s.Bounds?.X ?? s.X ?? 0;
                    const y = s.WorkArea?.Y ?? s.Bounds?.Y ?? s.Y ?? 0;
                    const w = s.WorkArea?.Width ?? s.Bounds?.Width ?? s.Size?.Width ?? 1920;
                    const h = s.WorkArea?.Height ?? s.Bounds?.Height ?? s.Size?.Height ?? 1080;
                    return { x, y, w, h };
                };
                const matchingScreen = screens.find((s) => {
                    const b = getScreenBounds(s);
                    return stored.x >= b.x && stored.x < b.x + b.w && stored.y >= b.y && stored.y < b.y + b.h;
                });
                const activeScreen = matchingScreen ? null : await Screens.GetCurrent().catch(() => null);
                const currentScreen = matchingScreen ?? activeScreen ?? screens.find((s) => s.IsPrimary) ?? screens[0] ?? null;
                if (!currentScreen) {
                    await Window.SetSize(stored.w, stored.h);
                    await Window.SetPosition(stored.x, stored.y);
                    return;
                }
                const { x: minX, y: minY, w: screenWidth, h: screenHeight } = getScreenBounds(currentScreen);
                const cw = Math.min(stored.w, screenWidth);
                const ch = Math.min(stored.h, screenHeight);
                const maxX = Math.max(minX, minX + screenWidth - cw);
                const maxY = Math.max(minY, minY + screenHeight - ch);
                await Window.SetSize(cw, ch);
                await Window.SetPosition(Math.min(Math.max(stored.x, minX), maxX), Math.min(Math.max(stored.y, minY), maxY));
            } catch { /* ignore */ }
        };

        void restoreWindowState();

        const persistWindowState = async (force: boolean = false) => {
            if (!force && isWindowHiddenRef.current) {
                return;
            }
            try {
                const size = await Window.Size();
                const position = await Window.Position();
                localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify({ w: size.width, h: size.height, x: position.x, y: position.y }));
            } catch { /* ignore */ }
        };

        let saveTimer: number | null = null;
        let periodicSaveTimer: number | null = null;

        const schedulePersist = () => {
            if (saveTimer !== null) window.clearTimeout(saveTimer);
            saveTimer = window.setTimeout(() => { saveTimer = null; void persistWindowState(); }, WINDOW_STATE_SAVE_DEBOUNCE_MS);
        };

        const handleBeforeUnload = () => {
            void persistWindowState(true);
        };

        window.addEventListener('resize', schedulePersist);
        window.addEventListener('beforeunload', handleBeforeUnload);
        periodicSaveTimer = window.setInterval(() => void persistWindowState(), WINDOW_STATE_SAVE_INTERVAL_MS);

        return () => {
            window.removeEventListener('resize', schedulePersist);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (saveTimer !== null) window.clearTimeout(saveTimer);
            if (periodicSaveTimer !== null) window.clearInterval(periodicSaveTimer);
            void persistWindowState(true);
        };
    }, []);

    const syncWindowTheme = useCallback((targetTheme: ThemeState) => {
        if (runtimePlatform !== 'windows') return;
        let mode: 'system' | 'light' | 'dark';
        if (targetTheme.type === 'system') {
            mode = 'system';
        } else if (targetTheme.type === 'light' || targetTheme.type === 'light-high-contrast') {
            mode = 'light';
        } else if (targetTheme.type === 'dark' || targetTheme.type === 'dark-high-contrast') {
            mode = 'dark';
        } else {
            const customBase = targetTheme.customThemeBase || inferCustomThemeMode(targetTheme.customColors);
            mode = customBase === 'light' ? 'light' : 'dark';
        }
        SetWindowTheme(mode).catch(() => {});
    }, [runtimePlatform]);

    useEffect(() => {
        syncWindowTheme(theme);
    }, [syncWindowTheme, theme]);

    const resetWindowLayout = (onReset?: () => void) => {
        localStorage.removeItem(WINDOW_STATE_KEY);
        void Window.SetSize(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT);
        void Window.Center();
        onReset?.();
    };

    const expandWindowForThemeStore = async () => {
        try {
            const current = await Window.Size();
            const curW = current.width;
            const curH = current.height;
            if (!themeStoreOriginalSizeRef.current) themeStoreOriginalSizeRef.current = { w: curW, h: curH };
            const targetWidth = Math.min(1800, Math.max(1360, curW + 260));
            if (targetWidth !== curW) await Window.SetSize(targetWidth, curH);
        } catch { /* ignore */ }
    };

    const restoreWindowAfterThemeStore = async () => {
        const original = themeStoreOriginalSizeRef.current;
        if (!original) return;
        themeStoreOriginalSizeRef.current = null;
        try { await Window.SetSize(original.w, original.h); } catch { /* ignore */ }
    };

    const expandWindowForSettingsDrawer = async (drawerWidth: number) => {
        try {
            const current = await Window.Size();
            const curW = current.width;
            const curH = current.height;
            const requiredWidth = Math.min(1800, Math.max(SETTINGS_DRAWER_MIN_WINDOW_WIDTH, drawerWidth + SETTINGS_DRAWER_MIN_EDITOR_WIDTH));
            if (curW >= requiredWidth) return;
            if (!settingsDrawerOriginalSizeRef.current) settingsDrawerOriginalSizeRef.current = { w: curW, h: curH };
            await Window.SetSize(requiredWidth, curH);
        } catch { /* ignore */ }
    };

    const restoreWindowAfterSettingsDrawer = async () => {
        const original = settingsDrawerOriginalSizeRef.current;
        if (!original) return;
        settingsDrawerOriginalSizeRef.current = null;
        try { await Window.SetSize(original.w, original.h); } catch { /* ignore */ }
    };

    const setMinimiseToTrayOnClose = (v: boolean) => setMinimiseToTrayOnCloseState(v);
    return (
        <WindowContext.Provider value={{
            runtimePlatform,
            minimiseToTrayOnClose, setMinimiseToTrayOnClose,
            resetWindowLayout,
            expandWindowForThemeStore, restoreWindowAfterThemeStore,
            expandWindowForSettingsDrawer, restoreWindowAfterSettingsDrawer,
            syncWindowTheme,
        }}>
            {children}
        </WindowContext.Provider>
    );
}

export function useWindow(): WindowContextValue {
    const ctx = useContext(WindowContext);
    if (!ctx) throw new Error('useWindow must be used inside WindowProvider');
    return ctx;
}
