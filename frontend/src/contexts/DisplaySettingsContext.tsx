import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PrecisionMode, DecimalDelimiterMode } from '../types/app';
import {
    formatNumber,
    getPrecisionScale,
    getSystemDecimalDelimiter,
    resolveDecimalDelimiter,
} from '../utils/formatting';
import { reformatComputedLineResult } from '../appInteractionLogic';
import {
    AUTO_LOCK_ON_WINDOW_HIDE_STORAGE_KEY,
    AUTO_LOCK_ON_SYSTEM_SLEEP_STORAGE_KEY,
    AUTO_LOCK_TIMEOUT_MINUTES_STORAGE_KEY,
    COPY_MODE_STORAGE_KEY,
        AUTO_EVAL_STORAGE_KEY,
    VARIABLE_FIRST_INLINING_STORAGE_KEY,
    DEFAULT_AUTO_LOCK_ON_WINDOW_HIDE,
    DEFAULT_AUTO_LOCK_ON_SYSTEM_SLEEP,
    DEFAULT_AUTO_LOCK_TIMEOUT_MINUTES,
        DEFAULT_AUTO_EVAL,
    DECIMAL_DELIMITER_STORAGE_KEY,
    PRECISION_STORAGE_KEY,
    SCIENTIFIC_NOTATION_STORAGE_KEY,
    WORD_WRAP_STORAGE_KEY,
    UI_FONT_SCALE_STORAGE_KEY,
    FONT_SCALE_STEP,
    FONT_SCALE_MIN,
    FONT_SCALE_MAX,
    DEFAULT_UI_FONT_SCALE,
    PRECISION_MIN,
    PRECISION_MAX,
    FINANCIAL_PRECISION,
    FOUR_POINT_PRECISION,
    MIN_AUTO_LOCK_TIMEOUT_MINUTES,
    MAX_AUTO_LOCK_TIMEOUT_MINUTES,
} from '../constants';

type DisplaySettingsContextValue = {
    decimalDelimiterMode: DecimalDelimiterMode;
    setDecimalDelimiterMode: (mode: DecimalDelimiterMode) => void;
    decimalDelimiter: '.' | ',';
    systemDecimalDelimiter: '.' | ',';
    precision: PrecisionMode;
    setPrecision: React.Dispatch<React.SetStateAction<PrecisionMode>>;
    decreasePrecision: () => void;
    increasePrecision: () => void;
    resetPrecision: () => void;
    applyFinancialPrecision: () => void;
    applyFourPointPrecision: () => void;
    scientificNotation: boolean;
    setScientificNotation: (v: boolean) => void;
    wordWrap: boolean;
    setWordWrap: React.Dispatch<React.SetStateAction<boolean>>;
    uiFontScale: number;
    setUIFontScale: React.Dispatch<React.SetStateAction<number>>;
    changeUIFontScale: (direction: 1 | -1) => void;
    resetUIFontScale: () => void;
    autoLockTimeoutMinutes: number;
    setAutoLockTimeoutMinutes: (value: number) => void;
    autoLockOnWindowHide: boolean;
    setAutoLockOnWindowHide: (value: boolean) => void;
    autoLockOnSystemSleep: boolean;
    setAutoLockOnSystemSleep: (value: boolean) => void;
    copyMode: 'as-is' | 'expressions-only';
    setCopyMode: (mode: 'as-is' | 'expressions-only') => void;
    autoEval: boolean;
    setAutoEval: (value: boolean) => void;
    variableFirstInlining: boolean;
    setVariableFirstInlining: (v: boolean) => void;
    formatNumber: (value: number, delimiter?: '.' | ',', prec?: PrecisionMode, sci?: boolean) => string;
    /** Call this to trigger a re-format pass on worksheet content when precision/delimiter changes.
     *  Accepts a setContent-like updater from WorksheetContext. */
    reformatContent: (setContent: React.Dispatch<React.SetStateAction<string>>) => void;
    /** True when precision increased (used by WorksheetContext to trigger re-eval) */
    precisionIncreasedRef: React.RefObject<boolean>;
};

const DisplaySettingsContext = createContext<DisplaySettingsContextValue | null>(null);

