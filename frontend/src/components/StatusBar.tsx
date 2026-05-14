import { useEffect } from 'react';
import {
    DEFAULT_FONT_SCALE,
    FINANCIAL_PRECISION,
    FONT_SCALE_MAX,
    FONT_SCALE_MIN,
    FONT_SCALE_STEP,
    FOUR_POINT_PRECISION,
    IS_DEV,
    PRECISION_MAX,
    PRECISION_MIN,
} from '../constants';
import { useAI, useDisplaySettings, useEditorUI, useStatus, useThemeContext, useThemeStore, useUIState, useWindow } from '../contexts';
import { PrecisionPopover } from './PrecisionPopover';
import { BurgerMenu } from './BurgerMenu';

export function StatusBar() {
    const { statusText, isStatusError, devError, setStatusText, setIsStatusError, setDevError } = useStatus();
    const { isAIQueryPending, aiDebugLog } = useAI();
    const { wordWrap, setWordWrap, precision, setPrecision, scientificNotation, setScientificNotation } = useDisplaySettings();
    const { setFontScale, precisionMenuRef, burgerMenuRef } = useEditorUI();
    const {
        showSettings,
        setShowSettings,
        showHelp,
        setShowHelp,
        setShowThemeStore,
        showBurgerMenu,
        setShowBurgerMenu,
        showPrecisionMenu,
        setShowPrecisionMenu,
        setShowClearWorksheetConfirm,
        setShowAIDebug,
    } = useUIState();
    const { resetWindowLayout, expandWindowForThemeStore, restoreWindowAfterSettingsDrawer, restoreWindowAfterThemeStore } = useWindow();
    const { pendingThemePreview, cancelThemePreview } = useThemeStore();
    const { setTheme } = useThemeContext();
    const closeThemeStoreInSidebar = () => {
        if (pendingThemePreview) {
            cancelThemePreview(setTheme);
        }
        setShowThemeStore(false);
        void restoreWindowAfterThemeStore();
    };

    useEffect(() => {
        if (!showBurgerMenu) {
            return;
        }

        const onMouseDown = (event: MouseEvent) => {
            if (!burgerMenuRef.current) {
                return;
            }
            if (!burgerMenuRef.current.contains(event.target as Node)) {
                setShowBurgerMenu(false);
            }
        };

        const onEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowBurgerMenu(false);
            }
        };

        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('keydown', onEscape);

        return () => {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onEscape);
        };
    }, [burgerMenuRef, setShowBurgerMenu, showBurgerMenu]);

    useEffect(() => {
        if (!showPrecisionMenu) {
            return;
        }

        const onMouseDown = (event: MouseEvent) => {
            if (!precisionMenuRef.current) {
                return;
            }
            if (!precisionMenuRef.current.contains(event.target as Node)) {
                setShowPrecisionMenu(false);
            }
        };

        const onEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowPrecisionMenu(false);
            }
        };

        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('keydown', onEscape);

        return () => {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onEscape);
        };
    }, [precisionMenuRef, setShowPrecisionMenu, showPrecisionMenu]);

    const requestClearWorksheet = () => {
        setShowPrecisionMenu(false);
        setShowBurgerMenu(false);
        setShowClearWorksheetConfirm(true);
    };

    const changeFontScale = (direction: 1 | -1) => {
        setFontScale((current) => {
            const next = current + direction * FONT_SCALE_STEP;
            return Number(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, next)).toFixed(2));
        });
    };

    const resetFontSize = () => {
        setFontScale(DEFAULT_FONT_SCALE);
        setStatusText('Font size reset');
        setIsStatusError(false);
        setDevError('');
    };

    const handleResetWindowLayout = () => {
        resetWindowLayout();
        setStatusText('Window layout reset');
        setIsStatusError(false);
        setDevError('');
    };

    const decreasePrecision = () => {
        setPrecision((current) => {
            if (current === 'full') {
                return 'full';
            }
            if (current === 'auto') {
                return 'full';
            }
            if (current === PRECISION_MIN) {
                return 'auto';
            }
            return current - 1;
        });
    };

    const increasePrecision = () => {
        setPrecision((current) => {
            if (current === 'full') {
                return 'auto';
            }
            if (current === 'auto') {
                return PRECISION_MIN;
            }
            if (current >= PRECISION_MAX) {
                return current;
            }
            return current + 1;
        });
    };

    const resetPrecision = () => {
        setPrecision('auto');
    };

    const applyFinancialPrecision = () => {
        setPrecision(FINANCIAL_PRECISION);
    };

    const applyFourPointPrecision = () => {
        setPrecision(FOUR_POINT_PRECISION);
    };

    const openHelpPanel = () => {
        setShowPrecisionMenu(false);
        setShowBurgerMenu(false);
        setShowThemeStore(false);
        setShowSettings(false);
        setShowHelp(true);
    };

    const openThemeStore = () => {
        void restoreWindowAfterSettingsDrawer();
        setShowHelp(false);
        setShowSettings(true);
        setShowThemeStore(true);
        void expandWindowForThemeStore();
    };

    return (
        <div className={`status-bar${isStatusError ? ' error' : ''}`}>
            <span className="status-text">
                {statusText}
                {IS_DEV && devError ? ` | dev: ${devError}` : ''}
            </span>
            {isAIQueryPending && (
                <span className="status-chip status-chip--busy" title="AI request is in progress">
                    <span className="status-spinner" aria-hidden="true" />
                    AI waiting...
                </span>
            )}
            <button
                type="button"
                className="status-chip status-chip-btn status-chip-btn--clear-first"
                title="Clear all expressions"
                aria-label="Clear all expressions"
                onMouseDown={(e) => e.preventDefault()}
                onClick={requestClearWorksheet}
            >
                clear
            </button>
            <button
                type="button"
                className={`status-chip status-chip-btn${wordWrap ? ' status-chip-btn--active' : ''}`}
                title={wordWrap ? 'Word wrap: on' : 'Word wrap: off'}
                aria-label="Toggle word wrap"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setWordWrap((prev) => !prev)}
            >
                wrap: {wordWrap ? 'on' : 'off'}
            </button>
            <div className="status-chip-wrap" ref={precisionMenuRef}>
                <button
                    type="button"
                    className={`status-chip status-chip-btn${showPrecisionMenu ? ' status-chip-btn--active' : ''}`}
                    title={precision === 'full' ? 'Precision: full (no rounding)' : precision === 'auto' ? 'Precision: auto (10 decimal places)' : `Precision: ${precision} decimal place${precision === 1 ? '' : 's'}`}
                    aria-label="Open precision selector"
                    aria-haspopup="dialog"
                    aria-expanded={showPrecisionMenu}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                        setShowBurgerMenu(false);
                        setShowPrecisionMenu((prev) => !prev);
                    }}
                >
                    {precision === 'full' ? 'prec: full' : precision === 'auto' ? 'prec: auto' : `prec: ${precision}`}
                </button>
                {showPrecisionMenu && (
                    <PrecisionPopover
                        precision={precision}
                        setPrecision={setPrecision}
                        scientificNotation={scientificNotation}
                        setScientificNotation={setScientificNotation}
                        decreasePrecision={decreasePrecision}
                        increasePrecision={increasePrecision}
                        applyFinancialPrecision={applyFinancialPrecision}
                        applyFourPointPrecision={applyFourPointPrecision}
                        resetPrecision={resetPrecision}
                    />
                )}
            </div>
            <div className="status-menu-wrap" ref={burgerMenuRef}>
                <button
                    type="button"
                    className="settings-btn status-menu-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                        setShowPrecisionMenu(false);
                        setShowBurgerMenu((prev) => !prev);
                    }}
                    aria-label="Menu"
                    title="Menu"
                >
                    ☰
                </button>
                {showBurgerMenu && (
                    <BurgerMenu
                        aiDebugLogCount={aiDebugLog.length}
                        onClose={() => setShowBurgerMenu(false)}
                        onNewWorksheet={() => { setShowBurgerMenu(false); requestClearWorksheet(); }}
                        onChangeFontScale={(dir) => { setShowBurgerMenu(false); changeFontScale(dir); }}
                        onResetFontSize={() => { setShowBurgerMenu(false); resetFontSize(); }}
                        onResetWindowLayout={() => { setShowBurgerMenu(false); handleResetWindowLayout(); }}
                        onOpenThemeStore={() => { setShowBurgerMenu(false); openThemeStore(); }}
                        onOpenHelp={() => { setShowBurgerMenu(false); openHelpPanel(); }}
                        onOpenAIDebug={() => { setShowBurgerMenu(false); setShowAIDebug(true); }}
                    />
                )}
            </div>
            <button
                type="button"
                className="settings-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    setShowPrecisionMenu(false);
                    setShowBurgerMenu(false);
                    if (showHelp) {
                        setShowHelp(false);
                        return;
                    }
                    openHelpPanel();
                }}
                aria-label="Help"
                title="Help"
            >
                ?
            </button>
            <button
                type="button"
                className="settings-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    if (showSettings) {
                        setShowSettings(false);
                        closeThemeStoreInSidebar();
                        return;
                    }
                    setShowPrecisionMenu(false);
                    setShowBurgerMenu(false);
                    setShowHelp(false);
                    setShowSettings(true);
                    closeThemeStoreInSidebar();
                }}
                aria-label="Settings"
                title="Settings"
            >
                ⚙
            </button>
        </div>
    );
}
