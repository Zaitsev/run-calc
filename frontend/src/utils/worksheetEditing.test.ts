import { describe, expect, it } from 'vitest';
import {
    getLineBounds,
    lineIndexAtPosition,
    parseDeclaredVariable,
    remapLineRecordForEdit,
    remapMarkedLinesForEdit,
} from './worksheetEditing';

describe('worksheet editing helpers', () => {
    it('calculates line bounds at caret', () => {
        const text = 'a\nbb\nccc';
        expect(getLineBounds(text, 0)).toEqual({ lineStart: 0, lineEnd: 1 });
        expect(getLineBounds(text, 3)).toEqual({ lineStart: 2, lineEnd: 4 });
    });

    it('maps caret to line index', () => {
        const text = 'a\nb\nc';
        expect(lineIndexAtPosition(text, 0)).toBe(0);
        expect(lineIndexAtPosition(text, 2)).toBe(1);
        expect(lineIndexAtPosition(text, 4)).toBe(2);
    });

    it('parses declared variables with optional @ prefix', () => {
        expect(parseDeclaredVariable('@Tax = 0.2')).toEqual({
            key: 'tax',
            label: '@Tax',
            expression: '0.2',
        });

        expect(parseDeclaredVariable('revenue = price * qty')).toEqual({
            key: 'revenue',
            label: 'revenue',
            expression: 'price * qty',
        });

        expect(parseDeclaredVariable('2 + 2')).toBeNull();
    });

    it('remaps marked lines after insertion', () => {
        const before = 'a\nb\nc';
        const after = 'a\nnew\nb\nc';
        const remapped = remapMarkedLinesForEdit(new Set([1, 2]), before, after);

        expect([...remapped].sort((a, b) => a - b)).toEqual([1, 3]);
    });

    it('remaps line records after insertion', () => {
        const before = 'a\nb\nc';
        const after = 'a\nnew\nb\nc';
        const remapped = remapLineRecordForEdit({ 1: 'x', 2: 'y' }, before, after);

        expect(remapped).toEqual({ 1: 'x', 3: 'y' });
    });
});
