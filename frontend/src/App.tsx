import {type CSSProperties, KeyboardEvent, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
    BrowserOpenURL,
    Environment,
    EventsOn,
    Quit,
    ScreenGetAll,
    WindowReload,
    WindowCenter,
    WindowSetDarkTheme,
    WindowSetLightTheme,
    WindowSetSystemDefaultTheme,
    WindowGetPosition,
    WindowGetSize,
    WindowHide,
    WindowSetPosition,
    WindowSetSize
} from '../wailsjs/runtime/runtime';
import './App.css';
import appLogo from './assets/images/icons/hare-calc-1024.png';
import appLogoDark from './assets/images/icons/hare-calc-1024-black.png';
import { AISettingsPanel, type AIContextMode, type AIKeyStatusState, type AISettingsState } from './AISettings';
import { AIDebugDrawer, type AIDebugEntry } from './AIDebugDrawer';
import { HelpPanel } from './HelpPanel';
import {extractExpressionDependencies, getAITriggerPrompt, getExpressionSource, isAITriggerLine, splitLineComment} from './lineExpression';
import {
    buildEvaluationExpression,
    buildStaleLineDetails,
    getPreservedCaretOffset,
    getFriendlyEvalErrorMessage,
    isAITriggerSourceLine,
    reformatComputedLineResult,
    stripMarkdownCodeFences,
    shouldSkipEvaluationAtCaret,
    shouldSkipEvaluation,
} from './appInteractionLogic';
import {useTheme, type ThemeState} from './useTheme';
import { getFontResizeDirectionFromWheel, getPrimaryShortcutAction } from './editorShortcuts';
import { ClearAIAPIKey, EvaluateExprProgram, GetAIKeyStatusForSettings, GetAISettings, IsRunningAsMSIX, RunAIQuery, SaveAISettings, SetAIAPIKey, SetMinimiseToTrayOnClose, SetRestoreShortcutEnabled } from '../wailsjs/go/main/App';

import { ThemeStore, type AcceptedThemeEntry } from './ThemeStore';

const OPERATOR_KEY_RE = /^[+\-*/]$/;
const MATH_FUNCTION_NAMES = new Set([
    'ABS', 'ACOS', 'ACOSH', 'ASIN', 'ASINH', 'ALL', 'ANY', 'ATAN', 'ATAN2', 'ATANH',
    'AVG', 'CBRT', 'CEIL', 'COS', 'COSH', 'COUNT', 'EACH', 'EXP', 'FILTER', 'FIND', 'FIRST', 'FLATTEN', 'FLOOR',
    'HYPOT', 'LEN', 'LAST', 'LOG', 'LOG10', 'LOG2', 'MAP', 'MAX', 'MEAN', 'MEDIAN', 'MIN', 'NONE', 'ONE', 'POW',
    'REDUCE', 'REVERSE', 'ROUND', 'SIGN', 'SIN', 'SINH', 'SORT', 'SQRT', 'SUM', 'TAN', 'TANH', 'TAKE', 'TRUNC', 'UNIQ',
]);

