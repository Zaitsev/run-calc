import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import type { HelpPage, HelpPanelPosition, WorksheetTabPosition } from '../types/app';
import {
    APP_VERSION,
    HELP_PANEL_POSITION_STORAGE_KEY,
    HELP_LAST_SEEN_VERSION_STORAGE_KEY,
    HELP_PANEL_SIDE_SIZE_STORAGE_KEY,
    HELP_PANEL_BOTTOM_SIZE_STORAGE_KEY,
    SETTINGS_DRAWER_WIDTH_STORAGE_KEY,
    WORKSHEETS_TAB_POSITION_STORAGE_KEY,
    DEFAULT_SETTINGS_DRAWER_WIDTH,
    SETTINGS_DRAWER_MIN_WIDTH,
    SETTINGS_DRAWER_MAX_WIDTH,
    SETTINGS_DRAWER_MIN_EDITOR_WIDTH,
    DEFAULT_HELP_PANEL_SIDE_SIZE,
    HELP_PANEL_SIDE_MIN_SIZE,
    HELP_PANEL_SIDE_MAX_SIZE,
    HELP_PANEL_SIDE_MIN_EDITOR_WIDTH,
    DEFAULT_HELP_PANEL_BOTTOM_SIZE,
    HELP_PANEL_BOTTOM_MIN_SIZE,
    HELP_PANEL_BOTTOM_MAX_SIZE,
    HELP_PANEL_BOTTOM_MIN_EDITOR_HEIGHT,
} from '../constants';

type UIStateContextValue = {
    showSettings: boolean;
    setShowSettings: (v: boolean) => void;
    showHelp: boolean;
    setShowHelp: (v: boolean) => void;
    helpActivePage: HelpPage;
    setHelpActivePage: (page: HelpPage) => void;
    openHelpPanel: (page?: HelpPage) => void;
    helpPanelPosition: HelpPanelPosition;
    setHelpPanelPosition: (v: HelpPanelPosition) => void;
    worksheetTabPosition: WorksheetTabPosition;
    setWorksheetTabPosition: (v: WorksheetTabPosition) => void;
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
    helpPanelSideSize: number;
    setHelpPanelSideSize: React.Dispatch<React.SetStateAction<number>>;
    helpPanelBottomSize: number;
    setHelpPanelBottomSize: React.Dispatch<React.SetStateAction<number>>;
    isResizingHelpPanel: boolean;
    setIsResizingHelpPanel: (v: boolean) => void;
    helpPanelResizeStartRef: React.RefObject<{ x: number; y: number; size: number; position: HelpPanelPosition } | null>;
    startHelpPanelResize: (event: ReactMouseEvent<HTMLDivElement>, position: HelpPanelPosition) => void;
    clampHelpPanelSideSize: (size: number) => number;
    clampHelpPanelBottomSize: (size: number) => number;
};

const UIStateContext = createContext<UIStateContextValue | null>(null);

