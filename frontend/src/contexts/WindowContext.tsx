import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
    Environment,
    EventsOn,
    ScreenGetAll,
    WindowGetPosition,
    WindowGetSize,
    WindowSetPosition,
    WindowSetSize,
} from '../../wailsjs/runtime/runtime';
import { IsRunningAsMSIX, SetMinimiseToTrayOnClose, SetRestoreShortcutEnabled } from '../../wailsjs/go/main/App';
import {
    WINDOW_STATE_KEY,
    WINDOW_STATE_SAVE_DEBOUNCE_MS,
    WINDOW_STATE_SAVE_INTERVAL_MS,
    DEFAULT_WINDOW_WIDTH,
    DEFAULT_WINDOW_HEIGHT,
    MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY,
    RESTORE_SHORTCUT_ENABLED_STORAGE_KEY,
} from '../constants';
import { WindowCenter, WindowSetDarkTheme, WindowSetLightTheme, WindowSetSystemDefaultTheme } from '../../wailsjs/runtime/runtime';
import type { ThemeState } from '../useTheme';
import { inferCustomThemeMode } from '../utils/colorUtils';

type WindowContextValue = {
    runtimePlatform: string;
    isMSIX: boolean;
    minimiseToTrayOnClose: boolean;
    setMinimiseToTrayOnClose: (v: boolean) => void;
    restoreShortcutEnabled: boolean;
    setRestoreShortcutEnabled: (v: boolean) => void;
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
    const [runtimePlatform, setRuntimePlatform] = useState('');
    const [isMSIX, setIsMSIX] = useState(false);
    const [minimiseToTrayOnClose, setMinimiseToTrayOnCloseState] = useState(() =>
        localStorage.getItem(MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY) !== 'false'
    );
    const [restoreShortcutEnabled, setRestoreShortcutEnabledState] = useState(() =>
        localStorage.getItem(RESTORE_SHORTCUT_ENABLED_STORAGE_KEY) !== 'false'
    );

    const themeStoreOriginalSizeRef = useRef<{ w: number; h: number } | null>(null);
    const settingsDrawerOriginalSizeRef = useRef<{ w: number; h: number } | null>(null);
    const isWindowHiddenRef = useRef(false);

    useEffect(() => {
        const unsubWindowHidden = EventsOn('window:hidden', () => {
            isWindowHiddenRef.current = true;
        });
        const unsubWindowShown = EventsOn('window:shown', () => {
            isWindowHiddenRef.current = false;
        });

        return () => {
            unsubWindowHidden();
            unsubWindowShown();
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        Environment()
            .then((env) => { if (!cancelled) setRuntimePlatform(env.platform || ''); })
            .catch(() => { if (!cancelled) setRuntimePlatform(''); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        IsRunningAsMSIX().then((v) => setIsMSIX(v)).catch(() => {});
    }, []);

    useEffect(() => {
        localStorage.setItem(MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY, String(minimiseToTrayOnClose));
        SetMinimiseToTrayOnClose(minimiseToTrayOnClose).catch(() => {});
    }, [minimiseToTrayOnClose]);

    useEffect(() => {
        localStorage.setItem(RESTORE_SHORTCUT_ENABLED_STORAGE_KEY, String(restoreShortcutEnabled));
        if (!isMSIX) SetRestoreShortcutEnabled(restoreShortcutEnabled).catch(() => {});
    }, [restoreShortcutEnabled, isMSIX]);

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
                const screens = await ScreenGetAll();
                const currentScreen = screens.find((s) => s.isCurrent) ?? screens.find((s) => s.isPrimary) ?? null;
                if (!currentScreen) {
                    WindowSetSize(stored.w, stored.h);
                    WindowSetPosition(stored.x, stored.y);
                    return;
                }
                const cw = Math.min(stored.w, currentScreen.width);
                const ch = Math.min(stored.h, currentScreen.height);
                const maxX = Math.max(0, currentScreen.width - cw);
                const maxY = Math.max(0, currentScreen.height - ch);
                WindowSetSize(cw, ch);
                WindowSetPosition(Math.min(Math.max(stored.x, 0), maxX), Math.min(Math.max(stored.y, 0), maxY));
            } catch { /* ignore */ }
        };

        void restoreWindowState();

        const persistWindowState = async (force: boolean = false) => {
            if (!force && isWindowHiddenRef.current) {
                return;
            }
            try {
                const size = await WindowGetSize();
                const position = await WindowGetPosition();
                localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify({ w: size.w, h: size.h, x: position.x, y: position.y }));
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

    const syncWindowTheme = (theme: ThemeState) => {
        if (runtimePlatform !== 'windows') return;
        if (theme.type === 'system') { WindowSetSystemDefaultTheme(); return; }
        if (theme.type === 'light') { WindowSetLightTheme(); return; }
        if (theme.type === 'dark') { WindowSetDarkTheme(); return; }
        const mode = theme.customThemeBase || inferCustomThemeMode(theme.customColors);
        if (mode === 'light') WindowSetLightTheme(); else WindowSetDarkTheme();
    };

    const resetWindowLayout = (onReset?: () => void) => {
        localStorage.removeItem(WINDOW_STATE_KEY);
        WindowSetSize(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT);
        WindowCenter();
        onReset?.();
    };

    const expandWindowForThemeStore = async () => {
        try {
            const current = await WindowGetSize();
            if (!themeStoreOriginalSizeRef.current) themeStoreOriginalSizeRef.current = { w: current.w, h: current.h };
            const targetWidth = Math.min(1800, Math.max(1360, current.w + 260));
            if (targetWidth !== current.w) WindowSetSize(targetWidth, current.h);
        } catch { /* ignore */ }
    };

    const restoreWindowAfterThemeStore = async () => {
        const original = themeStoreOriginalSizeRef.current;
        if (!original) return;
        themeStoreOriginalSizeRef.current = null;
        try { WindowSetSize(original.w, original.h); } catch { /* ignore */ }
    };

    const expandWindowForSettingsDrawer = async (drawerWidth: number) => {
        try {
            const current = await WindowGetSize();
            const SETTINGS_DRAWER_MIN_EDITOR_WIDTH = 380;
            const SETTINGS_DRAWER_MIN_WINDOW_WIDTH = 980;
            const requiredWidth = Math.min(1800, Math.max(SETTINGS_DRAWER_MIN_WINDOW_WIDTH, drawerWidth + SETTINGS_DRAWER_MIN_EDITOR_WIDTH));
            if (current.w >= requiredWidth) return;
            if (!settingsDrawerOriginalSizeRef.current) settingsDrawerOriginalSizeRef.current = { w: current.w, h: current.h };
            WindowSetSize(requiredWidth, current.h);
        } catch { /* ignore */ }
    };

    const restoreWindowAfterSettingsDrawer = async () => {
        const original = settingsDrawerOriginalSizeRef.current;
        if (!original) return;
        settingsDrawerOriginalSizeRef.current = null;
        try { WindowSetSize(original.w, original.h); } catch { /* ignore */ }
    };

    const setMinimiseToTrayOnClose = (v: boolean) => setMinimiseToTrayOnCloseState(v);
    const setRestoreShortcutEnabled = (v: boolean) => setRestoreShortcutEnabledState(v);

    return (
        <WindowContext.Provider value={{
            runtimePlatform, isMSIX,
            minimiseToTrayOnClose, setMinimiseToTrayOnClose,
            restoreShortcutEnabled, setRestoreShortcutEnabled,
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
