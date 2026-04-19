import {describe, expect, it} from 'vitest';
import {extractExpressionDependencies, getExpressionSource, stripErrorSuffix} from './lineExpression';

describe('lineExpression helpers', () => {
    it('strips error suffix only when present', () => {
        expect(stripErrorSuffix('a = 2 = error')).toBe('a = 2');
        expect(stripErrorSuffix('a = 2 = 5')).toBe('a = 2 = 5');
        expect(stripErrorSuffix('a = 2 = error " keep')).toBe('a = 2 " keep');
    });

    it('extracts source from regular expression result lines', () => {
        expect(getExpressionSource('2+3 = 5')).toBe('2+3');
    });

    it('extracts source from lines with trailing quote comments', () => {
        expect(getExpressionSource('2+3 = 5 " ok')).toBe('2+3 " ok');
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

    it('extracts declaration source with trailing quote comments', () => {
        expect(getExpressionSource('@a = 2+3 = 5 " note')).toBe('@a = 2+3 " note');
    });

    it('extracts dependencies from declaration expressions', () => {
        expect(extractExpressionDependencies('total = price + @tax')).toEqual(['price', 'tax']);
    });

    it('skips declaration target, built-ins, and literals for dependency extraction', () => {
        expect(extractExpressionDependencies('x = sin(PI) + "note" + `tmp = 1` + x')).toEqual([]);
    });

    it('extracts dependencies from regular expressions with stable normalization', () => {
        expect(extractExpressionDependencies('@income + Bonus + max(2, 3)')).toEqual(['income', 'bonus']);
    });

    it('ignores tokens that appear inside quote comments for dependencies', () => {
        expect(extractExpressionDependencies('total = price + tax " ignore bonus and sin(PI)')).toEqual(['price', 'tax']);
    });
});
