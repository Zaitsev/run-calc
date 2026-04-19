import {KeyboardEvent, useEffect, useMemo, useRef, useState} from 'react';
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
import {getExpressionSource, stripErrorSuffix} from './lineExpression';
import {useTheme, type ThemeState} from './useTheme';
import { getPrimaryShortcutAction } from './editorShortcuts';
import { EvaluateExprProgram, SetMinimiseToTrayOnClose, SetRestoreShortcutEnabled } from '../wailsjs/go/main/App';

import { ThemeStore, type AcceptedThemeEntry } from './ThemeStore';

const OPERATOR_KEY_RE = /^[+\-*/]$/;
const MATH_FUNCTION_NAMES = new Set([
    'ABS', 'ACOS', 'ACOSH', 'ASIN', 'ASINH', 'ATAN', 'ATAN2', 'ATANH',
    'AVG', 'CBRT', 'CEIL', 'COS', 'COSH', 'EXP', 'FILTER', 'FLOOR',
    'HYPOT', 'LOG', 'LOG10', 'LOG2', 'MAP', 'MAX', 'MIN', 'POW',
    'ROUND', 'SIGN', 'SIN', 'SINH', 'SQRT', 'TAN', 'TANH', 'TRUNC',
]);
const MATH_CONSTANT_NAMES = new Set([
    'E', 'PI', 'TAU', 'PHI', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT1_2', 'SQRT2', 'SQRTE', 'SQRTPI', 'SQRTPHI',
]);
const IS_DEV = import.meta.env.DEV;
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
const MARKED_LINES_STORAGE_KEY = 'calc.editor.markedLines';
const DECIMAL_DELIMITER_STORAGE_KEY = 'calc.editor.decimalDelimiter';
const PRECISION_STORAGE_KEY = 'calc.editor.precision';
const SCIENTIFIC_NOTATION_STORAGE_KEY = 'calc.editor.scientificNotation';
const WORD_WRAP_STORAGE_KEY = 'calc.editor.wordWrap';
const WORKSHEET_CONTENT_STORAGE_KEY = 'calc.editor.content';
const LAST_RESULT_STORAGE_KEY = 'calc.editor.lastResult';
const VARIABLE_VALUES_STORAGE_KEY = 'calc.editor.variableValues';
const ACCEPTED_THEMES_STORAGE_KEY = 'calc.themes.accepted';
const MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY = 'calc.window.minimiseToTrayOnClose';
const RESTORE_SHORTCUT_ENABLED_STORAGE_KEY = 'calc.window.restoreShortcutEnabled';
const DOUBLE_ESCAPE_HIDE_WINDOW_MS = 420;

const PRECISION_MIN = 0;
const PRECISION_MAX = 15;

type SavedThemeEntry = AcceptedThemeEntry;
type DecimalDelimiter = '.' | ',';

