import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import type { HelpPanelPosition } from '../types/app';
import {
    HELP_PANEL_POSITION_STORAGE_KEY,
    SETTINGS_DRAWER_WIDTH_STORAGE_KEY,
    DEFAULT_SETTINGS_DRAWER_WIDTH,
    SETTINGS_DRAWER_MIN_WIDTH,
    SETTINGS_DRAWER_MAX_WIDTH,
    SETTINGS_DRAWER_MIN_EDITOR_WIDTH,
} from '../constants';

type UIStateContextValue = {
    showSettings: boolean;
    setShowSettings: (v: boolean) => void;
    showHelp: boolean;
    setShowHelp: (v: boolean) => void;
    helpPanelPosition: HelpPanelPosition;
    setHelpPanelPosition: (v: HelpPanelPosition) => void;
    showThemeStore: boolean;
    setShowThemeStore: (v: boolean) => void;
    showBurgerMenu: boolean;
    setShowBurgerMenu: React.Dispatch<React.SetStateAction<boolean>>;
    showPrecisionMenu: boolean;
    setShowPrecisionMenu: React.Dispatch<React.SetStateAction<boolean>>;
    showIntelligenceHint: boolean;
    setShowIntelligenceHint: (v: boolean) => void;
    showClearWorksheetConfirm: boolean;
    setShowClearWorksheetConfirm: (v: boolean) => void;
    isReevaluatingAll: boolean;
    setIsReevaluatingAll: (v: boolean) => void;
    showAIDebug: boolean;
    setShowAIDebug: (v: boolean) => void;
    settingsDrawerWidth: number;
    setSettingsDrawerWidth: React.Dispatch<React.SetStateAction<number>>;
    isResizingSettingsDrawer: boolean;
    setIsResizingSettingsDrawer: (v: boolean) => void;
    settingsDrawerResizeStartRef: React.RefObject<{ x: number; width: number } | null>;
    startSettingsDrawerResize: (event: ReactMouseEvent<HTMLDivElement>) => void;
    clampSettingsDrawerWidth: (width: number) => number;
    intelligenceShowTimerRef: React.RefObject<number | null>;
    intelligenceHideTimerRef: React.RefObject<number | null>;
    lastEscapeKeyAtRef: React.RefObject<number>;
};

const UIStateContext = createContext<UIStateContextValue | null>(null);

