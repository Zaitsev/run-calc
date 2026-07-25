import { splitLineComment } from './lineExpression';
import { parseDeclaredVariable } from './utils/worksheetEditing';

type DecimalDelimiter = '.' | ',';
type PrecisionMode = 'auto' | 'full' | number;
const NUMERIC_TEXT_REGEX = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?$/;
export const SHADOW_STALE_MARKER = '__shadow_verification__';
export const UNEVALUATED_STALE_MARKER = '__unevaluated__';

type FormatNumberFn = (
    value: number,
    decimalDelimiter: DecimalDelimiter,
    precision: PrecisionMode,
    useScientific: boolean,
) => string;

export function shouldSkipEvaluation(lineText: string): boolean {
    const trimmed = lineText.trim();
    const {body} = splitLineComment(lineText);
    return trimmed.length === 0 || body.trim().length === 0;
}

export function shouldSkipEvaluationAtCaret(lineText: string, caretOffsetInLine: number): boolean {
    if (shouldSkipEvaluation(lineText)) {
        return true;
    }

    const {body, comment} = splitLineComment(lineText);
    if (comment.length === 0) {
        return false;
    }

    return caretOffsetInLine > body.length;
}

export function getPreservedCaretOffset(caretOffsetInLine: number, replacementLength: number): number {
    return Math.max(0, Math.min(caretOffsetInLine, replacementLength));
}

export function parseNumericText(text: string): string | null {
    const trimmed = text.trim();
    return NUMERIC_TEXT_REGEX.test(trimmed) ? trimmed : null;
}

export function isAITriggerSourceLine(lineText: string): boolean {
    const {body} = splitLineComment(lineText);
    return body.trimStart().startsWith('?');
}

export function getCopyableNumericResultText(lineText: string, isVariableLine: boolean): string | null {
    const {body} = splitLineComment(lineText);
    const firstEqualsIndex = body.indexOf(' = ');
    if (firstEqualsIndex === -1) {
        return null;
    }

    const resultEqualsIndex = isVariableLine ? body.indexOf(' = ', firstEqualsIndex + 3) : firstEqualsIndex;
    if (resultEqualsIndex === -1) {
        return null;
    }

    return parseNumericText(body.slice(resultEqualsIndex + 3));
}

export function shouldScheduleStaleVerification(isWorksheetLocked: boolean): boolean {
    return !isWorksheetLocked;
}

export function shouldAutoReevaluateStaleLines(params: {
    autoEval: boolean;
    isWorksheetLocked: boolean;
    isAIQueryPending: boolean;
    isReevaluatingAll: boolean;
    autoEvalEnterSequence: number;
    processedAutoEvalEnterSequence: number;
}): boolean {
    const {
        autoEval,
        isWorksheetLocked,
        isAIQueryPending,
        isReevaluatingAll,
        autoEvalEnterSequence,
        processedAutoEvalEnterSequence,
    } = params;

    if (autoEvalEnterSequence === 0) {
        return false;
    }

    if (autoEvalEnterSequence <= processedAutoEvalEnterSequence) {
        return false;
    }

    return autoEval && !isWorksheetLocked && !isAIQueryPending && !isReevaluatingAll;
}

export function buildEvaluationExpression(
    editableLine: string,
    trimmedLine: string,
    lastResult: number | null,
    decimalDelimiter: DecimalDelimiter,
    formatNumber: (value: number, decimalDelimiter: DecimalDelimiter) => string,
    declaredLabel?: string | null,
    variableFirstInlining?: boolean,
): string {
    if (!trimmedLine.match(/^[+\-*/]/) || lastResult === null) {
        return editableLine;
    }

    // If variable-first inlining is enabled and the carried-over value came from
    // a variable declaration line, use the variable name instead of the result.
    if (variableFirstInlining && declaredLabel) {
        return `${declaredLabel}${trimmedLine}`;
    }

    // Otherwise, use the original behavior: inject the last result
    return `${formatNumber(lastResult, decimalDelimiter)}${trimmedLine}`;
}

export interface LastEvaluatedLineInfo {
    /** The numeric result carried over from the nearest evaluated line above the cursor. */
    value: number;
    /** The variable label (e.g. "a" or "@arr") if that line was a declaration, otherwise null. */
    declaredLabel: string | null;
}

/**
 * Scans upward from `currentLineStart` for the nearest line with a finite evaluated
 * result (an ` = <number>` suffix), skipping empty lines, comment/AI-only lines, and
 * unevaluated declarations. Returns both the numeric value and — in a single pass —
 * whether that line was a variable declaration, so callers never have to reconcile
 * two independently-scanned answers for the same cursor position.
 */
