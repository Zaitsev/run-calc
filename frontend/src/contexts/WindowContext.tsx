import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
    Events,
    Screens,
    System,
    Window,
} from '@wailsio/runtime';
import { SetMinimiseToTrayOnClose } from '../../bindings/calc/app';
import {
    WINDOW_STATE_KEY,
    WINDOW_STATE_SAVE_DEBOUNCE_MS,
    WINDOW_STATE_SAVE_INTERVAL_MS,
    DEFAULT_WINDOW_WIDTH,
    DEFAULT_WINDOW_HEIGHT,
    MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY,
} from '../constants';
import type { ThemeState } from '../useTheme';

type WindowContextValue = {
    runtimePlatform: string;
    minimiseToTrayOnClose: boolean;
    setMinimiseToTrayOnClose: (v: boolean) => void;
    resetWindowLayout: (onReset?: () => void) => void;
    expandWindowForThemeStore: () => Promise<void>;
    restoreWindowAfterThemeStore: () => Promise<void>;
    expandWindowForSettingsDrawer: (drawerWidth: number) => Promise<void>;
    restoreWindowAfterSettingsDrawer: () => Promise<void>;
    themeStoreOriginalSizeRef: React.RefObject<{ w: number; h: number } | null>;
    settingsDrawerOriginalSizeRef: React.RefObject<{ w: number; h: number } | null>;
    syncWindowTheme: (theme: ThemeState) => void;
};

const WindowContext = createContext<WindowContextValue | null>(null);

export function WindowProvider({ children }: { children: ReactNode }) {
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
                const screens = await Screens.GetAll();
                const currentScreen = screens.find((s) => s.IsPrimary) ?? screens[0] ?? null;
                if (!currentScreen) {
                    await Window.SetSize(stored.w, stored.h);
                    await Window.SetPosition(stored.x, stored.y);
                    return;
                }
                const screenWidth = currentScreen.WorkArea?.Width ?? currentScreen.Size?.Width ?? 1920;
                const screenHeight = currentScreen.WorkArea?.Height ?? currentScreen.Size?.Height ?? 1080;
                const cw = Math.min(stored.w, screenWidth);
                const ch = Math.min(stored.h, screenHeight);
                const maxX = Math.max(0, screenWidth - cw);
                const maxY = Math.max(0, screenHeight - ch);
                await Window.SetSize(cw, ch);
                await Window.SetPosition(Math.min(Math.max(stored.x, 0), maxX), Math.min(Math.max(stored.y, 0), maxY));
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
                const w = size.width ?? (size as any).w;
                const h = size.height ?? (size as any).h;
                localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify({ w, h, x: position.x, y: position.y }));
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

    const syncWindowTheme = (_theme: ThemeState) => {
        // Theme changes on window frame are handled automatically in Wails v3
    };

    const resetWindowLayout = (onReset?: () => void) => {
        localStorage.removeItem(WINDOW_STATE_KEY);
        Window.SetSize(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT);
        Window.Center();
        onReset?.();
    };

    const expandWindowForThemeStore = async () => {
        try {
            const current = await Window.Size();
            const curW = current.width ?? (current as any).w;
            const curH = current.height ?? (current as any).h;
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
            const curW = current.width ?? (current as any).w;
            const curH = current.height ?? (current as any).h;
            const SETTINGS_DRAWER_MIN_EDITOR_WIDTH = 380;
            const SETTINGS_DRAWER_MIN_WINDOW_WIDTH = 980;
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
            themeStoreOriginalSizeRef,
            settingsDrawerOriginalSizeRef,
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
