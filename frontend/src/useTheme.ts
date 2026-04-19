import { useEffect, useState } from 'react';

export type ThemeType = 'light' | 'dark' | 'system' | 'custom';

export interface ThemeState {
    type: ThemeType;
    customColors?: Record<string, string>;
    customId?: string;
    customThemeBase?: 'dark' | 'light';
}

const THEME_KEY = 'calc.theme';
const DEFAULT_THEME: ThemeState = { type: 'system' };

function parseHexColor(color: string): [number, number, number] | null {
    const trimmed = color.trim();
    const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
    if (!hexMatch) {
        return null;
    }

    const hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
        return [
            parseInt(hex[0] + hex[0], 16),
            parseInt(hex[1] + hex[1], 16),
            parseInt(hex[2] + hex[2], 16),
        ];
    }

    return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
    ];
}

function parseRgbColor(color: string): [number, number, number] | null {
    const trimmed = color.trim();
    const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
    if (!rgbMatch) {
        return null;
    }

    const parts = rgbMatch[1].split(',').map((part) => part.trim());
    if (parts.length < 3) {
        return null;
    }

    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if ([r, g, b].some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
        return null;
    }

    return [r, g, b];
}

function parseColor(color?: string): [number, number, number] | null {
    if (!color) {
        return null;
    }

    return parseHexColor(color) || parseRgbColor(color);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
    const toLinear = (channel: number): number => {
        const normalized = channel / 255;
        return normalized <= 0.03928
            ? normalized / 12.92
            : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };

    const red = toLinear(r);
    const green = toLinear(g);
    const blue = toLinear(b);
    return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(foreground: [number, number, number], background: [number, number, number]): number {
    const l1 = relativeLuminance(foreground);
    const l2 = relativeLuminance(background);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

function applyTheme(themeState: ThemeState): void {
    const root = document.documentElement;

    // Clear existing inline custom color styles
    for (const key of Array.from(root.style)) {
        if (key.startsWith('--')) {
            root.style.removeProperty(key);
        }
    }

    if (themeState.type === 'custom' && themeState.customColors) {
        const customColors = themeState.customColors;
        // Use the theme's base type (dark/light) so missing variables inherit correct defaults
        const baseTheme = themeState.customThemeBase || 'dark';
        root.setAttribute('data-theme', baseTheme);
        for (const [key, value] of Object.entries(customColors)) {
            // Convert e.g. editor.background -> --editor-background
            const cssVar = '--' + key.replace(/\./g, '-');
            root.style.setProperty(cssVar, value);
            
            // Standard mapping fallback keys exactly as requested
            if (key === 'editor.background') root.style.setProperty('--html-bg', value);
            if (key === 'sideBar.background') root.style.setProperty('--window-bg', value);
            if (key === 'textLink.foreground') root.style.setProperty('--gutter-mark-color', value);
            if (key === 'symbolIcon.functionForeground') root.style.setProperty('--result-marked-color', value);
            if (key === 'symbolIcon.variableForeground') {
                root.style.setProperty('--result-variable-color', value);
                root.style.setProperty('--gutter-var-color', value);
            }
        }

        // Token colors from TextMate scopes (highest priority for syntax highlighting)
        const tokenFunction = customColors['tokenColor.function'];
        const tokenVariable = customColors['tokenColor.variable'];
        const tokenNumber = customColors['tokenColor.number'];
        const tokenOperator = customColors['tokenColor.operator'];
        const tokenConstant = customColors['tokenColor.constant'];
        const tokenPunctuation = customColors['tokenColor.punctuation'];
        const tokenComment = customColors['tokenColor.comment'];
        const aiInfoForeground = customColors['editorInfo.foreground'];
        const aiInfoBackground = customColors['editorInfo.background'];
        const aiHintForeground = customColors['editorHint.foreground'];
        const aiHintBackground = customColors['editorHint.background'];
        const scrollbarThumb = customColors['scrollbarSlider.background'];
        const scrollbarThumbHover = customColors['scrollbarSlider.hoverBackground'];
        const scrollbarThumbActive = customColors['scrollbarSlider.activeBackground'];
        const scrollbarShadow = customColors['scrollbar.shadow'];

        // Workbench icon colors (fallback)
        const functionColor = tokenFunction || customColors['symbolIcon.functionForeground'];
        const variableColor = tokenVariable || customColors['symbolIcon.variableForeground'];
        const operatorColor = tokenOperator || customColors['symbolIcon.operatorForeground'];
        const numberColor = tokenNumber || customColors['symbolIcon.numberForeground'];
        const constantColor = tokenConstant || customColors['symbolIcon.constantForeground'];
        const linkColor = customColors['textLink.foreground'];
        const gutterBg =
            customColors['editorGutter.background']
            || customColors['editor.background']
            || customColors['sideBar.background'];
        const gutterBorder =
            customColors['editorGroup.border']
            || customColors['sideBar.border'];
        const gutterLineNumberColor =
            customColors['editorLineNumber.activeForeground']
            || customColors['editorLineNumber.foreground']
            || functionColor
            || linkColor;

        if (!functionColor && linkColor) {
            root.style.setProperty('--result-marked-color', linkColor);
        }

        root.style.setProperty('--syntax-function', functionColor || linkColor || 'currentColor');
        root.style.setProperty('--syntax-variable', variableColor || linkColor || functionColor || 'currentColor');
        root.style.setProperty('--syntax-variable-declaration', variableColor || functionColor || linkColor || 'currentColor');
        root.style.setProperty('--syntax-operator', operatorColor || linkColor || functionColor || 'currentColor');
        root.style.setProperty('--syntax-number', numberColor || functionColor || variableColor || 'currentColor');
        root.style.setProperty('--syntax-constant', constantColor || functionColor || linkColor || 'currentColor');
        root.style.setProperty('--syntax-punctuation', tokenPunctuation || customColors['editor.foreground'] || 'currentColor');
        root.style.setProperty('--syntax-comment', tokenComment || customColors['descriptionForeground'] || tokenPunctuation || customColors['editor.foreground'] || 'currentColor');

        if (!variableColor) {
            const fallbackVariableColor = linkColor || functionColor;
            if (fallbackVariableColor) {
                root.style.setProperty('--result-variable-color', fallbackVariableColor);
                root.style.setProperty('--gutter-var-color', fallbackVariableColor);
            }
        }

        if (gutterBg) {
            root.style.setProperty('--editorGutter-background', gutterBg);
        }

        if (gutterBorder) {
            root.style.setProperty('--editorGroup-border', gutterBorder);
        }

        if (gutterLineNumberColor) {
            root.style.setProperty('--editorLineNumber-activeForeground', gutterLineNumberColor);
        }

        const aiForeground = aiInfoForeground || aiHintForeground || linkColor || functionColor || customColors['editor.foreground'];
        const aiBackground = aiInfoBackground || aiHintBackground || customColors['editor.selectionBackground'];

        if (aiForeground) {
            root.style.setProperty('--gutter-ai-color', aiForeground);
            root.style.setProperty('--ai-line-color', aiForeground);
        }

        if (aiBackground) {
            root.style.setProperty('--gutter-ai-bg', aiBackground);
            root.style.setProperty('--ai-line-bg', aiBackground);
        }

        const scrollbarTrack = scrollbarShadow || customColors['editor.background'] || customColors['sideBar.background'];
        if (scrollbarTrack) {
            root.style.setProperty('--scrollbar-track', scrollbarTrack);
        }

        if (scrollbarThumb) {
            root.style.setProperty('--scrollbar-thumb', scrollbarThumb);
        }

        if (scrollbarThumbHover || scrollbarThumb) {
            root.style.setProperty('--scrollbar-thumb-hover', scrollbarThumbHover || scrollbarThumb || 'currentColor');
        }

        if (scrollbarThumbActive || scrollbarThumbHover || scrollbarThumb) {
            root.style.setProperty('--scrollbar-thumb-active', scrollbarThumbActive || scrollbarThumbHover || scrollbarThumb || 'currentColor');
        }

        const editorBg = parseColor(customColors['editor.background']);
        const editorFg = parseColor(customColors['editor.foreground']);
        const errorFg = parseColor(customColors['editorError.foreground'] || customColors['problemsErrorIcon.foreground']);
        const fallbackError = baseTheme === 'dark' ? '#fda4af' : '#b4233d';

        if (editorBg) {
            if (!errorFg || contrastRatio(errorFg, editorBg) < 3) {
                root.style.setProperty('--editorError-foreground', fallbackError);
            }

            const explainerFallback = baseTheme === 'dark' ? '#fecdd3' : '#6b0f22';
            const explainerColor = parseColor(customColors['editorError.foreground'] || customColors['problemsErrorIcon.foreground']);
            if (!explainerColor || contrastRatio(explainerColor, editorBg) < 3.5) {
                root.style.setProperty('--line-error-explainer-color', explainerFallback);
            }
        } else if (!errorFg && editorFg) {
            root.style.setProperty('--editorError-foreground', fallbackError);
        }
    } else {
        const resolved =
            themeState.type === 'system'
                ? window.matchMedia('(prefers-color-scheme: dark)').matches
                    ? 'dark'
                    : 'light'
                : themeState.type;
        root.setAttribute('data-theme', resolved);
    }
}

export function useTheme() {
    const [theme, setThemeState] = useState<ThemeState>(() => {
        const raw = localStorage.getItem(THEME_KEY);
        if (!raw) return DEFAULT_THEME;
        try {
            const parsed = JSON.parse(raw);
            return parsed.type ? parsed : { type: parsed }; 
        } catch {
            return { type: raw as ThemeType };
        }
    });

    useEffect(() => {
        applyTheme(theme);
        localStorage.setItem(THEME_KEY, JSON.stringify(theme));

        if (theme.type !== 'system') {
            return;
        }

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = () => applyTheme({ type: 'system' });
        mq.addEventListener('change', listener);
        return () => mq.removeEventListener('change', listener);
    }, [theme]);

    return { theme, setTheme: setThemeState };
}