function usePrefersDark(): boolean {
    const [prefersDark, setPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (event: MediaQueryListEvent) => {
            setPrefersDark(event.matches);
        };

        setPrefersDark(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, []);

    return prefersDark;
}
const MATH_CONSTANT_NAMES = new Set([
    'E', 'PI', 'TAU', 'PHI', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT1_2', 'SQRT2', 'SQRTE', 'SQRTPI', 'SQRTPHI',
]);
const IS_DEV = import.meta.env.DEV;
const HELP_SITE_URL = import.meta.env.VITE_HELP_SITE_URL || (IS_DEV ? 'http://localhost:3001' : 'https://run-calc.taalgem.nl/');
const WINDOW_STATE_KEY = 'calc.window.state';
const WINDOW_STATE_SAVE_DEBOUNCE_MS = 200;
const WINDOW_STATE_SAVE_INTERVAL_MS = 1500;
const DEFAULT_WINDOW_WIDTH = 1100;
const DEFAULT_WINDOW_HEIGHT = 760;
const FONT_SCALE_STORAGE_KEY = 'calc.editor.fontScale';
const FONT_SCALE_STEP = 0.1;
const FONT_SCALE_MIN = 0.7;
const FONT_SCALE_MAX = 2.2;
const DEFAULT_FONT_SCALE = 1;
const EDITOR_SIDE_PADDING_PX = 20;
const MARKED_LINES_STORAGE_KEY = 'calc.editor.markedLines';
const DECIMAL_DELIMITER_STORAGE_KEY = 'calc.editor.decimalDelimiter';
const PRECISION_STORAGE_KEY = 'calc.editor.precision';
const SCIENTIFIC_NOTATION_STORAGE_KEY = 'calc.editor.scientificNotation';
const WORD_WRAP_STORAGE_KEY = 'calc.editor.wordWrap';
const WORKSHEET_CONTENT_STORAGE_KEY = 'calc.editor.content';
const LAST_RESULT_STORAGE_KEY = 'calc.editor.lastResult';
const VARIABLE_VALUES_STORAGE_KEY = 'calc.editor.variableValues';
const ACCEPTED_THEMES_STORAGE_KEY = 'calc.themes.accepted';
const SETTINGS_DRAWER_WIDTH_STORAGE_KEY = 'calc.settings.drawerWidth';
const MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY = 'calc.window.minimiseToTrayOnClose';
const RESTORE_SHORTCUT_ENABLED_STORAGE_KEY = 'calc.window.restoreShortcutEnabled';
const HELP_PANEL_POSITION_STORAGE_KEY = 'calc.help.position';
const DOUBLE_ESCAPE_HIDE_WINDOW_MS = 420;
const INTELLIGENCE_HINT_SHOW_DELAY_MS = 300;
const INTELLIGENCE_HINT_HIDE_IDLE_MS = 3000;
const EDITOR_TOP_PADDING_PX = 42;
const EDITOR_BOTTOM_PADDING_PX = 18;
const DEFAULT_SETTINGS_DRAWER_WIDTH = 420;
const SETTINGS_DRAWER_MIN_WIDTH = 360;
const SETTINGS_DRAWER_MAX_WIDTH = 1520;
const SETTINGS_DRAWER_MIN_EDITOR_WIDTH = 380;
const SETTINGS_DRAWER_MIN_WINDOW_WIDTH = 980;

const PRECISION_MIN = 0;
const PRECISION_MAX = 15;
const FINANCIAL_PRECISION = 2;
const FOUR_POINT_PRECISION = 4;

type SavedThemeEntry = AcceptedThemeEntry;
type DecimalDelimiter = '.' | ',';

type DecimalDelimiterMode = 'dot' | 'comma' | 'system';
type PrecisionMode = 'auto' | 'full' | number;
type HelpPanelPosition = 'left' | 'right' | 'bottom';
type SuggestionKind = 'variable' | 'function' | 'constant';

type SuggestionItem = {
    label: string;
    kind: SuggestionKind;
    matchText: string;
};

type IdentifierContext = {
    start: number;
    end: number;
    token: string;
    baseToken: string;
    wantsAtPrefix: boolean;
    lineStart: number;
    startInLine: number;
};

type StoredWindowState = {
    w: number;
    h: number;
    x: number;
    y: number;
};

type AIModelOutput = {
    answer?: string;
    answerNumber?: number;
    comment?: string;
    code?: string;
};

type AIRunResponse = {
    ok: boolean;
    error?: string;
    output: AIModelOutput;
    preview: {
        systemPrompt: string;
        userPrompt: string;
        contextMode: string;
        contextLineCount: number;
        endpoint?: string;
        modelId?: string;
        rawContextText?: string;
        rawLinesAbove?: string[];
        rawFullContent?: string;
        rawInitialPayload?: string;
        rawExchangeLog?: string;
        rawFinalMessage?: string;
        rawFinalContent?: string;
    };
};

type AISettingsResponse = {
    settings: AISettingsState;
    keyStatus: AIKeyStatusState;
};

type AIProgressEvent = {
    message?: string;
};

function defaultAISettingsState(): AISettingsState {
    return {
        providerPreset: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        modelId: 'gpt-4o-mini',
        defaultContextMode: 'above',
        allowInsecureKeyFallback: false,
        allowCustomEndpointKeyReuse: false,
        customKeySourceEndpoint: '',
        requestTimeoutSeconds: 45,
    };
}

function defaultAIKeyStatusState(): AIKeyStatusState {
    return {
        hasKey: false,
        storageMode: 'none',
    };
}

function areAISettingsEqual(left: AISettingsState, right: AISettingsState): boolean {
    return left.providerPreset === right.providerPreset &&
        left.endpoint === right.endpoint &&
        left.modelId === right.modelId &&
        left.defaultContextMode === right.defaultContextMode &&
        left.allowInsecureKeyFallback === right.allowInsecureKeyFallback &&
    left.allowCustomEndpointKeyReuse === right.allowCustomEndpointKeyReuse &&
        left.requestTimeoutSeconds === right.requestTimeoutSeconds;
}

function getSystemDecimalDelimiter(): '.' | ',' {
    const parts = new Intl.NumberFormat().formatToParts(1.1);
    const decimalPart = parts.find((part) => part.type === 'decimal')?.value;
    return decimalPart === ',' ? ',' : '.';
}

function resolveDecimalDelimiter(mode: DecimalDelimiterMode): DecimalDelimiter {
    if (mode === 'dot') {
        return '.';
    }
    if (mode === 'comma') {
        return ',';
    }

    return getSystemDecimalDelimiter();
}

function formatNumber(
    value: number,
    decimalDelimiter: '.' | ',',
    precision: PrecisionMode = 'auto',
    useScientific = false,
): string {
    const absVal = Math.abs(value);
    if (useScientific && value !== 0 && (absVal >= 1e7 || absVal < 1e-7)) {
        let expStr: string;
        if (precision === 'full') {
            expStr = value.toExponential();
        } else {
            const decPlaces = precision === 'auto' ? 10 : precision;
            const [mantissa, exponent] = value.toExponential(decPlaces).split('e');
            expStr = mantissa.replace(/\.?0+$/, '') + 'e' + exponent;
        }
        return decimalDelimiter === ',' ? expStr.replace('.', ',') : expStr;
    }

    if (Number.isInteger(value)) {
        return String(value);
    }

    let str: string;
    if (precision === 'full') {
        str = String(value);
    } else if (precision === 'auto') {
        const rounded = Number(value.toFixed(10));
        str = String(rounded);
    } else {
        str = value.toFixed(precision);
        str = str.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    }

    return decimalDelimiter === ',' ? str.replace('.', ',') : str;
}

function getPrecisionScale(precision: PrecisionMode): number {
    if (precision === 'full') {
        return Number.POSITIVE_INFINITY;
    }
    if (precision === 'auto') {
        return 10;
    }

    return precision;
}

function parseHexColor(hexColor: string): [number, number, number] | null {
    const hex = hexColor.trim();
    if (!hex.startsWith('#')) {
        return null;
    }

    const value = hex.slice(1);
    if (value.length === 3 || value.length === 4) {
        const r = parseInt(value[0] + value[0], 16);
        const g = parseInt(value[1] + value[1], 16);
        const b = parseInt(value[2] + value[2], 16);
        return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : [r, g, b];
    }

    if (value.length === 6 || value.length === 8) {
        const r = parseInt(value.slice(0, 2), 16);
        const g = parseInt(value.slice(2, 4), 16);
        const b = parseInt(value.slice(4, 6), 16);
        return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : [r, g, b];
    }

    return null;
}

function parseRgbColor(rgbColor: string): [number, number, number] | null {
    const match = rgbColor.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) {
        return null;
    }

    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    if (![r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
        return null;
    }

    return [r, g, b];
}

function inferCustomThemeMode(customColors?: Record<string, string>): 'light' | 'dark' {
    const bg = customColors?.['editor.background'] || customColors?.['sideBar.background'];
    if (!bg) {
        return 'dark';
    }

    const rgb = parseHexColor(bg) || parseRgbColor(bg);
    if (!rgb) {
        return 'dark';
    }

    const [r, g, b] = rgb;
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.58 ? 'light' : 'dark';
}

function isIdentifierStartChar(ch: string): boolean {
    return /^[a-zA-Z_]$/.test(ch);
}

function isIdentifierPartChar(ch: string): boolean {
    return /^[a-zA-Z0-9_]$/.test(ch);
}

function App() {
    const [content, setContent] = useState(() => {
        return localStorage.getItem(WORKSHEET_CONTENT_STORAGE_KEY) ?? '';
    });
    const [lastResult, setLastResult] = useState<number | null>(() => {
        const raw = localStorage.getItem(LAST_RESULT_STORAGE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    });
    const [statusText, setStatusText] = useState('Ready');
    const [isStatusError, setIsStatusError] = useState(false);
    const [devError, setDevError] = useState('');
    const [fontScale, setFontScale] = useState(() => {
        const raw = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
        if (!raw) {
            return DEFAULT_FONT_SCALE;
        }

        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
            return DEFAULT_FONT_SCALE;
        }

        return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, parsed));
    });
    const [showSettings, setShowSettings] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [helpPanelPosition, setHelpPanelPosition] = useState<HelpPanelPosition>(() => {
        const raw = localStorage.getItem(HELP_PANEL_POSITION_STORAGE_KEY);
        if (raw === 'left' || raw === 'right' || raw === 'bottom') {
            return raw;
        }
        return 'right';
    });
    const [showThemeStore, setShowThemeStore] = useState(false);
    const [settingsDrawerWidth, setSettingsDrawerWidth] = useState(() => {
        const raw = localStorage.getItem(SETTINGS_DRAWER_WIDTH_STORAGE_KEY);
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
            return DEFAULT_SETTINGS_DRAWER_WIDTH;
        }
        return Math.round(Math.min(SETTINGS_DRAWER_MAX_WIDTH, Math.max(SETTINGS_DRAWER_MIN_WIDTH, parsed)));
    });
    const [minimiseToTrayOnClose, setMinimiseToTrayOnClose] = useState(() => {
        return localStorage.getItem(MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY) !== 'false';
    });
    const [restoreShortcutEnabled, setRestoreShortcutEnabled] = useState(() => {
        return localStorage.getItem(RESTORE_SHORTCUT_ENABLED_STORAGE_KEY) !== 'false';
    });
    const [decimalDelimiterMode, setDecimalDelimiterMode] = useState<DecimalDelimiterMode>(() => {
        const raw = localStorage.getItem(DECIMAL_DELIMITER_STORAGE_KEY);
        if (raw === 'dot' || raw === 'comma' || raw === 'system') {
            return raw;
        }

        return 'dot';
    });
    const [precision, setPrecision] = useState<PrecisionMode>(() => {
        const raw = localStorage.getItem(PRECISION_STORAGE_KEY);
        if (raw === 'auto') return 'auto';
        if (raw === 'full') return 'full';
        const n = Number(raw);
        if (Number.isInteger(n) && n >= PRECISION_MIN && n <= PRECISION_MAX) return n;
        return 'auto';
    });
    const [scientificNotation, setScientificNotation] = useState(() => {
        return localStorage.getItem(SCIENTIFIC_NOTATION_STORAGE_KEY) === 'true';
    });
    const [wordWrap, setWordWrap] = useState(() => {
        return localStorage.getItem(WORD_WRAP_STORAGE_KEY) === 'true';
    });
    const [aiContextMode, setAIContextMode] = useState<AIContextMode>('above');
    const [aiSettings, setAISettings] = useState<AISettingsState>(() => defaultAISettingsState());
    const [aiSettingsDraft, setAISettingsDraft] = useState<AISettingsState>(() => defaultAISettingsState());
    const [aiSettingsActionFailed, setAISettingsActionFailed] = useState(false);
    const [aiSettingsApplyError, setAISettingsApplyError] = useState('');
    const [aiKeyStatus, setAIKeyStatus] = useState<AIKeyStatusState>(() => defaultAIKeyStatusState());
    const [aiSettingsBusy, setAISettingsBusy] = useState(false);
    const [aiDebugLog, setAIDebugLog] = useState<AIDebugEntry[]>([]);
    const [isAIQueryPending, setIsAIQueryPending] = useState(false);
    const [aiPendingLineIndex, setAIPendingLineIndex] = useState<number | null>(null);
    const [aiProgressMessage, setAIProgressMessage] = useState('');
    const aiDebugIdRef = useRef(0);
    const [showAIDebug, setShowAIDebug] = useState(false);
    const [isResizingSettingsDrawer, setIsResizingSettingsDrawer] = useState(false);
    const [variableValues, setVariableValues] = useState<Record<string, unknown>>(() => {
        const raw = localStorage.getItem(VARIABLE_VALUES_STORAGE_KEY);
        if (!raw) return {};
        try {
            const obj = JSON.parse(raw);
            if (typeof obj === 'object' && obj !== null) {
                return obj;
            }
        } catch {
            // ignore
        }
        return {};
    });
    const [variableVersions, setVariableVersions] = useState<Record<string, number>>({});
    const [_, setLineDependencies] = useState<Record<number, string[]>>({});
    const [lineDependencyVersions, setLineDependencyVersions] = useState<Record<number, Record<string, number>>>({});
    const [pendingThemePreview, setPendingThemePreview] = useState<SavedThemeEntry | null>(null);
    const {theme, setTheme} = useTheme();
    const prefersDark = usePrefersDark();
    const isDarkTheme =
        theme.type === 'dark' ||
        (theme.type === 'custom' && (theme.customThemeBase ?? inferCustomThemeMode(theme.customColors)) === 'dark') ||
        (theme.type === 'system' && prefersDark);
    const isContentEmpty = content.trim() === '';
    const previewRestoreThemeRef = useRef<ThemeState | null>(null);
    const [savedThemes, setSavedThemes] = useState<SavedThemeEntry[]>(() => {
        const raw = localStorage.getItem(ACCEPTED_THEMES_STORAGE_KEY);
        if (!raw) {
            return [];
        }

        try {
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.filter((item): item is SavedThemeEntry => {
                if (!item || typeof item !== 'object') {
                    return false;
                }

                const maybe = item as SavedThemeEntry;
                return (
                    typeof maybe.id === 'string' &&
                    typeof maybe.name === 'string' &&
                    !!maybe.colors &&
                    typeof maybe.colors === 'object'
                );
            });
        } catch {
            return [];
        }
    });
    const themeStoreOriginalSizeRef = useRef<{ w: number; h: number } | null>(null);
    const settingsDrawerOriginalSizeRef = useRef<{ w: number; h: number } | null>(null);
    const settingsDrawerResizeStartRef = useRef<{ x: number; width: number } | null>(null);
    const burgerMenuRef = useRef<HTMLDivElement | null>(null);
    const precisionMenuRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<HTMLTextAreaElement | null>(null);
    const gutterRef = useRef<HTMLDivElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const lastEscapeKeyAtRef = useRef(0);
    const [markedLines, setMarkedLines] = useState<ReadonlySet<number>>(() => {
        const raw = localStorage.getItem(MARKED_LINES_STORAGE_KEY);
        if (!raw) return new Set<number>();
        try {
            const arr: unknown = JSON.parse(raw);
            if (Array.isArray(arr)) {
                return new Set<number>(arr.filter((n): n is number => typeof n === 'number'));
            }
        } catch {
            // ignore
        }
        return new Set<number>();
    });
    const [lineHeightPx, setLineHeightPx] = useState(22);
    const [lineRowHeights, setLineRowHeights] = useState<number[]>([]);
    const [editorFontSpec, setEditorFontSpec] = useState('16px Nunito, Segoe UI, Tahoma, sans-serif');
    const [editorScrollbarWidth, setEditorScrollbarWidth] = useState(0);
    const [editorScrollTop, setEditorScrollTop] = useState(0);
    const [editorScrollLeft, setEditorScrollLeft] = useState(0);
    const [caretPos, setCaretPos] = useState(0);
    const [runtimePlatform, setRuntimePlatform] = useState('');
    const [isMSIX, setIsMSIX] = useState(false);
    const [showBurgerMenu, setShowBurgerMenu] = useState(false);
    const [showPrecisionMenu, setShowPrecisionMenu] = useState(false);
    const [showIntelligenceHint, setShowIntelligenceHint] = useState(false);
    const [showClearWorksheetConfirm, setShowClearWorksheetConfirm] = useState(false);
    const [isReevaluatingAll, setIsReevaluatingAll] = useState(false);
    const previousPrecisionRef = useRef<PrecisionMode>(precision);
    const intelligenceShowTimerRef = useRef<number | null>(null);
    const intelligenceHideTimerRef = useRef<number | null>(null);

    const systemDecimalDelimiter = getSystemDecimalDelimiter();
    const decimalDelimiter = resolveDecimalDelimiter(decimalDelimiterMode);

    useEffect(() => {
        localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(fontScale));
    }, [fontScale]);

    useEffect(() => {
        localStorage.setItem(DECIMAL_DELIMITER_STORAGE_KEY, decimalDelimiterMode);
    }, [decimalDelimiterMode]);

    useEffect(() => {
        localStorage.setItem(PRECISION_STORAGE_KEY, String(precision));
    }, [precision]);

    useEffect(() => {
        const previousPrecision = previousPrecisionRef.current;
        const precisionIncreased = getPrecisionScale(precision) > getPrecisionScale(previousPrecision);
        previousPrecisionRef.current = precision;

        if (!precisionIncreased) {
            return;
        }

        void reevaluateAllExpressions();
    }, [precision]);

    useEffect(() => {
        localStorage.setItem(SCIENTIFIC_NOTATION_STORAGE_KEY, String(scientificNotation));
    }, [scientificNotation]);

    useEffect(() => {
        localStorage.setItem(WORD_WRAP_STORAGE_KEY, String(wordWrap));
    }, [wordWrap]);

    // Re-format already-computed numeric result suffixes when display settings change.
    useEffect(() => {
        setContent((currentContent) => {
            const lines = currentContent.split('\n');
            let changed = false;
            const newLines = lines.map((line) => {
                const newLine = reformatComputedLineResult(
                    line,
                    decimalDelimiter,
                    precision,
                    scientificNotation,
                    formatNumber,
                );
                if (newLine !== line) {
                    changed = true;
                    return newLine;
                }

                return line;
            });
            return changed ? newLines.join('\n') : currentContent;
        });
    }, [precision, scientificNotation, decimalDelimiter]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        localStorage.setItem(MARKED_LINES_STORAGE_KEY, JSON.stringify([...markedLines]));
    }, [markedLines]);

    useEffect(() => {
        localStorage.setItem(WORKSHEET_CONTENT_STORAGE_KEY, content);
    }, [content]);

    useEffect(() => {
        if (lastResult === null) {
            localStorage.removeItem(LAST_RESULT_STORAGE_KEY);
            return;
        }

        localStorage.setItem(LAST_RESULT_STORAGE_KEY, String(lastResult));
    }, [lastResult]);

    useEffect(() => {
        localStorage.setItem(VARIABLE_VALUES_STORAGE_KEY, JSON.stringify(variableValues));
    }, [variableValues]);

    useEffect(() => {
        localStorage.setItem(ACCEPTED_THEMES_STORAGE_KEY, JSON.stringify(savedThemes));
    }, [savedThemes]);

    useEffect(() => {
        localStorage.setItem(SETTINGS_DRAWER_WIDTH_STORAGE_KEY, String(settingsDrawerWidth));
    }, [settingsDrawerWidth]);

    useEffect(() => {
        localStorage.setItem(MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY, String(minimiseToTrayOnClose));
        SetMinimiseToTrayOnClose(minimiseToTrayOnClose).catch(() => {
            // Keep settings responsive even if backend sync fails.
        });
    }, [minimiseToTrayOnClose]);

    useEffect(() => {
        localStorage.setItem(RESTORE_SHORTCUT_ENABLED_STORAGE_KEY, String(restoreShortcutEnabled));
        if (!isMSIX) SetRestoreShortcutEnabled(restoreShortcutEnabled).catch(() => {
            // Keep settings responsive even if backend sync fails.
        });
    }, [restoreShortcutEnabled, isMSIX]);

    useEffect(() => {
        localStorage.setItem(HELP_PANEL_POSITION_STORAGE_KEY, helpPanelPosition);
    }, [helpPanelPosition]);

    useEffect(() => {
        let cancelled = false;
        Environment()
            .then((env) => {
                if (!cancelled) {
                    setRuntimePlatform(env.platform || '');
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setRuntimePlatform('');
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        IsRunningAsMSIX()
            .then((v) => setIsMSIX(v))
            .catch(() => {/* non-Windows dev server — leave false */});
    }, []);

    const getSettingsDrawerMaxWidth = () => {
        const viewportWidth = Math.max(window.innerWidth, SETTINGS_DRAWER_MIN_WIDTH + SETTINGS_DRAWER_MIN_EDITOR_WIDTH);
        return Math.max(
            SETTINGS_DRAWER_MIN_WIDTH,
            Math.min(SETTINGS_DRAWER_MAX_WIDTH, viewportWidth - SETTINGS_DRAWER_MIN_EDITOR_WIDTH),
        );
    };

    const clampSettingsDrawerWidth = (width: number) => {
        const clampedMax = getSettingsDrawerMaxWidth();
        return Math.round(Math.min(clampedMax, Math.max(SETTINGS_DRAWER_MIN_WIDTH, width)));
    };

    useEffect(() => {
        const onWindowResize = () => {
            setSettingsDrawerWidth((current) => clampSettingsDrawerWidth(current));
        };

        window.addEventListener('resize', onWindowResize);
        return () => {
            window.removeEventListener('resize', onWindowResize);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!isResizingSettingsDrawer) {
            return;
        }

        const onMouseMove = (event: MouseEvent) => {
            const start = settingsDrawerResizeStartRef.current;
            if (!start) {
                return;
            }

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
        if (runtimePlatform !== 'windows') {
            return;
        }

        if (theme.type === 'system') {
            WindowSetSystemDefaultTheme();
            return;
        }

        if (theme.type === 'light') {
            WindowSetLightTheme();
            return;
        }

        if (theme.type === 'dark') {
            WindowSetDarkTheme();
            return;
        }

        const customMode = theme.customThemeBase || inferCustomThemeMode(theme.customColors);
        if (customMode === 'light') {
            WindowSetLightTheme();
        } else {
            WindowSetDarkTheme();
        }
    }, [runtimePlatform, theme]);

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
    }, [showBurgerMenu]);

    useEffect(() => {
        if (!showClearWorksheetConfirm) {
            return;
        }

        const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setShowClearWorksheetConfirm(false);
            }
        };

        document.addEventListener('keydown', onDocumentKeyDown);
        return () => {
            document.removeEventListener('keydown', onDocumentKeyDown);
        };
    }, [showClearWorksheetConfirm]);

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
    }, [showPrecisionMenu]);

    useEffect(() => {
        if (!editorRef.current) return;
        const cs = getComputedStyle(editorRef.current);
        const lh = parseFloat(cs.lineHeight);
        if (Number.isFinite(lh) && lh > 0) setLineHeightPx(lh);
        setEditorFontSpec(`${cs.fontSize} ${cs.fontFamily}`);
    }, [fontScale]);

    const syncEditorScrollbarWidth = () => {
        const editor = editorRef.current;
        if (!editor) {
            return;
        }

        const nextWidth = Math.max(0, editor.offsetWidth - editor.clientWidth);
        setEditorScrollbarWidth((prev) => (Math.abs(prev - nextWidth) < 0.5 ? prev : nextWidth));
    };

    useLayoutEffect(() => {
        syncEditorScrollbarWidth();
    }, [content, wordWrap, fontScale]);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) {
            return;
        }

        const ro = new ResizeObserver(() => {
            syncEditorScrollbarWidth();
        });
        ro.observe(editor);
        return () => ro.disconnect();
    }, []);

    const measureLineRowHeights = () => {
        const container = overlayRef.current;
        if (!container) return;
        const children = container.children;
        const heights: number[] = [];
        for (let i = 0; i < children.length; i++) {
            const row = children[i] as HTMLElement;
            const measured = row.getBoundingClientRect().height;
            heights.push(measured > 0 ? measured : row.offsetHeight);
        }
        setLineRowHeights((prev) => {
            if (
                prev.length === heights.length
                && prev.every((h, idx) => Math.abs(h - heights[idx]) < 0.01)
            ) {
                return prev;
            }
            return heights;
        });
    };

    useLayoutEffect(() => {
        measureLineRowHeights();
    });

    useEffect(() => {
        const container = overlayRef.current;
        if (!container) return;
        const ro = new ResizeObserver(() => measureLineRowHeights());
        ro.observe(container);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        return () => {
            if (intelligenceShowTimerRef.current !== null) {
                window.clearTimeout(intelligenceShowTimerRef.current);
            }
            if (intelligenceHideTimerRef.current !== null) {
                window.clearTimeout(intelligenceHideTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setAISettingsBusy(true);
            try {
                const response = await GetAISettings() as AISettingsResponse;
                if (cancelled) {
                    return;
                }
                const loadedSettings = response.settings || defaultAISettingsState();
                setAISettings(loadedSettings);
                setAISettingsDraft(loadedSettings);
                setAISettingsActionFailed(false);
                setAISettingsApplyError('');
                setAIKeyStatus(response.keyStatus || defaultAIKeyStatusState());
                setAIContextMode((loadedSettings.defaultContextMode === 'full' ? 'full' : 'above'));
            } catch (error) {
                if (cancelled) {
                    return;
                }
                const message = error instanceof Error ? error.message : 'Unknown AI settings error';
                setStatusText(`AI settings load failed: ${message}`);
                setIsStatusError(true);
                setDevError(message);
            } finally {
                if (!cancelled) {
                    setAISettingsBusy(false);
                }
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        let cancelled = false;
        const refreshDraftKeyStatus = async () => {
            try {
                const status = await GetAIKeyStatusForSettings(aiSettingsDraft as any) as AIKeyStatusState;
                if (!cancelled) {
                    setAIKeyStatus(status || defaultAIKeyStatusState());
                }
            } catch {
                // Keep currently shown status when draft status lookup fails.
            }
        };

        void refreshDraftKeyStatus();
        return () => {
            cancelled = true;
        };
    }, [aiSettingsDraft.providerPreset, aiSettingsDraft.allowInsecureKeyFallback]);

    const aiSettingsHasUnsavedChanges = !areAISettingsEqual(aiSettingsDraft, aiSettings);

    const revertAISettingsDraftToSaved = () => {
        setAISettingsDraft(aiSettings);
        setAIContextMode((aiSettings.defaultContextMode === 'full' ? 'full' : 'above'));
        setAISettingsActionFailed(false);
        setAISettingsApplyError('');
        setStatusText('AI settings draft reverted to last saved state.');
        setIsStatusError(false);
        setDevError('');
    };

    const testAndSaveAISettings = async () => {
        if (!aiSettingsHasUnsavedChanges) {
            setStatusText('AI settings are already up to date.');
            setIsStatusError(false);
            setAISettingsApplyError('');
            setDevError('');
            return;
        }

        setAISettingsBusy(true);
        setAISettingsActionFailed(false);
        setAISettingsApplyError('');
        try {
            setStatusText('Testing AI settings...');
            setIsStatusError(false);
            setDevError('');

            const health = await RunAIQuery({
                prompt: 'Health check: respond with answerNumber 1.',
                contextMode: aiSettingsDraft.defaultContextMode,
                linesAbove: [],
                fullContent: '',
                settingsOverride: aiSettingsDraft,
            } as any) as AIRunResponse;

            if (!health.ok) {
                const message = health.error || 'AI settings test failed';
                setStatusText(`AI settings test failed. Changes were not saved: ${message}`);
                setIsStatusError(true);
                setDevError(message);
                setAISettingsActionFailed(true);
                setAISettingsApplyError(message);
                return;
            }

            const response = await SaveAISettings(aiSettingsDraft as any) as AISettingsResponse;
            const settingsError = response.keyStatus?.lastError || '';
            if (settingsError.startsWith('settings validation failed:') || settingsError.startsWith('settings save failed:')) {
                setAIKeyStatus(response.keyStatus || defaultAIKeyStatusState());
                setStatusText(`AI settings save failed. Changes were not saved: ${settingsError}`);
                setIsStatusError(true);
                setDevError(settingsError);
                setAISettingsActionFailed(true);
                setAISettingsApplyError(settingsError);
                return;
            }

            const savedSettings = response.settings || aiSettingsDraft;
            setAISettings(savedSettings);
            setAISettingsDraft(savedSettings);
            setAISettingsActionFailed(false);
            setAISettingsApplyError('');
            setAIKeyStatus(response.keyStatus || defaultAIKeyStatusState());
            setAIContextMode((savedSettings.defaultContextMode === 'full' ? 'full' : 'above'));
            setStatusText('AI settings test passed and settings were saved.');
            setIsStatusError(false);
            setDevError('');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown AI settings test error';
            setStatusText(`AI settings test failed. Changes were not saved: ${message}`);
            setIsStatusError(true);
            setDevError(message);
            setAISettingsActionFailed(true);
            setAISettingsApplyError(message);
        } finally {
            setAISettingsBusy(false);
        }
    };

    const saveAIKeyToBackend = async (apiKey: string) => {
        setAISettingsBusy(true);
        try {
            const keyStatus = await SetAIAPIKey(apiKey, aiSettingsDraft as any) as AIKeyStatusState;
            setAIKeyStatus(keyStatus || defaultAIKeyStatusState());
            if (keyStatus?.hasKey) {
                setAISettings((current) => {
                    if (current.providerPreset !== 'custom') {
                        return current;
                    }
                    return { ...current, customKeySourceEndpoint: current.endpoint };
                });
                setAISettingsDraft((current) => {
                    if (current.providerPreset !== 'custom') {
                        return current;
                    }
                    return { ...current, customKeySourceEndpoint: current.endpoint };
                });
                setStatusText(`API key saved (${keyStatus.storageMode})`);
                setIsStatusError(false);
                setDevError('');
            } else {
                setStatusText(`API key save failed: ${keyStatus?.lastError || 'unknown error'}`);
                setIsStatusError(true);
                setDevError(keyStatus?.lastError || 'AI key save failed');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown API key error';
            setStatusText(`API key save failed: ${message}`);
            setIsStatusError(true);
            setDevError(message);
        } finally {
            setAISettingsBusy(false);
        }
    };

    const clearAIKeyInBackend = async () => {
        setAISettingsBusy(true);
        try {
            const keyStatus = await ClearAIAPIKey(aiSettingsDraft as any) as AIKeyStatusState;
            setAIKeyStatus(keyStatus || defaultAIKeyStatusState());
            setAISettings((current) => ({ ...current, customKeySourceEndpoint: '' }));
            setAISettingsDraft((current) => ({ ...current, customKeySourceEndpoint: '' }));
            setStatusText('API key cleared');
            setIsStatusError(false);
            setDevError('');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown API key clear error';
            setStatusText(`API key clear failed: ${message}`);
            setIsStatusError(true);
            setDevError(message);
        } finally {
            setAISettingsBusy(false);
        }
    };

    // --- Hoisted actions (stable: only use setState callbacks or stable fns) ---

    const changeFontScale = (direction: 1 | -1) => {
        setFontScale((current) => {
            const next = current + direction * FONT_SCALE_STEP;
            return Number(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, next)).toFixed(2));
        });
    };

    const clearWorksheet = () => {
        setContent('');
        setLastResult(null);
        setStatusText('Ready');
        setIsStatusError(false);
        setDevError('');
        setMarkedLines(new Set());
        setVariableValues({});
        setVariableVersions({});
        setLineDependencies({});
        setLineDependencyVersions({});
        localStorage.removeItem(WORKSHEET_CONTENT_STORAGE_KEY);
        localStorage.removeItem(LAST_RESULT_STORAGE_KEY);

        requestAnimationFrame(() => {
            if (!editorRef.current) {
                return;
            }

            editorRef.current.focus();
            editorRef.current.selectionStart = 0;
            editorRef.current.selectionEnd = 0;
        });
    };

    const requestClearWorksheet = () => {
        setShowPrecisionMenu(false);
        setShowBurgerMenu(false);
        setShowClearWorksheetConfirm(true);
    };

    const cancelClearWorksheet = () => {
        setShowClearWorksheetConfirm(false);
    };

    const confirmClearWorksheet = () => {
        setShowClearWorksheetConfirm(false);
        clearWorksheet();
    };

    const toggleMarkLine = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const lineIndex = content.slice(0, editor.selectionStart).split('\n').length - 1;
        setMarkedLines((prev) => {
            const next = new Set(prev);
            if (next.has(lineIndex)) {
                next.delete(lineIndex);
            } else {
                next.add(lineIndex);
            }
            return next;
        });
    };

    const resetFontSize = () => {
        localStorage.removeItem(FONT_SCALE_STORAGE_KEY);
        setFontScale(DEFAULT_FONT_SCALE);
        setStatusText('Font size reset');
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

    const resetWindowLayout = () => {
        localStorage.removeItem(WINDOW_STATE_KEY);
        WindowSetSize(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT);
        WindowCenter();
        setStatusText('Window layout reset');
        setIsStatusError(false);
        setDevError('');
    };

    // --- Window state persistence ---

    useEffect(() => {
        const readStoredState = (): StoredWindowState | null => {
            const raw = localStorage.getItem(WINDOW_STATE_KEY);
            if (!raw) {
                return null;
            }

            try {
                const parsed: unknown = JSON.parse(raw);
                if (
                    typeof parsed === 'object' &&
                    parsed !== null &&
                    'w' in parsed &&
                    'h' in parsed &&
                    'x' in parsed &&
                    'y' in parsed &&
                    typeof (parsed as StoredWindowState).w === 'number' &&
                    typeof (parsed as StoredWindowState).h === 'number' &&
                    typeof (parsed as StoredWindowState).x === 'number' &&
                    typeof (parsed as StoredWindowState).y === 'number'
                ) {
                    const width = Math.round((parsed as StoredWindowState).w);
                    const height = Math.round((parsed as StoredWindowState).h);
                    const x = Math.round((parsed as StoredWindowState).x);
                    const y = Math.round((parsed as StoredWindowState).y);
                    if (width > 0 && height > 0) {
                        return {w: width, h: height, x, y};
                    }
                }
            } catch {
                // Ignore malformed saved data.
            }

            return null;
        };

        const restoreWindowState = async () => {
            const storedState = readStoredState();
            if (!storedState) {
                return;
            }

            try {
                const screens = await ScreenGetAll();
                const currentScreen = screens.find((screen) => screen.isCurrent)
                    ?? screens.find((screen) => screen.isPrimary)
                    ?? null;

                if (!currentScreen) {
                    WindowSetSize(storedState.w, storedState.h);
                    WindowSetPosition(storedState.x, storedState.y);
                    return;
                }

                const clampedWidth = Math.min(storedState.w, currentScreen.width);
                const clampedHeight = Math.min(storedState.h, currentScreen.height);
                const maxX = Math.max(0, currentScreen.width - clampedWidth);
                const maxY = Math.max(0, currentScreen.height - clampedHeight);
                const clampedX = Math.min(Math.max(storedState.x, 0), maxX);
                const clampedY = Math.min(Math.max(storedState.y, 0), maxY);

                WindowSetSize(clampedWidth, clampedHeight);
                WindowSetPosition(clampedX, clampedY);
            } catch {
                // Ignore restore failures to keep startup resilient.
            }
        };

        void restoreWindowState();

        let saveTimer: number | null = null;
        let periodicSaveTimer: number | null = null;

        const persistWindowState = async () => {
            try {
                const size = await WindowGetSize();
                const position = await WindowGetPosition();
                localStorage.setItem(
                    WINDOW_STATE_KEY,
                    JSON.stringify({w: size.w, h: size.h, x: position.x, y: position.y})
                );
            } catch {
                // Ignore persistence failures to keep editing uninterrupted.
            }
        };

        const schedulePersistWindowState = () => {
            if (saveTimer !== null) {
                window.clearTimeout(saveTimer);
            }

            saveTimer = window.setTimeout(() => {
                saveTimer = null;
                void persistWindowState();
            }, WINDOW_STATE_SAVE_DEBOUNCE_MS);
        };

        window.addEventListener('resize', schedulePersistWindowState);
        window.addEventListener('beforeunload', () => void persistWindowState());
        periodicSaveTimer = window.setInterval(() => {
            void persistWindowState();
        }, WINDOW_STATE_SAVE_INTERVAL_MS);

        return () => {
            window.removeEventListener('resize', schedulePersistWindowState);
            if (saveTimer !== null) {
                window.clearTimeout(saveTimer);
            }
            if (periodicSaveTimer !== null) {
                window.clearInterval(periodicSaveTimer);
            }
            void persistWindowState();
        };
    }, []);

    // --- Menu / keyboard event subscriptions ---

    useEffect(() => {
        const unsubThemeStore = EventsOn('theme-store:open', () => {
            setShowHelp(false);
            setShowSettings(true);
            setShowThemeStore(true);
            void expandWindowForThemeStore();
        });
        const unsubNew = EventsOn('menu:file:new', requestClearWorksheet);
        const unsubResetWindow = EventsOn('menu:view:reset-window-layout', resetWindowLayout);
        const unsubIncrease = EventsOn('menu:view:increase-font-size', () => changeFontScale(1));
        const unsubDecrease = EventsOn('menu:view:decrease-font-size', () => changeFontScale(-1));
        const unsubResetFont = EventsOn('menu:view:reset-font-size', resetFontSize);
        const unsubOpenHelp = EventsOn('menu:help:open', () => {
            setShowPrecisionMenu(false);
            setShowBurgerMenu(false);
            setShowThemeStore(false);
            setShowSettings(false);
            setShowHelp(true);
        });
        const unsubAIProgress = EventsOn('ai:progress', (payload: AIProgressEvent | string | null | undefined) => {
            if (typeof payload === 'string') {
                setAIProgressMessage(payload.trim());
                return;
            }
            const nextMessage = payload?.message?.trim() || '';
            setAIProgressMessage(nextMessage);
        });
        return () => {
            unsubThemeStore();
            unsubNew();
            unsubResetWindow();
            unsubIncrease();
            unsubDecrease();
            unsubResetFont();
            unsubOpenHelp();
            unsubAIProgress();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Editor helpers ---

    const setContentAndCaret = (nextContent: string, caretPos: number) => {
        setContent(nextContent);
        setCaretPos(caretPos);
        requestAnimationFrame(() => {
            if (!editorRef.current) {
                return;
            }
            editorRef.current.selectionStart = caretPos;
            editorRef.current.selectionEnd = caretPos;
        });
    };

    const getLineBounds = (text: string, pos: number) => {
        const lineStart = text.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
        const nextBreak = text.indexOf('\n', pos);
        const lineEnd = nextBreak === -1 ? text.length : nextBreak;
        return {lineStart, lineEnd};
    };

    const insertAtSelection = (insertText: string) => {
        const editor = editorRef.current;
        if (!editor) {
            return;
        }

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const nextContent = content.slice(0, start) + insertText + content.slice(end);
        const nextCaret = start + insertText.length;

        setContentAndCaret(nextContent, nextCaret);
    };

    const insertLineBelowCurrent = () => {
        const editor = editorRef.current;
        if (!editor) {
            return;
        }

        const {lineEnd} = getLineBounds(content, editor.selectionStart);
        const insertPos = lineEnd;
        const nextContent = content.slice(0, insertPos) + '\n' + content.slice(insertPos);
        const nextCaret = insertPos + 1;

        setContentAndCaret(nextContent, nextCaret);
    };

    const updateCaretPosFromEditor = () => {
        if (!editorRef.current) {
            return;
        }

        setCaretPos(editorRef.current.selectionStart);
    };

    const scheduleIntelligenceHintFromTyping = () => {
        if (intelligenceShowTimerRef.current !== null) {
            window.clearTimeout(intelligenceShowTimerRef.current);
            intelligenceShowTimerRef.current = null;
        }
        if (intelligenceHideTimerRef.current !== null) {
            window.clearTimeout(intelligenceHideTimerRef.current);
            intelligenceHideTimerRef.current = null;
        }

        setShowIntelligenceHint(false);

        intelligenceShowTimerRef.current = window.setTimeout(() => {
            setShowIntelligenceHint(true);
            intelligenceShowTimerRef.current = null;
        }, INTELLIGENCE_HINT_SHOW_DELAY_MS);

        intelligenceHideTimerRef.current = window.setTimeout(() => {
            setShowIntelligenceHint(false);
            intelligenceHideTimerRef.current = null;
        }, INTELLIGENCE_HINT_HIDE_IDLE_MS);
    };

    const countLineBreaks = (text: string) => {
        let count = 0;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') {
                count++;
            }
        }
        return count;
    };

    const getLineEditInfo = (beforeText: string, afterText: string) => {
        let start = 0;
        const maxStart = Math.min(beforeText.length, afterText.length);
        while (start < maxStart && beforeText[start] === afterText[start]) {
            start++;
        }

        let beforeEnd = beforeText.length;
        let afterEnd = afterText.length;
        while (
            beforeEnd > start &&
            afterEnd > start &&
            beforeText[beforeEnd - 1] === afterText[afterEnd - 1]
        ) {
            beforeEnd--;
            afterEnd--;
        }

        const beforeChanged = beforeText.slice(start, beforeEnd);
        const afterChanged = afterText.slice(start, afterEnd);
        const startLine = countLineBreaks(beforeText.slice(0, start));
        const beforeBreaks = countLineBreaks(beforeChanged);
        const afterBreaks = countLineBreaks(afterChanged);

        return {
            startLine,
            beforeBreaks,
            afterBreaks,
            delta: afterBreaks - beforeBreaks,
        };
    };

    const remapLineIndex = (lineIndex: number, edit: {startLine: number; beforeBreaks: number; afterBreaks: number; delta: number}) => {
        const editEndLineBefore = edit.startLine + edit.beforeBreaks;
        if (lineIndex < edit.startLine) {
            return lineIndex;
        }

        if (lineIndex > editEndLineBefore) {
            return lineIndex + edit.delta;
        }

        const relative = lineIndex - edit.startLine;
        if (relative <= edit.afterBreaks) {
            return edit.startLine + relative;
        }

        return null;
    };

    const remapMarkedLinesForEdit = (prevMarked: ReadonlySet<number>, beforeText: string, afterText: string) => {
        const edit = getLineEditInfo(beforeText, afterText);
        if (edit.delta === 0) {
            return prevMarked;
        }

        const next = new Set<number>();
        prevMarked.forEach((lineIndex) => {
            const remapped = remapLineIndex(lineIndex, edit);
            if (remapped !== null) {
                next.add(remapped);
            }
        });

        return next;
    };

    const remapLineRecordForEdit = <T,>(
        prevRecord: Record<number, T>,
        beforeText: string,
        afterText: string,
    ): Record<number, T> => {
        const edit = getLineEditInfo(beforeText, afterText);
        if (edit.delta === 0) {
            return prevRecord;
        }

        const nextRecord: Record<number, T> = {};
        Object.entries(prevRecord).forEach(([key, value]) => {
            const lineIndex = Number(key);
            if (!Number.isFinite(lineIndex)) {
                return;
            }

            const remapped = remapLineIndex(lineIndex, edit);
            if (remapped !== null) {
                nextRecord[remapped] = value;
            }
        });

        return nextRecord;
    };

    const lineIndexAtPosition = (text: string, position: number): number => {
        return countLineBreaks(text.slice(0, position));
    };

    const clearLineEvaluationMetadata = (lineIndex: number) => {
        setLineDependencies((prev) => {
            if (!(lineIndex in prev)) {
                return prev;
            }

            const next = {...prev};
            delete next[lineIndex];
            return next;
        });

        setLineDependencyVersions((prev) => {
            if (!(lineIndex in prev)) {
                return prev;
            }

            const next = {...prev};
            delete next[lineIndex];
            return next;
        });
    };

    const parseDeclaredVariable = (lineText: string): {key: string; label: string; expression: string} | null => {
        const match = lineText.match(/^\s*(@?[a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\s\S]+)$/);
        if (!match) {
            return null;
        }

        const label = match[1];
        const key = (label.startsWith('@') ? label.slice(1) : label).toLowerCase();

        return {
            key,
            label,
            expression: match[2].trim(),
        };
    };

    const appendLineComment = (base: string, comment: string): string => {
        if (!comment) {
            return base;
        }

        const trimmedBase = base.trimEnd();
        return trimmedBase.length > 0 ? `${trimmedBase} ${comment}` : comment;
    };

    const formatEvaluatedLine = (lineSource: string, resultText: string): string => {
        const {body, comment} = splitLineComment(lineSource);
        const bodySource = body.trimEnd();
        const declaration = parseDeclaredVariable(bodySource);
        const base = declaration
            ? `${declaration.label} = ${declaration.expression} = ${resultText}`
            : `${bodySource} = ${resultText}`;

        return appendLineComment(base, comment);
    };

    const areValuesEquivalent = (left: unknown, right: unknown): boolean => {
        if (Object.is(left, right)) {
            return true;
        }

        if (typeof left === 'object' && left !== null && typeof right === 'object' && right !== null) {
            try {
                return JSON.stringify(left) === JSON.stringify(right);
            } catch {
                return false;
            }
        }

        return false;
    };

    const formatExprValue = (value: unknown, isNumber: boolean, numberValue: number): string => {
        if (isNumber) {
            return formatNumber(numberValue, decimalDelimiter, precision, scientificNotation);
        }

        if (typeof value === 'string') {
            return value;
        }

        if (typeof value === 'number') {
            return formatNumber(value, decimalDelimiter, precision, scientificNotation);
        }

        if (typeof value === 'boolean' || value === null) {
            return String(value);
        }

        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    };

    const knownVariableNames = useMemo(() => {
        const names = new Set<string>();
        content.split('\n').forEach((line) => {
            const declaration = parseDeclaredVariable(getExpressionSource(line));
            if (declaration) {
                names.add(declaration.key);
            }
        });

        Object.keys(variableValues).forEach((name) => {
            names.add(name.toLowerCase());
        });

        return names;
    }, [content, variableValues]);

    const suggestionCatalog = useMemo<SuggestionItem[]>(() => {
        const items: SuggestionItem[] = [];

        [...knownVariableNames]
            .sort((a, b) => a.localeCompare(b))
            .forEach((name) => {
                items.push({label: name, kind: 'variable', matchText: name.toLowerCase()});
            });

        [...MATH_FUNCTION_NAMES]
            .map((name) => name.toLowerCase())
            .sort((a, b) => a.localeCompare(b))
            .forEach((name) => {
                items.push({label: name, kind: 'function', matchText: name});
            });

        [...MATH_CONSTANT_NAMES]
            .sort((a, b) => a.localeCompare(b))
            .forEach((name) => {
                items.push({label: name, kind: 'constant', matchText: name.toLowerCase()});
            });

        return items;
    }, [knownVariableNames]);

    const getIdentifierContext = (text: string, position: number): IdentifierContext | null => {
        const {lineStart, lineEnd} = getLineBounds(text, position);
        const lineText = text.slice(lineStart, lineEnd);
        const localPos = position - lineStart;

        let start = localPos;
        while (start > 0 && isIdentifierPartChar(lineText[start - 1])) {
            start--;
        }
        if (start > 0 && lineText[start - 1] === '@') {
            start--;
        }

        let end = localPos;
        while (end < lineText.length && isIdentifierPartChar(lineText[end])) {
            end++;
        }

        const token = lineText.slice(start, end);
        if (!token) {
            return null;
        }

        const wantsAtPrefix = token.startsWith('@');
        const baseToken = wantsAtPrefix ? token.slice(1) : token;
        if (!baseToken || !isIdentifierStartChar(baseToken[0])) {
            return null;
        }

        return {
            start: lineStart + start,
            end: lineStart + end,
            token,
            baseToken,
            wantsAtPrefix,
            lineStart,
            startInLine: start,
        };
    };

    const identifierContext = useMemo(() => getIdentifierContext(content, caretPos), [content, caretPos]);

    const intelligenceSuggestions = useMemo(() => {
        if (!identifierContext) {
            return [] as SuggestionItem[];
        }

        const query = identifierContext.baseToken.toLowerCase();
        if (query.length === 0) {
            return [] as SuggestionItem[];
        }

        const kindWeight: Record<SuggestionKind, number> = {
            variable: 0,
            function: 1,
            constant: 2,
        };

        return suggestionCatalog
            .filter((item) => {
                if (identifierContext.wantsAtPrefix && item.kind !== 'variable') {
                    return false;
                }
                return item.matchText.startsWith(query) && item.matchText !== query;
            })
            .sort((a, b) => {
                const kindDiff = kindWeight[a.kind] - kindWeight[b.kind];
                if (kindDiff !== 0) {
                    return kindDiff;
                }
                return a.label.localeCompare(b.label);
            })
            .slice(0, 5);
    }, [identifierContext, suggestionCatalog]);

    const acceptSuggestion = (suggestion: SuggestionItem) => {
        if (!editorRef.current || !identifierContext) {
            return;
        }

        const nextChar = content[identifierContext.end] ?? '';
        const replacementBase = suggestion.kind === 'constant'
            ? suggestion.label
            : suggestion.label.toLowerCase();
        const replacementCore = identifierContext.wantsAtPrefix && suggestion.kind === 'variable'
            ? `@${replacementBase}`
            : replacementBase;
        const replacement = suggestion.kind === 'function' && nextChar !== '('
            ? `${replacementCore}(`
            : replacementCore;

        const nextContent = content.slice(0, identifierContext.start)
            + replacement
            + content.slice(identifierContext.end);
        const nextCaret = identifierContext.start + replacement.length;

        setContentAndCaret(nextContent, nextCaret);
        setStatusText(`${suggestion.kind}: ${replacementBase}`);
        setIsStatusError(false);
        setDevError('');
        setShowIntelligenceHint(false);
    };

    const renderSyntaxText = (text: string, keyPrefix: string) => {
        type TokenKind =
            | 'plain'
            | 'variable-decl'
            | 'variable'
            | 'function'
            | 'operator'
            | 'number'
            | 'constant'
            | 'punctuation'
            | 'comment';

        const chunks: Array<{text: string; kind: TokenKind}> = [];
        const pushChunk = (part: string, kind: TokenKind) => {
            if (part.length > 0) {
                chunks.push({text: part, kind});
            }
        };

        let i = 0;
        const declMatch = text.match(/^(\s*)(@?[a-zA-Z_][a-zA-Z0-9_]*)(\s*=.*)$/);
        if (declMatch) {
            pushChunk(declMatch[1], 'plain');
            pushChunk(declMatch[2], 'variable-decl');
            i = declMatch[1].length + declMatch[2].length;
        }

        while (i < text.length) {
            const current = text[i];

            if (current === '"') {
                pushChunk(text.slice(i), 'comment');
                break;
            }

            if (/\s/.test(current)) {
                const start = i;
                while (i < text.length && /\s/.test(text[i])) i++;
                pushChunk(text.slice(start, i), 'plain');
                continue;
            }

            if (current === '@' && i + 1 < text.length && /[a-zA-Z_]/.test(text[i + 1])) {
                const start = i;
                i += 2;
                while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) i++;
                pushChunk(text.slice(start, i), 'variable');
                continue;
            }

            if (/[a-zA-Z_]/.test(current)) {
                const start = i;
                i++;
                while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) i++;
                const identifier = text.slice(start, i);
                const upper = identifier.toUpperCase();
                const lower = identifier.toLowerCase();

                let j = i;
                while (j < text.length && /\s/.test(text[j])) j++;
                const nextChar = text[j];

                if (MATH_FUNCTION_NAMES.has(upper) && nextChar === '(') {
                    pushChunk(identifier, 'function');
                } else if (MATH_CONSTANT_NAMES.has(upper)) {
                    pushChunk(identifier, 'constant');
                } else if (knownVariableNames.has(lower) || upper.length === 1) {
                    pushChunk(identifier, 'variable');
                } else {
                    pushChunk(identifier, 'plain');
                }
                continue;
            }

            const numberMatch = text.slice(i).match(/^(\d+(?:[\.,]\d+)?(?:[eE][+\-]?\d+)?)/);
            if (numberMatch) {
                pushChunk(numberMatch[1], 'number');
                i += numberMatch[1].length;
                continue;
            }

            if ('+-*/='.includes(current)) {
                pushChunk(current, 'operator');
                i++;
                continue;
            }

            if ('(),;'.includes(current)) {
                pushChunk(current, 'punctuation');
                i++;
                continue;
            }

            pushChunk(current, 'plain');
            i++;
        }

        return chunks.map((chunk, idx) => {
            if (chunk.kind === 'plain') {
                return <span key={`${keyPrefix}-${idx}`}>{chunk.text}</span>;
            }

            return (
                <span key={`${keyPrefix}-${idx}`} className={`syntax-token syntax-token--${chunk.kind}`}>
                    {chunk.text}
                </span>
            );
        });
    };

    const evaluateCurrentLine = async () => {
        const editor = editorRef.current;
        if (!editor) {
            return;
        }

        const caretPos = editor.selectionStart;
        const bounds = getLineBounds(content, caretPos);
        const lineStart = bounds.lineStart;
        const lineEnd = bounds.lineEnd;
        const lineText = content.slice(lineStart, lineEnd);
        const editableLine = getExpressionSource(lineText);

        const lineIndex = lineIndexAtPosition(content, lineStart);
        const caretOffsetInLine = Math.min(Math.max(caretPos - lineStart, 0), lineText.length);

        if (shouldSkipEvaluationAtCaret(lineText, caretOffsetInLine)) {
            setStatusText('Ready');
            setIsStatusError(false);
            setDevError('');
            if (lineEnd === content.length) {
                const nextContent = content + '\n';
                const nextCaret = nextContent.length;
                setContentAndCaret(nextContent, nextCaret);
                return;
            }
            const nextLineStart = lineEnd < content.length ? lineEnd + 1 : lineEnd;
            if (nextLineStart !== caretPos) {
                setCaretPos(nextLineStart);
                requestAnimationFrame(() => {
                    if (!editorRef.current) {
                        return;
                    }
                    editorRef.current.selectionStart = nextLineStart;
                    editorRef.current.selectionEnd = nextLineStart;
                });
            }
            return;
        }

        if (isAITriggerLine(editableLine)) {
            const prompt = getAITriggerPrompt(editableLine);
            if (!prompt) {
                insertAtSelection('\n');
                setStatusText('AI prompt is empty. Add text after ? and press Enter.');
                setIsStatusError(true);
                setDevError('AI prompt is empty');
                return;
            }

            if (isAIQueryPending) {
                setStatusText('AI request already in progress...');
                setIsStatusError(false);
                setDevError('');
                return;
            }

            let aiStart = 0;
            try {
                const lines = content.split('\n');
                const linesAbove = lines.slice(0, lineIndex).map((line) => getExpressionSource(line));
                aiStart = Date.now();
                setAIPendingLineIndex(lineIndex);
                setIsAIQueryPending(true);
                setAIProgressMessage('preparing request');
                setStatusText('AI request sent... waiting for response');
                setIsStatusError(false);
                setDevError('');
                const aiResult = await RunAIQuery({
                    prompt,
                    contextMode: aiContextMode,
                    linesAbove,
                    fullContent: content,
                    settingsOverride: aiSettings,
                } as any) as AIRunResponse;

                if (!aiResult.ok) {
                    const errorMessage = aiResult.error || 'AI request failed';
                    setLastResult(null);
                    clearLineEvaluationMetadata(lineIndex);
                    setIsStatusError(true);
                    setStatusText(`AI mode failed: ${errorMessage}`);
                    setDevError(errorMessage);

                    setAIDebugLog((prev) => {
                        const id = ++aiDebugIdRef.current;
                        const entry: AIDebugEntry = {
                            id,
                            timestamp: new Date(),
                            prompt,
                            model: aiResult.preview?.modelId ?? '',
                            endpoint: aiResult.preview?.endpoint ?? '',
                            systemPrompt: aiResult.preview?.systemPrompt || '',
                            userPrompt: aiResult.preview?.userPrompt || '',
                            contextMode: aiResult.preview?.contextMode || aiContextMode,
                            contextLineCount: aiResult.preview?.contextLineCount ?? linesAbove.length,
                            status: 'error',
                            error: errorMessage,
                            durationMs: Date.now() - aiStart,
                            raw: {
                                frontendRequest: {
                                    prompt,
                                    contextMode: aiContextMode,
                                    linesAbove,
                                    fullContent: content,
                                },
                                backendPreview: aiResult.preview,
                                backendResponse: aiResult,
                            },
                        };
                        return [...prev, entry];
                    });
                    return;
                }

                const output = aiResult.output || {};
                const insertionLines: string[] = [];
                const answerNumber = output.answerNumber;
                const hasNumericAnswer = typeof answerNumber === 'number' && Number.isFinite(answerNumber);
                const normalizedComment = (output.comment || '').trim();
                if (hasNumericAnswer) {
                    let answerLine = `ai0 = ${formatNumber(answerNumber, decimalDelimiter, precision, scientificNotation)}`;
                    if (normalizedComment.length > 0) {
                        answerLine = `${answerLine} " ${normalizedComment}`;
                    }
                    insertionLines.push(answerLine);
                } else {
                    const normalizedAnswer = (output.answer || '').trim();
                    if (normalizedAnswer.length > 0) {
                        insertionLines.push(`" ${normalizedAnswer}`);
                    }
                    if (normalizedComment.length > 0) {
                        insertionLines.push(`" ${normalizedComment}`);
                    }
                }

                const normalizedCode = stripMarkdownCodeFences(output.code || '');
                const codeLines = normalizedCode.length > 0
                    ? normalizedCode.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.length > 0)
                    : [];
                if (codeLines.length > 0) {
                    insertionLines.push(...codeLines);
                }

                const before = content.slice(0, lineEnd);
                const after = content.slice(lineEnd);
                const insertionBlock = `\n${insertionLines.join('\n')}`;
                const nextContent = before + insertionBlock + after + (lineEnd === content.length ? '\n' : '');
                const nextCaret = before.length + insertionBlock.length;

                setContentAndCaret(nextContent, nextCaret);
                clearLineEvaluationMetadata(lineIndex);
                setLastResult(null);
                setStatusText('AI response inserted');
                setIsStatusError(false);
                setDevError('');

                setAIDebugLog((prev) => {
                    const id = ++aiDebugIdRef.current;
                    const entry: AIDebugEntry = {
                        id,
                        timestamp: new Date(),
                        prompt,
                        model: aiResult.preview.modelId ?? '',
                        endpoint: aiResult.preview.endpoint ?? '',
                        systemPrompt: aiResult.preview.systemPrompt,
                        userPrompt: aiResult.preview.userPrompt,
                        contextMode: aiResult.preview.contextMode,
                        contextLineCount: aiResult.preview.contextLineCount,
                        status: 'ok',
                        output: aiResult.output,
                        durationMs: Date.now() - aiStart,
                        raw: {
                            frontendRequest: {
                                prompt,
                                contextMode: aiContextMode,
                                linesAbove,
                                fullContent: content,
                            },
                            backendPreview: aiResult.preview,
                            backendResponse: aiResult,
                        },
                    };
                    return [...prev, entry];
                });

                if (codeLines.length > 0) {
                    const contentForReeval = nextContent;
                    requestAnimationFrame(() => {
                        void reevaluateAllExpressions(contentForReeval);
                    });
                }
            } catch (error) {
                setLastResult(null);
                clearLineEvaluationMetadata(lineIndex);
                setIsStatusError(true);
                const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
                setStatusText(`AI mode failed: ${errorMessage}`);
                setDevError(errorMessage);

                setAIDebugLog((prev) => {
                    const id = ++aiDebugIdRef.current;
                    const entry: AIDebugEntry = {
                        id,
                        timestamp: new Date(),
                        prompt,
                        model: '',
                        endpoint: '',
                        systemPrompt: '',
                        userPrompt: '',
                        contextMode: aiContextMode,
                        contextLineCount: 0,
                        status: 'error',
                        error: errorMessage,
                        durationMs: Date.now() - aiStart,
                        raw: {
                            frontendRequest: {
                                prompt,
                                contextMode: aiContextMode,
                                fullContent: content,
                            },
                            thrownError: error,
                        },
                    };
                    return [...prev, entry];
                });
            } finally {
                setIsAIQueryPending(false);
                setAIPendingLineIndex(null);
                setAIProgressMessage('');
            }
            return;
        }

        const trimmed = editableLine.trim();

        const declaration = parseDeclaredVariable(splitLineComment(editableLine).body.trimEnd());
        const expression = buildEvaluationExpression(
            editableLine,
            trimmed,
            lastResult,
            decimalDelimiter,
            (value, delimiter) => formatNumber(value, delimiter, 'auto', false),
        );

        try {
            const evalResult = await EvaluateExprProgram(expression, variableValues as Record<string, any>);
            if (!evalResult.ok) {
                throw new Error(evalResult.error || 'Evaluation failed');
            }

            const numberValue = evalResult.numberValue ?? 0;
            const formatted = formatExprValue(evalResult.value, evalResult.isNumber, numberValue);
            const replacement = formatEvaluatedLine(editableLine, formatted);
            const before = content.slice(0, lineStart);
            const after = content.slice(lineEnd);
            const nextContent = before + replacement + after + (lineEnd === content.length ? '\n' : '');
            const nextCaret = lineEnd === content.length
                ? (before + replacement + '\n').length
                : before.length + replacement.length + 1;

            setContentAndCaret(nextContent, nextCaret);
            setLastResult(evalResult.isNumber ? numberValue : null);
            const nextVariables = (evalResult.variables || {}) as Record<string, unknown>;

            const changedVariableKeys = new Set<string>();
            const previousVariableKeys = new Set(Object.keys(variableValues));
            const nextVariableKeys = new Set(Object.keys(nextVariables));
            const allVariableKeys = new Set<string>([...previousVariableKeys, ...nextVariableKeys]);
            allVariableKeys.forEach((key) => {
                const normalizedKey = key.toLowerCase();
                const previousValue = variableValues[normalizedKey];
                const nextValue = nextVariables[normalizedKey];
                if (!areValuesEquivalent(previousValue, nextValue)) {
                    changedVariableKeys.add(normalizedKey);
                }
            });

            const nextVariableVersions = {...variableVersions};
            changedVariableKeys.forEach((key) => {
                nextVariableVersions[key] = (nextVariableVersions[key] ?? 0) + 1;
            });

            const dependencies = extractExpressionDependencies(editableLine);
            const dependencySnapshot: Record<string, number> = {};
            dependencies.forEach((name) => {
                dependencySnapshot[name] = nextVariableVersions[name] ?? 0;
            });

            setVariableValues(nextVariables);
            setVariableVersions(nextVariableVersions);
            setLineDependencies((prev) => ({
                ...prev,
                [lineIndex]: dependencies,
            }));
            setLineDependencyVersions((prev) => ({
                ...prev,
                [lineIndex]: dependencySnapshot,
            }));
            setStatusText('Calculated');
            setIsStatusError(false);
            setDevError('');
        } catch (error) {
            const replacement = formatEvaluatedLine(editableLine, 'error');
            const before = content.slice(0, lineStart);
            const after = content.slice(lineEnd);
            const nextContent = before + replacement + after;
            const nextCaret = before.length + getPreservedCaretOffset(caretOffsetInLine, replacement.length);
            setContentAndCaret(nextContent, nextCaret);
            setLastResult(null);
            clearLineEvaluationMetadata(lineIndex);
            setIsStatusError(true);

            const errorMessage = error instanceof Error ? error.message : 'Unknown evaluation error';
            setStatusText(getFriendlyEvalErrorMessage(errorMessage));
            setDevError(errorMessage);
        }
    };

    const reevaluateAllExpressions = async (contentOverride?: string) => {
        if (isReevaluatingAll) {
            return;
        }

        setIsReevaluatingAll(true);
        try {
            const sourceLines = (contentOverride ?? content).split('\n');
            const nextLines = [...sourceLines];
            let workingVariables: Record<string, unknown> = {};
            let workingVariableVersions: Record<string, number> = {};
            const nextLineDependencies: Record<number, string[]> = {};
            const nextLineDependencyVersions: Record<number, Record<string, number>> = {};
            let nextLastResult: number | null = null;
            let calculatedCount = 0;
            let failedCount = 0;

            for (let i = 0; i < sourceLines.length; i++) {
                const originalLine = sourceLines[i];
                const editableLine = getExpressionSource(originalLine);
                if (shouldSkipEvaluation(editableLine)) {
                    continue;
                }

                if (isAITriggerSourceLine(editableLine)) {
                    continue;
                }

                const declaration = parseDeclaredVariable(splitLineComment(editableLine).body.trimEnd());
                try {
                    const evalResult = await EvaluateExprProgram(editableLine, workingVariables as Record<string, any>);
                    if (!evalResult.ok) {
                        throw new Error(evalResult.error || 'Evaluation failed');
                    }

                    const numberValue = evalResult.numberValue ?? 0;
                    const formatted = formatExprValue(evalResult.value, evalResult.isNumber, numberValue);
                    nextLines[i] = formatEvaluatedLine(editableLine, formatted);

                    const nextVariables = (evalResult.variables || {}) as Record<string, unknown>;
                    const changedVariableKeys = new Set<string>();
                    const allVariableKeys = new Set<string>([
                        ...Object.keys(workingVariables),
                        ...Object.keys(nextVariables),
                    ]);
                    allVariableKeys.forEach((key) => {
                        const normalizedKey = key.toLowerCase();
                        const previousValue = workingVariables[normalizedKey];
                        const nextValue = nextVariables[normalizedKey];
                        if (!areValuesEquivalent(previousValue, nextValue)) {
                            changedVariableKeys.add(normalizedKey);
                        }
                    });

                    changedVariableKeys.forEach((key) => {
                        workingVariableVersions[key] = (workingVariableVersions[key] ?? 0) + 1;
                    });

                    const dependencies = extractExpressionDependencies(editableLine);
                    const dependencySnapshot: Record<string, number> = {};
                    dependencies.forEach((name) => {
                        dependencySnapshot[name] = workingVariableVersions[name] ?? 0;
                    });

                    nextLineDependencies[i] = dependencies;
                    nextLineDependencyVersions[i] = dependencySnapshot;
                    workingVariables = nextVariables;
                    nextLastResult = evalResult.isNumber ? numberValue : null;
                    calculatedCount++;
                } catch {
                    nextLines[i] = formatEvaluatedLine(editableLine, 'error');
                    failedCount++;
                    nextLastResult = null;
                }
            }

            const nextContent = nextLines.join('\n');
            setContent(nextContent);
            setVariableValues(workingVariables);
            setVariableVersions(workingVariableVersions);
            setLineDependencies(nextLineDependencies);
            setLineDependencyVersions(nextLineDependencyVersions);
            setLastResult(nextLastResult);
            setIsStatusError(failedCount > 0);
            setDevError('');
            setStatusText(
                failedCount > 0
                    ? `Re-evaluated ${calculatedCount} line${calculatedCount === 1 ? '' : 's'}, ${failedCount} failed`
                    : `Re-evaluated ${calculatedCount} line${calculatedCount === 1 ? '' : 's'}`
            );

            requestAnimationFrame(() => {
                if (!editorRef.current) {
                    return;
                }

                const nextCaret = Math.min(editorRef.current.selectionStart, nextContent.length);
                editorRef.current.selectionStart = nextCaret;
                editorRef.current.selectionEnd = nextCaret;
                setCaretPos(nextCaret);
            });
        } finally {
            setIsReevaluatingAll(false);
        }
    };

    const clearStaleStates = () => {
        setLineDependencies({});
        setLineDependencyVersions({});
        setStatusText('Cleared stale markers');
        setIsStatusError(false);
        setDevError('');
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
            const now = Date.now();
            const elapsed = now - lastEscapeKeyAtRef.current;
            lastEscapeKeyAtRef.current = now;
            if (elapsed <= DOUBLE_ESCAPE_HIDE_WINDOW_MS) {
                event.preventDefault();
                WindowHide();
            }
            return;
        }

        const shortcutAction = getPrimaryShortcutAction(event);
        if (shortcutAction === 'insert-line-below') {
            event.preventDefault();
            insertLineBelowCurrent();
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            void evaluateCurrentLine();
            setShowIntelligenceHint(false);
            return;
        }

        if (event.key === 'Tab' && intelligenceSuggestions.length > 0 && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            acceptSuggestion(intelligenceSuggestions[0]);
            return;
        }

        if (shortcutAction === 'toggle-mark-line') {
            event.preventDefault();
            toggleMarkLine();
            return;
        }

        if (shortcutAction === 'toggle-word-wrap') {
            event.preventDefault();
            setWordWrap((prev) => !prev);
            return;
        }

        if (shortcutAction === 'increase-font-size') {
            event.preventDefault();
            changeFontScale(1);
            return;
        }

        if (shortcutAction === 'decrease-font-size') {
            event.preventDefault();
            changeFontScale(-1);
            return;
        }

        if (shortcutAction === 'reset-font-size') {
            event.preventDefault();
            resetFontSize();
            return;
        }

        const BRACKET_PAIRS: Record<string, string> = {'(': ')', '[': ']', '{': '}'};
        if (BRACKET_PAIRS[event.key] && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const editor = editorRef.current;
            if (editor && editor.selectionStart !== editor.selectionEnd) {
                event.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                const selected = content.slice(start, end);
                const close = BRACKET_PAIRS[event.key];
                const nextContent = content.slice(0, start) + event.key + selected + close + content.slice(end);
                setContent(nextContent);
                setCaretPos(end + 2);
                requestAnimationFrame(() => {
                    if (!editorRef.current) return;
                    editorRef.current.selectionStart = start + 1;
                    editorRef.current.selectionEnd = end + 1;
                });
                return;
            }
        }

        if (!OPERATOR_KEY_RE.test(event.key) || event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        const editor = editorRef.current;
        if (!editor || lastResult === null) {
            return;
        }

        if (editor.selectionStart !== editor.selectionEnd) {
            return;
        }

        const {lineStart, lineEnd} = getLineBounds(content, editor.selectionStart);
        const lineText = content.slice(lineStart, lineEnd);
        if (lineText.trim().length !== 0) {
            return;
        }

        event.preventDefault();
        insertAtSelection(`${formatNumber(lastResult, decimalDelimiter, 'auto', false)}${event.key}`);
    };

    const onEditorWheel = (event: ReactWheelEvent<HTMLTextAreaElement>) => {
        const direction = getFontResizeDirectionFromWheel(event);
        if (direction === null) {
            return;
        }

        event.preventDefault();
        changeFontScale(direction);
    };

    const {lines: contentLines, lineErrors, truncatedZeroLines, truncatedLines, declarationLines, aiTriggerLines} = useMemo(() => {
        const nextLineErrors = new Map<number, string>();
        const nextTruncatedZeroLines = new Map<number, number>();
        const nextTruncatedLines = new Map<number, number>(); // significant truncation, non-zero
        const nextDeclarationLines = new Set<number>();
        const nextAITriggerLines = new Set<number>();
        const lines = content.split('\n');
        let insideMultilineCodeBlock = false;

        lines.forEach((line, i) => {
            const tickCount = line.match(/`/g)?.length ?? 0;
            const source = getExpressionSource(line);
            const declaration = parseDeclaredVariable(source);
            if (declaration) {
                nextDeclarationLines.add(i);
            }

            if (isAITriggerSourceLine(source)) {
                nextAITriggerLines.add(i);
            }

            if (insideMultilineCodeBlock || tickCount % 2 === 1) {
                if (tickCount % 2 === 1) {
                    insideMultilineCodeBlock = !insideMultilineCodeBlock;
                }
                return;
            }

            const {body} = splitLineComment(line);
            if (body.trimEnd().endsWith(' = error')) {
                nextLineErrors.set(i, 'error');
            }
        });

        return {
            lines,
            lineErrors: nextLineErrors,
            truncatedZeroLines: nextTruncatedZeroLines,
            truncatedLines: nextTruncatedLines,
            declarationLines: nextDeclarationLines,
            aiTriggerLines: nextAITriggerLines,
        };
    }, [content]);

    const staleLineDetails = useMemo(() => {
        return buildStaleLineDetails(lineDependencyVersions, variableVersions);
    }, [lineDependencyVersions, variableVersions]);

    const renderOverlayLines = () => {
        return contentLines.map((line, i) => {
            const isPendingAILine = isAIQueryPending && aiPendingLineIndex === i;
            const lineClassName = `editor-line-row${lineErrors.has(i) ? ' line-error' : ''}${!lineErrors.has(i) && staleLineDetails.has(i) ? ' line-stale' : ''}${aiTriggerLines.has(i) ? ' line-ai' : ''}${isPendingAILine ? ' line-ai-waiting' : ''}`;
            const isVariableLine = declarationLines.has(i);
            const isMarkedLine = markedLines.has(i);

            const {body: lineBody, comment: lineComment} = splitLineComment(line);
            const eqIdx = isVariableLine ? lineBody.lastIndexOf(' = ') : lineBody.indexOf(' = ');
            if (eqIdx === -1) {
                return (
                    <div key={i} className={lineClassName}>
                        {renderSyntaxText(line, `${i}-full`)}
                    </div>
                );
            }

            if (!isMarkedLine && !isVariableLine) {
                return (
                    <div key={i} className={lineClassName}>
                        {renderSyntaxText(line, `${i}-line`)}
                    </div>
                );
            }

            const resultClass = isVariableLine
                ? 'marked-result marked-result--var'
                : 'marked-result';

            return (
                <div key={i} className={lineClassName}>
                    {renderSyntaxText(lineBody.slice(0, eqIdx), `${i}-lhs`)}
                    <span className={resultClass}>{lineBody.slice(eqIdx)}</span>
                    {lineComment && renderSyntaxText(lineComment, `${i}-cmt`)}
                </div>
            );
        });
    };

    const activeLineIndex = content.slice(0, caretPos).split('\n').length - 1;
    const activeLineError = lineErrors.get(activeLineIndex) ?? '';
    const activeLineText = contentLines[activeLineIndex] ?? '';
    const measureLineWidth = (text: string): number => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return 0;
            ctx.font = editorFontSpec;
            return ctx.measureText(text).width;
        } catch {
            return 0;
        }
    };
    const EDITOR_PADDING = 20;
    const getLineTop = (idx: number): number => {
        if (lineRowHeights.length > 0) {
            let top = 0;
            for (let j = 0; j < idx && j < lineRowHeights.length; j++) top += lineRowHeights[j];
            return top;
        }
        return idx * lineHeightPx;
    };
    const activeLineH = lineRowHeights[activeLineIndex] ?? lineHeightPx;
    const activeLineErrorTop = EDITOR_TOP_PADDING_PX + getLineTop(activeLineIndex) - editorScrollTop + activeLineH * 0.9;
    const activeLineErrorLeft = Math.max(EDITOR_PADDING, EDITOR_PADDING + measureLineWidth(activeLineText) + 8 - editorScrollLeft);
    const pendingAILineHeight = aiPendingLineIndex !== null ? (lineRowHeights[aiPendingLineIndex] ?? lineHeightPx) : lineHeightPx;
    const aiProgressTop = aiPendingLineIndex !== null
        ? EDITOR_TOP_PADDING_PX + getLineTop(aiPendingLineIndex) - editorScrollTop + pendingAILineHeight + 4
        : 0;
    const intelligenceTop = identifierContext
        ? EDITOR_TOP_PADDING_PX + getLineTop(activeLineIndex) - editorScrollTop + activeLineH * 2.2
        : 0;
    const intelligenceLeft = identifierContext
        ? Math.max(EDITOR_PADDING, EDITOR_PADDING + measureLineWidth(activeLineText.slice(0, identifierContext.startInLine)) - editorScrollLeft)
        : 0;

    const startThemePreview = (candidate: SavedThemeEntry) => {
        if (!previewRestoreThemeRef.current) {
            previewRestoreThemeRef.current = theme;
        }

        setTheme({
            type: 'custom',
            customColors: candidate.colors,
            customId: candidate.id,
            customThemeBase: candidate.themeBase,
        });
        setPendingThemePreview(candidate);
    };

    const cancelThemePreview = () => {
        if (previewRestoreThemeRef.current) {
            setTheme(previewRestoreThemeRef.current);
            previewRestoreThemeRef.current = null;
        }
        setPendingThemePreview(null);
    };

    const acceptThemePreview = (candidate: SavedThemeEntry) => {
        setSavedThemes((prev) => {
            const withoutDup = prev.filter((entry) => entry.id !== candidate.id);
            return [candidate, ...withoutDup];
        });

        setTheme({
            type: 'custom',
            customColors: candidate.colors,
            customId: candidate.id,
            customThemeBase: candidate.themeBase,
        });

        previewRestoreThemeRef.current = null;
        setPendingThemePreview(null);
    };

    const deleteSavedTheme = (themeId: string) => {
        setSavedThemes((prev) => prev.filter((entry) => entry.id !== themeId));
    };

    const expandWindowForThemeStore = async () => {
        try {
            const current = await WindowGetSize();
            if (!themeStoreOriginalSizeRef.current) {
                themeStoreOriginalSizeRef.current = { w: current.w, h: current.h };
            }

            const targetWidth = Math.min(1800, Math.max(1360, current.w + 260));
            if (targetWidth !== current.w) {
                WindowSetSize(targetWidth, current.h);
            }
        } catch {
            // Keep UI functional even if window APIs fail.
        }
    };

    const expandWindowForSettingsDrawer = async () => {
        try {
            const current = await WindowGetSize();
            const requiredWidth = Math.min(
                1800,
                Math.max(SETTINGS_DRAWER_MIN_WINDOW_WIDTH, settingsDrawerWidth + SETTINGS_DRAWER_MIN_EDITOR_WIDTH),
            );
            if (current.w >= requiredWidth) {
                return;
            }

            if (!settingsDrawerOriginalSizeRef.current) {
                settingsDrawerOriginalSizeRef.current = { w: current.w, h: current.h };
            }

            WindowSetSize(requiredWidth, current.h);
        } catch {
            // Keep UI functional even if window APIs fail.
        }
    };

    const restoreWindowAfterThemeStore = async () => {
        const original = themeStoreOriginalSizeRef.current;
        if (!original) {
            return;
        }

        themeStoreOriginalSizeRef.current = null;
        try {
            WindowSetSize(original.w, original.h);
        } catch {
            // Ignore restore failures.
        }
    };

    const restoreWindowAfterSettingsDrawer = async () => {
        const original = settingsDrawerOriginalSizeRef.current;
        if (!original) {
            return;
        }

        settingsDrawerOriginalSizeRef.current = null;
        try {
            WindowSetSize(original.w, original.h);
        } catch {
            // Ignore restore failures.
        }
    };

    useEffect(() => {
        if (showSettings && !showThemeStore) {
            void expandWindowForSettingsDrawer();
            return;
        }

        void restoreWindowAfterSettingsDrawer();
    }, [showSettings, showThemeStore]); // eslint-disable-line react-hooks/exhaustive-deps

    const startSettingsDrawerResize = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.button !== 0 || showThemeStore) {
            return;
        }

        event.preventDefault();
        settingsDrawerResizeStartRef.current = {
            x: event.clientX,
            width: settingsDrawerWidth,
        };
        setIsResizingSettingsDrawer(true);
    };

    const openThemeStoreInSidebar = () => {
        void restoreWindowAfterSettingsDrawer();
        setShowThemeStore(true);
        void expandWindowForThemeStore();
    };

    const openHelpPanel = () => {
        setShowPrecisionMenu(false);
        setShowBurgerMenu(false);
        setShowThemeStore(false);
        setShowSettings(false);
        setShowHelp(true);
    };

    const closeThemeStoreInSidebar = () => {
        if (pendingThemePreview) {
            cancelThemePreview();
        }
        setShowThemeStore(false);
        void restoreWindowAfterThemeStore();
    };

    const runBurgerAction = (action: () => void) => {
        setShowBurgerMenu(false);
        action();
    };

    const helpDockClass = !showHelp
        ? ''
        : helpPanelPosition === 'left'
            ? ' window--help-left'
            : helpPanelPosition === 'bottom'
                ? ' window--help-bottom'
                : ' window--help-right';
    const windowStyle = {
        '--window-logo-image': `url(${isDarkTheme ? appLogoDark : appLogo})`,
        '--logo-layer-opacity': isContentEmpty ? '1' : (isDarkTheme ? '0.02' : '0.025'),
    } as CSSProperties;

    return (
        <div id="app" className={`window${helpDockClass}`} style={windowStyle}>
            <div className="editor-container">
                <div className="gutter" ref={gutterRef}>
                    <div className="gutter-lines" style={{paddingTop: EDITOR_TOP_PADDING_PX, paddingBottom: EDITOR_BOTTOM_PADDING_PX}}>
                        {contentLines.map((_, i) => (
                            <div
                                key={i}
                                className={`gutter-line${(lineRowHeights[i] ?? lineHeightPx) > lineHeightPx + 1 ? ' gutter-line--wrapped' : ''}${markedLines.has(i) ? ' gutter-line--marked' : ''}${lineErrors.has(i) ? ' gutter-line--error' : ''}${!lineErrors.has(i) && (truncatedZeroLines.has(i) || truncatedLines.has(i)) ? ' gutter-line--truncated' : ''}${!lineErrors.has(i) && staleLineDetails.has(i) ? ' gutter-line--stale' : ''}${declarationLines.has(i) ? ' gutter-line--var' : ''}${aiTriggerLines.has(i) ? ' gutter-line--ai' : ''}`}
                                style={{height: lineRowHeights[i] ?? lineHeightPx}}
                                onClick={() => {
                                    setMarkedLines((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(i)) next.delete(i); else next.add(i);
                                        return next;
                                    });
                                }}
                                title={
                                    lineErrors.get(i)
                                    ?? (truncatedZeroLines.has(i)
                                        ? `Result rounded to 0 — actual: ${formatNumber(truncatedZeroLines.get(i)!, decimalDelimiter, 'auto', false)} (precision: ${precision})`
                                        : (truncatedLines.has(i)
                                            ? `Result truncated — actual: ${formatNumber(truncatedLines.get(i)!, decimalDelimiter, 'auto', false)}, displayed: ${formatNumber(truncatedLines.get(i)!, decimalDelimiter, precision, scientificNotation)} (precision: ${precision})`
                                            : (staleLineDetails.has(i)
                                                ? `Stale result: depends on changed variable${staleLineDetails.get(i)!.length === 1 ? '' : 's'} ${staleLineDetails.get(i)!.join(', ')}`
                                            : (aiTriggerLines.has(i)
                                                ? 'AI prompt line'
                                            : (declarationLines.has(i)
                                                ? 'Variable declaration'
                                                : (markedLines.has(i) ? 'Remove mark' : 'Mark line'))))))
                                }
                            >
                                <span className="gutter-line-number" aria-hidden="true">{i + 1}</span>
                                <span className="gutter-line-indicator" aria-hidden="true">
                                    {lineErrors.has(i) && (
                                        <span className="gutter-error-icon">!</span>
                                    )}
                                    {!lineErrors.has(i) && truncatedZeroLines.has(i) && (
                                        <span className="gutter-truncated-icon">~0</span>
                                    )}
                                    {!lineErrors.has(i) && !truncatedZeroLines.has(i) && truncatedLines.has(i) && (
                                        <span className="gutter-truncated-icon">≈</span>
                                    )}
                                    {!lineErrors.has(i) && !truncatedZeroLines.has(i) && !truncatedLines.has(i) && staleLineDetails.has(i) && (
                                        <span className="gutter-stale-icon">↻</span>
                                    )}
                                    {!lineErrors.has(i) && !truncatedZeroLines.has(i) && !truncatedLines.has(i) && !staleLineDetails.has(i) && aiTriggerLines.has(i) && (
                                        <span className="gutter-ai-icon">?</span>
                                    )}
                                    {markedLines.has(i) && !lineErrors.has(i) && !truncatedZeroLines.has(i) && !truncatedLines.has(i) && !staleLineDetails.has(i) && !declarationLines.has(i) && (
                                        <span className="gutter-mark">&#9670;</span>
                                    )}
                                    {declarationLines.has(i) && !lineErrors.has(i) && !truncatedZeroLines.has(i) && !truncatedLines.has(i) && !staleLineDetails.has(i) && (
                                        <span className="gutter-var">@</span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="editor-area">
                    {staleLineDetails.size > 0 && (
                        <div className="stale-banner" role="status" aria-live="polite">
                            <span className="stale-banner-text">
                                {`Stale results detected on ${staleLineDetails.size} line${staleLineDetails.size === 1 ? '' : 's'}.`}
                            </span>
                            <div className="stale-banner-actions">
                                <button
                                    type="button"
                                    className="stale-banner-btn"
                                    onClick={() => void reevaluateAllExpressions()}
                                    disabled={isReevaluatingAll}
                                >
                                    {isReevaluatingAll ? 'Re-evaluating...' : 'Re-evaluate All'}
                                </button>
                                <button
                                    type="button"
                                    className="stale-banner-btn stale-banner-btn--ghost"
                                    onClick={clearStaleStates}
                                    disabled={isReevaluatingAll}
                                >
                                    Clear Stale
                                </button>
                            </div>
                        </div>
                    )}
                    <textarea
                        ref={editorRef}
                        className={`editor${wordWrap ? ' editor--wrap' : ''}`}
                        spellCheck={false}
                        value={content}
                        onChange={(e) => {
                            const rawNextContent = e.target.value;
                            const rawCaretPos = e.target.selectionStart;
                            scheduleIntelligenceHintFromTyping();
                            const {lineStart, lineEnd} = getLineBounds(rawNextContent, rawCaretPos);
                            const editedLine = rawNextContent.slice(lineStart, lineEnd);
                            const cleanedLine = getExpressionSource(editedLine);

                            let nextContent = rawNextContent;
                            let nextCaretPos = rawCaretPos;
                            if (cleanedLine !== editedLine) {
                                nextContent = rawNextContent.slice(0, lineStart) + cleanedLine + rawNextContent.slice(lineEnd);
                                nextCaretPos = Math.min(rawCaretPos, lineStart + cleanedLine.length);
                            }

                            const activeLineIndex = lineIndexAtPosition(nextContent, nextCaretPos);
                            const previousLine = content.split('\n')[activeLineIndex] ?? '';
                            const nextLine = nextContent.split('\n')[activeLineIndex] ?? '';
                            const previousLineSource = getExpressionSource(previousLine);
                            const nextLineSource = getExpressionSource(nextLine);
                            const sourceChanged = previousLineSource !== nextLineSource;

                            if (sourceChanged) {
                                setLastResult(null);
                                clearLineEvaluationMetadata(activeLineIndex);
                            }

                            setContent(nextContent);
                            setCaretPos(nextCaretPos);

                            if (isStatusError || devError) {
                                setStatusText('Ready');
                                setIsStatusError(false);
                                setDevError('');
                            }

                            if (nextContent !== rawNextContent || nextCaretPos !== rawCaretPos) {
                                requestAnimationFrame(() => {
                                    if (!editorRef.current) {
                                        return;
                                    }
                                    editorRef.current.selectionStart = nextCaretPos;
                                    editorRef.current.selectionEnd = nextCaretPos;
                                });
                            }

                            setVariableValues((prevValues) => {
                                const activeVariables = new Set<string>();
                                nextContent.split('\n').forEach((line) => {
                                    const declaration = parseDeclaredVariable(getExpressionSource(line));
                                    if (declaration) {
                                        activeVariables.add(declaration.key);
                                    }
                                });

                                const nextValues: Record<string, unknown> = {};
                                let changed = false;
                                for (const [name, value] of Object.entries(prevValues)) {
                                    if (activeVariables.has(name)) {
                                        nextValues[name] = value;
                                    } else {
                                        changed = true;
                                    }
                                }

                                // Version bumps are evaluation-driven. Editing alone should not create stale markers.

                                return changed ? nextValues : prevValues;
                            });

                            setMarkedLines((prev) => remapMarkedLinesForEdit(prev, content, nextContent));
                            setLineDependencies((prev) => remapLineRecordForEdit(prev, content, nextContent));
                            setLineDependencyVersions((prev) => remapLineRecordForEdit(prev, content, nextContent));
                        }}
                        onSelect={updateCaretPosFromEditor}
                        onClick={updateCaretPosFromEditor}
                        onKeyUp={updateCaretPosFromEditor}
                        onKeyDown={onKeyDown}
                        onWheel={onEditorWheel}
                        onScroll={() => {
                            const el = editorRef.current;
                            if (!el) return;
                            setEditorScrollTop(el.scrollTop);
                            setEditorScrollLeft(el.scrollLeft);
                            syncEditorScrollbarWidth();
                            if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;
                            if (overlayRef.current) {
                                overlayRef.current.scrollTop = el.scrollTop;
                                overlayRef.current.scrollLeft = el.scrollLeft;
                            }
                        }}
                        style={{
                            fontSize: `${fontScale}em`,
                            paddingTop: `${EDITOR_TOP_PADDING_PX}px`,
                            paddingBottom: `${EDITOR_BOTTOM_PADDING_PX}px`,
                        }}
                    />
                    <div
                        ref={overlayRef}
                        className={`editor-overlay${wordWrap ? ' editor-overlay--wrap' : ''}`}
                        aria-hidden="true"
                        style={{
                            fontSize: `${fontScale}em`,
                            paddingTop: `${EDITOR_TOP_PADDING_PX}px`,
                            paddingBottom: `${EDITOR_BOTTOM_PADDING_PX}px`,
                            paddingRight: `${EDITOR_SIDE_PADDING_PX + editorScrollbarWidth}px`,
                        }}
                    >
                        {renderOverlayLines()}
                    </div>
                    {activeLineError && (
                        <div
                            className="line-error-floating"
                            style={{top: activeLineErrorTop, left: activeLineErrorLeft}}
                            aria-live="polite"
                        >
                            {activeLineError}
                        </div>
                    )}
                    {isAIQueryPending && aiPendingLineIndex !== null && aiProgressMessage && (
                        <div
                            className="line-ai-progress"
                            style={{top: aiProgressTop, left: EDITOR_PADDING - editorScrollLeft}}
                            aria-live="polite"
                        >
                            <span className="line-ai-progress-prefix">" </span>
                            <span>AI: {aiProgressMessage}</span>
                        </div>
                    )}
                    {showIntelligenceHint && intelligenceSuggestions.length > 0 && (
                        <div
                            className="editor-intelligence"
                            style={{top: intelligenceTop, left: intelligenceLeft}}
                            aria-live="polite"
                        >
                            {intelligenceSuggestions.map((suggestion, index) => (
                                <div key={`${suggestion.kind}-${suggestion.label}`} className={`editor-intelligence-item${index === 0 ? ' editor-intelligence-item--active' : ''}`}>
                                    <span className={`editor-intelligence-kind editor-intelligence-kind--${suggestion.kind}`}>{suggestion.kind}</span>
                                    <span className="editor-intelligence-label">{suggestion.label}</span>
                                </div>
                            ))}
                            <div className="editor-intelligence-hint">Tab to accept</div>
                        </div>
                    )}
                </div>
            </div>
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
                        <div className="precision-popover" role="dialog" aria-label="Precision selector">
                            <div className="precision-popover-title">Display precision</div>
                            <div className="precision-popover-desc">Applies to rendered result text.</div>
                            <div className="precision-popover-row">
                                <div className="precision-popover-row-info">
                                    <div className="precision-popover-label">Decimals</div>
                                    <div className="precision-popover-value">
                                        {precision === 'full' ? 'Full — no rounding' : precision === 'auto' ? 'Auto — 10 dec. places' : `${precision} place${precision === 1 ? '' : 's'}`}
                                    </div>
                                </div>
                                <div className="settings-stepper-group precision-popover-stepper">
                                    <button
                                        type="button"
                                        className="settings-stepper"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={decreasePrecision}
                                        disabled={precision === 'full'}
                                        aria-label="Decrease precision"
                                    >
                                        −
                                    </button>
                                    <span className="settings-stepper-value">
                                        {precision === 'full' ? 'Full' : precision === 'auto' ? 'Auto' : String(precision)}
                                    </span>
                                    <button
                                        type="button"
                                        className="settings-stepper"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={increasePrecision}
                                        disabled={precision === PRECISION_MAX}
                                        aria-label="Increase precision"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="precision-popover-actions">
                                <button
                                    type="button"
                                    className="precision-popover-link"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setPrecision('full')}
                                    disabled={precision === 'full'}
                                >
                                    Full
                                </button>
                                <button
                                    type="button"
                                    className="precision-popover-link"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={applyFinancialPrecision}
                                    disabled={precision === FINANCIAL_PRECISION}
                                >
                                    Financial (2)
                                </button>
                                <button
                                    type="button"
                                    className="precision-popover-link"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={applyFourPointPrecision}
                                    disabled={precision === FOUR_POINT_PRECISION}
                                >
                                    Intermediate (4)
                                </button>
                                <button
                                    type="button"
                                    className="precision-popover-link"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={resetPrecision}
                                    disabled={precision === 'auto'}
                                >
                                    Auto (10)
                                </button>
                            </div>
                            <div className="precision-popover-row precision-popover-row--toggle">
                                <div className="precision-popover-row-info">
                                    <div className="precision-popover-label">Scientific mode</div>
                                    <div className="precision-popover-value">Use 1e+7 and 1e-7 for extreme values.</div>
                                </div>
                                <label className="settings-toggle" aria-label="Toggle scientific notation">
                                    <input
                                        type="checkbox"
                                        checked={scientificNotation}
                                        onChange={(e) => setScientificNotation(e.target.checked)}
                                    />
                                    <span className="settings-toggle-track" />
                                </label>
                                                        </div>
                            </div>
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
                        <div className="status-menu-popover" role="menu" aria-label="App menu">
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(requestClearWorksheet)}>New worksheet</button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(() => WindowReload())}>Reload app</button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(() => changeFontScale(1))}>Increase font size</button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(() => changeFontScale(-1))}>Decrease font size</button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(resetFontSize)}>Reset font size</button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(resetWindowLayout)}>Reset window layout</button>
                            <button
                                type="button"
                                className="status-menu-item"
                                onClick={() => runBurgerAction(() => {
                                    setShowHelp(false);
                                    setShowSettings(true);
                                    openThemeStoreInSidebar();
                                })}
                            >
                                Open Theme Store
                            </button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(openHelpPanel)}>Help</button>
                            <button
                                type="button"
                                className="status-menu-item"
                                onClick={() => runBurgerAction(() => BrowserOpenURL(HELP_SITE_URL))}
                            >
                                Open Full Help Site
                            </button>
                            <button
                                type="button"
                                className="status-menu-item"
                                onClick={() => runBurgerAction(() => setShowAIDebug(true))}
                            >
                                AI Debug Log{aiDebugLog.length > 0 ? ` (${aiDebugLog.length})` : ''}
                            </button>
                            <button
                                type="button"
                                className="status-menu-item"
                                onClick={() => runBurgerAction(() => BrowserOpenURL('https://github.com/Zaitsev/run-calc'))}
                            >
                                GitHub
                            </button>
                            <button
                                type="button"
                                className="status-menu-item"
                                onClick={() => runBurgerAction(() => alert('Run-Calc is a native Wails desktop calculator with a system menu and standard OS window chrome.'))}
                            >
                                About
                            </button>
                            <button
                                type="button"
                                className="status-menu-item status-menu-item--danger"
                                onClick={() => runBurgerAction(() => Quit())}
                            >
                                Quit (your work is saved)
                            </button>
                        </div>
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
                        setShowPrecisionMenu(false);
                        setShowBurgerMenu(false);
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
                            onMouseDown={startSettingsDrawerResize}
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
                                    closeThemeStoreInSidebar();
                                    return;
                                }
                                setShowSettings(false);
                            }}
                            aria-label="Back"
                        >
                            &#8594;
                        </button>
                        <span className="settings-title">{showThemeStore ? 'Theme Store' : 'Settings'}</span>
                    </div>

                    {showThemeStore ? (
                        <div className="settings-body settings-body--theme-store">
                            <ThemeStore
                                onPreviewTheme={startThemePreview}
                                onAcceptTheme={acceptThemePreview}
                                onCancelThemePreview={cancelThemePreview}
                                currentPreviewThemeId={pendingThemePreview?.id ?? null}
                            />
                        </div>
                    ) : (
                    <div className="settings-body">
                        {/* ── AI ── */}
                        <div className={`settings-ai-block${aiSettingsHasUnsavedChanges ? ' settings-ai-block--action-required' : ''}`}>
                            <p className="settings-section-label settings-section-label--with-chip">
                                <span>AI</span>
                                {aiSettingsHasUnsavedChanges && (
                                    <span className="settings-status-chip" aria-label="AI settings have unsaved changes">Unsaved</span>
                                )}
                            </p>
                            <AISettingsPanel
                                settings={aiSettingsDraft}
                                keyStatus={aiKeyStatus}
                                busy={aiSettingsBusy}
                                hasUnsavedChanges={aiSettingsHasUnsavedChanges}
                                showRevertChanges={aiSettingsActionFailed}
                                applyErrorMessage={aiSettingsApplyError}
                                onChange={(next) => {
                                    setAISettingsDraft(next);
                                }}
                                onTestAndSave={testAndSaveAISettings}
                                onRevertChanges={revertAISettingsDraftToSaved}
                                onSaveKey={saveAIKeyToBackend}
                                onClearKey={clearAIKeyInBackend}
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
                                        onClick={openThemeStoreInSidebar}
                                        role="listitem"
                                    >
                                        <span className="saved-theme-icon saved-theme-icon--browse" aria-hidden="true">+</span>
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
                                        { key: 'system', name: 'System', meta: 'Use OS setting', icon: 'S' },
                                    ] as const).map((entry) => {
                                        const isActive = theme.type === entry.key;
                                        return (
                                            <button
                                                key={entry.key}
                                                type="button"
                                                className={`saved-theme-item${isActive ? ' saved-theme-item--active' : ''}`}
                                                onClick={() => setTheme({ type: entry.key })}
                                                role="listitem"
                                            >
                                                <span className="saved-theme-icon saved-theme-icon--builtin" aria-hidden="true">{entry.icon}</span>
                                                <span className="saved-theme-text">
                                                    <span className="saved-theme-name">{entry.name}</span>
                                                    <span className="saved-theme-meta">{entry.meta}</span>
                                                </span>
                                                <span className="saved-theme-check" aria-hidden="true">v</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="saved-theme-group" role="group" aria-label="Downloaded themes">
                                    {savedThemes.map((entry) => {
                                        const isActive = theme.type === 'custom' && theme.customId === entry.id;
                                        return (
                                            <div key={entry.id} className="saved-theme-item-wrapper">
                                                <button
                                                    type="button"
                                                    className={`saved-theme-item${isActive ? ' saved-theme-item--active' : ''}`}
                                                    onClick={() => setTheme({
                                                        type: 'custom',
                                                        customColors: entry.colors,
                                                        customId: entry.id,
                                                        customThemeBase: entry.themeBase,
                                                    })}
                                                    role="listitem"
                                                >
                                                    {entry.iconUrl && <img src={entry.iconUrl} alt="" aria-hidden="true" className="saved-theme-icon" />}
                                                    <span className="saved-theme-text">
                                                        <span className="saved-theme-name">{entry.name}</span>
                                                        {entry.publisher && <span className="saved-theme-meta">{entry.publisher}</span>}
                                                    </span>
                                                    <span className="saved-theme-check" aria-hidden="true">v</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="saved-theme-delete-btn"
                                                    onClick={() => deleteSavedTheme(entry.id)}
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

                        {/* ── Editor ── */}
                        <p className="settings-section-label">Editor</p>
                        <div className="settings-card">
                            <div className="settings-row">
                                <div className="settings-row-info">
                                    <div className="settings-row-title">Font size</div>
                                    <div className="settings-row-desc">Adjust the editor text size</div>
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
                                        checked={wordWrap}
                                        onChange={(e) => setWordWrap(e.target.checked)}
                                    />
                                    <span className="settings-toggle-track" />
                                </label>
                            </div>
                        </div>

                        {/* ── Calculation ── */}
                        <p className="settings-section-label">Calculation</p>
                        <div className="settings-card">
                            <div className="settings-card-header">
                                <div className="settings-card-title">Decimal delimiter</div>
                                <div className="settings-card-desc">Choose how decimal values are written and parsed</div>
                            </div>
                            <div className="settings-options">
                                {(['dot', 'comma', 'system'] as const).map((mode) => (
                                    <label key={mode} className="settings-option">
                                        <input
                                            type="radio"
                                            name="decimal-delimiter"
                                            value={mode}
                                            checked={decimalDelimiterMode === mode}
                                            onChange={() => setDecimalDelimiterMode(mode)}
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
                                    <div className="settings-row-title">Decimal precision</div>
                                    <div className="settings-row-desc">Auto = 10 decimals · Full = no rounding · or pick 0–15</div>
                                </div>
                                <div className="settings-stepper-group">
                                    <button
                                        type="button"
                                        className="settings-stepper"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={decreasePrecision}
                                        disabled={precision === 'full'}
                                        aria-label="Decrease precision"
                                    >
                                        −
                                    </button>
                                    <span className="settings-stepper-value">
                                        {precision === 'full' ? 'Full' : precision === 'auto' ? 'Auto' : String(precision)}
                                    </span>
                                    <button
                                        type="button"
                                        className="settings-stepper"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={increasePrecision}
                                        disabled={precision === PRECISION_MAX}
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
                                    onClick={applyFinancialPrecision}
                                    disabled={precision === FINANCIAL_PRECISION}
                                >
                                    Financial (2)
                                </button>
                                <button
                                    type="button"
                                    className="settings-link-btn"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={applyFourPointPrecision}
                                    disabled={precision === FOUR_POINT_PRECISION}
                                >
                                    Intermediate (4)
                                </button>
                                {precision !== 'auto' && (
                                    <button
                                        type="button"
                                        className="settings-link-btn"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={resetPrecision}
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
                                        checked={scientificNotation}
                                        onChange={(e) => setScientificNotation(e.target.checked)}
                                    />
                                    <span className="settings-toggle-track" />
                                </label>
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
                                    onClick={() => { resetWindowLayout(); setShowSettings(false); }}
                                >
                                    Reset
                                </button>
                            </div>
                        </div>

                        <div className="settings-card">
                            <div className="settings-row">
                                <div className="settings-row-info">
                                    <div className="settings-row-title">Close button behavior</div>
                                    <div className="settings-row-desc">Hide to tray on close (default) instead of quitting</div>
                                </div>
                                <label className="settings-toggle" aria-label="Toggle close button behavior">
                                    <input
                                        type="checkbox"
                                        checked={minimiseToTrayOnClose}
                                        onChange={(e) => setMinimiseToTrayOnClose(e.target.checked)}
                                    />
                                    <span className="settings-toggle-track" />
                                </label>
                            </div>
                        </div>

                        <div className="settings-card">
                            <div className="settings-row">
                                <div className="settings-row-info">
                                    <div className="settings-row-title">Restore shortcut</div>
                                    <div className="settings-row-desc">
                                        {isMSIX
                                            ? 'Not available in the Store version (Windows sandbox restriction)'
                                            : runtimePlatform === 'darwin'
                                                ? 'Use Cmd + Clear (NumLock-equivalent) to restore from hidden/minimized state'
                                                : 'Use Ctrl + NumLock to restore from hidden/minimized state'}
                                    </div>
                                </div>
                                <label className="settings-toggle" aria-label="Toggle restore shortcut">
                                    <input
                                        type="checkbox"
                                        checked={restoreShortcutEnabled}
                                        disabled={isMSIX}
                                        onChange={(e) => setRestoreShortcutEnabled(e.target.checked)}
                                    />
                                    <span className="settings-toggle-track" />
                                </label>
                            </div>
                        </div>

                    </div>
                    )}
                </div>

            <div
                className={`settings-panel settings-panel--ai-debug${showAIDebug ? ' settings-panel--open' : ''}`}
                role="dialog"
                aria-label="AI Debug Log"
                aria-hidden={!showAIDebug}
            >
                <AIDebugDrawer
                    entries={aiDebugLog}
                    onClear={() => setAIDebugLog([])}
                    onClose={() => setShowAIDebug(false)}
                />
            </div>

            {showHelp && (
                <div
                    className={`settings-panel settings-panel--open${helpPanelPosition === 'left' ? ' settings-panel--left' : ''}${helpPanelPosition === 'bottom' ? ' settings-panel--bottom' : ''}`}
                    role="dialog"
                    aria-label="Help"
                >
                    <div className="settings-header">
                        <button
                            type="button"
                            className="settings-back"
                            onClick={() => setShowHelp(false)}
                            aria-label="Back"
                        >
                            &#8594;
                        </button>
                        <span className="settings-title">Help</span>
                        <div className="settings-header-actions" role="group" aria-label="Help panel position">
                            <button
                                type="button"
                                className={`settings-pos-btn${helpPanelPosition === 'left' ? ' settings-pos-btn--active' : ''}`}
                                aria-label="Move help panel to left"
                                title="Move help panel to left"
                                onClick={() => {
                                    if (helpPanelPosition === 'left') {
                                        setShowHelp(false);
                                        return;
                                    }
                                    setHelpPanelPosition('left');
                                }}
                            >
                                <span className="settings-pos-icon settings-pos-icon--left" aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                className={`settings-pos-btn${helpPanelPosition === 'right' ? ' settings-pos-btn--active' : ''}`}
                                aria-label="Move help panel to right"
                                title="Move help panel to right"
                                onClick={() => {
                                    if (helpPanelPosition === 'right') {
                                        setShowHelp(false);
                                        return;
                                    }
                                    setHelpPanelPosition('right');
                                }}
                            >
                                <span className="settings-pos-icon settings-pos-icon--right" aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                className={`settings-pos-btn${helpPanelPosition === 'bottom' ? ' settings-pos-btn--active' : ''}`}
                                aria-label="Move help panel to bottom"
                                title="Move help panel to bottom"
                                onClick={() => {
                                    if (helpPanelPosition === 'bottom') {
                                        setShowHelp(false);
                                        return;
                                    }
                                    setHelpPanelPosition('bottom');
                                }}
                            >
                                <span className="settings-pos-icon settings-pos-icon--bottom" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    <div className="settings-body">
                        <HelpPanel helpSiteUrl={HELP_SITE_URL} />
                    </div>
                </div>
            )}
            {showClearWorksheetConfirm && (
                <div
                    className="recalc-modal-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="clear-worksheet-title"
                    aria-describedby="clear-worksheet-message"
                    onMouseDown={cancelClearWorksheet}
                >
                    <div className="recalc-modal" onMouseDown={(event) => event.stopPropagation()}>
                        <h3 id="clear-worksheet-title">Confirm Clear Worksheet</h3>
                        <p id="clear-worksheet-message">Clear worksheet and remove all expressions?</p>
                        <div className="recalc-modal-actions">
                            <button type="button" className="recalc-btn-no" onClick={cancelClearWorksheet}>Cancel</button>
                            <button type="button" className="recalc-btn-yes" onClick={confirmClearWorksheet}>Clear</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
