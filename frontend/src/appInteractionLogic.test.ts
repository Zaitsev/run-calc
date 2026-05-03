import {describe, expect, it} from 'vitest';
import {
    buildEvaluationExpression,
    buildStaleLineDetails,
    getPreservedCaretOffset,
    getFriendlyEvalErrorMessage,
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

    it('builds operator carry-over expression only when last result exists', () => {
        const format = (value: number, delimiter: '.' | ',') =>
            delimiter === ',' ? String(value).replace('.', ',') : String(value);

        expect(buildEvaluationExpression('+2', '+2', 5, '.', format)).toBe('5+2');
        expect(buildEvaluationExpression('-3', '-3', 1.5, ',', format)).toBe('1,5-3');
        expect(buildEvaluationExpression('2+3', '2+3', 5, '.', format)).toBe('2+3');
        expect(buildEvaluationExpression('+2', '+2', null, '.', format)).toBe('+2');
    });

    it('maps syntax and math failures to user-friendly messages', () => {
        expect(getFriendlyEvalErrorMessage('mismatched input )')).toContain('typing mistake');
        expect(getFriendlyEvalErrorMessage('division by zero')).toContain('Division by zero');
        expect(getFriendlyEvalErrorMessage('unknown variable price')).toContain('not recognized');
        expect(getFriendlyEvalErrorMessage('some unexpected backend issue')).toContain('Cannot evaluate');
    });

    it('builds stale-line details when variable versions no longer match snapshots', () => {
        const stale = buildStaleLineDetails(
            {
                1: {price: 1, tax: 3},
                3: {price: 1},
            },
            {
                price: 2,
                tax: 3,
            },
        );

        expect(stale.size).toBe(2);
        expect(stale.get(1)).toEqual(['price']);
        expect(stale.get(3)).toEqual(['price']);
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
});