type DecimalDelimiterMode = 'dot' | 'comma' | 'system';
type PrecisionMode = 'auto' | 'full' | number;
type HelpPage = 'operations' | 'shortcuts' | 'new';
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
    if (Number.isInteger(value)) {
        return String(value);
    }

    const absVal = Math.abs(value);
    if (useScientific && value !== 0 && (absVal >= 1e15 || absVal < 1e-6)) {
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

function getFriendlyEvalErrorMessage(message: string): string {
    const normalized = message.toLowerCase();

    if (normalized.includes('expression is empty')) {
        return 'There is nothing to calculate on this line yet. Type an expression and press Enter.';
    }

    if (normalized.includes('result contains nan or inf')) {
        return 'This line produced an invalid number. Try values in a valid range (for example: ASIN needs -1..1, LOG needs a number above 0), then press Enter again.';
    }

    if (normalized.includes('filter predicate must return true or false')) {
        return 'FILTER needs a yes/no test for each item. Example: filter(# > 10). Then press Enter again.';
    }

    if (normalized.includes('function values are not supported')) {
        return 'Use function calls with parentheses, like SIN(item) or SQRT(9), then press Enter again.';
    }

    if (normalized.includes('cannot reassign internal name')) {
        return 'Internal names are read-only. Use a different variable name and press Enter again.';
    }

    if (normalized.includes('unsupported pipeline stage') || normalized.includes('invalid pipeline stage')) {
        return 'A pipeline step after | is not valid. Use filter(...), map(...), or a function like sum, avg, min, max, median.';
    }

    if (normalized.includes('expected a list')) {
        return 'This step needs a list of values. Example: a = [1,2,3] then a | map(# * 2).';
    }

    if (normalized.includes('expected numeric values') || normalized.includes('expects a numeric value')) {
        return 'This operation needs numbers only. Check for text, empty values, or missing variables.';
    }

    if (normalized.includes('requires at least one value')) {
        return 'This operation needs at least one value in the list.';
    }

    if (normalized.includes('unexpected token') || normalized.includes('unexpected character') || normalized.includes('mismatched input') || normalized.includes('syntax')) {
        return 'There is a typing mistake in this expression. Check brackets, commas, and operators, then press Enter again.';
    }

    if (normalized.includes('unknown name') || normalized.includes('unknown variable') || normalized.includes('undefined')) {
        return 'A name in this line is not recognized. Define it first (example: price = 20), then try again.';
    }

    if (normalized.includes('divide by zero') || normalized.includes('division by zero')) {
        return 'Division by zero is not allowed. Change the denominator and press Enter again.';
    }

    return 'Cannot evaluate this line yet. Fix it and press Enter again.';
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
    const [showThemeStore, setShowThemeStore] = useState(false);
    const [minimiseToTrayOnClose, setMinimiseToTrayOnClose] = useState(() => {
        return localStorage.getItem(MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY) !== 'false';
    });
    const [restoreShortcutEnabled, setRestoreShortcutEnabled] = useState(() => {
        return localStorage.getItem(RESTORE_SHORTCUT_ENABLED_STORAGE_KEY) !== 'false';
    });
    const [activeHelpPage, setActiveHelpPage] = useState<HelpPage>('operations');
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
    const [pendingThemePreview, setPendingThemePreview] = useState<SavedThemeEntry | null>(null);
    const {theme, setTheme} = useTheme();
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
    const [editorFontSpec, setEditorFontSpec] = useState('16px Nunito, Segoe UI, Tahoma, sans-serif');
    const [editorScrollTop, setEditorScrollTop] = useState(0);
    const [editorScrollLeft, setEditorScrollLeft] = useState(0);
    const [caretPos, setCaretPos] = useState(0);
    const [runtimePlatform, setRuntimePlatform] = useState('');
    const [showBurgerMenu, setShowBurgerMenu] = useState(false);
    const [showPrecisionMenu, setShowPrecisionMenu] = useState(false);

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
                const eqIdx = line.lastIndexOf(' = ');
                if (eqIdx === -1) return line;
                const afterEq = line.slice(eqIdx + 3).trim();
                if (afterEq === 'error' || afterEq.length === 0) {
                    return line;
                }

                const numericCandidate = Number(afterEq.replace(',', '.'));
                if (!Number.isFinite(numericCandidate)) {
                    return line;
                }

                const formatted = formatNumber(numericCandidate, decimalDelimiter, precision, scientificNotation);
                const newLine = `${line.slice(0, eqIdx + 3)}${formatted}`;
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
        localStorage.setItem(MINIMISE_TO_TRAY_ON_CLOSE_STORAGE_KEY, String(minimiseToTrayOnClose));
        SetMinimiseToTrayOnClose(minimiseToTrayOnClose).catch(() => {
            // Keep settings responsive even if backend sync fails.
        });
    }, [minimiseToTrayOnClose]);

    useEffect(() => {
        localStorage.setItem(RESTORE_SHORTCUT_ENABLED_STORAGE_KEY, String(restoreShortcutEnabled));
        SetRestoreShortcutEnabled(restoreShortcutEnabled).catch(() => {
            // Keep settings responsive even if backend sync fails.
        });
    }, [restoreShortcutEnabled]);

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
            setShowSettings(true);
            setShowThemeStore(true);
            void expandWindowForThemeStore();
        });
        const unsubNew = EventsOn('menu:file:new', clearWorksheet);
        const unsubResetWindow = EventsOn('menu:view:reset-window-layout', resetWindowLayout);
        const unsubIncrease = EventsOn('menu:view:increase-font-size', () => changeFontScale(1));
        const unsubDecrease = EventsOn('menu:view:decrease-font-size', () => changeFontScale(-1));
        const unsubResetFont = EventsOn('menu:view:reset-font-size', resetFontSize);
        return () => {
            unsubThemeStore();
            unsubNew();
            unsubResetWindow();
            unsubIncrease();
            unsubDecrease();
            unsubResetFont();
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

    const getEnclosingBacktickBlock = (text: string, caret: number): {open: number; close: number | null} | null => {
        const ticks: number[] = [];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '`') {
                ticks.push(i);
            }
        }

        for (let i = 0; i + 1 < ticks.length; i += 2) {
            const open = ticks[i];
            const close = ticks[i + 1];
            if (open <= caret && caret <= close + 1) {
                return {open, close};
            }
        }

        if (ticks.length % 2 === 1) {
            const open = ticks[ticks.length - 1];
            if (open <= caret) {
                return {open, close: null};
            }
        }

        return null;
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
            | 'punctuation';

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
        const codeBlockRegion = getEnclosingBacktickBlock(content, caretPos);
        if (codeBlockRegion && codeBlockRegion.close === null) {
            insertAtSelection('\n');
            setStatusText('Continue typing the code block. Close it with a backtick to evaluate.');
            setIsStatusError(false);
            setDevError('');
            return;
        }

        let lineStart: number;
        let lineEnd: number;
        let lineText: string;
        let editableLine: string;

        if (codeBlockRegion && codeBlockRegion.close !== null) {
            lineStart = content.lastIndexOf('\n', Math.max(0, codeBlockRegion.open - 1)) + 1;
            const nextBreak = content.indexOf('\n', codeBlockRegion.close);
            lineEnd = nextBreak === -1 ? content.length : nextBreak;
            lineText = content.slice(lineStart, lineEnd);
            const closeOffset = codeBlockRegion.close - lineStart;
            editableLine = lineText.slice(0, closeOffset + 1).trimEnd();
        } else {
            const bounds = getLineBounds(content, caretPos);
            lineStart = bounds.lineStart;
            lineEnd = bounds.lineEnd;
            lineText = content.slice(lineStart, lineEnd);
            editableLine = getExpressionSource(lineText);
        }

        const trimmed = editableLine.trim();

        if (trimmed.length === 0) {
            insertAtSelection('\n');
            setStatusText('Ready');
            setIsStatusError(false);
            setDevError('');
            return;
        }

        const declaration = parseDeclaredVariable(editableLine);
        const expression = OPERATOR_KEY_RE.test(trimmed[0]) && lastResult !== null
            ? `${formatNumber(lastResult, decimalDelimiter, 'auto', false)}${trimmed}`
            : editableLine;

        try {
            const evalResult = await EvaluateExprProgram(expression, variableValues as Record<string, any>);
            if (!evalResult.ok) {
                throw new Error(evalResult.error || 'Evaluation failed');
            }

            const numberValue = evalResult.numberValue ?? 0;
            const formatted = formatExprValue(evalResult.value, evalResult.isNumber, numberValue);
            const replacement = declaration
                ? `${declaration.label} = ${declaration.expression} = ${formatted}`
                : `${editableLine} = ${formatted}`;
            const before = content.slice(0, lineStart);
            const after = content.slice(lineEnd);
            const nextContent = before + replacement + after + (lineEnd === content.length ? '\n' : '');
            const nextCaret = lineEnd === content.length
                ? (before + replacement + '\n').length
                : before.length + replacement.length + 1;

            setContentAndCaret(nextContent, nextCaret);
            setLastResult(evalResult.isNumber ? numberValue : null);
            setVariableValues(evalResult.variables || {});
            setStatusText('Calculated');
            setIsStatusError(false);
            setDevError('');
        } catch (error) {
            const replacement = declaration
                ? `${declaration.label} = ${declaration.expression} = error`
                : `${editableLine} = error`;
            const before = content.slice(0, lineStart);
            const after = content.slice(lineEnd);
            const nextContent = before + replacement + after;
            const nextCaret = before.length + editableLine.length;
            setContentAndCaret(nextContent, nextCaret);
            setLastResult(null);
            setIsStatusError(true);

            const errorMessage = error instanceof Error ? error.message : 'Unknown evaluation error';
            setStatusText(getFriendlyEvalErrorMessage(errorMessage));
            setDevError(errorMessage);
        }
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

    const {lines: contentLines, lineErrors, truncatedZeroLines, truncatedLines, declarationLines} = useMemo(() => {
        const nextLineErrors = new Map<number, string>();
        const nextTruncatedZeroLines = new Map<number, number>();
        const nextTruncatedLines = new Map<number, number>(); // significant truncation, non-zero
        const nextDeclarationLines = new Set<number>();
        const lines = content.split('\n');
        let insideMultilineCodeBlock = false;

        lines.forEach((line, i) => {
            const tickCount = line.match(/`/g)?.length ?? 0;
            const source = getExpressionSource(line);
            const declaration = parseDeclaredVariable(source);
            if (declaration) {
                nextDeclarationLines.add(i);
            }

            if (insideMultilineCodeBlock || tickCount % 2 === 1) {
                if (tickCount % 2 === 1) {
                    insideMultilineCodeBlock = !insideMultilineCodeBlock;
                }
                return;
            }

            if (line.trimEnd().endsWith(' = error')) {
                nextLineErrors.set(i, 'error');
            }
        });

        return {
            lines,
            lineErrors: nextLineErrors,
            truncatedZeroLines: nextTruncatedZeroLines,
            truncatedLines: nextTruncatedLines,
            declarationLines: nextDeclarationLines,
        };
    }, [content]);

    const renderOverlayLines = () => {
        return contentLines.map((line, i) => {
            const suffix = i < contentLines.length - 1 ? '\n' : '';
            const lineClassName = lineErrors.has(i) ? 'line-error' : undefined;
            const isVariableLine = declarationLines.has(i);
            const isMarkedLine = markedLines.has(i);

            const eqIdx = isVariableLine ? line.lastIndexOf(' = ') : line.indexOf(' = ');
            if (eqIdx === -1) {
                return (
                    <span key={i} className={lineClassName}>
                        {renderSyntaxText(line, `${i}-full`)}
                        {suffix}
                    </span>
                );
            }

            if (!isMarkedLine && !isVariableLine) {
                return (
                    <span key={i} className={lineClassName}>
                        {renderSyntaxText(line, `${i}-line`)}
                        {suffix}
                    </span>
                );
            }

            const resultClass = isVariableLine
                ? 'marked-result marked-result--var'
                : 'marked-result';

            return (
                <span key={i} className={lineClassName}>
                    {renderSyntaxText(line.slice(0, eqIdx), `${i}-lhs`)}
                    <span className={resultClass}>{line.slice(eqIdx)}</span>
                    {suffix}
                </span>
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
    const activeLineErrorTop = 18 + activeLineIndex * lineHeightPx - editorScrollTop + lineHeightPx * 0.9;
    const activeLineErrorLeft = Math.max(EDITOR_PADDING, EDITOR_PADDING + measureLineWidth(activeLineText) + 8 - editorScrollLeft);
    const intelligenceTop = identifierContext
        ? 18 + activeLineIndex * lineHeightPx - editorScrollTop + lineHeightPx * 2.2
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

    const openThemeStoreInSidebar = () => {
        setShowThemeStore(true);
        void expandWindowForThemeStore();
    };

    const openHelpPanel = (page: HelpPage) => {
        setShowThemeStore(false);
        setActiveHelpPage(page);
        setShowSettings(true);
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

    return (
        <div id="app" className="window">
            <div className="window-logo-bg" aria-hidden="true">
                <img className="window-logo-bg-image" src={appLogo} alt="" />
            </div>
            <div className="editor-container">
                <div className="gutter" ref={gutterRef}>
                    <div className="gutter-lines" style={{paddingTop: 18}}>
                        {contentLines.map((_, i) => (
                            <div
                                key={i}
                                className={`gutter-line${markedLines.has(i) ? ' gutter-line--marked' : ''}${lineErrors.has(i) ? ' gutter-line--error' : ''}${!lineErrors.has(i) && (truncatedZeroLines.has(i) || truncatedLines.has(i)) ? ' gutter-line--truncated' : ''}${declarationLines.has(i) ? ' gutter-line--var' : ''}`}
                                style={{height: lineHeightPx}}
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
                                            : (declarationLines.has(i)
                                                ? 'Variable declaration'
                                                : (markedLines.has(i) ? 'Remove mark' : 'Mark line'))))
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
                                    {markedLines.has(i) && !lineErrors.has(i) && !truncatedZeroLines.has(i) && !truncatedLines.has(i) && !declarationLines.has(i) && (
                                        <span className="gutter-mark">&#9670;</span>
                                    )}
                                    {declarationLines.has(i) && !lineErrors.has(i) && !truncatedZeroLines.has(i) && !truncatedLines.has(i) && (
                                        <span className="gutter-var">@</span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="editor-area">
                    <textarea
                        ref={editorRef}
                        className={`editor${wordWrap ? ' editor--wrap' : ''}`}
                        spellCheck={false}
                        value={content}
                        onChange={(e) => {
                            const rawNextContent = e.target.value;
                            const rawCaretPos = e.target.selectionStart;
                            const {lineStart, lineEnd} = getLineBounds(rawNextContent, rawCaretPos);
                            const editedLine = rawNextContent.slice(lineStart, lineEnd);
                            const cleanedLine = stripErrorSuffix(editedLine);

                            let nextContent = rawNextContent;
                            let nextCaretPos = rawCaretPos;
                            if (cleanedLine !== editedLine) {
                                nextContent = rawNextContent.slice(0, lineStart) + cleanedLine + rawNextContent.slice(lineEnd);
                                nextCaretPos = Math.min(rawCaretPos, lineStart + cleanedLine.length);
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

                                return changed ? nextValues : prevValues;
                            });

                            setMarkedLines((prev) => remapMarkedLinesForEdit(prev, content, nextContent));
                        }}
                        onSelect={updateCaretPosFromEditor}
                        onClick={updateCaretPosFromEditor}
                        onKeyUp={updateCaretPosFromEditor}
                        onKeyDown={onKeyDown}
                        onScroll={() => {
                            const el = editorRef.current;
                            if (!el) return;
                            setEditorScrollTop(el.scrollTop);
                            setEditorScrollLeft(el.scrollLeft);
                            if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;
                            if (overlayRef.current) {
                                overlayRef.current.scrollTop = el.scrollTop;
                                overlayRef.current.scrollLeft = el.scrollLeft;
                            }
                        }}
                        style={{fontSize: `${fontScale}em`}}
                    />
                    <div
                        ref={overlayRef}
                        className={`editor-overlay${wordWrap ? ' editor-overlay--wrap' : ''}`}
                        aria-hidden="true"
                        style={{fontSize: `${fontScale}em`}}
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
                    {intelligenceSuggestions.length > 0 && (
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
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(clearWorksheet)}>New worksheet</button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(() => WindowReload())}>Reload app</button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(() => changeFontScale(1))}>Increase font size</button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(() => changeFontScale(-1))}>Decrease font size</button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(resetFontSize)}>Reset font size</button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(resetWindowLayout)}>Reset window layout</button>
                            <button
                                type="button"
                                className="status-menu-item"
                                onClick={() => runBurgerAction(() => {
                                    setShowSettings(true);
                                    openThemeStoreInSidebar();
                                })}
                            >
                                Open Theme Store
                            </button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(() => openHelpPanel('operations'))}>Help: Operations</button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(() => openHelpPanel('shortcuts'))}>Help: Shortcuts</button>
                            <button type="button" className="status-menu-item" onClick={() => runBurgerAction(() => openHelpPanel('new'))}>Help: New</button>
                            <button
                                type="button"
                                className="status-menu-item"
                                onClick={() => runBurgerAction(() => BrowserOpenURL('https://wails.io/docs'))}
                            >
                                Wails docs
                            </button>
                            <button
                                type="button"
                                className="status-menu-item status-menu-item--danger"
                                onClick={() => runBurgerAction(() => Quit())}
                            >
                                Quit
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
                className={`settings-panel${showSettings ? ' settings-panel--open' : ''}${showThemeStore ? ' settings-panel--theme-store' : ''}`}
                role="dialog"
                aria-label="Settings"
                aria-hidden={!showSettings}
            >
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

                        {/* ── Help ── */}
                        <p className="settings-section-label">Help</p>
                        <div className="settings-card">
                            <div className="settings-card-header">
                                <div className="settings-card-title">In-app help</div>
                                <div className="settings-card-desc">Reference pages for operations, shortcuts, and latest changes</div>
                            </div>
                            <div className="settings-help-tabs" role="tablist" aria-label="Help pages">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeHelpPage === 'operations'}
                                    className={`settings-help-tab${activeHelpPage === 'operations' ? ' settings-help-tab--active' : ''}`}
                                    onClick={() => setActiveHelpPage('operations')}
                                >
                                    Operations
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeHelpPage === 'shortcuts'}
                                    className={`settings-help-tab${activeHelpPage === 'shortcuts' ? ' settings-help-tab--active' : ''}`}
                                    onClick={() => setActiveHelpPage('shortcuts')}
                                >
                                    Shortcuts
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeHelpPage === 'new'}
                                    className={`settings-help-tab${activeHelpPage === 'new' ? ' settings-help-tab--active' : ''}`}
                                    onClick={() => setActiveHelpPage('new')}
                                >
                                    New
                                </button>
                            </div>
                            <div className="settings-help-content" role="tabpanel">
                                {activeHelpPage === 'operations' && (
                                    <ul>
                                        <li>Type an expression directly in the editor (example: 2+3*4).</li>
                                        <li>Press Enter to evaluate the current line and append result inline as expression = result.</li>
                                        <li>Start a new line with +, -, *, or / to continue from the previous result.</li>
                                        <li>Assign variables with name = expression or @name = expression (example: @incomes = [4500, 5200, 3800]).</li>
                                        <li>Use pipelines with | to pass data to the next step (example: @incomes | filter(# &gt; 4000) | sum).</li>
                                        <li>Use # inside filter/map stages to refer to the current item.</li>
                                        <li>Available aggregation stages include sum, avg, min, max, and median.</li>
                                        <li>Available math functions include sin, cos, tan, asin, acos, atan, atan2, sqrt, pow, abs, ceil, floor, round, trunc, exp, log, log10, log2, hypot, sign, and constants such as PI, TAU, E, PHI, LN2, LN10, LOG2E, LOG10E, SQRT1_2, SQRT2, SQRTE, SQRTPI, and SQRTPHI.</li>
                                        <li>Functions must be called with parentheses (example: sin(PI/2)); bare references such as sin are rejected except in pipeline shorthand like map(sin).</li>
                                        <li>Internal names are read-only and cannot be reassigned, including built-in constants and functions (examples: PI = 30 and sin = 5 are rejected).</li>
                                        <li>Small editor intelligence suggests known variables plus allowed functions and constants near the caret. Press Tab to accept the top suggestion.</li>
                                        <li>Backtick blocks can contain multiple statements; Enter inserts a new line while the block is open and evaluates after closing backtick.</li>
                                        <li>Line numbers appear in the left gutter for easy reference and navigation.</li>
                                        <li>Toggle word wrap in Settings → Editor to wrap long lines at the window edge (disabled by default for a clean appearance).</li>
                                        <li>Click the precision chip in the status bar to quickly change decimal precision or toggle scientific mode.</li>
                                        <li>Invalid lines are highlighted in red with a gutter ! marker until corrected.</li>
                                        <li>Status messages use plain language and examples to help fix common mistakes quickly, even if you are new to formulas.</li>
                                    </ul>
                                )}
                                {activeHelpPage === 'shortcuts' && (
                                    <ul>
                                        <li>Enter: Evaluate current line.</li>
                                        <li>Ctrl/Cmd + Enter: Insert a new line below without evaluating.</li>
                                        <li>Ctrl/Cmd + N: New worksheet.</li>
                                        <li>Ctrl/Cmd + =: Increase font size.</li>
                                        <li>Ctrl/Cmd + -: Decrease font size.</li>
                                        <li>Ctrl/Cmd + 0: Reset font size.</li>
                                        <li>Tab: Accept the top variable/function/constant suggestion when shown.</li>
                                        <li>Ctrl/Cmd + R: Reload app window.</li>
                                        <li>Ctrl/Cmd + Q: Quit app.</li>
                                        <li>Press Escape twice quickly: Hide app window.</li>
                                    </ul>
                                )}
                                {activeHelpPage === 'new' && (
                                    <ul>
                                        <li>Added line numbers in the editor gutter for easy reference. Numbers now appear alongside error icons and other indicators.</li>
                                        <li>Added word wrap toggle in Settings → Editor to wrap long lines at the window edge. Word wrap is disabled by default for a clean, code-like appearance.</li>
                                        <li>Added Ctrl/Cmd + Enter to insert a new line below the current line without evaluating.</li>
                                        <li>Switched all expression execution to Go backend Expr evaluation with a unified language model across the app.</li>
                                        <li>Added pipeline analytics syntax with | pass-through and # current-item placeholders for filter/map.</li>
                                        <li>Added @variable syntax and list-focused helpers such as sum, avg, min, max, and median.</li>
                                        <li>Added lightweight editor intelligence for known variables and allowed functions/constants, with Tab completion for the top suggestion.</li>
                                        <li>Extended intelligence coverage to include pipeline helpers such as avg, filter, and map in suggestions and highlighting.</li>
                                        <li>Added safe handling for bare function references so expressions like sin now return a user error instead of triggering a backend JSON panic, while map(sin) shorthand maps over each item.</li>
                                        <li>Improved status-bar error messages with clearer guidance for invalid math domains (NaN/Inf), FILTER predicates, internal-name reassignment, and missing function parentheses.</li>
                                        <li>Protected all internal names from reassignment so built-ins like PI, E, TAU, and sin remain immutable.</li>
                                        <li>Expanded Expr math constants to include the practical full set from Go math plus TAU, including PHI, SQRTE, SQRTPI, SQRTPHI, SQRT1_2, and the existing logarithmic constants.</li>
                                        <li>Added JS Math-style functions and constants in expressions (sin, cos, sqrt, pow, max, min, PI, E, and more).</li>
                                        <li>Variables now use classic inline declarations like s = 2+6, with @ markers in the gutter for declaration lines.</li>
                                        <li>Removed configurable variable trigger key behavior from Editor settings.</li>
                                        <li>Added a quick double-Escape shortcut to hide the app window while keeping the app running.</li>
                                        <li>Fixed line-bound variable remapping: deleting or inserting lines now keeps variable letters attached to the correct lines instead of moving onto empty lines.</li>
                                        <li>Restored Help pages in menus: native Help menu entries and in-app menu shortcuts now open Help pages directly.</li>
                                        <li>Added worksheet persistence so your content and carry-over result are restored on restart.</li>
                                        <li>Added on-type line validation with red line state and gutter ! markers.</li>
                                        <li>Added scientific notation support in expressions such as 1e6 and 2.5E-3.</li>
                                        <li>Added decimal delimiter mode in Settings with dot, comma, and system options.</li>
                                        <li>Precision modes: Auto = 10 decimal places, Full = no rounding, or set a fixed 0–15 decimal count. Use the status-bar chip or Settings to switch.</li>
                                        <li>Added experimental simple code mode: backtick-wrapped blocks now support let/const/var and return the value of the last expression.</li>
                                        <li>Extended simple code mode so variable declarations can assign a backtick block result (example: v = `a=2; b=3; a+b`).</li>
                                        <li>Added multiline simple code blocks: Enter now adds new lines while a block is open and evaluates when the closing backtick is present.</li>
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* ── Appearance ── */}
                        <p className="settings-section-label">Appearance</p>
                        <div className="settings-card">
                            <div className="settings-card-header">
                                <div className="settings-card-title">App theme</div>
                                <div className="settings-card-desc">Select which app theme to display</div>
                            </div>
                            <div className="settings-options">
                                {(['light', 'dark', 'system'] as const).map((t) => (
                                    <label key={t} className="settings-option">
                                        <input
                                            type="radio"
                                            name="theme"
                                            value={t}
                                            checked={theme.type === t}
                                            onChange={() => setTheme({ type: t as any })}
                                        />
                                        <span>
                                            {t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'Use system setting'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                            <div className="settings-options" style={{ marginTop: '12px' }}>
                                <button 
                                    className="settings-action-btn settings-open-theme-store-btn"
                                    onClick={openThemeStoreInSidebar}
                                >
                                    Browse Theme Store
                                </button>
                            </div>
                            {savedThemes.length > 0 && (
                                <div className="saved-theme-section">
                                    <div className="saved-theme-title">Saved themes</div>
                                    <div className="saved-theme-list">
                                        {savedThemes.map((entry) => {
                                            const isActive = theme.type === 'custom' && theme.customId === entry.id;
                                            return (
                                                <div key={entry.id} className="saved-theme-chip-row">
                                                    <button
                                                        type="button"
                                                        className={`saved-theme-chip${isActive ? ' saved-theme-chip--active' : ''}`}
                                                        onClick={() => setTheme({
                                                            type: 'custom',
                                                            customColors: entry.colors,
                                                            customId: entry.id,
                                                            customThemeBase: entry.themeBase,
                                                        })}
                                                        title={entry.publisher ? `${entry.name} by ${entry.publisher}` : entry.name}
                                                    >
                                                        {entry.iconUrl && <img src={entry.iconUrl} alt="" aria-hidden="true" />}
                                                        <span>{entry.name}</span>
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
                            )}
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
                            {precision !== 'auto' && (
                                <div className="settings-subaction">
                                    <button
                                        type="button"
                                        className="settings-link-btn"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={resetPrecision}
                                    >
                                        Reset to default
                                    </button>
                                </div>
                            )}
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

                        <div className="settings-card">
                            <div className="settings-row">
                                <div className="settings-row-info">
                                    <div className="settings-row-title">Word wrap</div>
                                    <div className="settings-row-desc">Wrap long lines at window edge</div>
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
                                        {runtimePlatform === 'darwin'
                                            ? 'Use Cmd + Clear (NumLock-equivalent) to restore from hidden/minimized state'
                                            : 'Use Ctrl + NumLock to restore from hidden/minimized state'}
                                    </div>
                                </div>
                                <label className="settings-toggle" aria-label="Toggle restore shortcut">
                                    <input
                                        type="checkbox"
                                        checked={restoreShortcutEnabled}
                                        onChange={(e) => setRestoreShortcutEnabled(e.target.checked)}
                                    />
                                    <span className="settings-toggle-track" />
                                </label>
                            </div>
                        </div>

                    </div>
                    )}
                </div>
        </div>
    );
}

export default App;
