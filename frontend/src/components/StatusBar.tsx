import type { RefObject } from 'react';
import type { PrecisionMode } from '../types/app';
import { IS_DEV } from '../constants';
import { PrecisionPopover } from './PrecisionPopover';
import { BurgerMenu } from './BurgerMenu';

type Props = {
    statusText: string;
    isStatusError: boolean;
    devError: string;
    isAIQueryPending: boolean;
    wordWrap: boolean;
    setWordWrap: (fn: (prev: boolean) => boolean) => void;
    precision: PrecisionMode;
    setPrecision: (v: PrecisionMode) => void;
    scientificNotation: boolean;
    setScientificNotation: (v: boolean) => void;
    decreasePrecision: () => void;
    increasePrecision: () => void;
    applyFinancialPrecision: () => void;
    applyFourPointPrecision: () => void;
    resetPrecision: () => void;
    showPrecisionMenu: boolean;
    setShowPrecisionMenu: (fn: (prev: boolean) => boolean) => void;
    showBurgerMenu: boolean;
    setShowBurgerMenu: (fn: (prev: boolean) => boolean) => void;
    setShowHelp: (v: boolean) => void;
    setShowSettings: (v: boolean) => void;
    setShowThemeStore: (v: boolean) => void;
    showHelp: boolean;
    precisionMenuRef: RefObject<HTMLDivElement | null>;
    burgerMenuRef: RefObject<HTMLDivElement | null>;
    onRequestClearWorksheet: () => void;
    onOpenHelp: () => void;
    aiDebugLogCount: number;
    onChangeFontScale: (dir: 1 | -1) => void;
    onResetFontSize: () => void;
    onResetWindowLayout: () => void;
    onOpenThemeStore: () => void;
    onOpenAIDebug: () => void;
};

export function StatusBar({
    statusText, isStatusError, devError, isAIQueryPending,
    wordWrap, setWordWrap,
    precision, setPrecision, scientificNotation, setScientificNotation,
    decreasePrecision, increasePrecision, applyFinancialPrecision, applyFourPointPrecision, resetPrecision,
    showPrecisionMenu, setShowPrecisionMenu,
    showBurgerMenu, setShowBurgerMenu,
    setShowHelp, setShowSettings, setShowThemeStore, showHelp,
    precisionMenuRef, burgerMenuRef,
    onRequestClearWorksheet, onOpenHelp, aiDebugLogCount,
    onChangeFontScale, onResetFontSize, onResetWindowLayout, onOpenThemeStore, onOpenAIDebug,
}: Props) {
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
                onClick={onRequestClearWorksheet}
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
                        setShowBurgerMenu(() => false);
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
                        setShowPrecisionMenu(() => false);
                        setShowBurgerMenu((prev) => !prev);
                    }}
                    aria-label="Menu"
                    title="Menu"
                >
                    ☰
                </button>
                {showBurgerMenu && (
                    <BurgerMenu
                        aiDebugLogCount={aiDebugLogCount}
                        onNewWorksheet={() => { setShowBurgerMenu(() => false); onRequestClearWorksheet(); }}
                        onChangeFontScale={(dir) => { setShowBurgerMenu(() => false); onChangeFontScale(dir); }}
                        onResetFontSize={() => { setShowBurgerMenu(() => false); onResetFontSize(); }}
                        onResetWindowLayout={() => { setShowBurgerMenu(() => false); onResetWindowLayout(); }}
                        onOpenThemeStore={() => { setShowBurgerMenu(() => false); onOpenThemeStore(); }}
                        onOpenHelp={() => { setShowBurgerMenu(() => false); onOpenHelp(); }}
                        onOpenAIDebug={() => { setShowBurgerMenu(() => false); onOpenAIDebug(); }}
                    />
                )}
            </div>
            <button
                type="button"
                className="settings-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    setShowPrecisionMenu(() => false);
                    setShowBurgerMenu(() => false);
                    if (showHelp) { setShowHelp(false); return; }
                    onOpenHelp();
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
                    setShowPrecisionMenu(() => false);
                    setShowBurgerMenu(() => false);
                    setShowHelp(false);
                    setShowSettings(true);
                    setShowThemeStore(false);
                }}
                aria-label="Settings"
                title="Settings"
            >
                ⚙
            </button>
        </div>
    );
}