export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
    const systemDecimalDelimiter = getSystemDecimalDelimiter();

    const [decimalDelimiterMode, setDecimalDelimiterModeState] = useState<DecimalDelimiterMode>(() => {
        const raw = localStorage.getItem(DECIMAL_DELIMITER_STORAGE_KEY);
        if (raw === 'dot' || raw === 'comma' || raw === 'system') return raw;
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

    const [scientificNotation, setScientificNotationState] = useState(() =>
        localStorage.getItem(SCIENTIFIC_NOTATION_STORAGE_KEY) === 'true'
    );

    const [wordWrap, setWordWrap] = useState(() =>
        localStorage.getItem(WORD_WRAP_STORAGE_KEY) === 'true'
    );

    const [uiFontScale, setUIFontScale] = useState(() => {
        const raw = localStorage.getItem(UI_FONT_SCALE_STORAGE_KEY);
        if (!raw) return DEFAULT_UI_FONT_SCALE;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return DEFAULT_UI_FONT_SCALE;
        return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, parsed));
    });

    const [autoLockTimeoutMinutes, setAutoLockTimeoutMinutesState] = useState(() => {
        const raw = localStorage.getItem(AUTO_LOCK_TIMEOUT_MINUTES_STORAGE_KEY);
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
            return DEFAULT_AUTO_LOCK_TIMEOUT_MINUTES;
        }
        return Math.min(MAX_AUTO_LOCK_TIMEOUT_MINUTES, Math.max(MIN_AUTO_LOCK_TIMEOUT_MINUTES, Math.round(parsed)));
    });

    const [autoLockOnWindowHide, setAutoLockOnWindowHideState] = useState(() =>
        {
            const raw = localStorage.getItem(AUTO_LOCK_ON_WINDOW_HIDE_STORAGE_KEY);
            if (raw === null) {
                return DEFAULT_AUTO_LOCK_ON_WINDOW_HIDE;
            }
            return raw === 'true';
        }
    );

    const [autoLockOnSystemSleep, setAutoLockOnSystemSleepState] = useState(() => {
        const raw = localStorage.getItem(AUTO_LOCK_ON_SYSTEM_SLEEP_STORAGE_KEY);
        if (raw === null) {
            return DEFAULT_AUTO_LOCK_ON_SYSTEM_SLEEP;
        }
        return raw === 'true';
    });

    const [copyMode, setCopyModeState] = useState<'as-is' | 'expressions-only'>(() => {
        const raw = localStorage.getItem(COPY_MODE_STORAGE_KEY);
        if (raw === 'expressions-only') return 'expressions-only';
        return 'as-is';
    });

    const [autoEval, setAutoEvalState] = useState(() => {
        const raw = localStorage.getItem(AUTO_EVAL_STORAGE_KEY);
        if (raw === null) {
            return DEFAULT_AUTO_EVAL;
        }
        return raw === 'true';
    });

    const [variableFirstInlining, setVariableFirstInliningState] = useState(() => {
        const raw = localStorage.getItem(VARIABLE_FIRST_INLINING_STORAGE_KEY);
        if (raw === null) {
            return true;  // default: enabled
        }
        return raw === 'true';
    });

    const precisionIncreasedRef = useRef(false);
    const previousPrecisionRef = useRef<PrecisionMode>(precision);

    const decimalDelimiter = resolveDecimalDelimiter(decimalDelimiterMode);

    useEffect(() => {
        localStorage.setItem(DECIMAL_DELIMITER_STORAGE_KEY, decimalDelimiterMode);
    }, [decimalDelimiterMode]);

    useEffect(() => {
        localStorage.setItem(PRECISION_STORAGE_KEY, String(precision));
    }, [precision]);

    useEffect(() => {
        const prev = previousPrecisionRef.current;
        precisionIncreasedRef.current = getPrecisionScale(precision) > getPrecisionScale(prev);
        previousPrecisionRef.current = precision;
    }, [precision]);

    useEffect(() => {
        localStorage.setItem(SCIENTIFIC_NOTATION_STORAGE_KEY, String(scientificNotation));
    }, [scientificNotation]);

    useEffect(() => {
        localStorage.setItem(WORD_WRAP_STORAGE_KEY, String(wordWrap));
    }, [wordWrap]);

    useEffect(() => {
        localStorage.setItem(UI_FONT_SCALE_STORAGE_KEY, String(uiFontScale));
    }, [uiFontScale]);

    useEffect(() => {
        localStorage.setItem(AUTO_LOCK_TIMEOUT_MINUTES_STORAGE_KEY, String(autoLockTimeoutMinutes));
    }, [autoLockTimeoutMinutes]);

    useEffect(() => {
        localStorage.setItem(AUTO_LOCK_ON_WINDOW_HIDE_STORAGE_KEY, String(autoLockOnWindowHide));
    }, [autoLockOnWindowHide]);

    useEffect(() => {
        localStorage.setItem(AUTO_LOCK_ON_SYSTEM_SLEEP_STORAGE_KEY, String(autoLockOnSystemSleep));
    }, [autoLockOnSystemSleep]);

    useEffect(() => {
        localStorage.setItem(COPY_MODE_STORAGE_KEY, copyMode);
    }, [copyMode]);

    useEffect(() => {
        localStorage.setItem(AUTO_EVAL_STORAGE_KEY, String(autoEval));
    }, [autoEval]);

    useEffect(() => {
        localStorage.setItem(VARIABLE_FIRST_INLINING_STORAGE_KEY, String(variableFirstInlining));
    }, [variableFirstInlining]);

    const setCopyMode = (mode: 'as-is' | 'expressions-only') => setCopyModeState(mode);
    const setAutoEval = (value: boolean) => setAutoEvalState(value);
    const setVariableFirstInlining = (v: boolean) => setVariableFirstInliningState(v);

    const setDecimalDelimiterMode = (mode: DecimalDelimiterMode) => setDecimalDelimiterModeState(mode);
    const setScientificNotation = (v: boolean) => setScientificNotationState(v);
    const setAutoLockTimeoutMinutes = (value: number) => {
        const normalized = Math.min(MAX_AUTO_LOCK_TIMEOUT_MINUTES, Math.max(MIN_AUTO_LOCK_TIMEOUT_MINUTES, Math.round(value)));
        setAutoLockTimeoutMinutesState(normalized);
    };
    const setAutoLockOnWindowHide = (value: boolean) => setAutoLockOnWindowHideState(value);
    const setAutoLockOnSystemSleep = (value: boolean) => setAutoLockOnSystemSleepState(value);

    const changeUIFontScale = (direction: 1 | -1) => {
        setUIFontScale((current) => {
            const next = current + direction * FONT_SCALE_STEP;
            return Number(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, next)).toFixed(2));
        });
    };

    const resetUIFontScale = () => {
        setUIFontScale(DEFAULT_UI_FONT_SCALE);
    };

    const decreasePrecision = () => {
        setPrecision((current: PrecisionMode) => {
            if (current === 'full') return 'full';
            if (current === 'auto') return 'full';
            if (current === PRECISION_MIN) return 'auto';
            return (current as number) - 1;
        });
    };

    const increasePrecision = () => {
        setPrecision((current: PrecisionMode) => {
            if (current === 'full') return 'auto';
            if (current === 'auto') return PRECISION_MIN;
            if ((current as number) >= PRECISION_MAX) return current;
            return (current as number) + 1;
        });
    };

    const resetPrecision = () => setPrecision('auto');
    const applyFinancialPrecision = () => setPrecision(FINANCIAL_PRECISION);
    const applyFourPointPrecision = () => setPrecision(FOUR_POINT_PRECISION);

    const fmtNumber = (
        value: number,
        delimiter: '.' | ',' = decimalDelimiter,
        prec: PrecisionMode = precision,
        sci: boolean = scientificNotation,
    ) => formatNumber(value, delimiter, prec, sci);

    const reformatContent = (setContent: React.Dispatch<React.SetStateAction<string>>) => {
        setContent((current) => {
            const lines = current.split('\n');
            let changed = false;
            const newLines = lines.map((line) => {
                const newLine = reformatComputedLineResult(line, decimalDelimiter, precision, scientificNotation, formatNumber);
                if (newLine !== line) { changed = true; return newLine; }
                return line;
            });
            return changed ? newLines.join('\n') : current;
        });
    };

    return (
        <DisplaySettingsContext.Provider value={{
            decimalDelimiterMode,
            setDecimalDelimiterMode,
            decimalDelimiter,
            systemDecimalDelimiter,
            precision,
            setPrecision,
            decreasePrecision,
            increasePrecision,
            resetPrecision,
            applyFinancialPrecision,
            applyFourPointPrecision,
            scientificNotation,
            setScientificNotation,
            wordWrap,
            setWordWrap,
            uiFontScale,
            setUIFontScale,
            changeUIFontScale,
            resetUIFontScale,
            autoLockTimeoutMinutes,
            setAutoLockTimeoutMinutes,
            autoLockOnWindowHide,
            setAutoLockOnWindowHide,
            autoLockOnSystemSleep,
            setAutoLockOnSystemSleep,
            copyMode,
            setCopyMode,
                autoEval,
                setAutoEval,
            variableFirstInlining,
            setVariableFirstInlining,
            formatNumber: fmtNumber,
            reformatContent,
            precisionIncreasedRef,
        }}>
            {children}
        </DisplaySettingsContext.Provider>
    );
}

export function useDisplaySettings(): DisplaySettingsContextValue {
    const ctx = useContext(DisplaySettingsContext);
    if (!ctx) throw new Error('useDisplaySettings must be used inside DisplaySettingsProvider');
    return ctx;
}
