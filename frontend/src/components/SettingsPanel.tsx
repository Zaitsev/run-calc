import React from 'react';
import { useEditorUI, useStatus, useThemeContext, useUIState } from '../contexts';
import { AISettingsPanel } from '../AISettings';
import { ThemeStore } from '../ThemeStore';
import type { WorksheetTabPosition } from '../types/app';
import {
    DEFAULT_FONT_SCALE,
    DEFAULT_UI_FONT_SCALE,
    DEFAULT_SETTINGS_DRAWER_WIDTH,
    FINANCIAL_PRECISION,
    FONT_SCALE_MAX,
    FONT_SCALE_MIN,
    FONT_SCALE_STEP,
    FOUR_POINT_PRECISION,
    PRECISION_MAX,
    SETTINGS_DRAWER_MAX_WIDTH,
    SETTINGS_DRAWER_MIN_WIDTH,
} from '../constants';
import { useSettingsPanelState } from '../hooks/useSettingsPanelState';

interface SettingsPanelProps {
    showSettings: boolean;
    showThemeStore: boolean;
    setShowThemeStore: (b: boolean) => void;
    settingsDrawerWidth: number;
    setSettingsDrawerWidth: React.Dispatch<React.SetStateAction<number>>;
    startSettingsDrawerResize: (e: React.MouseEvent<HTMLDivElement>) => void;
    worksheetTabPosition: WorksheetTabPosition;
    setWorksheetTabPosition: (position: WorksheetTabPosition) => void;
    onClose: () => void;
    onOpenThemeStore: () => void;
    onCloseThemeStore: () => void;
}

