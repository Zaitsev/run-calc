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
    WindowSetPosition,
    WindowSetSize
} from '../wailsjs/runtime/runtime';
import './App.css';
import appLogo from './assets/images/icons/hare-calc-1024.png';
import {evaluateExpression, ParseError, type DecimalDelimiter} from './calculator';
import {useTheme, type ThemeState} from './useTheme';
import { getPrimaryShortcutAction } from './editorShortcuts';

import { ThemeStore, type AcceptedThemeEntry } from './ThemeStore';

const OPERATOR_KEY_RE = /^[+\-*/]$/;
const ERROR_SUFFIX = ' = error';
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
const WORKSHEET_CONTENT_STORAGE_KEY = 'calc.editor.content';
const LAST_RESULT_STORAGE_KEY = 'calc.editor.lastResult';
const LINE_VARIABLES_STORAGE_KEY = 'calc.editor.lineVariables';
const VARIABLE_VALUES_STORAGE_KEY = 'calc.editor.variableValues';
const ACCEPTED_THEMES_STORAGE_KEY = 'calc.themes.accepted';
const PRECISION_MIN = 0;
const PRECISION_MAX = 15;

type SavedThemeEntry = AcceptedThemeEntry;

type DecimalDelimiterMode = 'dot' | 'comma' | 'system';
type PrecisionMode = 'auto' | number;

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
        const expStr = precision === 'auto'
            ? value.toExponential()
            : value.toExponential(precision);
        return decimalDelimiter === ',' ? expStr.replace('.', ',') : expStr;
    }

    let str: string;
    if (precision === 'auto') {
        const rounded = Number(value.toFixed(12));
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
        const n = Number(raw);
        if (Number.isInteger(n) && n >= PRECISION_MIN && n <= PRECISION_MAX) return n;
        return 'auto';
    });
    const [scientificNotation, setScientificNotation] = useState(() => {
        return localStorage.getItem(SCIENTIFIC_NOTATION_STORAGE_KEY) === 'true';
    });
    const [lineVariables, setLineVariables] = useState<Record<number, string>>(() => {
        const raw = localStorage.getItem(LINE_VARIABLES_STORAGE_KEY);
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
    const [variableValues, setVariableValues] = useState<Record<string, number>>(() => {
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
    const [pendingRecalc, setPendingRecalc] = useState<{ variable: string; dependents: number[]; newValue: number } | null>(null);
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
    const editorRef = useRef<HTMLTextAreaElement | null>(null);
    const gutterRef = useRef<HTMLDivElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);
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

    // Re-format all evaluated result lines when display settings change.
    useEffect(() => {
        setContent((currentContent) => {
            const lines = currentContent.split('\n');
            let changed = false;
            const newLines = lines.map((line) => {
                const eqIdx = line.indexOf(' = ');
                if (eqIdx === -1) return line;
                const afterEq = line.slice(eqIdx + 3);
                if (afterEq === 'error') return line;
                const expr = line.slice(0, eqIdx).trimEnd();
                if (expr.trim().length === 0) return line;
                try {
                    const result = evaluateExpression(expr, decimalDelimiter, variableValues);
                    const formatted = formatNumber(result, decimalDelimiter, precision, scientificNotation);
                    const newLine = `${expr} = ${formatted}`;
                    if (newLine !== line) {
                        changed = true;
                        return newLine;
                    }
                } catch {
                    // leave unchanged if expression doesn't parse with current delimiter
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
        localStorage.setItem(LINE_VARIABLES_STORAGE_KEY, JSON.stringify(lineVariables));
    }, [lineVariables]);

    useEffect(() => {
        localStorage.setItem(VARIABLE_VALUES_STORAGE_KEY, JSON.stringify(variableValues));
    }, [variableValues]);

    useEffect(() => {
        localStorage.setItem(ACCEPTED_THEMES_STORAGE_KEY, JSON.stringify(savedThemes));
    }, [savedThemes]);

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

        const customMode = inferCustomThemeMode(theme.customColors);
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

    const stripErrorSuffix = (lineText: string) => {
        if (!lineText.endsWith(ERROR_SUFFIX)) {
            return lineText;
        }

        return lineText.slice(0, -ERROR_SUFFIX.length);
    };

    const getExpressionSource = (lineText: string) => {
        const withoutError = stripErrorSuffix(lineText);
        const equalsIndex = withoutError.indexOf('=');

        if (equalsIndex === -1) {
            return withoutError;
        }

        return withoutError.slice(0, equalsIndex).trimEnd();
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

    const updateCaretPosFromEditor = () => {
        if (!editorRef.current) {
            return;
        }

        setCaretPos(editorRef.current.selectionStart);
    };

    const evaluateCurrentLine = () => {
        const editor = editorRef.current;
        if (!editor) {
            return;
        }

        const caretPos = editor.selectionStart;
        const {lineStart, lineEnd} = getLineBounds(content, caretPos);
        const lineText = content.slice(lineStart, lineEnd);
        const editableLine = getExpressionSource(lineText);
        const trimmed = editableLine.trim();
        const lineIndex = content.slice(0, lineStart).split('\n').length - 1;

        if (trimmed.length === 0) {
            insertAtSelection('\n');
            setStatusText('Ready');
            setIsStatusError(false);
            setDevError('');
            return;
        }

        const expression = OPERATOR_KEY_RE.test(trimmed[0]) && lastResult !== null
            ? `${formatNumber(lastResult, decimalDelimiter, 'auto', false)}${trimmed}`
            : editableLine;

        let result: number;
        try {
            result = evaluateExpression(expression, decimalDelimiter, variableValues);
        } catch (error) {
            const replacement = `${editableLine} = error`;
            const before = content.slice(0, lineStart);
            const after = content.slice(lineEnd);
            const nextContent = before + replacement + after;
            const nextCaret = before.length + editableLine.length;
            setContentAndCaret(nextContent, nextCaret);
            setLastResult(null);
            setStatusText('Cannot evaluate this line yet. Fix it and press Enter again.');
            setIsStatusError(true);

            if (error instanceof ParseError) {
                setDevError(`${error.message} at column ${error.position + 1}`);
            } else if (error instanceof Error) {
                setDevError(error.message);
            } else {
                setDevError('Unknown parsing error');
            }
            return;
        }

        const formatted = formatNumber(result, decimalDelimiter, precision, scientificNotation);
        const replacement = `${editableLine} = ${formatted}`;
        const before = content.slice(0, lineStart);
        const after = content.slice(lineEnd);
        const nextContent = before + replacement + after + (lineEnd === content.length ? '\n' : '');
        const nextCaret = lineEnd === content.length
            ? (before + replacement + '\n').length
            : before.length + replacement.length + 1;

        setContentAndCaret(nextContent, nextCaret);
        setLastResult(result);
        setStatusText('Calculated');
        setIsStatusError(false);
        setDevError('');

        // Recalculate dependents if it's a variable assignment
        if (lineIndex in lineVariables) {
            const varName = lineVariables[lineIndex];
            const oldVal = variableValues[varName];
            
            if (oldVal !== result) {
                setVariableValues(prev => ({ ...prev, [varName]: result }));
                
                const lines = nextContent.split('\n');
                const dependentLines: number[] = [];
                const regex = new RegExp(String.raw`(^|[^a-zA-Z])${varName}([^a-zA-Z]|$)`);
                
                for (let i = lineIndex + 1; i < lines.length; i++) {
                    const exprSource = getExpressionSource(lines[i]);
                    if (regex.test(exprSource)) {
                        dependentLines.push(i);
                    }
                }
                
                if (dependentLines.length > 0) {
                    setPendingRecalc({
                        variable: varName,
                        dependents: dependentLines,
                        newValue: result
                    });
                }
            }
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            evaluateCurrentLine();
            return;
        }

        const shortcutAction = getPrimaryShortcutAction(event);
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

        if (shortcutAction === 'assign-variable') {
            event.preventDefault();
            const editor = editorRef.current;
            if (!editor) return;
            const lineIndex = content.slice(0, editor.selectionStart).split('\n').length - 1;
            const letter = event.key.toUpperCase();
            
            setLineVariables((prev) => {
                const next = { ...prev };
                if (next[lineIndex] === letter) {
                    delete next[lineIndex]; // toggle off
                } else {
                    next[lineIndex] = letter;
                }
                return next;
            });
            
            const lineText = content.split('\n')[lineIndex];
            const eqIdx = lineText.indexOf(' = ');
            if (eqIdx !== -1) {
                const afterEq = lineText.slice(eqIdx + 3);
                if (afterEq !== 'error') {
                     const parsedRes = Number(afterEq.replace(decimalDelimiter === ',' ? ',' : '.', '.'));
                     if (Number.isFinite(parsedRes)) {
                         setVariableValues(prev => ({ ...prev, [letter]: parsedRes }));
                     }
                }
            }
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

    const {lines: contentLines, lineErrors, truncatedZeroLines, truncatedLines} = useMemo(() => {
        const nextLineErrors = new Map<number, string>();
        const nextTruncatedZeroLines = new Map<number, number>();
        const nextTruncatedLines = new Map<number, number>(); // significant truncation, non-zero
        const lines = content.split('\n');

        lines.forEach((line, i) => {
            const expression = getExpressionSource(line).trim();
            if (expression.length === 0) {
                return;
            }

            let evalResult: number | null = null;
            try {
                evalResult = evaluateExpression(expression, decimalDelimiter, variableValues);
            } catch (error) {
                // Suppress errors that occur at the very end of the expression: those
                // indicate the user hasn't finished typing yet (e.g. "4+", "2*(").
                // Only show errors whose position is inside the expression body
                // (e.g. "3r4" — unexpected character in the middle).
                const isIncomplete =
                    error instanceof ParseError && error.position >= expression.length;

                if (!isIncomplete) {
                    if (error instanceof ParseError) {
                        nextLineErrors.set(i, `${error.message} at column ${error.position + 1}`);
                    } else if (error instanceof Error) {
                        nextLineErrors.set(i, error.message);
                    } else {
                        nextLineErrors.set(i, 'Invalid expression');
                    }
                }
            }

            if (evalResult !== null && evalResult !== 0 && precision !== 'auto') {
                const formatted = formatNumber(evalResult, decimalDelimiter, precision, scientificNotation);
                const displayed = parseFloat(formatted.replace(',', '.'));
                if (displayed === 0) {
                    nextTruncatedZeroLines.set(i, evalResult);
                } else if (Math.abs(evalResult - displayed) > 1e-8) {
                    nextTruncatedLines.set(i, evalResult);
                }
            }
        });

        return {lines, lineErrors: nextLineErrors, truncatedZeroLines: nextTruncatedZeroLines, truncatedLines: nextTruncatedLines};
    }, [content, decimalDelimiter, precision, scientificNotation, variableValues]);

    const renderOverlayLines = () => {
        return contentLines.map((line, i) => {
            const suffix = i < contentLines.length - 1 ? '\n' : '';
            const lineClassName = lineErrors.has(i) ? 'line-error' : undefined;
            const isVariableLine = i in lineVariables;
            const isMarkedLine = markedLines.has(i);

            if (!isMarkedLine && !isVariableLine) {
                return <span key={i} className={lineClassName}>{line + suffix}</span>;
            }

            const eqIdx = line.indexOf(' = ');
            if (eqIdx === -1) {
                return <span key={i} className={lineClassName}>{line + suffix}</span>;
            }

            const resultClass = isVariableLine
                ? 'marked-result marked-result--var'
                : 'marked-result';

            return (
                <span key={i} className={lineClassName}>
                    {line.slice(0, eqIdx)}
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

    const startThemePreview = (candidate: SavedThemeEntry) => {
        if (!previewRestoreThemeRef.current) {
            previewRestoreThemeRef.current = theme;
        }

        setTheme({
            type: 'custom',
            customColors: candidate.colors,
            customId: candidate.id,
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
                                className={`gutter-line${markedLines.has(i) ? ' gutter-line--marked' : ''}${lineErrors.has(i) ? ' gutter-line--error' : ''}${!lineErrors.has(i) && (truncatedZeroLines.has(i) || truncatedLines.has(i)) ? ' gutter-line--truncated' : ''}${i in lineVariables ? ' gutter-line--var' : ''}`}
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
                                            : (markedLines.has(i) ? 'Remove mark' : 'Mark line')))
                                }
                            >
                                {lineErrors.has(i) && (
                                    <span className="gutter-error-icon" aria-hidden="true">!</span>
                                )}
                                {!lineErrors.has(i) && truncatedZeroLines.has(i) && (
                                    <span className="gutter-truncated-icon" aria-hidden="true">~0</span>
                                )}
                                {!lineErrors.has(i) && !truncatedZeroLines.has(i) && truncatedLines.has(i) && (
                                    <span className="gutter-truncated-icon" aria-hidden="true">≈</span>
                                )}
                                {markedLines.has(i) && !lineErrors.has(i) && !truncatedZeroLines.has(i) && !truncatedLines.has(i) && !(i in lineVariables) && (
                                    <span className="gutter-mark" aria-hidden="true">&#9670;</span>
                                )}
                                {i in lineVariables && (
                                    <span className="gutter-var" aria-hidden="true">{lineVariables[i]}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="editor-area">
                    <textarea
                        ref={editorRef}
                        className="editor"
                        spellCheck={false}
                        value={content}
                        onChange={(e) => {
                            setContent(e.target.value);
                            setCaretPos(e.target.selectionStart);
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
                        className="editor-overlay"
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
                </div>
            </div>
            <div className={`status-bar${isStatusError ? ' error' : ''}`}>
                <span className="status-text">
                    {statusText}
                    {IS_DEV && devError ? ` | dev: ${devError}` : ''}
                </span>
                <span
                    className="status-chip"
                    title={precision === 'auto' ? 'Precision: auto (no rounding)' : `Precision: ${precision} decimal place${precision === 1 ? '' : 's'}`}
                >
                    {precision === 'auto' ? 'prec: auto' : `prec: ${precision}`}
                </span>
                <div className="status-menu-wrap" ref={burgerMenuRef}>
                    <button
                        type="button"
                        className="settings-btn status-menu-btn"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowBurgerMenu((prev) => !prev)}
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
                        setShowSettings(true);
                        setShowThemeStore(false);
                    }}
                    aria-label="Settings"
                    title="Settings"
                >
                    ⚙
                </button>
            </div>

            {pendingRecalc && (
                <div className="recalc-modal-overlay">
                    <div className="recalc-modal">
                        <h3>Variable Changed</h3>
                        <p>
                            Variable <strong>{pendingRecalc.variable}</strong> was updated to {formatNumber(pendingRecalc.newValue, decimalDelimiter, precision, scientificNotation)}.
                            <br/>
                            Recalculate {pendingRecalc.dependents.length} dependent line(s)?
                        </p>
                        <div className="recalc-modal-actions">
                            <button
                                className="recalc-btn-yes"
                                onClick={() => {
                                    setContent(prevContent => {
                                        const lines = prevContent.split('\n');
                                        pendingRecalc.dependents.forEach(idx => {
                                            const line = lines[idx];
                                            const expr = getExpressionSource(line);
                                            try {
                                                const res = evaluateExpression(expr.trim(), decimalDelimiter, variableValues);
                                                lines[idx] = `${expr} = ${formatNumber(res, decimalDelimiter, precision, scientificNotation)}`;
                                            } catch {
                                                lines[idx] = `${expr} = error`;
                                            }
                                        });
                                        return lines.join('\n');
                                    });
                                    setPendingRecalc(null);
                                    
                                    // Focus back on editor
                                    if (editorRef.current) {
                                        editorRef.current.focus();
                                    }
                                }}
                            >
                                Yes
                            </button>
                            <button 
                                className="recalc-btn-no"
                                onClick={() => {
                                    setPendingRecalc(null);
                                    if (editorRef.current) editorRef.current.focus();
                                }}
                            >
                                No
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                    <div className="settings-row-desc">Maximum digits after the decimal point</div>
                                </div>
                                <div className="settings-stepper-group">
                                    <button
                                        type="button"
                                        className="settings-stepper"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => setPrecision((p) => {
                                            if (p === 'auto') return 'auto';
                                            if (p === PRECISION_MIN) return 'auto';
                                            return (p as number) - 1;
                                        })}
                                        disabled={precision === 'auto'}
                                        aria-label="Decrease precision"
                                    >
                                        −
                                    </button>
                                    <span className="settings-stepper-value">
                                        {precision === 'auto' ? 'Auto' : String(precision)}
                                    </span>
                                    <button
                                        type="button"
                                        className="settings-stepper"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => setPrecision((p) => {
                                            if (p === 'auto') return PRECISION_MIN;
                                            if ((p as number) >= PRECISION_MAX) return p;
                                            return (p as number) + 1;
                                        })}
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
                                        onClick={() => setPrecision('auto')}
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

                    </div>
                    )}
                </div>
        </div>
    );
}

export default App;
