import { getExpressionSource } from '../lineExpression';
import type { IdentifierContext, SuggestionItem, SuggestionKind } from '../types/app';
import { MATH_CONSTANT_NAMES, MATH_FUNCTION_NAMES, isIdentifierPartChar, isIdentifierStartChar } from './identifierUtils';
import { getLineBounds, parseDeclaredVariable } from './worksheetEditing';

export const collectKnownVariableNames = (
    content: string,
    variableValues: Record<string, unknown>,
): Set<string> => {
    const names = new Set<string>();
    content.split('\n').forEach((line) => {
        const declaration = parseDeclaredVariable(getExpressionSource(line));
        if (declaration) {
            names.add(declaration.key);
        }
    });

    Object.keys(variableValues).forEach((name) => {
        names.add(name.toLowerCase());
    });

    return names;
};

export const buildSuggestionCatalog = (knownVariableNames: ReadonlySet<string>): SuggestionItem[] => {
    const items: SuggestionItem[] = [];

    [...knownVariableNames]
        .sort((a, b) => a.localeCompare(b))
        .forEach((name) => {
            items.push({label: name, kind: 'variable', matchText: name.toLowerCase()});
        });

    [...MATH_FUNCTION_NAMES]
        .map((name) => name.toLowerCase())
        .sort((a, b) => a.localeCompare(b))
        .forEach((name) => {
            items.push({label: name, kind: 'function', matchText: name});
        });

    [...MATH_CONSTANT_NAMES]
        .sort((a, b) => a.localeCompare(b))
        .forEach((name) => {
            items.push({label: name, kind: 'constant', matchText: name.toLowerCase()});
        });

    return items;
};

export const getIdentifierContextAtPosition = (text: string, position: number): IdentifierContext | null => {
    const {lineStart, lineEnd} = getLineBounds(text, position);
    const lineText = text.slice(lineStart, lineEnd);
    const localPos = position - lineStart;

    let start = localPos;
    while (start > 0 && isIdentifierPartChar(lineText[start - 1])) {
        start--;
    }
    if (start > 0 && lineText[start - 1] === '@') {
        start--;
    }

    let end = localPos;
    while (end < lineText.length && isIdentifierPartChar(lineText[end])) {
        end++;
    }

    const token = lineText.slice(start, end);
    if (!token) {
        return null;
    }

    const wantsAtPrefix = token.startsWith('@');
    const baseToken = wantsAtPrefix ? token.slice(1) : token;
    if (!baseToken || !isIdentifierStartChar(baseToken[0])) {
        return null;
    }

    return {
        start: lineStart + start,
        end: lineStart + end,
        token,
        baseToken,
        wantsAtPrefix,
        lineStart,
        startInLine: start,
    };
};

export const buildIntelligenceSuggestions = (
    identifierContext: IdentifierContext | null,
    suggestionCatalog: ReadonlyArray<SuggestionItem>,
): SuggestionItem[] => {
    if (!identifierContext) {
        return [];
    }

    const query = identifierContext.baseToken.toLowerCase();
    if (query.length === 0) {
        return [];
    }

    const kindWeight: Record<SuggestionKind, number> = {
        variable: 0,
        function: 1,
        constant: 2,
    };

    return suggestionCatalog
        .filter((item) => {
            if (identifierContext.wantsAtPrefix && item.kind !== 'variable') {
                return false;
            }
            return item.matchText.startsWith(query) && item.matchText !== query;
        })
        .sort((a, b) => {
            const kindDiff = kindWeight[a.kind] - kindWeight[b.kind];
            if (kindDiff !== 0) {
                return kindDiff;
            }
            return a.label.localeCompare(b.label);
        })
        .slice(0, 5);
};
