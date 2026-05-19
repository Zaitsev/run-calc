import { splitLineComment } from '../lineExpression';
import type { DecimalDelimiter, PrecisionMode } from '../types/app';
import { formatNumber } from './formatting';

export function getLineBounds(text: string, pos: number): { lineStart: number; lineEnd: number } {
    const lineStart = text.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
    const nextBreak = text.indexOf('\n', pos);
    const lineEnd = nextBreak === -1 ? text.length : nextBreak;
    return { lineStart, lineEnd };
}

export function lineIndexAtPosition(text: string, position: number): number {
    let count = 0;
    for (let i = 0; i < position; i++) {
        if (text[i] === '\n') count++;
    }
    return count;
}

export function parseDeclaredVariable(lineText: string): { key: string; label: string; expression: string } | null {
    const match = lineText.match(/^\s*(@?[a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (!match) return null;
    const label = match[1];
    const key = (label.startsWith('@') ? label.slice(1) : label).toLowerCase();
    return { key, label, expression: match[2].trim() };
}

export function appendLineComment(base: string, comment: string): string {
    if (!comment) return base;
    const trimmedBase = base.trimEnd();
    return trimmedBase.length > 0 ? `${trimmedBase} ${comment}` : comment;
}

export function formatEvaluatedLine(lineSource: string, resultText: string): string {
    const { body, comment } = splitLineComment(lineSource);
    const bodySource = body.trimEnd();
    const declaration = parseDeclaredVariable(bodySource);
    const base = declaration
        ? `${declaration.label} = ${declaration.expression} = ${resultText}`
        : `${bodySource} = ${resultText}`;
    return appendLineComment(base, comment);
}

export function formatExprValue(
    value: unknown,
    isNumber: boolean,
    numberValue: number,
    decimalDelimiter: DecimalDelimiter,
    precision: PrecisionMode,
    scientificNotation: boolean,
): string {
    if (isNumber) return formatNumber(numberValue, decimalDelimiter, precision, scientificNotation);
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return formatNumber(value, decimalDelimiter, precision, scientificNotation);
    if (typeof value === 'boolean' || value === null) return String(value);
    try { return JSON.stringify(value); } catch { return String(value); }
}