export function getLastEvaluatedLineInfo(content: string, currentLineStart: number): LastEvaluatedLineInfo | null {
    let searchEnd = currentLineStart;
    let maxIterations = content.length;
    while (searchEnd > 0 && maxIterations > 0) {
        maxIterations--;
        const prevLineEnd = searchEnd - 1;
        const prevLineStart = prevLineEnd > 0 ? content.lastIndexOf('\n', prevLineEnd - 1) + 1 : 0;
        const lineText = content.slice(prevLineStart, prevLineEnd);
        if (lineText.trim().length === 0) {
            searchEnd = prevLineStart;
            continue;
        }
        const {body} = splitLineComment(lineText);
        const trimmedBody = body.trimEnd();
        const decl = parseDeclaredVariable(trimmedBody);
        if (decl && !decl.expression.includes(' = ') && !parseNumericText(decl.expression)) {
            searchEnd = prevLineStart;
            continue;
        }
        const equalsIndex = trimmedBody.lastIndexOf(' = ');
        if (equalsIndex === -1) {
            searchEnd = prevLineStart;
            continue;
        }
        const resultText = trimmedBody.slice(equalsIndex + 3).trim();
        const num = Number(resultText.replace(',', '.'));
        if (isFinite(num)) {
            return {value: num, declaredLabel: decl ? decl.label : null};
        }
        searchEnd = prevLineStart;
    }
    return null;
}

export function reformatComputedLineResult(
    lineText: string,
    decimalDelimiter: DecimalDelimiter,
    precision: PrecisionMode,
    useScientific: boolean,
    formatNumber: FormatNumberFn,
): string {
    const {body, comment} = splitLineComment(lineText);
    const equalsIndex = body.lastIndexOf(' = ');
    if (equalsIndex === -1) {
        return lineText;
    }

    const resultText = body.slice(equalsIndex + 3).trim();
    if (resultText.length === 0 || resultText === 'error') {
        return lineText;
    }

    const numericResult = Number(resultText.replace(',', '.'));
    if (!Number.isFinite(numericResult)) {
        return lineText;
    }

    const formattedResult = formatNumber(numericResult, decimalDelimiter, precision, useScientific);
    const nextBody = `${body.slice(0, equalsIndex + 3)}${formattedResult}`;
    if (!comment) {
        return nextBody;
    }

    const trimmedBody = nextBody.trimEnd();
    return trimmedBody.length > 0 ? `${trimmedBody} ${comment}` : comment;
}

export function stripMarkdownCodeFences(text: string): string {
    const trimmed = text.trim();
    if (!trimmed.startsWith('```')) {
        return trimmed;
    }

    const firstLineBreak = trimmed.indexOf('\n');
    if (firstLineBreak === -1) {
        return trimmed.replace(/^```[a-zA-Z0-9_-]*\s*/, '').replace(/```$/, '').trim();
    }

    const openingFence = trimmed.slice(0, firstLineBreak).trim();
    if (!/^```[a-zA-Z0-9_-]*$/.test(openingFence)) {
        return trimmed;
    }

    const bodyWithClosingFence = trimmed.slice(firstLineBreak + 1);
    if (!bodyWithClosingFence.endsWith('```')) {
        return trimmed;
    }

    return bodyWithClosingFence.slice(0, -3).trim();
}

export function getFriendlyEvalErrorMessage(message: string): string {
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
        return 'A pipeline step after | is not valid. Use filter, map, each, or aggregation functions like sum, count, mean, median, min, max, all, any, reduce, etc.';
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

export function buildStaleLineDetails(
    staleLineMarkers: Record<number, Record<string, number>>,
): Map<number, string[]> {
    const details = new Map<number, string[]>();
    Object.entries(staleLineMarkers).forEach(([lineKey, snapshot]) => {
        const lineIndex = Number(lineKey);
        if (!Number.isFinite(lineIndex)) {
            return;
        }

        const staleVariables: string[] = [];
        Object.entries(snapshot).forEach(([variableName]) => {
            if (variableName === SHADOW_STALE_MARKER) {
                staleVariables.push('background check');
                return;
            }

            if (variableName === UNEVALUATED_STALE_MARKER) {
                staleVariables.push('not evaluated');
            }
        });

        if (staleVariables.length > 0) {
            details.set(lineIndex, staleVariables);
        }
    });

    return details;
}