export function SettingsPanel({
    showSettings,
    showThemeStore,
    setShowThemeStore,
    settingsDrawerWidth,
    setSettingsDrawerWidth,
    startSettingsDrawerResize,
    worksheetTabPosition,
    setWorksheetTabPosition,
    onClose,
    onOpenThemeStore,
    onCloseThemeStore,
}: SettingsPanelProps) {
    const { display, themeStore, window: windowContext, ai } = useSettingsPanelState();
    const theme = useThemeContext();
    const { clampSettingsDrawerWidth } = useUIState();
    const { fontScale, setFontScale } = useEditorUI();

    const systemDecimalDelimiter = display.systemDecimalDelimiter ?? '.';

    const changeFontScale = (direction: 1 | -1) => {
        setFontScale((current) => {
            const next = current + direction * FONT_SCALE_STEP;
            return Number(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, next)).toFixed(2));
        });
    };

    const resetFontSize = () => {
        setFontScale(DEFAULT_FONT_SCALE);
    };

    const handleResetWindowLayout = () => {
        windowContext.resetWindowLayout?.();
    };

    const handleSetTheme = (themeConfig: any) => {
        theme.setTheme(themeConfig);
    };

    const { setStatusText, setIsStatusError, setDevError } = useStatus();
    const withStatusSetters = { setStatusText, setIsStatusError, setDevError };

    const onTestAndSaveAISettings = async () => {
        await ai.testAndSaveAISettings(withStatusSetters);
    };

    const onRevertAISettingsDraft = () => {
        ai.revertAISettingsDraftToSaved(withStatusSetters);
    };

    const onSaveAIKeyToBackend = async (apiKey: string) => {
        await ai.saveAIKeyToBackend(apiKey, withStatusSetters);
    };

    const onClearAIKeyInBackend = async () => {
        await ai.clearAIKeyInBackend(withStatusSetters);
    };

    const formatAutoLockTimeout = (minutes: number) => {
        if (minutes <= 0) return 'Off';
        if (minutes === 1) return '1 minute';
        return `${minutes} minutes`;
    };

    return (
        <div
            className={`settings-panel settings-panel--main${showSettings ? ' settings-panel--open' : ''}${showThemeStore ? ' settings-panel--theme-store' : ''}`}
            role="dialog"
            aria-label="Settings"
            aria-hidden={!showSettings}
            style={showThemeStore ? undefined : { width: `${settingsDrawerWidth}px` }}
        >
            {!showThemeStore && (
                <div
                    className="settings-resize-handle"
                    role="separator"
                    aria-label="Resize settings drawer"
                    aria-orientation="vertical"
                    tabIndex={0}
                    onMouseDown={(e) => startSettingsDrawerResize(e)}
                    onDoubleClick={() => setSettingsDrawerWidth(DEFAULT_SETTINGS_DRAWER_WIDTH)}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowLeft') {
                            event.preventDefault();
                            setSettingsDrawerWidth((current) => clampSettingsDrawerWidth(current + 16));
                        } else if (event.key === 'ArrowRight') {
                            event.preventDefault();
                            setSettingsDrawerWidth((current) => clampSettingsDrawerWidth(current - 16));
                        } else if (event.key === 'Home') {
                            event.preventDefault();
                            setSettingsDrawerWidth(SETTINGS_DRAWER_MIN_WIDTH);
                        } else if (event.key === 'End') {
                            event.preventDefault();
                            setSettingsDrawerWidth(clampSettingsDrawerWidth(SETTINGS_DRAWER_MAX_WIDTH));
                        }
                    }}
                    title="Drag to resize"
                />
            )}
            <div className="settings-header">
                <button
                    type="button"
                    className="settings-back"
                    onClick={() => {
                        if (showThemeStore) {
                            onCloseThemeStore();
                            return;
                        }
                        onClose();
                    }}
                    aria-label="Back"
                >
                    &#8594;
                </button>
                <span className="settings-title">{showThemeStore ? 'Theme Store' : 'Settings'}</span>
            </div>

            {showThemeStore ? (
                <div className="settings-body settings-body--theme-store">
                    <ThemeStore />
                </div>
            ) : (
                <div className="settings-body">
                    {/* ── UI Font Size ── */}
                    <div className="settings-card">
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-title">Menus & Help panel text size</div>
                                <div className="settings-row-desc">Adjust text size for menus and help panel</div>
                            </div>
                            <div className="settings-stepper-group">
                                <button
                                    type="button"
                                    className="settings-stepper"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => display.changeUIFontScale(-1)}
                                    disabled={display.uiFontScale <= FONT_SCALE_MIN}
                                    aria-label="Decrease UI font size"
                                >
                                    −
                                </button>
                                <span className="settings-stepper-value">
                                    {Math.round(display.uiFontScale * 100)}%
                                </span>
                                <button
                                    type="button"
                                    className="settings-stepper"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => display.changeUIFontScale(1)}
                                    disabled={display.uiFontScale >= FONT_SCALE_MAX}
                                    aria-label="Increase UI font size"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        {display.uiFontScale !== DEFAULT_UI_FONT_SCALE && (
                            <div className="settings-subaction">
                                <button
                                    type="button"
                                    className="settings-link-btn"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={display.resetUIFontScale}
                                >
                                    Reset to default
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Editor ── */}
                    <p className="settings-section-label">Editor</p>
                    <div className="settings-card">
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-title">Worksheet text size</div>
                                <div className="settings-row-desc">Adjust the main text size</div>
                            </div>
                            <div className="settings-stepper-group">
                                <button
                                    type="button"
                                    className="settings-stepper"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => changeFontScale(-1)}
                                    disabled={fontScale <= FONT_SCALE_MIN}
                                    aria-label="Decrease font size"
                                >
                                    −
                                </button>
                                <span className="settings-stepper-value">
                                    {Math.round(fontScale * 100)}%
                                </span>
                                <button
                                    type="button"
                                    className="settings-stepper"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => changeFontScale(1)}
                                    disabled={fontScale >= FONT_SCALE_MAX}
                                    aria-label="Increase font size"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        {fontScale !== DEFAULT_FONT_SCALE && (
                            <div className="settings-subaction">
                                <button
                                    type="button"
                                    className="settings-link-btn"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={resetFontSize}
                                >
                                    Reset to default
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="settings-card">
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-title">Word wrap</div>
                                <div className="settings-row-desc">Wrap long lines inside the editor</div>
                            </div>
                            <label className="settings-toggle" aria-label="Toggle word wrap">
                                <input
                                    type="checkbox"
                                    checked={display.wordWrap}
                                    onChange={(e) => display.setWordWrap(e.target.checked)}
                                />
                                <span className="settings-toggle-track" />
                            </label>
                        </div>
                    </div>
                    <div className="settings-card">
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-title">Copy expressions only</div>
                                <div className="settings-row-desc">Exclude calculated results when copying</div>
                            </div>
                            <label className="settings-toggle" aria-label="Toggle copy mode">
                                <input
                                    type="checkbox"
                                    checked={display.copyMode === 'expressions-only'}
                                    onChange={(e) => display.setCopyMode(e.target.checked ? 'expressions-only' : 'as-is')}
                                />
                                <span className="settings-toggle-track" />
                            </label>
                        </div>
                    </div>
                    <div className="settings-card">
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-title">Use variables for new lines</div>
                                <div className="settings-row-desc">When starting a new line with an operator, use the previous variable name instead of its value</div>
                            </div>
                            <label className="settings-toggle" aria-label="Toggle variable-first inlining">
                                <input
                                    type="checkbox"
                                    checked={display.variableFirstInlining}
                                    onChange={(e) => display.setVariableFirstInlining(e.target.checked)}
                                />
                                <span className="settings-toggle-track" />
                            </label>
                        </div>
                    </div>
                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div className="settings-card-title">Worksheet tabs position</div>
                            <div className="settings-card-desc">Choose where worksheet tabs are displayed</div>
                        </div>
                        <div className="settings-options">
                            {(['top', 'bottom', 'left'] as const).map((position) => (
                                <label key={position} className="settings-option">
                                    <input
                                        type="radio"
                                        name="worksheet-tabs-position"
                                        value={position}
                                        checked={worksheetTabPosition === position}
                                        onChange={() => setWorksheetTabPosition(position)}
                                    />
                                    <span>
                                        {position === 'top' ? 'Top' : position === 'bottom' ? 'Bottom' : 'Left'}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <p className="settings-section-label">Privacy</p>
                    <div className="settings-card">
                        <div className="settings-row settings-row--stack">
                            <div className="settings-row-info">
                                <div className="settings-row-title">Inactivity auto-lock</div>
                                <div className="settings-row-desc">Automatically lock protected worksheets after inactivity.</div>
                            </div>
                            <div className="settings-slider-block">
                                <input
                                    type="range"
                                    min={0}
                                    max={30}
                                    step={1}
                                    className="settings-range"
                                    value={display.autoLockTimeoutMinutes}
                                    onChange={(event) => display.setAutoLockTimeoutMinutes(Number(event.target.value))}
                                    aria-label="Auto-lock timeout in minutes"
                                />
                                <div className="settings-slider-meta">
                                    <span>Off</span>
                                    <span>{formatAutoLockTimeout(display.autoLockTimeoutMinutes)}</span>
                                    <span>30 min</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="settings-card">
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-title">Lock on minimize or hide</div>
                                <div className="settings-row-desc">Automatically lock protected worksheets when the window is hidden or minimized.</div>
                            </div>
                            <label className="settings-toggle" aria-label="Toggle lock on minimize or hide">
                                <input
                                    type="checkbox"
                                    checked={display.autoLockOnWindowHide}
                                    onChange={(e) => display.setAutoLockOnWindowHide(e.target.checked)}
                                />
                                <span className="settings-toggle-track" />
                            </label>
                        </div>
                    </div>
                    <div className="settings-card">
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-title">Lock on system sleep/resume</div>
                                <div className="settings-row-desc">Automatically lock protected worksheets after the computer wakes from sleep.</div>
                            </div>
                            <label className="settings-toggle" aria-label="Toggle lock on system sleep/resume">
                                <input
                                    type="checkbox"
                                    checked={display.autoLockOnSystemSleep}
                                    onChange={(e) => display.setAutoLockOnSystemSleep(e.target.checked)}
                                />
                                <span className="settings-toggle-track" />
                            </label>
                        </div>
                    </div>
           {/* ── Calculation ── */}
                    <p className="settings-section-label">Calculation</p>
                    <div className="settings-card">
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-title">Auto-calculate</div>
                                <div className="settings-row-desc">Automatically recalculate the worksheet if a result changes elsewhere</div>
                            </div>
                            <label className="settings-toggle" aria-label="Toggle auto eval">
                                <input
                                    type="checkbox"
                                    checked={display.autoEval}
                                    onChange={(e) => display.setAutoEval(e.target.checked)}
                                />
                                <span className="settings-toggle-track" />
                            </label>
                        </div>
                    </div>
                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div className="settings-card-title">Decimal delimiter</div>
                            <div className="settings-card-desc">Choose how decimal values are typed and displayed</div>
                        </div>
                        <div className="settings-options">
                            {(['dot', 'comma', 'system'] as const).map((mode) => (
                                <label key={mode} className="settings-option">
                                    <input
                                        type="radio"
                                        name="decimal-delimiter"
                                        value={mode}
                                        checked={display.decimalDelimiterMode === mode}
                                        onChange={() => display.setDecimalDelimiterMode(mode)}
                                    />
                                    <span>
                                        {mode === 'dot'
                                            ? 'Dot (1.23)'
                                            : mode === 'comma'
                                              ? 'Comma (1,23)'
                                              : `Use system setting (${systemDecimalDelimiter === ',' ? '1,23' : '1.23'})`}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="settings-card">
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-title">Decimal places</div>
                                <div className="settings-row-desc">Auto = 10 decimals · Full = no rounding · or pick 0–15</div>
                            </div>
                            <div className="settings-stepper-group">
                                <button
                                    type="button"
                                    className="settings-stepper"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={display.decreasePrecision}
                                    disabled={display.precision === 'full'}
                                    aria-label="Decrease precision"
                                >
                                    −
                                </button>
                                <span className="settings-stepper-value">
                                    {display.precision === 'full'
                                        ? 'Full'
                                        : display.precision === 'auto'
                                          ? 'Auto'
                                          : String(display.precision)}
                                </span>
                                <button
                                    type="button"
                                    className="settings-stepper"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={display.increasePrecision}
                                    disabled={display.precision === PRECISION_MAX}
                                    aria-label="Increase precision"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        <div className="settings-subaction settings-subaction--presets">
                            <button
                                type="button"
                                className="settings-link-btn"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={display.applyFinancialPrecision}
                                disabled={display.precision === FINANCIAL_PRECISION}
                            >
                                Financial (2)
                            </button>
                            <button
                                type="button"
                                className="settings-link-btn"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={display.applyFourPointPrecision}
                                disabled={display.precision === FOUR_POINT_PRECISION}
                            >
                                Intermediate (4)
                            </button>
                            {display.precision !== 'auto' && (
                                <button
                                    type="button"
                                    className="settings-link-btn"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={display.resetPrecision}
                                >
                                    Reset to default
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="settings-card">
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-title">Scientific notation</div>
                                <div className="settings-row-desc">Display very large or small results as 1e+7 / 1e-7</div>
                            </div>
                            <label className="settings-toggle" aria-label="Toggle scientific notation">
                                <input
                                    type="checkbox"
                                    checked={display.scientificNotation}
                                    onChange={(e) => display.setScientificNotation(e.target.checked)}
                                />
                                <span className="settings-toggle-track" />
                            </label>
                        </div>
                    </div>
                    {/* ── AI Settings ── */}
                    <p className={`settings-section-label settings-ai-block${ai.aiSettingsHasUnsavedChanges ? ' settings-section-label--with-chip' : ''}`}><span>AI</span>
                            {ai.aiSettingsHasUnsavedChanges && (
                                <span className="settings-status-chip" aria-label="AI settings have unsaved changes">
                                    Unsaved
                                </span>
                            )}</p>
                    <div className={`settings-ai-block${ai.aiSettingsHasUnsavedChanges ? ' settings-ai-block--action-required' : ''}`}>
                        <AISettingsPanel
                            settings={ai.aiSettingsDraft}
                            keyStatus={ai.aiKeyStatus}
                            busy={ai.aiSettingsBusy}
                            hasUnsavedChanges={ai.aiSettingsHasUnsavedChanges}
                            showRevertChanges={ai.aiSettingsActionFailed}
                            applyErrorMessage={ai.aiSettingsApplyError}
                            onChange={(next) => {
                                ai.setAISettingsDraft(next);
                            }}
                            onTestAndSave={onTestAndSaveAISettings}
                            onRevertChanges={onRevertAISettingsDraft}
                            onSaveKey={onSaveAIKeyToBackend}
                            onClearKey={onClearAIKeyInBackend}
                        />
                    </div>
         

                    {/* ── Appearance ── */}
                    <p className="settings-section-label">Appearance</p>
                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div className="settings-card-title">App theme</div>
                            <div className="settings-card-desc">Select which app theme to display</div>
                        </div>
                        <div className="saved-theme-list" role="list">
                            <div className="saved-theme-group" role="group" aria-label="Browse themes">
                                <button
                                    type="button"
                                    className="saved-theme-item saved-theme-browse-btn"
                                    onClick={onOpenThemeStore}
                                    role="listitem"
                                >
                                    <span className="saved-theme-icon saved-theme-icon--browse" aria-hidden="true">
                                        +
                                    </span>
                                    <span className="saved-theme-text">
                                        <span className="saved-theme-name">Browse themes</span>
                                        <span className="saved-theme-meta">Theme store</span>
                                    </span>
                                </button>
                            </div>

                            <div className="saved-theme-group" role="group" aria-label="Default themes">
                                {([
                                    { key: 'light', name: 'Light', meta: 'Default theme', icon: 'L' },
                                    { key: 'dark', name: 'Dark', meta: 'Default theme', icon: 'D' },
                                    { key: 'light-high-contrast', name: 'Light (High Contrast)', meta: 'High visibility', icon: 'HC' },
                                    { key: 'dark-high-contrast', name: 'Dark (High Contrast)', meta: 'High visibility', icon: 'HC' },
                                    { key: 'system', name: 'System', meta: 'Use OS setting', icon: 'S' },
                                ] as const).map((entry) => {
                                    const isActive = theme.theme.type === entry.key;
                                    return (
                                        <button
                                            key={entry.key}
                                            type="button"
                                            className={`saved-theme-item${isActive ? ' saved-theme-item--active' : ''}`}
                                            onClick={() => handleSetTheme({ type: entry.key })}
                                            role="listitem"
                                        >
                                            <span className="saved-theme-icon saved-theme-icon--builtin" aria-hidden="true">
                                                {entry.icon}
                                            </span>
                                            <span className="saved-theme-text">
                                                <span className="saved-theme-name">{entry.name}</span>
                                                <span className="saved-theme-meta">{entry.meta}</span>
                                            </span>
                                            <span className="saved-theme-check" aria-hidden="true">
                                                v
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="saved-theme-group" role="group" aria-label="Downloaded themes">
                                {themeStore.savedThemes.map((entry) => {
                                    const isActive = theme.theme.type === 'custom' && theme.theme.customId === entry.id;
                                    return (
                                        <div key={entry.id} className="saved-theme-item-wrapper">
                                            <button
                                                type="button"
                                                className={`saved-theme-item${isActive ? ' saved-theme-item--active' : ''}`}
                                                onClick={() =>
                                                    handleSetTheme({
                                                        type: 'custom',
                                                        customColors: entry.colors,
                                                        customId: entry.id,
                                                        customThemeBase: entry.themeBase,
                                                    })
                                                }
                                                role="listitem"
                                            >
                                                {entry.iconUrl && (
                                                    <img src={entry.iconUrl} alt="" aria-hidden="true" className="saved-theme-icon" />
                                                )}
                                                <span className="saved-theme-text">
                                                    <span className="saved-theme-name">{entry.name}</span>
                                                    {entry.publisher && <span className="saved-theme-meta">{entry.publisher}</span>}
                                                </span>
                                                <span className="saved-theme-check" aria-hidden="true">
                                                    v
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="saved-theme-delete-btn"
                                                onClick={() => themeStore.deleteSavedTheme(entry.id)}
                                                aria-label={`Delete saved theme ${entry.name}`}
                                                title={`Delete ${entry.name}`}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>


                    {/* ── Window ── */}
                    <p className="settings-section-label">Window</p>
                    <div className="settings-card">
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-title">Window layout</div>
                                <div className="settings-row-desc">Restore default size and position</div>
                            </div>
                            <button
                                type="button"
                                className="settings-action-btn"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    handleResetWindowLayout();
                                    onClose();
                                }}
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    {windowContext.runtimePlatform === 'windows' && (
                        <div className="settings-card">
                            <div className="settings-row">
                                <div className="settings-row-info">
                                    <div className="settings-row-title">Close button behavior</div>
                                    <div className="settings-row-desc">Hide to tray on close (default) instead of quitting. Restore from the tray icon menu.</div>
                                </div>
                                <label className="settings-toggle" aria-label="Toggle close button behavior">
                                    <input
                                        type="checkbox"
                                        checked={windowContext.minimiseToTrayOnClose}
                                        onChange={(e) => windowContext.setMinimiseToTrayOnClose(e.target.checked)}
                                    />
                                    <span className="settings-toggle-track" />
                                </label>
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}
