import {describe, expect, it} from 'vitest';
import {
    buildEvaluationExpression,
    buildStaleLineDetails,
    getFriendlyEvalErrorMessage,
    shouldSkipEvaluation,
} from './appInteractionLogic';

describe('app interaction helpers', () => {
    it('skips evaluation for empty and comment-only lines', () => {
        expect(shouldSkipEvaluation('   ')).toBe(true);
        expect(shouldSkipEvaluation('" note')).toBe(true);
        expect(shouldSkipEvaluation('2 + 3 " note')).toBe(false);
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
});
