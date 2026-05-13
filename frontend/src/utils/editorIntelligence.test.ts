import { describe, expect, it } from 'vitest';
import type { IdentifierContext, SuggestionItem } from '../types/app';
import {
    buildIntelligenceSuggestions,
    buildSuggestionCatalog,
    collectKnownVariableNames,
    getIdentifierContextAtPosition,
} from './editorIntelligence';

describe('editor intelligence helpers', () => {
    it('collects known variables from declarations and existing values', () => {
        const names = collectKnownVariableNames(
            'Revenue = 12\n@Tax = 0.2\ncomment only',
            {
                CarryOver: 1,
                tax: 2,
            },
        );

        expect([...names].sort()).toEqual(['carryover', 'revenue', 'tax']);
    });

    it('builds suggestion catalog with variable/function/constant entries', () => {
        const catalog = buildSuggestionCatalog(new Set(['price']));

        expect(catalog.some((item) => item.kind === 'variable' && item.label === 'price')).toBe(true);
        expect(catalog.some((item) => item.kind === 'function' && item.label === 'abs')).toBe(true);
        expect(catalog.some((item) => item.kind === 'constant' && item.label === 'PI')).toBe(true);
    });

    it('finds identifier context at a caret position', () => {
        const text = 'total = @price + abs(value)';
        const caret = text.indexOf('price') + 3;
        const context = getIdentifierContextAtPosition(text, caret);

        expect(context).not.toBeNull();
        expect(context?.token).toBe('@price');
        expect(context?.baseToken).toBe('price');
        expect(context?.wantsAtPrefix).toBe(true);
    });

    it('builds ranked suggestions and respects @ variable mode', () => {
        const context: IdentifierContext = {
            start: 0,
            end: 2,
            token: '@a',
            baseToken: 'a',
            wantsAtPrefix: true,
            lineStart: 0,
            startInLine: 0,
        };

        const catalog: SuggestionItem[] = [
            { label: 'abs', kind: 'function', matchText: 'abs' },
            { label: 'alpha', kind: 'variable', matchText: 'alpha' },
            { label: 'ANGLE', kind: 'constant', matchText: 'angle' },
        ];

        const suggestions = buildIntelligenceSuggestions(context, catalog);

        expect(suggestions).toEqual([
            { label: 'alpha', kind: 'variable', matchText: 'alpha' },
        ]);
    });
});
