import type { RefObject } from 'react';
import type { AIContextMode, AISettingsState } from '../AISettings';
import type { AIDebugEntry } from '../AIDebugDrawer';
import type { AIRunResponse } from '../types/app';
import type { DecimalDelimiter, PrecisionMode } from '../types/app';
import { CaptureRandomState, EvaluateExprProgram, RestoreRandomState, RunAIQuery } from '../../wailsjs/go/main/App';
import {
    getExpressionSource,
    isAITriggerLine,
    getAITriggerPrompt,
    splitLineComment,
} from '../lineExpression';
import {
    shouldSkipEvaluation,
    shouldSkipEvaluationAtCaret,
    buildEvaluationExpression,
    getPreservedCaretOffset,
    getFriendlyEvalErrorMessage,
    isAITriggerSourceLine,
    stripMarkdownCodeFences,
    SHADOW_STALE_MARKER,
} from '../appInteractionLogic';
import {
    getLineBounds,
    lineIndexAtPosition,
    formatEvaluatedLine,
    formatExprValue,
} from '../utils/evalHelpers';
import { formatNumber } from '../utils/formatting';

type EvalDeps = {
    // state
    content: string;
    lastResult: number | null;
    variableValues: Record<string, unknown>;
    lineDependencyVersions: Record<number, Record<string, number>>;
    isReevaluatingAll: boolean;
    isAIQueryPending: boolean;
    aiContextMode: AIContextMode;
    aiSettings: AISettingsState;
    decimalDelimiter: DecimalDelimiter;
    precision: PrecisionMode;
    scientificNotation: boolean;
    variableFirstInlining: boolean;
    // setters
    setContent: (v: string) => void;
    setCaretPos: (v: number) => void;
    setLastResult: (v: number | null) => void;
    setVariableValues: (v: Record<string, unknown>) => void;
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
    worksheetRevisionRef?: React.MutableRefObject<number>;
};

