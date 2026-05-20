import { describe, expect, it, vi } from 'vitest';
import { buildEvaluationHooks } from './useEvaluation';

vi.mock('../../wailsjs/go/main/App', () => ({
    EvaluateExprProgram: vi.fn(),
    CaptureRandomState: vi.fn(),
    RestoreRandomState: vi.fn(),
    RunAIQuery: vi.fn(),
}));

import { CaptureRandomState, EvaluateExprProgram, RestoreRandomState } from '../../wailsjs/go/main/App';
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
    it('captures and restores random state around shadow verification', async () => {
        const evaluateExprMock = vi.mocked(EvaluateExprProgram);
        const captureRandomStateMock = vi.mocked(CaptureRandomState);
        const restoreRandomStateMock = vi.mocked(RestoreRandomState);

        evaluateExprMock.mockResolvedValue({
            ok: true,
            value: 0.5,
            isNumber: true,
            numberValue: 0.5,
            variables: { a: 0.5 },
        } as EvalResult);
        captureRandomStateMock.mockResolvedValue({ state: '123', hasSpare: false, spare: 0, seeded: true });
        restoreRandomStateMock.mockResolvedValue();

        const hooks = buildEvaluationHooks({
            content: 'a = uniform() = 0.1',
            lastResult: null,
            variableValues: {},
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
            variableFirstInlining: true,
            setContent: () => {},
            setCaretPos: () => {},
            setLastResult: () => {},
            setVariableValues: () => {},
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
            editorRef: { current: null },
            aiDebugIdRef: { current: 0 },
            worksheetRevisionRef: { current: 1 },
        });

        await hooks.verifyWorksheetShadow();

        expect(captureRandomStateMock).toHaveBeenCalledTimes(1);
        expect(restoreRandomStateMock).toHaveBeenCalledTimes(1);
        expect(restoreRandomStateMock).toHaveBeenCalledWith({ state: '123', hasSpare: false, spare: 0, seeded: true });
    });

    it('abandons reevaluation when the worksheet revision changes mid-flight', async () => {
        const evaluateExprMock = vi.mocked(EvaluateExprProgram);

        const evalResolvers: Array<(value: EvalResult) => void> = [];
        evaluateExprMock.mockImplementation(() => new Promise<EvalResult>((resolve) => {
            evalResolvers.push(resolve as (value: EvalResult) => void);
        }));

        let content = ['a = 1 = 1', 'b = a + 1 = 2'].join('\n');
        let variableValues: Record<string, unknown> = { a: 1, b: 2 };
        let lineDependencyVersions: Record<number, Record<string, number>> = { 1: { a: 1 } };
        let isReevaluatingAll = false;
        let statusText = '';
        const worksheetRevisionRef = { current: 1 } as React.MutableRefObject<number>;

        const hooks = buildEvaluationHooks({
            content,
            lastResult: null,
            variableValues,
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
            variableFirstInlining: true,
            setContent: (next) => {
                content = next;
            },
            setCaretPos: () => {},
            setLastResult: () => {},
            setVariableValues: (next) => {
                variableValues = next;
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
            setIsStatusError: () => {},
            setDevError: () => {},
            clearLineEvaluationMetadata: () => {},
            editorRef: { current: null },
            aiDebugIdRef: { current: 0 },
            worksheetRevisionRef,
        });

        const reevaluatePromise = hooks.reevaluateAllExpressions();
        await Promise.resolve();
        worksheetRevisionRef.current += 1;

        const resolveEval = evalResolvers[0];
        if (resolveEval) {
            resolveEval({
                ok: true,
                value: 1,
                isNumber: true,
                numberValue: 1,
                variables: { a: 1 },
            } as EvalResult);
        }

        await reevaluatePromise;

        expect(content).toBe(['a = 1 = 1', 'b = a + 1 = 2'].join('\n'));
        expect(variableValues).toEqual({ a: 1, b: 2 });
        expect(lineDependencyVersions).toEqual({ 1: { a: 1 } });
        expect(isReevaluatingAll).toBe(false);
        expect(statusText).toBe('');
    });

    it('re-evaluates strictly top-to-bottom without refresh passes', async () => {
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
        let lineDependencyVersions: Record<number, Record<string, number>> = { 1: { a: 1 } };
        let lastResult: number | null = null;
        let isReevaluatingAll = false;
        let statusText = '';
        let isStatusError = false;
        let caretPos = 0;

        const line1Length = 'a = 1 = 1'.length + 1;
        editorRef.current!.selectionStart = line1Length + 'b = a + 1 = 2'.length;
        editorRef.current!.selectionEnd = editorRef.current!.selectionStart;

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
                variableFirstInlining: true,
                setContent: (next) => {
                    content = next;
                },
                setCaretPos: (next) => {
                    caretPos = next;
                },
                setLastResult: (next) => {
                    lastResult = next;
                },
                setVariableValues: (next) => {
                    variableValues = next;
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

            expect(content.split('\n')[1]).toBe('b = a + 1 = 2');
            expect(lineDependencyVersions).toEqual({});
            expect(variableValues.a).toBe(5);
            expect(variableValues.b).toBe(2);
            expect(lastResult).toBe(5);
            expect(isStatusError).toBe(false);
            expect(statusText).toBe('Re-evaluated 3 lines');
            expect(isReevaluatingAll).toBe(false);
            expect(caretPos).toBe(line1Length + 'b = a + 1'.length);
            expect(editorRef.current!.selectionStart).toBe(line1Length + 'b = a + 1'.length);
        } finally {
            globalThis.requestAnimationFrame = originalRAF;
        }
    });

    it('marks mismatched deterministic lines as stale via shadow verification', async () => {
        const evaluateExprMock = vi.mocked(EvaluateExprProgram);
        evaluateExprMock.mockImplementation(async (expression, variables) => mockedEvaluateExprProgram(expression, variables as Record<string, unknown>));

        let lineDependencyVersions: Record<number, Record<string, number>> = {};

        const hooks = buildEvaluationHooks({
            content: ['a = 5 = 5', 'b = a + 1 = 2'].join('\n'),
            lastResult: null,
            variableValues: { a: 5, b: 2 },
            lineDependencyVersions,
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
            variableFirstInlining: true,
            setContent: () => {},
            setCaretPos: () => {},
            setLastResult: () => {},
            setVariableValues: () => {},
            setLineDependencyVersions: (next) => {
                lineDependencyVersions = typeof next === 'function' ? next(lineDependencyVersions) : next;
            },
            setIsReevaluatingAll: () => {},
            setIsAIQueryPending: () => {},
            setAIPendingLineIndex: () => {},
            setAIProgressMessage: () => {},
            setAIDebugLog: () => [],
            setStatusText: () => {},
            setIsStatusError: () => {},
            setDevError: () => {},
            clearLineEvaluationMetadata: () => {},
            editorRef: { current: null },
            aiDebugIdRef: { current: 0 },
            worksheetRevisionRef: { current: 1 },
        });

        await hooks.verifyWorksheetShadow();

        expect(lineDependencyVersions[1]).toEqual({ __shadow_verification__: -1 });
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
        const clearLineEvaluationMetadata = vi.fn();

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
                variableFirstInlining: true,
                setContent: (next) => {
                    content = next;
                    editorRef.current!.value = next;
                },
                setCaretPos: (next) => {
                    caretPos = next;
                },
                setLastResult: () => {},
                setVariableValues: () => {},
                setLineDependencyVersions: () => ({}),
                setIsReevaluatingAll: () => {},
                setIsAIQueryPending: () => {},
                setAIPendingLineIndex: () => {},
                setAIProgressMessage: () => {},
                setAIDebugLog: () => [],
                setStatusText: () => {},
                setIsStatusError: () => {},
                setDevError: () => {},
                clearLineEvaluationMetadata,
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
            expect(clearLineEvaluationMetadata).toHaveBeenCalledWith(0);
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
                variableFirstInlining: true,
                setContent: (next) => {
                    content = next;
                },
                setCaretPos: (next) => {
                    caretPos = next;
                },
                setLastResult: () => {},
                setVariableValues: () => {},
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
                variableFirstInlining: true,
                setContent: (next) => {
                    content = next;
                    editorRef.current!.value = next;
                },
                setCaretPos: (next) => {
                    caretPos = next;
                },
                setLastResult: () => {},
                setVariableValues: () => {},
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
