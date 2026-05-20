import {describe, expect, it} from 'vitest';
import {
    buildEvaluationExpression,
    buildStaleLineDetails,
    SHADOW_STALE_MARKER,
    getCopyableNumericResultText,
    getPreservedCaretOffset,
    getFriendlyEvalErrorMessage,
    parseNumericText,
    reformatComputedLineResult,
    shouldSkipEvaluationAtCaret,
    stripMarkdownCodeFences,
    shouldSkipEvaluation,
} from './appInteractionLogic';

describe('app interaction helpers', () => {
    it('skips evaluation for empty and comment-only lines', () => {
        expect(shouldSkipEvaluation('   ')).toBe(true);
        expect(shouldSkipEvaluation('" note')).toBe(true);
        expect(shouldSkipEvaluation('2 + 3 " note')).toBe(false);
    });

    it('skips evaluation when Enter is pressed inside trailing comment text', () => {
        expect(shouldSkipEvaluationAtCaret('2 + 3 " note', 0)).toBe(false);
        expect(shouldSkipEvaluationAtCaret('2 + 3 " note', 6)).toBe(false);
        expect(shouldSkipEvaluationAtCaret('2 + 3 " note', 8)).toBe(true);
        expect(shouldSkipEvaluationAtCaret('" note', 3)).toBe(true);
    });

    it('preserves caret position on replacement lines within bounds', () => {
        expect(getPreservedCaretOffset(4, 12)).toBe(4);
        expect(getPreservedCaretOffset(20, 8)).toBe(8);
        expect(getPreservedCaretOffset(-5, 8)).toBe(0);
    });

    it('accepts only numeric text for clipboard-compatible copy and paste flows', () => {
        expect(parseNumericText('  12.5 ')).toBe('12.5');
        expect(parseNumericText('-1,25e3')).toBe('-1,25e3');
        expect(parseNumericText('true')).toBeNull();
        expect(parseNumericText('[1, 2]')).toBeNull();
    });

    it('builds operator carry-over expression only when last result exists', () => {
        const format = (value: number, delimiter: '.' | ',') =>
            delimiter === ',' ? String(value).replace('.', ',') : String(value);

        expect(buildEvaluationExpression('+2', '+2', 5, '.', format)).toBe('5+2');
        expect(buildEvaluationExpression('-3', '-3', 1.5, ',', format)).toBe('1,5-3');
        expect(buildEvaluationExpression('2+3', '2+3', 5, '.', format)).toBe('2+3');
        expect(buildEvaluationExpression('+2', '+2', null, '.', format)).toBe('+2');
    });

    it('uses variable name instead of result when variable-first inlining is enabled', () => {
        const format = (value: number, delimiter: '.' | ',') =>
            delimiter === ',' ? String(value).replace('.', ',') : String(value);

        // Variable assignment: should use variable name
        expect(buildEvaluationExpression('+', '+', 5, '.', format, 'a=5', true)).toBe('a+');
        expect(buildEvaluationExpression('+2', '+2', 5, '.', format, 'a=5', true)).toBe('a+2');
        expect(buildEvaluationExpression('*3', '*3', 10, '.', format, 'price=100', true)).toBe('price*3');
        expect(buildEvaluationExpression('-1', '-1', 42, '.', format, '@arr=[1,2,3]', true)).toBe('@arr-1');
        
        // Regular expression: should still use result
        expect(buildEvaluationExpression('+2', '+2', 5, '.', format, '2+3 = 5', true)).toBe('5+2');
        
        // When disabled: should use result
        expect(buildEvaluationExpression('+2', '+2', 5, '.', format, 'a=5', false)).toBe('5+2');
        
        // Without previous line: should use result
        expect(buildEvaluationExpression('+2', '+2', 5, '.', format, '', true)).toBe('5+2');
    });

    it('maps syntax and math failures to user-friendly messages', () => {
        expect(getFriendlyEvalErrorMessage('mismatched input )')).toContain('typing mistake');
        expect(getFriendlyEvalErrorMessage('division by zero')).toContain('Division by zero');
        expect(getFriendlyEvalErrorMessage('unknown variable price')).toContain('not recognized');
        expect(getFriendlyEvalErrorMessage('some unexpected backend issue')).toContain('Cannot evaluate');
    });

    it('labels background-check stale markers', () => {
        const stale = buildStaleLineDetails(
            {
                2: {[SHADOW_STALE_MARKER]: -1},
            },
        );

        expect(stale.get(2)).toEqual(['background check']);
    });

    it('strips markdown code fences from AI code blocks before insertion', () => {
        expect(stripMarkdownCodeFences('```\na = 1..10\nmean_a = a | avg\n```')).toBe('a = 1..10\nmean_a = a | avg');
        expect(stripMarkdownCodeFences('```calc\na = 1..10\nmean_a = a | avg\n```')).toBe('a = 1..10\nmean_a = a | avg');
        expect(stripMarkdownCodeFences('a = 1..10\nmean_a = a | avg')).toBe('a = 1..10\nmean_a = a | avg');
    });

    it('reformats computed numeric suffixes while preserving quote comments', () => {
        const format = (value: number, delimiter: '.' | ',', precision: 'auto' | 'full' | number) => {
            if (precision === 'auto') {
                return String(Number(value.toFixed(10)));
            }
            if (precision === 'full') {
                return String(value);
            }

            const fixed = value.toFixed(precision).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
            return delimiter === ',' ? fixed.replace('.', ',') : fixed;
        };

        expect(reformatComputedLineResult('2/3 = 0.6666666667 " note', '.', 2, false, format)).toBe('2/3 = 0.67 " note');
    });

    it('reformats declaration result suffixes based on last equals marker', () => {
        const format = (value: number) => value.toFixed(2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

        expect(reformatComputedLineResult('v = 2/3 = 0.6666666667', '.', 2, false, format)).toBe('v = 2/3 = 0.67');
        expect(reformatComputedLineResult('v = 2/3 " keep', '.', 2, false, format)).toBe('v = 2/3 " keep');
    });

    it('only exposes evaluated numeric results for result-copy actions', () => {
        expect(getCopyableNumericResultText('2 + 3 = 5', false)).toBe('5');
        expect(getCopyableNumericResultText('total = 2 + 3 = 5', true)).toBe('5');
        expect(getCopyableNumericResultText('total = 5', true)).toBeNull();
        expect(getCopyableNumericResultText('label = "ok" = ok', true)).toBeNull();
        expect(getCopyableNumericResultText('status = true', false)).toBeNull();
    });
});