export function UIStateProvider({ children }: { children: ReactNode }) {
    const [showSettings, setShowSettings] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [helpActivePage, setHelpActivePage] = useState<HelpPage>('operations');
    const [helpPanelPosition, setHelpPanelPositionState] = useState<HelpPanelPosition>(() => {
        const raw = localStorage.getItem(HELP_PANEL_POSITION_STORAGE_KEY);
        if (raw === 'left' || raw === 'right' || raw === 'bottom') return raw;
        return 'right';
    });
    const [worksheetTabPosition, setWorksheetTabPositionState] = useState<WorksheetTabPosition>(() => {
        const raw = localStorage.getItem(WORKSHEETS_TAB_POSITION_STORAGE_KEY);
        if (raw === 'top' || raw === 'bottom' || raw === 'left') return raw;
        return 'top';
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
    const [helpPanelSideSize, setHelpPanelSideSize] = useState(() => {
        const raw = localStorage.getItem(HELP_PANEL_SIDE_SIZE_STORAGE_KEY);
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return DEFAULT_HELP_PANEL_SIDE_SIZE;
        return Math.round(Math.min(HELP_PANEL_SIDE_MAX_SIZE, Math.max(HELP_PANEL_SIDE_MIN_SIZE, parsed)));
    });
    const [helpPanelBottomSize, setHelpPanelBottomSize] = useState(() => {
        const raw = localStorage.getItem(HELP_PANEL_BOTTOM_SIZE_STORAGE_KEY);
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return DEFAULT_HELP_PANEL_BOTTOM_SIZE;
        return Math.round(Math.min(HELP_PANEL_BOTTOM_MAX_SIZE, Math.max(HELP_PANEL_BOTTOM_MIN_SIZE, parsed)));
    });
    const [isResizingHelpPanel, setIsResizingHelpPanel] = useState(false);

    const settingsDrawerResizeStartRef = useRef<{ x: number; width: number } | null>(null);
    const intelligenceShowTimerRef = useRef<number | null>(null);
    const intelligenceHideTimerRef = useRef<number | null>(null);
    const lastEscapeKeyAtRef = useRef(0);
    const helpPanelResizeStartRef = useRef<{ x: number; y: number; size: number; position: HelpPanelPosition } | null>(null);

    const setHelpPanelPosition = (v: HelpPanelPosition) => setHelpPanelPositionState(v);
    const setWorksheetTabPosition = (v: WorksheetTabPosition) => setWorksheetTabPositionState(v);
    const openHelpPanel = (page: HelpPage = 'operations') => {
        setShowThemeStore(false);
        setShowSettings(false);
        setHelpActivePage(page);
        setShowHelp(true);
    };

    useEffect(() => {
        const lastSeenVersion = localStorage.getItem(HELP_LAST_SEEN_VERSION_STORAGE_KEY);
        if (lastSeenVersion === APP_VERSION) {
            return;
        }

        openHelpPanel('new');
        localStorage.setItem(HELP_LAST_SEEN_VERSION_STORAGE_KEY, APP_VERSION);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        localStorage.setItem(HELP_PANEL_POSITION_STORAGE_KEY, helpPanelPosition);
    }, [helpPanelPosition]);

    useEffect(() => {
        localStorage.setItem(WORKSHEETS_TAB_POSITION_STORAGE_KEY, worksheetTabPosition);
    }, [worksheetTabPosition]);

    useEffect(() => {
        localStorage.setItem(SETTINGS_DRAWER_WIDTH_STORAGE_KEY, String(settingsDrawerWidth));
    }, [settingsDrawerWidth]);

    useEffect(() => {
        localStorage.setItem(HELP_PANEL_SIDE_SIZE_STORAGE_KEY, String(helpPanelSideSize));
    }, [helpPanelSideSize]);

    useEffect(() => {
        localStorage.setItem(HELP_PANEL_BOTTOM_SIZE_STORAGE_KEY, String(helpPanelBottomSize));
    }, [helpPanelBottomSize]);

    const clampSettingsDrawerWidth = (width: number): number => {
        const viewportWidth = Math.max(window.innerWidth, SETTINGS_DRAWER_MIN_WIDTH + SETTINGS_DRAWER_MIN_EDITOR_WIDTH);
        const clampedMax = Math.max(
            SETTINGS_DRAWER_MIN_WIDTH,
            Math.min(SETTINGS_DRAWER_MAX_WIDTH, viewportWidth - SETTINGS_DRAWER_MIN_EDITOR_WIDTH),
        );
        return Math.round(Math.min(clampedMax, Math.max(SETTINGS_DRAWER_MIN_WIDTH, width)));
    };

    const clampHelpPanelSideSize = (size: number): number => {
        const viewportWidth = Math.max(window.innerWidth, HELP_PANEL_SIDE_MIN_SIZE + HELP_PANEL_SIDE_MIN_EDITOR_WIDTH);
        const clampedMax = Math.max(
            HELP_PANEL_SIDE_MIN_SIZE,
            Math.min(HELP_PANEL_SIDE_MAX_SIZE, viewportWidth - HELP_PANEL_SIDE_MIN_EDITOR_WIDTH),
        );
        return Math.round(Math.min(clampedMax, Math.max(HELP_PANEL_SIDE_MIN_SIZE, size)));
    };

    const clampHelpPanelBottomSize = (size: number): number => {
        const viewportHeight = Math.max(window.innerHeight, HELP_PANEL_BOTTOM_MIN_SIZE + HELP_PANEL_BOTTOM_MIN_EDITOR_HEIGHT);
        const clampedMax = Math.max(
            HELP_PANEL_BOTTOM_MIN_SIZE,
            Math.min(HELP_PANEL_BOTTOM_MAX_SIZE, viewportHeight - HELP_PANEL_BOTTOM_MIN_EDITOR_HEIGHT),
        );
        return Math.round(Math.min(clampedMax, Math.max(HELP_PANEL_BOTTOM_MIN_SIZE, size)));
    };

    useEffect(() => {
        const onWindowResize = () => {
            setSettingsDrawerWidth((current) => clampSettingsDrawerWidth(current));
            setHelpPanelSideSize((current) => clampHelpPanelSideSize(current));
            setHelpPanelBottomSize((current) => clampHelpPanelBottomSize(current));
        };
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
        if (!isResizingHelpPanel) return;

        const directionClass = helpPanelResizeStartRef.current?.position === 'bottom'
            ? 'is-resizing-help-panel-ns'
            : 'is-resizing-help-panel-ew';

        const onMouseMove = (event: MouseEvent) => {
            const start = helpPanelResizeStartRef.current;
            if (!start) return;

            if (start.position === 'bottom') {
                const delta = start.y - event.clientY;
                setHelpPanelBottomSize(clampHelpPanelBottomSize(start.size + delta));
                return;
            }

            const delta = start.position === 'left'
                ? event.clientX - start.x
                : start.x - event.clientX;
            setHelpPanelSideSize(clampHelpPanelSideSize(start.size + delta));
        };

        const stopResize = () => {
            helpPanelResizeStartRef.current = null;
            setIsResizingHelpPanel(false);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', stopResize);
        window.addEventListener('blur', stopResize);
        document.body.classList.add('is-resizing-help-panel');
        document.body.classList.add(directionClass);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', stopResize);
            window.removeEventListener('blur', stopResize);
            document.body.classList.remove('is-resizing-help-panel');
            document.body.classList.remove(directionClass);
        };
    }, [isResizingHelpPanel]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const startHelpPanelResize = (event: ReactMouseEvent<HTMLDivElement>, position: HelpPanelPosition) => {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        helpPanelResizeStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            size: position === 'bottom' ? helpPanelBottomSize : helpPanelSideSize,
            position,
        };
        setIsResizingHelpPanel(true);
    };

    return (
        <UIStateContext.Provider value={{
            showSettings, setShowSettings,
            showHelp, setShowHelp,
            helpActivePage,
            setHelpActivePage,
            openHelpPanel,
            helpPanelPosition, setHelpPanelPosition,
            worksheetTabPosition, setWorksheetTabPosition,
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
            helpPanelSideSize,
            setHelpPanelSideSize,
            helpPanelBottomSize,
            setHelpPanelBottomSize,
            isResizingHelpPanel,
            setIsResizingHelpPanel,
            helpPanelResizeStartRef,
            startHelpPanelResize,
            clampHelpPanelSideSize,
            clampHelpPanelBottomSize,
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
