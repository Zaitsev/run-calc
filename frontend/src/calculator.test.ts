import {describe, expect, it} from 'vitest';
import {evaluateExpression, ParseError} from './calculator';

describe('evaluateExpression', () => {
    it('evaluates arithmetic with precedence and parentheses', () => {
        expect(evaluateExpression('2+3*4', '.')).toBe(14);
        expect(evaluateExpression('(2+3)*4', '.')).toBe(20);
    });

    it('supports unary operators', () => {
        expect(evaluateExpression('-5 + +3', '.')).toBe(-2);
    });

    it('supports scientific notation with dot delimiter', () => {
        expect(evaluateExpression('1e6 / 1e4', '.')).toBe(100);
        expect(evaluateExpression('2.5E-3 * 1e3', '.')).toBe(2.5);
    });

    it('supports scientific notation with comma delimiter', () => {
        expect(evaluateExpression('1,2e3 + 0,8E2', ',')).toBe(1280);
    });

    it('throws ParseError for invalid scientific notation exponent', () => {
        expect(() => evaluateExpression('1e+', '.')).toThrow(ParseError);
        expect(() => evaluateExpression('1e', '.')).toThrow(ParseError);
    });

    it('throws ParseError for division by zero', () => {
        expect(() => evaluateExpression('10/0', '.')).toThrow(ParseError);
    });
});