type ContentAndCaret = { nextContent: string; nextCaret: number };
const NON_DETERMINISTIC_FUNCTION_CALL_RE = /\b(?:uniform|normal)\s*\(/i;

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
        content, lastResult, variableValues,
        isReevaluatingAll, isAIQueryPending, aiContextMode, aiSettings,
        decimalDelimiter, precision, scientificNotation, variableFirstInlining,
        setContent, setCaretPos, setLastResult,
        setVariableValues, setLineDependencyVersions,
        setIsReevaluatingAll, setIsAIQueryPending, setAIPendingLineIndex, setAIProgressMessage,
        setAIDebugLog, setStatusText, setIsStatusError, setDevError,
        clearLineEvaluationMetadata, editorRef, aiDebugIdRef,
        worksheetRevisionRef,
    } = deps;

    const setContentAndCaret = (nextContent: string, nextCaret: number) => {
        applyContentAndCaret(editorRef, setContent, setCaretPos, { nextContent, nextCaret });
    };

    const buildShadowLineSnapshots = (lineIndexes: number[]) => {
        const snapshots: Record<number, Record<string, number>> = {};
        lineIndexes.forEach((lineIndex) => {
            snapshots[lineIndex] = { [SHADOW_STALE_MARKER]: -1 };
        });
        return snapshots;
    };

    const verifyWorksheetShadow = async () => {
        if (isReevaluatingAll || isAIQueryPending) return 0;

        const sourceLines = content.split('\n');
        const containsNonDeterministicExpressions = sourceLines.some((sourceLine) => {
            const editableLine = getExpressionSource(sourceLine);
            if (shouldSkipEvaluation(editableLine) || isAITriggerSourceLine(editableLine)) {
                return false;
            }
            const { body } = splitLineComment(editableLine);
            return NON_DETERMINISTIC_FUNCTION_CALL_RE.test(body);
        });
        if (containsNonDeterministicExpressions) {
            setLineDependencyVersions(() => ({}));
            return 0;
        }

        const revisionAtStart = worksheetRevisionRef?.current ?? 0;
        let capturedRandomState: Awaited<ReturnType<typeof CaptureRandomState>> | null = null;
        try {
            capturedRandomState = await CaptureRandomState();
        } catch {
            return 0;
        }
        let shadowVariables: Record<string, unknown> = {};
        const mismatchedLineIndexes: number[] = [];
        let nextShadowSnapshots: Record<number, Record<string, number>> | null = null;
        let restoreRandomStateFailed = false;

        const revisionChanged = () => (worksheetRevisionRef?.current ?? 0) !== revisionAtStart;

        try {
            // Evaluate each line top-to-bottom and compare results
            for (let i = 0; i < sourceLines.length; i++) {
                if (revisionChanged()) return 0;

                const editableLine = getExpressionSource(sourceLines[i]);
                if (shouldSkipEvaluation(editableLine) || isAITriggerSourceLine(editableLine)) {
                    continue;
                }
                if (sourceLines[i] === editableLine) {
                    continue;
                }

                try {
                    const evalResult = await EvaluateExprProgram(editableLine, shadowVariables as Record<string, any>);
                    if (!evalResult.ok) throw new Error(evalResult.error || 'Evaluation failed');
                    if (revisionChanged()) return 0;

                    const numberValue = evalResult.numberValue ?? 0;
                    const formatted = formatExprValue(evalResult.value, evalResult.isNumber, numberValue, decimalDelimiter, precision, scientificNotation);
                    const shadowLineResult = formatEvaluatedLine(editableLine, formatted);

                    // Compare shadow result with actual source line
                    if (shadowLineResult !== sourceLines[i]) {
                        mismatchedLineIndexes.push(i);
                    }

                    // Update shadow variables for next line evaluation
                    const nextVariables = (evalResult.variables || {}) as Record<string, unknown>;
                    shadowVariables = nextVariables;
                } catch {
                    // Compare: if source doesn't show error, it's a mismatch
                    if (sourceLines[i] !== formatEvaluatedLine(editableLine, 'error')) {
                        mismatchedLineIndexes.push(i);
                    }
                }
            }

            if (revisionChanged()) return 0;

            // Mark mismatched lines with shadow verification marker.
            nextShadowSnapshots = buildShadowLineSnapshots(mismatchedLineIndexes);
        } finally {
            if (capturedRandomState !== null) {
                try {
                    await RestoreRandomState(capturedRandomState);
                } catch {
                    restoreRandomStateFailed = true;
                }
            }
        }

        if (restoreRandomStateFailed || nextShadowSnapshots === null) {
            setLineDependencyVersions(() => ({}));
            return 0;
        }

        // Shadow verification is the single source of stale markers in shadow-only mode.
        setLineDependencyVersions(() => nextShadowSnapshots);
        return mismatchedLineIndexes.length;
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
        
        // Extract previous line content for variable-first inlining feature
        let previousLineSource = '';
        if (lineStart > 0) {
            const prevLineEnd = lineStart - 1;  // Account for the newline
            const prevBounds = getLineBounds(content, Math.max(0, lineStart - 2));
            const prevLineStart = prevBounds.lineStart;
            const prevLineText = content.slice(prevLineStart, prevLineEnd);
            previousLineSource = getExpressionSource(prevLineText);
        }
        
        const expression = buildEvaluationExpression(
            editableLine, trimmed, lastResult, decimalDelimiter,
            (value, delimiter) => formatNumber(value, delimiter, 'auto', false),
            previousLineSource,
            variableFirstInlining,
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

            setVariableValues(nextVariables);
            clearLineEvaluationMetadata(lineIndex);
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
        // Bump revision before the first await so any in-flight verifyWorksheetShadow
        // will see revisionChanged() === true in its finally block and skip RestoreRandomState.
        if (worksheetRevisionRef) worksheetRevisionRef.current += 1;
        setIsReevaluatingAll(true);
        const sourceContent = contentOverride ?? content;
        const caretSnapshot = editorRef.current?.selectionStart ?? 0;
        const caretBounds = getLineBounds(sourceContent, caretSnapshot);
        const caretLineIndex = lineIndexAtPosition(sourceContent, caretSnapshot);
        const caretLineText = sourceContent.slice(caretBounds.lineStart, caretBounds.lineEnd);
        const caretOffsetInLine = Math.min(Math.max(caretSnapshot - caretBounds.lineStart, 0), caretLineText.length);
        const caretExpressionOffset = Math.min(caretOffsetInLine, getExpressionSource(caretLineText).length);
        const revisionAtStart = worksheetRevisionRef?.current ?? 0;
        try {
            const sourceLines = sourceContent.split('\n');
            const nextLines = [...sourceLines];
            let workingVariables: Record<string, unknown> = {};
            let nextLastResult: number | null = null;
            let calculatedCount = 0;
            let failedCount = 0;

            // Simple line-by-line evaluation: no complex refresh logic
            for (let i = 0; i < sourceLines.length; i++) {
                const editableLine = getExpressionSource(sourceLines[i]);
                if (shouldSkipEvaluation(editableLine)) continue;
                if (isAITriggerSourceLine(editableLine)) continue;
                if ((worksheetRevisionRef?.current ?? 0) !== revisionAtStart) {
                    return;
                }

                try {
                    const evalResult = await EvaluateExprProgram(editableLine, workingVariables as Record<string, any>);
                    if (!evalResult.ok) throw new Error(evalResult.error || 'Evaluation failed');
                    if ((worksheetRevisionRef?.current ?? 0) !== revisionAtStart) {
                        return;
                    }

                    const numberValue = evalResult.numberValue ?? 0;
                    const formatted = formatExprValue(evalResult.value, evalResult.isNumber, numberValue, decimalDelimiter, precision, scientificNotation);
                    nextLines[i] = formatEvaluatedLine(editableLine, formatted);

                    const nextVariables = (evalResult.variables || {}) as Record<string, unknown>;
                    workingVariables = nextVariables;
                    nextLastResult = evalResult.isNumber ? numberValue : null;
                    calculatedCount++;
                } catch {
                    nextLines[i] = formatEvaluatedLine(editableLine, 'error');
                    failedCount++;
                    nextLastResult = null;
                }
            }

            const nextContent = nextLines.join('\n');
            const targetLineIndex = Math.min(caretLineIndex, Math.max(0, nextLines.length - 1));
            let targetLineStart = 0;
            for (let i = 0; i < targetLineIndex; i++) {
                targetLineStart += nextLines[i].length + 1;
            }
            const targetEditableLine = getExpressionSource(nextLines[targetLineIndex] ?? '');
            const targetCaret = targetLineStart + Math.min(caretExpressionOffset, targetEditableLine.length);

            setContent(nextContent);
            setVariableValues(workingVariables);
            // Clear all stale markers after re-evaluation (shadow verifier will detect mismatches)
            setLineDependencyVersions(() => ({}));
            setLastResult(nextLastResult);
            setIsStatusError(failedCount > 0);
            setDevError('');
            setStatusText(
                failedCount > 0
                    ? `Re-evaluated ${calculatedCount} line${calculatedCount === 1 ? '' : 's'}, ${failedCount} failed`
                    : `Re-evaluated ${calculatedCount} line${calculatedCount === 1 ? '' : 's'}`
            );

            requestAnimationFrame(() => {
                if (!editorRef.current) return;
                const nextCaret = Math.min(targetCaret, nextContent.length);
                editorRef.current.selectionStart = nextCaret;
                editorRef.current.selectionEnd = nextCaret;
                setCaretPos(nextCaret);
            });
        } finally {
            setIsReevaluatingAll(false);
        }
    };

    return { evaluateCurrentLine, reevaluateAllExpressions, verifyWorksheetShadow };
}
