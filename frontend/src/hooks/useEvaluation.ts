import type { RefObject } from 'react';
import type { AIContextMode, AISettingsState } from '../AISettings';
import type { AIDebugEntry } from '../AIDebugDrawer';
import type { AIRunResponse } from '../types/app';
import type { DecimalDelimiter, PrecisionMode } from '../types/app';
import { EvaluateExprProgram, RunAIQuery } from '../../wailsjs/go/main/App';
import {
    getExpressionSource,
    isAITriggerLine,
    getAITriggerPrompt,
    extractExpressionDependencies,
} from '../lineExpression';
import {
    shouldSkipEvaluation,
    shouldSkipEvaluationAtCaret,
    buildEvaluationExpression,
    getPreservedCaretOffset,
    getFriendlyEvalErrorMessage,
    isAITriggerSourceLine,
    stripMarkdownCodeFences,
} from '../appInteractionLogic';
import {
    getLineBounds,
    lineIndexAtPosition,
    formatEvaluatedLine,
    areValuesEquivalent,
    formatExprValue,
} from '../utils/evalHelpers';
import { formatNumber } from '../utils/formatting';

type EvalDeps = {
    // state
    content: string;
    lastResult: number | null;
    variableValues: Record<string, unknown>;
    variableVersions: Record<string, number>;
    lineDependencies: Record<number, string[]>;
    lineDependencyVersions: Record<number, Record<string, number>>;
    isReevaluatingAll: boolean;
    isAIQueryPending: boolean;
    aiContextMode: AIContextMode;
    aiSettings: AISettingsState;
    decimalDelimiter: DecimalDelimiter;
    precision: PrecisionMode;
    scientificNotation: boolean;
    // setters
    setContent: (v: string) => void;
    setCaretPos: (v: number) => void;
    setLastResult: (v: number | null) => void;
    setVariableValues: (v: Record<string, unknown>) => void;
    setVariableVersions: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    setLineDependencies: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
    setLineDependencyVersions: React.Dispatch<React.SetStateAction<Record<number, Record<string, number>>>>;
    setIsReevaluatingAll: (v: boolean) => void;
    setIsAIQueryPending: (v: boolean) => void;
    setAIPendingLineIndex: (v: number | null) => void;
    setAIProgressMessage: (v: string) => void;
    setAIDebugLog: React.Dispatch<React.SetStateAction<AIDebugEntry[]>>;
    setStatusText: (v: string) => void;
    setIsStatusError: (v: boolean) => void;
    setDevError: (v: string) => void;
    clearLineEvaluationMetadata: (lineIndex: number) => void;
    // refs
    editorRef: RefObject<HTMLTextAreaElement | null>;
    aiDebugIdRef: RefObject<number>;
};

type ContentAndCaret = { nextContent: string; nextCaret: number };

function applyContentAndCaret(
    editorRef: RefObject<HTMLTextAreaElement | null>,
    setContent: (v: string) => void,
    setCaretPos: (v: number) => void,
    { nextContent, nextCaret }: ContentAndCaret,
) {
    setContent(nextContent);
    setCaretPos(nextCaret);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (!editorRef.current) return;
            const clampedCaret = Math.min(nextCaret, editorRef.current.value.length);
            editorRef.current.selectionStart = clampedCaret;
            editorRef.current.selectionEnd = clampedCaret;
        });
    });
}

