import {describe, expect, it} from 'vitest';
import {getExpressionSource, stripErrorSuffix} from './lineExpression';

describe('lineExpression helpers', () => {
    it('strips error suffix only when present', () => {
        expect(stripErrorSuffix('a = 2 = error')).toBe('a = 2');
        expect(stripErrorSuffix('a = 2 = 5')).toBe('a = 2 = 5');
    });

    it('extracts source from regular expression result lines', () => {
        expect(getExpressionSource('2+3 = 5')).toBe('2+3');
    });

    it('extracts source from declaration result lines', () => {
        expect(getExpressionSource('v = 2+3 = 5')).toBe('v = 2+3');
    });

    it('preserves full backtick declaration source when result is error', () => {
        expect(getExpressionSource('a = `x=1; y+` = error')).toBe('a = `x=1; y+`');
    });

    it('preserves plain lines with no result marker', () => {
        expect(getExpressionSource('a=`x=1; y+`')).toBe('a=`x=1; y+`');
    });

    it('preserves declaration backtick rhs with internal spaced assignment', () => {
        expect(getExpressionSource('a = `x = 1; x+2`')).toBe('a = `x = 1; x+2`');
    });

    it('extracts source from @-prefixed declaration result lines', () => {
        expect(getExpressionSource('@incomes = [1,2,3] = [1,2,3]')).toBe('@incomes = [1,2,3]');
    });
});
