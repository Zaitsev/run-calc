import { useEffect, useState } from 'react';

export const MATH_FUNCTION_NAMES = new Set([
    'ABS', 'ACOS', 'ACOSH', 'ASIN', 'ASINH', 'ALL', 'ANY', 'ATAN', 'ATAN2', 'ATANH',
    'AVG', 'CBRT', 'CEIL', 'COS', 'COSH', 'COUNT', 'EACH', 'EXP', 'FILTER', 'FIND', 'FIRST', 'FLATTEN', 'FLOOR',
    'HYPOT', 'LEN', 'LAST', 'LOG', 'LOG10', 'LOG2', 'MAP', 'MAX', 'MEAN', 'MEDIAN', 'MIN', 'NONE', 'ONE', 'POW',
    'REDUCE', 'REVERSE', 'ROUND', 'SIGN', 'SIN', 'SINH', 'SORT', 'SQRT', 'SUM', 'TAN', 'TANH', 'TAKE', 'TRUNC', 'UNIQ',
]);

export const MATH_CONSTANT_NAMES = new Set([
    'E', 'PI', 'TAU', 'PHI', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT1_2', 'SQRT2', 'SQRTE', 'SQRTPI', 'SQRTPHI',
]);

export function isIdentifierStartChar(ch: string): boolean {
    return /^[a-zA-Z_]$/.test(ch);
}

export function isIdentifierPartChar(ch: string): boolean {
    return /^[a-zA-Z0-9_]$/.test(ch);
}

export function usePrefersDark(): boolean {
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
