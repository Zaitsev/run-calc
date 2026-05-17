import { describe, expect, it, vi } from 'vitest';
import { buildEvaluationHooks } from './useEvaluation';

vi.mock('../../wailsjs/go/main/App', () => ({
    EvaluateExprProgram: vi.fn(),
    RunAIQuery: vi.fn(),
}));

import { EvaluateExprProgram } from '../../wailsjs/go/main/App';
import type { main } from '../../wailsjs/go/models';

type EvalResult = main.ExprEvalResponse;

function evaluateSimpleExpression(expression: string, variables: Record<string, unknown>): number {
    const trimmed = expression.trim();

    const numberValue = Number(trimmed);
    if (Number.isFinite(numberValue)) {
        return numberValue;
    }

    const plusMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\+\s*(-?\d+(?:\.\d+)?)$/);
    if (plusMatch) {
        const base = Number(variables[plusMatch[1].toLowerCase()] ?? 0);
        return base + Number(plusMatch[2]);
    }

    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
        return Number(variables[trimmed.toLowerCase()] ?? 0);
    }

    throw new Error(`Unsupported test expression: ${expression}`);
}

function mockedEvaluateExprProgram(expression: string, variables: Record<string, unknown>): EvalResult {
    const declarationMatch = expression.match(/^\s*(@?[a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (declarationMatch) {
        const name = declarationMatch[1].startsWith('@')
            ? declarationMatch[1].slice(1).toLowerCase()
            : declarationMatch[1].toLowerCase();
        const value = evaluateSimpleExpression(declarationMatch[2], variables);
        return {
            ok: true,
            value,
            isNumber: true,
            numberValue: value,
            variables: {
                ...variables,
                [name]: value,
            },
        };
    }

    const value = evaluateSimpleExpression(expression, variables);
    return {
        ok: true,
        value,
        isNumber: true,
        numberValue: value,
        variables: {
            ...variables,
        },
    };
}

describe('buildEvaluationHooks reevaluateAllExpressions', () => {
    it('refreshes lines that remain stale after the top-to-bottom reevaluation pass', async () => {
        const evaluateExprMock = vi.mocked(EvaluateExprProgram);
        evaluateExprMock.mockImplementation(async (expression, variables) => mockedEvaluateExprProgram(expression, variables as Record<string, unknown>));

        const editorRef = {
            current: {
                selectionStart: 0,
                selectionEnd: 0,
            },
        } as React.RefObject<HTMLTextAreaElement | null>;

        let content = [
            'a = 1 = 1',
            'b = a + 1 = 2',
            'a = 5 = 5',
        ].join('\n');
        let variableValues: Record<string, unknown> = { a: 5, b: 2 };
        let variableVersions: Record<string, number> = { a: 2, b: 1 };
        let lineDependencies: Record<number, string[]> = { 1: ['a'] };
        let lineDependencyVersions: Record<number, Record<string, number>> = { 1: { a: 1 } };
        let lastResult: number | null = null;
        let isReevaluatingAll = false;
        let statusText = '';
        let isStatusError = false;

        const originalRAF = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            callback(0);
            return 0;
        }) as typeof requestAnimationFrame;

        try {
            const hooks = buildEvaluationHooks({
                content,
                lastResult,
                variableValues,
                variableVersions,
                lineDependencies,
                lineDependencyVersions,
                isReevaluatingAll,
                isAIQueryPending: false,
                aiContextMode: 'above',
                aiSettings: {
                    providerPreset: 'openai',
                    endpoint: '',
                    modelId: '',
                    defaultContextMode: 'above',
                    allowInsecureKeyFallback: false,
                    allowCustomEndpointKeyReuse: false,
                    requestTimeoutSeconds: 30,
                },
                decimalDelimiter: '.',
                precision: 'auto',
                scientificNotation: false,
                setContent: (next) => {
                    content = next;
                },
                setCaretPos: () => {},
                setLastResult: (next) => {
                    lastResult = next;
                },
                setVariableValues: (next) => {
                    variableValues = next;
                },
                setVariableVersions: (next) => {
                    variableVersions = typeof next === 'function' ? next(variableVersions) : next;
                },
                setLineDependencies: (next) => {
                    lineDependencies = typeof next === 'function' ? next(lineDependencies) : next;
                },
                setLineDependencyVersions: (next) => {
                    lineDependencyVersions = typeof next === 'function' ? next(lineDependencyVersions) : next;
                },
                setIsReevaluatingAll: (next) => {
                    isReevaluatingAll = next;
                },
                setIsAIQueryPending: () => {},
                setAIPendingLineIndex: () => {},
                setAIProgressMessage: () => {},
                setAIDebugLog: () => [],
                setStatusText: (next) => {
                    statusText = next;
                },
                setIsStatusError: (next) => {
                    isStatusError = next;
                },
                setDevError: () => {},
                clearLineEvaluationMetadata: () => {},
                editorRef,
                aiDebugIdRef: { current: 0 },
            });

            await hooks.reevaluateAllExpressions();

            expect(content.split('\n')[1]).toBe('b = a + 1 = 6');
            expect(lineDependencyVersions[1]).toEqual({ a: 2 });
            expect(variableValues.a).toBe(5);
            expect(variableValues.b).toBe(6);
            expect(lastResult).toBe(6);
            expect(isStatusError).toBe(false);
            expect(statusText).toContain('refreshed 1 stale');
            expect(isReevaluatingAll).toBe(false);
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });
});

describe('buildEvaluationHooks evaluateCurrentLine', () => {
    it('moves caret to the next line after evaluating a non-final line', async () => {
        const evaluateExprMock = vi.mocked(EvaluateExprProgram);
        evaluateExprMock.mockResolvedValue({
            ok: true,
            value: 58,
            isNumber: true,
            numberValue: 58,
            variables: { a: 275 },
        } as EvalResult);

        let selectionStart = 0;
        let selectionEnd = 0;
        const editorRef = {
            current: {
                get selectionStart() {
                    return selectionStart;
                },
                set selectionStart(value: number) {
                    selectionStart = value;
                },
                get selectionEnd() {
                    return selectionEnd;
                },
                set selectionEnd(value: number) {
                    selectionEnd = value;
                },
                value: '',
            },
        } as unknown as React.RefObject<HTMLTextAreaElement | null>;

        let content = [
            '42/42*58',
            '2+5',
            'a = 5*55',
            'a = 275',
        ].join('\n');
        editorRef.current!.value = content;

        let caretPos = 0;
        selectionStart = 0;
        selectionEnd = 0;

        const originalRAF = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            callback(0);
            return 0;
        }) as typeof requestAnimationFrame;

        try {
            const hooks = buildEvaluationHooks({
                content,
                lastResult: null,
                variableValues: { a: 275 },
                variableVersions: {},
                lineDependencies: {},
                lineDependencyVersions: {},
                isReevaluatingAll: false,
                isAIQueryPending: false,
                aiContextMode: 'above',
                aiSettings: {
                    providerPreset: 'openai',
                    endpoint: '',
                    modelId: '',
                    defaultContextMode: 'above',
                    allowInsecureKeyFallback: false,
                    allowCustomEndpointKeyReuse: false,
                    requestTimeoutSeconds: 30,
                },
                decimalDelimiter: '.',
                precision: 'auto',
                scientificNotation: false,
                setContent: (next) => {
                    content = next;
                    editorRef.current!.value = next;
                },
                setCaretPos: (next) => {
                    caretPos = next;
                },
                setLastResult: () => {},
                setVariableValues: () => {},
                setVariableVersions: () => ({}),
                setLineDependencies: () => ({}),
                setLineDependencyVersions: () => ({}),
                setIsReevaluatingAll: () => {},
                setIsAIQueryPending: () => {},
                setAIPendingLineIndex: () => {},
                setAIProgressMessage: () => {},
                setAIDebugLog: () => [],
                setStatusText: () => {},
                setIsStatusError: () => {},
                setDevError: () => {},
                clearLineEvaluationMetadata: () => {},
                editorRef,
                aiDebugIdRef: { current: 0 },
            });

            await hooks.evaluateCurrentLine();

            expect(content).toBe([
                '42/42*58 = 58',
                '2+5',
                'a = 5*55',
                'a = 275',
            ].join('\n'));

            const expectedCaret = '42/42*58 = 58\n'.length;
            expect(caretPos).toBe(expectedCaret);
            expect(editorRef.current!.selectionStart).toBe(expectedCaret);
            expect(editorRef.current!.selectionEnd).toBe(expectedCaret);
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });

    it('keeps caret on the next line when textarea value updates a frame later', async () => {
        const evaluateExprMock = vi.mocked(EvaluateExprProgram);
        evaluateExprMock.mockResolvedValue({
            ok: true,
            value: 58,
            isNumber: true,
            numberValue: 58,
            variables: {},
        } as EvalResult);

        let selectionStart = 0;
        let selectionEnd = 0;
        const editorRef = {
            current: {
                get selectionStart() {
                    return selectionStart;
                },
                set selectionStart(value: number) {
                    selectionStart = value;
                },
                get selectionEnd() {
                    return selectionEnd;
                },
                set selectionEnd(value: number) {
                    selectionEnd = value;
                },
                value: '',
            },
        } as unknown as React.RefObject<HTMLTextAreaElement | null>;

        let content = [
            '42/42*58',
            '2+5',
            'a = 5*55',
            'a = 275',
        ].join('\n');
        editorRef.current!.value = content;

        let caretPos = 0;
        const queuedRaf: FrameRequestCallback[] = [];
        const originalRAF = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            queuedRaf.push(callback);
            return queuedRaf.length;
        }) as typeof requestAnimationFrame;

        try {
            const hooks = buildEvaluationHooks({
                content,
                lastResult: null,
                variableValues: {},
                variableVersions: {},
                lineDependencies: {},
                lineDependencyVersions: {},
                isReevaluatingAll: false,
                isAIQueryPending: false,
                aiContextMode: 'above',
                aiSettings: {
                    providerPreset: 'openai',
                    endpoint: '',
                    modelId: '',
                    defaultContextMode: 'above',
                    allowInsecureKeyFallback: false,
                    allowCustomEndpointKeyReuse: false,
                    requestTimeoutSeconds: 30,
                },
                decimalDelimiter: '.',
                precision: 'auto',
                scientificNotation: false,
                setContent: (next) => {
                    content = next;
                },
                setCaretPos: (next) => {
                    caretPos = next;
                },
                setLastResult: () => {},
                setVariableValues: () => {},
                setVariableVersions: () => ({}),
                setLineDependencies: () => ({}),
                setLineDependencyVersions: () => ({}),
                setIsReevaluatingAll: () => {},
                setIsAIQueryPending: () => {},
                setAIPendingLineIndex: () => {},
                setAIProgressMessage: () => {},
                setAIDebugLog: () => [],
                setStatusText: () => {},
                setIsStatusError: () => {},
                setDevError: () => {},
                clearLineEvaluationMetadata: () => {},
                editorRef,
                aiDebugIdRef: { current: 0 },
            });

            await hooks.evaluateCurrentLine();

            expect(queuedRaf.length).toBe(1);
            const firstFrame = queuedRaf.shift();
            firstFrame?.(0);

            // Simulate React applying textarea value between animation frames.
            editorRef.current!.value = content;

            expect(queuedRaf.length).toBe(1);
            const secondFrame = queuedRaf.shift();
            secondFrame?.(0);

            const expectedCaret = '42/42*58 = 58\n'.length;
            expect(caretPos).toBe(expectedCaret);
            expect(editorRef.current!.selectionStart).toBe(expectedCaret);
            expect(editorRef.current!.selectionEnd).toBe(expectedCaret);
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });

    it('appends a newline and places caret at the end when evaluating the final line', async () => {
        const evaluateExprMock = vi.mocked(EvaluateExprProgram);
        evaluateExprMock.mockResolvedValue({
            ok: true,
            value: 7,
            isNumber: true,
            numberValue: 7,
            variables: {},
        } as EvalResult);

        let selectionStart = 0;
        let selectionEnd = 0;
        const editorRef = {
            current: {
                get selectionStart() {
                    return selectionStart;
                },
                set selectionStart(value: number) {
                    selectionStart = value;
                },
                get selectionEnd() {
                    return selectionEnd;
                },
                set selectionEnd(value: number) {
                    selectionEnd = value;
                },
                value: '',
            },
        } as unknown as React.RefObject<HTMLTextAreaElement | null>;

        let content = '3+4';
        editorRef.current!.value = content;

        let caretPos = 0;
        selectionStart = 0;
        selectionEnd = 0;

        const originalRAF = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            callback(0);
            return 0;
        }) as typeof requestAnimationFrame;

        try {
            const hooks = buildEvaluationHooks({
                content,
                lastResult: null,
                variableValues: {},
                variableVersions: {},
                lineDependencies: {},
                lineDependencyVersions: {},
                isReevaluatingAll: false,
                isAIQueryPending: false,
                aiContextMode: 'above',
                aiSettings: {
                    providerPreset: 'openai',
                    endpoint: '',
                    modelId: '',
                    defaultContextMode: 'above',
                    allowInsecureKeyFallback: false,
                    allowCustomEndpointKeyReuse: false,
                    requestTimeoutSeconds: 30,
                },
                decimalDelimiter: '.',
                precision: 'auto',
                scientificNotation: false,
                setContent: (next) => {
                    content = next;
                    editorRef.current!.value = next;
                },
                setCaretPos: (next) => {
                    caretPos = next;
                },
                setLastResult: () => {},
                setVariableValues: () => {},
                setVariableVersions: () => ({}),
                setLineDependencies: () => ({}),
                setLineDependencyVersions: () => ({}),
                setIsReevaluatingAll: () => {},
                setIsAIQueryPending: () => {},
                setAIPendingLineIndex: () => {},
                setAIProgressMessage: () => {},
                setAIDebugLog: () => [],
                setStatusText: () => {},
                setIsStatusError: () => {},
                setDevError: () => {},
                clearLineEvaluationMetadata: () => {},
                editorRef,
                aiDebugIdRef: { current: 0 },
            });

            await hooks.evaluateCurrentLine();

            expect(content).toBe('3+4 = 7\n');
            expect(caretPos).toBe(content.length);
            expect(editorRef.current!.selectionStart).toBe(content.length);
            expect(editorRef.current!.selectionEnd).toBe(content.length);
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });
});