export function UIStateProvider({ children }: { children: ReactNode }) {
    const [showSettings, setShowSettings] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [helpPanelPosition, setHelpPanelPositionState] = useState<HelpPanelPosition>(() => {
        const raw = localStorage.getItem(HELP_PANEL_POSITION_STORAGE_KEY);
        if (raw === 'left' || raw === 'right' || raw === 'bottom') return raw;
        return 'right';
    });
    const [showThemeStore, setShowThemeStore] = useState(false);
    const [showBurgerMenu, setShowBurgerMenu] = useState(false);
    const [showPrecisionMenu, setShowPrecisionMenu] = useState(false);
    const [showIntelligenceHint, setShowIntelligenceHint] = useState(false);
    const [showClearWorksheetConfirm, setShowClearWorksheetConfirm] = useState(false);
    const [isReevaluatingAll, setIsReevaluatingAll] = useState(false);
    const [showAIDebug, setShowAIDebug] = useState(false);
    const [settingsDrawerWidth, setSettingsDrawerWidth] = useState(() => {
        const raw = localStorage.getItem(SETTINGS_DRAWER_WIDTH_STORAGE_KEY);
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS_DRAWER_WIDTH;
        return Math.round(Math.min(SETTINGS_DRAWER_MAX_WIDTH, Math.max(SETTINGS_DRAWER_MIN_WIDTH, parsed)));
    });
    const [isResizingSettingsDrawer, setIsResizingSettingsDrawer] = useState(false);

    const settingsDrawerResizeStartRef = useRef<{ x: number; width: number } | null>(null);
    const intelligenceShowTimerRef = useRef<number | null>(null);
    const intelligenceHideTimerRef = useRef<number | null>(null);
    const lastEscapeKeyAtRef = useRef(0);

    const setHelpPanelPosition = (v: HelpPanelPosition) => setHelpPanelPositionState(v);

    useEffect(() => {
        localStorage.setItem(HELP_PANEL_POSITION_STORAGE_KEY, helpPanelPosition);
    }, [helpPanelPosition]);

    useEffect(() => {
        localStorage.setItem(SETTINGS_DRAWER_WIDTH_STORAGE_KEY, String(settingsDrawerWidth));
    }, [settingsDrawerWidth]);

    const clampSettingsDrawerWidth = (width: number): number => {
        const viewportWidth = Math.max(window.innerWidth, SETTINGS_DRAWER_MIN_WIDTH + SETTINGS_DRAWER_MIN_EDITOR_WIDTH);
        const clampedMax = Math.max(
            SETTINGS_DRAWER_MIN_WIDTH,
            Math.min(SETTINGS_DRAWER_MAX_WIDTH, viewportWidth - SETTINGS_DRAWER_MIN_EDITOR_WIDTH),
        );
        return Math.round(Math.min(clampedMax, Math.max(SETTINGS_DRAWER_MIN_WIDTH, width)));
    };

    useEffect(() => {
        const onWindowResize = () => setSettingsDrawerWidth((current) => clampSettingsDrawerWidth(current));
        window.addEventListener('resize', onWindowResize);
        return () => window.removeEventListener('resize', onWindowResize);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!isResizingSettingsDrawer) return;

        const onMouseMove = (event: MouseEvent) => {
            const start = settingsDrawerResizeStartRef.current;
            if (!start) return;
            const delta = start.x - event.clientX;
            setSettingsDrawerWidth(clampSettingsDrawerWidth(start.width + delta));
        };

        const stopResize = () => {
            settingsDrawerResizeStartRef.current = null;
            setIsResizingSettingsDrawer(false);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', stopResize);
        window.addEventListener('blur', stopResize);
        document.body.classList.add('is-resizing-settings-drawer');

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', stopResize);
            window.removeEventListener('blur', stopResize);
            document.body.classList.remove('is-resizing-settings-drawer');
        };
    }, [isResizingSettingsDrawer]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!showBurgerMenu) return;
        // Close on outside click — needs burgerMenuRef from EditorUIContext;
        // kept here as state but the click handler uses the ref which lives in App still.
    }, [showBurgerMenu]);

    useEffect(() => {
        if (!showClearWorksheetConfirm) return;
        const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); setShowClearWorksheetConfirm(false); }
        };
        document.addEventListener('keydown', onDocumentKeyDown);
        return () => document.removeEventListener('keydown', onDocumentKeyDown);
    }, [showClearWorksheetConfirm]);

    useEffect(() => {
        return () => {
            if (intelligenceShowTimerRef.current !== null) window.clearTimeout(intelligenceShowTimerRef.current);
            if (intelligenceHideTimerRef.current !== null) window.clearTimeout(intelligenceHideTimerRef.current);
        };
    }, []);

    const startSettingsDrawerResize = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.button !== 0 || showThemeStore) return;
        event.preventDefault();
        settingsDrawerResizeStartRef.current = { x: event.clientX, width: settingsDrawerWidth };
        setIsResizingSettingsDrawer(true);
    };

    return (
        <UIStateContext.Provider value={{
            showSettings, setShowSettings,
            showHelp, setShowHelp,
            helpPanelPosition, setHelpPanelPosition,
            showThemeStore, setShowThemeStore,
            showBurgerMenu, setShowBurgerMenu,
            showPrecisionMenu, setShowPrecisionMenu,
            showIntelligenceHint, setShowIntelligenceHint,
            showClearWorksheetConfirm, setShowClearWorksheetConfirm,
            isReevaluatingAll, setIsReevaluatingAll,
            showAIDebug, setShowAIDebug,
            settingsDrawerWidth, setSettingsDrawerWidth,
            isResizingSettingsDrawer, setIsResizingSettingsDrawer,
            settingsDrawerResizeStartRef,
            startSettingsDrawerResize,
            clampSettingsDrawerWidth,
            intelligenceShowTimerRef,
            intelligenceHideTimerRef,
            lastEscapeKeyAtRef,
        }}>
            {children}
        </UIStateContext.Provider>
    );
}

export function useUIState(): UIStateContextValue {
    const ctx = useContext(UIStateContext);
    if (!ctx) throw new Error('useUIState must be used inside UIStateProvider');
    return ctx;
}