export function buildEvaluationHooks(deps: EvalDeps) {
    const {
        content, lastResult, variableValues, variableVersions, lineDependencies: _ld, lineDependencyVersions: _ldv,
        isReevaluatingAll, isAIQueryPending, aiContextMode, aiSettings,
        decimalDelimiter, precision, scientificNotation,
        setContent, setCaretPos, setLastResult,
        setVariableValues, setVariableVersions, setLineDependencies, setLineDependencyVersions,
        setIsReevaluatingAll, setIsAIQueryPending, setAIPendingLineIndex, setAIProgressMessage,
        setAIDebugLog, setStatusText, setIsStatusError, setDevError,
        clearLineEvaluationMetadata, editorRef, aiDebugIdRef,
    } = deps;

    const setContentAndCaret = (nextContent: string, nextCaret: number) => {
        applyContentAndCaret(editorRef, setContent, setCaretPos, { nextContent, nextCaret });
    };

    const evaluateCurrentLine = async () => {
        const editor = editorRef.current;
        if (!editor) return;

        const caretPos = editor.selectionStart;
        const bounds = getLineBounds(content, caretPos);
        const { lineStart, lineEnd } = bounds;
        const lineText = content.slice(lineStart, lineEnd);
        const editableLine = getExpressionSource(lineText);
        const lineIndex = lineIndexAtPosition(content, lineStart);
        const caretOffsetInLine = Math.min(Math.max(caretPos - lineStart, 0), lineText.length);

        if (shouldSkipEvaluationAtCaret(lineText, caretOffsetInLine)) {
            setStatusText('Ready');
            setIsStatusError(false);
            setDevError('');
            if (lineEnd === content.length) {
                const nextContent = content + '\n';
                setContentAndCaret(nextContent, nextContent.length);
                return;
            }
            const nextLineStart = lineEnd < content.length ? lineEnd + 1 : lineEnd;
            if (nextLineStart !== caretPos) {
                setCaretPos(nextLineStart);
                requestAnimationFrame(() => {
                    if (!editorRef.current) return;
                    editorRef.current.selectionStart = nextLineStart;
                    editorRef.current.selectionEnd = nextLineStart;
                });
            }
            return;
        }

        if (isAITriggerLine(editableLine)) {
            const prompt = getAITriggerPrompt(editableLine);
            if (!prompt) {
                const nextContent = content.slice(0, editor.selectionStart) + '\n' + content.slice(editor.selectionEnd);
                const nextCaret = editor.selectionStart + 1;
                setContentAndCaret(nextContent, nextCaret);
                setStatusText('AI prompt is empty. Add text after ? and press Enter.');
                setIsStatusError(true);
                setDevError('AI prompt is empty');
                return;
            }

            if (isAIQueryPending) {
                setStatusText('AI request already in progress...');
                setIsStatusError(false);
                setDevError('');
                return;
            }

            let aiStart = 0;
            try {
                const lines = content.split('\n');
                const linesAbove = lines.slice(0, lineIndex).map((line) => getExpressionSource(line));
                aiStart = Date.now();
                setAIPendingLineIndex(lineIndex);
                setIsAIQueryPending(true);
                setAIProgressMessage('preparing request');
                setStatusText('AI request sent... waiting for response');
                setIsStatusError(false);
                setDevError('');

                const aiResult = await RunAIQuery({
                    prompt,
                    contextMode: aiContextMode,
                    linesAbove,
                    fullContent: content,
                    settingsOverride: aiSettings,
                } as any) as AIRunResponse;

                if (!aiResult.ok) {
                    const errorMessage = aiResult.error || 'AI request failed';
                    setLastResult(null);
                    clearLineEvaluationMetadata(lineIndex);
                    setIsStatusError(true);
                    setStatusText(`AI mode failed: ${errorMessage}`);
                    setDevError(errorMessage);
                    setAIDebugLog((prev) => {
                        const id = ++aiDebugIdRef.current!;
                        const entry: AIDebugEntry = {
                            id, timestamp: new Date(), prompt,
                            model: aiResult.preview?.modelId ?? '',
                            endpoint: aiResult.preview?.endpoint ?? '',
                            systemPrompt: aiResult.preview?.systemPrompt || '',
                            userPrompt: aiResult.preview?.userPrompt || '',
                            contextMode: aiResult.preview?.contextMode || aiContextMode,
                            contextLineCount: aiResult.preview?.contextLineCount ?? linesAbove.length,
                            status: 'error', error: errorMessage,
                            durationMs: Date.now() - aiStart,
                            raw: { frontendRequest: { prompt, contextMode: aiContextMode, linesAbove, fullContent: content }, backendPreview: aiResult.preview, backendResponse: aiResult },
                        };
                        return [...prev, entry];
                    });
                    return;
                }

                const output = aiResult.output || {};
                const insertionLines: string[] = [];
                const answerNumber = output.answerNumber;
                const hasNumericAnswer = typeof answerNumber === 'number' && Number.isFinite(answerNumber);
                const normalizedComment = (output.comment || '').trim();
                if (hasNumericAnswer) {
                    let answerLine = `ai0 = ${formatNumber(answerNumber as number, decimalDelimiter, precision, scientificNotation)}`;
                    if (normalizedComment.length > 0) answerLine = `${answerLine} " ${normalizedComment}`;
                    insertionLines.push(answerLine);
                } else {
                    const normalizedAnswer = (output.answer || '').trim();
                    if (normalizedAnswer.length > 0) insertionLines.push(`" ${normalizedAnswer}`);
                    if (normalizedComment.length > 0) insertionLines.push(`" ${normalizedComment}`);
                }

                const normalizedCode = stripMarkdownCodeFences(output.code || '');
                const codeLines = normalizedCode.length > 0
                    ? normalizedCode.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.length > 0)
                    : [];
                if (codeLines.length > 0) insertionLines.push(...codeLines);

                const before = content.slice(0, lineEnd);
                const after = content.slice(lineEnd);
                const insertionBlock = `\n${insertionLines.join('\n')}`;
                const nextContent = before + insertionBlock + after + (lineEnd === content.length ? '\n' : '');
                const nextCaret = before.length + insertionBlock.length;

                setContentAndCaret(nextContent, nextCaret);
                clearLineEvaluationMetadata(lineIndex);
                setLastResult(null);
                setStatusText('AI response inserted');
                setIsStatusError(false);
                setDevError('');

                setAIDebugLog((prev) => {
                    const id = ++aiDebugIdRef.current!;
                    const entry: AIDebugEntry = {
                        id, timestamp: new Date(), prompt,
                        model: aiResult.preview.modelId ?? '',
                        endpoint: aiResult.preview.endpoint ?? '',
                        systemPrompt: aiResult.preview.systemPrompt,
                        userPrompt: aiResult.preview.userPrompt,
                        contextMode: aiResult.preview.contextMode,
                        contextLineCount: aiResult.preview.contextLineCount,
                        status: 'ok', output: aiResult.output,
                        durationMs: Date.now() - aiStart,
                        raw: { frontendRequest: { prompt, contextMode: aiContextMode, linesAbove, fullContent: content }, backendPreview: aiResult.preview, backendResponse: aiResult },
                    };
                    return [...prev, entry];
                });

                if (codeLines.length > 0) {
                    const contentForReeval = nextContent;
                    requestAnimationFrame(() => { void reevaluateAllExpressions(contentForReeval); });
                }
            } catch (error) {
                setLastResult(null);
                clearLineEvaluationMetadata(lineIndex);
                setIsStatusError(true);
                const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
                setStatusText(`AI mode failed: ${errorMessage}`);
                setDevError(errorMessage);
                setAIDebugLog((prev) => {
                    const id = ++aiDebugIdRef.current!;
                    const entry: AIDebugEntry = {
                        id, timestamp: new Date(), prompt: prompt || '',
                        model: '', endpoint: '', systemPrompt: '', userPrompt: '',
                        contextMode: aiContextMode, contextLineCount: 0,
                        status: 'error', error: errorMessage,
                        durationMs: Date.now() - aiStart,
                        raw: { frontendRequest: { prompt, contextMode: aiContextMode, fullContent: content }, thrownError: error },
                    };
                    return [...prev, entry];
                });
            } finally {
                setIsAIQueryPending(false);
                setAIPendingLineIndex(null);
                setAIProgressMessage('');
            }
            return;
        }

        const trimmed = editableLine.trim();
        const expression = buildEvaluationExpression(
            editableLine, trimmed, lastResult, decimalDelimiter,
            (value, delimiter) => formatNumber(value, delimiter, 'auto', false),
        );

        try {
            const evalResult = await EvaluateExprProgram(expression, variableValues as Record<string, any>);
            if (!evalResult.ok) throw new Error(evalResult.error || 'Evaluation failed');

            const numberValue = evalResult.numberValue ?? 0;
            const formatted = formatExprValue(evalResult.value, evalResult.isNumber, numberValue, decimalDelimiter, precision, scientificNotation);
            const replacement = formatEvaluatedLine(editableLine, formatted);
            const before = content.slice(0, lineStart);
            const after = content.slice(lineEnd);
            const nextContent = before + replacement + after + (lineEnd === content.length ? '\n' : '');
            const nextCaret = lineEnd === content.length
                ? (before + replacement + '\n').length
                : before.length + replacement.length + 1;

            setContentAndCaret(nextContent, nextCaret);
            setLastResult(evalResult.isNumber ? numberValue : null);

            const nextVariables = (evalResult.variables || {}) as Record<string, unknown>;
            const changedVariableKeys = new Set<string>();
            const allVariableKeys = new Set<string>([...Object.keys(variableValues), ...Object.keys(nextVariables)]);
            allVariableKeys.forEach((key) => {
                const nk = key.toLowerCase();
                if (!areValuesEquivalent(variableValues[nk], nextVariables[nk])) changedVariableKeys.add(nk);
            });

            const nextVariableVersions = { ...variableVersions };
            changedVariableKeys.forEach((key) => { nextVariableVersions[key] = (nextVariableVersions[key] ?? 0) + 1; });

            const dependencies = extractExpressionDependencies(editableLine);
            const dependencySnapshot: Record<string, number> = {};
            dependencies.forEach((name) => { dependencySnapshot[name] = nextVariableVersions[name] ?? 0; });

            setVariableValues(nextVariables);
            setVariableVersions((prev) => ({ ...prev, ...nextVariableVersions }));
            setLineDependencies((prev) => ({ ...prev, [lineIndex]: dependencies }));
            setLineDependencyVersions((prev) => ({ ...prev, [lineIndex]: dependencySnapshot }));
            setStatusText('Calculated');
            setIsStatusError(false);
            setDevError('');
        } catch (error) {
            const replacement = formatEvaluatedLine(editableLine, 'error');
            const before = content.slice(0, lineStart);
            const after = content.slice(lineEnd);
            const nextContent = before + replacement + after;
            const nextCaret = before.length + getPreservedCaretOffset(caretOffsetInLine, replacement.length);
            setContentAndCaret(nextContent, nextCaret);
            setLastResult(null);
            clearLineEvaluationMetadata(lineIndex);
            setIsStatusError(true);
            const errorMessage = error instanceof Error ? error.message : 'Unknown evaluation error';
            setStatusText(getFriendlyEvalErrorMessage(errorMessage));
            setDevError(errorMessage);
        }
    };

    const reevaluateAllExpressions = async (contentOverride?: string) => {
        if (isReevaluatingAll) return;
        setIsReevaluatingAll(true);
        try {
            const sourceLines = (contentOverride ?? content).split('\n');
            const nextLines = [...sourceLines];
            let workingVariables: Record<string, unknown> = {};
            let workingVariableVersions: Record<string, number> = {};
            const nextLineDependencies: Record<number, string[]> = {};
            const nextLineDependencyVersions: Record<number, Record<string, number>> = {};
            let nextLastResult: number | null = null;
            let calculatedCount = 0;
            let failedCount = 0;

            for (let i = 0; i < sourceLines.length; i++) {
                const originalLine = sourceLines[i];
                const editableLine = getExpressionSource(originalLine);
                if (shouldSkipEvaluation(editableLine)) continue;
                if (isAITriggerSourceLine(editableLine)) continue;

                try {
                    const evalResult = await EvaluateExprProgram(editableLine, workingVariables as Record<string, any>);
                    if (!evalResult.ok) throw new Error(evalResult.error || 'Evaluation failed');

                    const numberValue = evalResult.numberValue ?? 0;
                    const formatted = formatExprValue(evalResult.value, evalResult.isNumber, numberValue, decimalDelimiter, precision, scientificNotation);
                    nextLines[i] = formatEvaluatedLine(editableLine, formatted);

                    const nextVariables = (evalResult.variables || {}) as Record<string, unknown>;
                    const changedVariableKeys = new Set<string>();
                    const allVariableKeys = new Set<string>([...Object.keys(workingVariables), ...Object.keys(nextVariables)]);
                    allVariableKeys.forEach((key) => {
                        const nk = key.toLowerCase();
                        if (!areValuesEquivalent(workingVariables[nk], nextVariables[nk])) changedVariableKeys.add(nk);
                    });
                    changedVariableKeys.forEach((key) => { workingVariableVersions[key] = (workingVariableVersions[key] ?? 0) + 1; });

                    const dependencies = extractExpressionDependencies(editableLine);
                    const dependencySnapshot: Record<string, number> = {};
                    dependencies.forEach((name) => { dependencySnapshot[name] = workingVariableVersions[name] ?? 0; });

                    nextLineDependencies[i] = dependencies;
                    nextLineDependencyVersions[i] = dependencySnapshot;
                    workingVariables = nextVariables;
                    nextLastResult = evalResult.isNumber ? numberValue : null;
                    calculatedCount++;
                } catch {
                    nextLines[i] = formatEvaluatedLine(editableLine, 'error');
                    failedCount++;
                    nextLastResult = null;
                }
            }

            // A strict top-to-bottom pass can still leave lines stale when a referenced
            // variable is reassigned later. Refresh stale lines against the latest state
            // and propagate variable updates until snapshots converge.
            let refreshedStaleCount = 0;
            const maxRefreshPasses = Math.max(1, sourceLines.length);
            for (let pass = 0; pass < maxRefreshPasses; pass++) {
                const staleLineIndexes = Object.entries(nextLineDependencyVersions)
                    .filter(([, dependencySnapshot]) => Object.entries(dependencySnapshot).some(([name, version]) => {
                        const currentVersion = workingVariableVersions[name] ?? 0;
                        return currentVersion !== version;
                    }))
                    .map(([lineKey]) => Number(lineKey))
                    .filter((lineIndex) => Number.isFinite(lineIndex))
                    .sort((left, right) => left - right);

                if (staleLineIndexes.length === 0) {
                    break;
                }

                for (const lineIndex of staleLineIndexes) {
                    const editableLine = getExpressionSource(nextLines[lineIndex] ?? '');
                    if (shouldSkipEvaluation(editableLine) || isAITriggerSourceLine(editableLine)) {
                        delete nextLineDependencies[lineIndex];
                        delete nextLineDependencyVersions[lineIndex];
                        continue;
                    }

                    try {
                        const evalResult = await EvaluateExprProgram(editableLine, workingVariables as Record<string, any>);
                        if (!evalResult.ok) {
                            throw new Error(evalResult.error || 'Evaluation failed');
                        }

                        const numberValue = evalResult.numberValue ?? 0;
                        const formatted = formatExprValue(evalResult.value, evalResult.isNumber, numberValue, decimalDelimiter, precision, scientificNotation);
                        nextLines[lineIndex] = formatEvaluatedLine(editableLine, formatted);

                        const nextVariables = (evalResult.variables || {}) as Record<string, unknown>;
                        const changedVariableKeys = new Set<string>();
                        const allVariableKeys = new Set<string>([...Object.keys(workingVariables), ...Object.keys(nextVariables)]);
                        allVariableKeys.forEach((key) => {
                            const nk = key.toLowerCase();
                            if (!areValuesEquivalent(workingVariables[nk], nextVariables[nk])) {
                                changedVariableKeys.add(nk);
                            }
                        });
                        changedVariableKeys.forEach((key) => {
                            workingVariableVersions[key] = (workingVariableVersions[key] ?? 0) + 1;
                        });

                        const dependencies = extractExpressionDependencies(editableLine);
                        const dependencySnapshotAtLatestState: Record<string, number> = {};
                        dependencies.forEach((name) => {
                            dependencySnapshotAtLatestState[name] = workingVariableVersions[name] ?? 0;
                        });
                        nextLineDependencies[lineIndex] = dependencies;
                        nextLineDependencyVersions[lineIndex] = dependencySnapshotAtLatestState;
                        workingVariables = nextVariables;
                        nextLastResult = evalResult.isNumber ? numberValue : null;
                        refreshedStaleCount++;
                    } catch {
                        nextLines[lineIndex] = formatEvaluatedLine(editableLine, 'error');
                        delete nextLineDependencies[lineIndex];
                        delete nextLineDependencyVersions[lineIndex];
                        failedCount++;
                        nextLastResult = null;
                    }
                }
            }

            const nextContent = nextLines.join('\n');
            setContent(nextContent);
            setVariableValues(workingVariables);
            setVariableVersions(() => workingVariableVersions);
            setLineDependencies(() => nextLineDependencies);
            setLineDependencyVersions(() => nextLineDependencyVersions);
            setLastResult(nextLastResult);
            setIsStatusError(failedCount > 0);
            setDevError('');
            setStatusText(
                failedCount > 0
                    ? `Re-evaluated ${calculatedCount} line${calculatedCount === 1 ? '' : 's'}${refreshedStaleCount > 0 ? `, refreshed ${refreshedStaleCount} stale` : ''}, ${failedCount} failed`
                    : `Re-evaluated ${calculatedCount} line${calculatedCount === 1 ? '' : 's'}${refreshedStaleCount > 0 ? `, refreshed ${refreshedStaleCount} stale` : ''}`
            );

            requestAnimationFrame(() => {
                if (!editorRef.current) return;
                const nextCaret = Math.min(editorRef.current.selectionStart, nextContent.length);
                editorRef.current.selectionStart = nextCaret;
                editorRef.current.selectionEnd = nextCaret;
                setCaretPos(nextCaret);
            });
        } finally {
            setIsReevaluatingAll(false);
        }
    };

    const clearStaleStates = () => {
        setLineDependencies(() => ({}));
        setLineDependencyVersions(() => ({}));
        setStatusText('Cleared stale markers');
        setIsStatusError(false);
        setDevError('');
    };

    return { evaluateCurrentLine, reevaluateAllExpressions, clearStaleStates };
}
