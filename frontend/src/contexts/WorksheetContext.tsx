import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { WorksheetSnapshot } from '../types/app';
import { useWorksheetManager } from './WorksheetManagerContext';

type WorksheetContextValue = {
    content: string;
    setContent: React.Dispatch<React.SetStateAction<string>>;
    lastResult: number | null;
    setLastResult: (v: number | null) => void;
    markedLines: ReadonlySet<number>;
    setMarkedLines: React.Dispatch<React.SetStateAction<ReadonlySet<number>>>;
    variableValues: Record<string, unknown>;
    setVariableValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
    staleLineMarkers: Record<number, Record<string, number>>;
    setStaleLineMarkers: React.Dispatch<React.SetStateAction<Record<number, Record<string, number>>>>;
    clearWorksheet: (editorFocusCb?: () => void) => void;
    remapMarkedLinesForEdit: (prevMarked: ReadonlySet<number>, beforeText: string, afterText: string) => ReadonlySet<number>;
    remapLineRecordForEdit: <T>(prev: Record<number, T>, beforeText: string, afterText: string) => Record<number, T>;
    clearLineEvaluationMetadata: (lineIndex: number) => void;
};

const WorksheetContext = createContext<WorksheetContextValue | null>(null);

// ─── internal helpers ────────────────────────────────────────────────────────

function countLineBreaks(text: string): number {
    let count = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') count++;
    }
    return count;
}

function getLineEditInfo(beforeText: string, afterText: string) {
    let start = 0;
    const maxStart = Math.min(beforeText.length, afterText.length);
    while (start < maxStart && beforeText[start] === afterText[start]) start++;

    let beforeEnd = beforeText.length;
    let afterEnd = afterText.length;
    while (
        beforeEnd > start &&
        afterEnd > start &&
        beforeText[beforeEnd - 1] === afterText[afterEnd - 1]
    ) {
        beforeEnd--;
        afterEnd--;
    }

    const beforeChanged = beforeText.slice(start, beforeEnd);
    const afterChanged = afterText.slice(start, afterEnd);
    const startLine = countLineBreaks(beforeText.slice(0, start));
    const beforeBreaks = countLineBreaks(beforeChanged);
    const afterBreaks = countLineBreaks(afterChanged);

    return { startLine, beforeBreaks, afterBreaks, delta: afterBreaks - beforeBreaks };
}

function remapLineIndex(
    lineIndex: number,
    edit: { startLine: number; beforeBreaks: number; afterBreaks: number; delta: number },
): number | null {
    const editEndLineBefore = edit.startLine + edit.beforeBreaks;
    if (lineIndex < edit.startLine) return lineIndex;
    if (lineIndex > editEndLineBefore) return lineIndex + edit.delta;
    const relative = lineIndex - edit.startLine;
    if (relative <= edit.afterBreaks) return edit.startLine + relative;
    return null;
}

function sameMarkedLines(markedLinesArray: number[], markedLinesSet: ReadonlySet<number>): boolean {
    if (markedLinesArray.length !== markedLinesSet.size) {
        return false;
    }

    return markedLinesArray.every((line) => markedLinesSet.has(line));
}

function sameVariableValues(nextValues: Record<string, unknown>, currentValues: Record<string, unknown>): boolean {
    const nextEntries = Object.entries(nextValues);
    if (nextEntries.length !== Object.keys(currentValues).length) {
        return false;
    }

    return nextEntries.every(([key, value]) => Object.is(currentValues[key], value));
}

export function shouldResetSessionEvaluationMetadata(params: {
    activeWorksheet: WorksheetSnapshot;
    syncedWorksheetId: string;
    hasPendingContentSync: boolean;
    content: string;
    lastResult: number | null;
    markedLines: ReadonlySet<number>;
    variableValues: Record<string, unknown>;
}): boolean {
    const {
        activeWorksheet,
        syncedWorksheetId,
        hasPendingContentSync,
        content,
        lastResult,
        markedLines,
        variableValues,
    } = params;

    if (syncedWorksheetId !== activeWorksheet.id) {
        return true;
    }

    if (hasPendingContentSync) {
        return false;
    }

    return activeWorksheet.content !== content
        || activeWorksheet.lastResult !== lastResult
        || !sameMarkedLines(activeWorksheet.markedLines, markedLines)
        || !sameVariableValues(activeWorksheet.variableValues, variableValues);
}

// ─────────────────────────────────────────────────────────────────────────────

export function WorksheetProvider({ children }: { children: ReactNode }) {
    const { worksheets, activeId, updateActiveWorksheet } = useWorksheetManager();
    const activeWorksheet = worksheets.find(w => w.id === activeId);

    // Provide a default context even during hydration, to avoid null renders
    const fallbackWorksheet: WorksheetSnapshot = activeWorksheet || {
        id: activeId || 'temp',
        name: 'Worksheet',
        content: '',
        lastResult: null,
        markedLines: [],
        variableValues: {},
        isLocked: false,
        lockPasswordHash: undefined,
    };

    const [lastResult, setLastResultState] = useState<number | null>(fallbackWorksheet.lastResult);
    const [content, setContentState] = useState(fallbackWorksheet.content);
    const [markedLines, setMarkedLines] = useState<ReadonlySet<number>>(new Set(fallbackWorksheet.markedLines));
    const [variableValues, setVariableValues] = useState<Record<string, unknown>>(fallbackWorksheet.variableValues);

    // Session-only state (not persisted)
    const [staleLineMarkers, setStaleLineMarkers] = useState<Record<number, Record<string, number>>>({});
    const hasPendingContentSyncRef = useRef(false);
    const syncedWorksheetIdRef = useRef(fallbackWorksheet.id);
    const contentRef = useRef(content);
    const lastResultRef = useRef(lastResult);
    const markedLinesRef = useRef(markedLines);
    const variableValuesRef = useRef(variableValues);

    useEffect(() => {
        contentRef.current = content;
        lastResultRef.current = lastResult;
        markedLinesRef.current = markedLines;
        variableValuesRef.current = variableValues;
    }, [content, lastResult, markedLines, variableValues]);

    // Sync local state from active worksheet when it changes
    useEffect(() => {
        if (!activeWorksheet) return;
        const isWorksheetSwitch = syncedWorksheetIdRef.current !== activeWorksheet.id;
        const shouldResetMetadata = shouldResetSessionEvaluationMetadata({
            activeWorksheet,
            syncedWorksheetId: syncedWorksheetIdRef.current,
            hasPendingContentSync: hasPendingContentSyncRef.current,
            content: contentRef.current,
            lastResult: lastResultRef.current,
            markedLines: markedLinesRef.current,
            variableValues: variableValuesRef.current,
        });
        syncedWorksheetIdRef.current = activeWorksheet.id;
        if (isWorksheetSwitch || !hasPendingContentSyncRef.current) {
            setContentState(activeWorksheet.content);
        }
        setLastResultState(activeWorksheet.lastResult);
        setMarkedLines(new Set(activeWorksheet.markedLines));
        setVariableValues(activeWorksheet.variableValues);
        hasPendingContentSyncRef.current = false;

        if (shouldResetMetadata) {
            setStaleLineMarkers({});
        }
    }, [activeWorksheet]);

    // Persist state changes back to manager - debounced to avoid excessive updates
    const persistTimerRef = useRef<number | null>(null);
    useEffect(() => {
        if (persistTimerRef.current !== null) {
            window.clearTimeout(persistTimerRef.current);
        }
        persistTimerRef.current = window.setTimeout(() => {
            updateActiveWorksheet({
                content,
                lastResult,
                markedLines: [...markedLines],
                variableValues,
            });
            hasPendingContentSyncRef.current = false;
        }, 200);

        return () => {
            if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
        };
    }, [content, lastResult, markedLines, variableValues, updateActiveWorksheet]);

    const setContent = (next: React.SetStateAction<string>) => {
        const currentContent = content;
        const newContent = typeof next === 'function' ? next(currentContent) : next;
        hasPendingContentSyncRef.current = true;
        setContentState(newContent);
    };

    const setLastResult = (v: number | null) => setLastResultState(v);

    const clearWorksheet = (editorFocusCb?: () => void) => {
        setContent('');
        setLastResultState(null);
        setMarkedLines(new Set());
        setVariableValues({});
        setStaleLineMarkers({});
        editorFocusCb?.();
    };

    const remapMarkedLinesForEdit = (
        prevMarked: ReadonlySet<number>,
        beforeText: string,
        afterText: string,
    ): ReadonlySet<number> => {
        const edit = getLineEditInfo(beforeText, afterText);
        if (edit.delta === 0) return prevMarked;
        const next = new Set<number>();
        prevMarked.forEach((lineIndex) => {
            const remapped = remapLineIndex(lineIndex, edit);
            if (remapped !== null) next.add(remapped);
        });
        return next;
    };

    const remapLineRecordForEdit = <T,>(
        prevRecord: Record<number, T>,
        beforeText: string,
        afterText: string,
    ): Record<number, T> => {
        const edit = getLineEditInfo(beforeText, afterText);
        if (edit.delta === 0) return prevRecord;
        const nextRecord: Record<number, T> = {};
        Object.entries(prevRecord).forEach(([key, value]) => {
            const lineIndex = Number(key);
            if (!Number.isFinite(lineIndex)) return;
            const remapped = remapLineIndex(lineIndex, edit);
            if (remapped !== null) nextRecord[remapped] = value;
        });
        return nextRecord;
    };

    const clearLineEvaluationMetadata = (lineIndex: number) => {
        setStaleLineMarkers((prev) => {
            if (!(lineIndex in prev)) return prev;
            const next = { ...prev };
            delete next[lineIndex];
            return next;
        });
    };

    return (
        <WorksheetContext.Provider value={{
            content,
            setContent,
            lastResult,
            setLastResult,
            markedLines,
            setMarkedLines,
            variableValues,
            setVariableValues,
            staleLineMarkers,
            setStaleLineMarkers,
            clearWorksheet,
            remapMarkedLinesForEdit,
            remapLineRecordForEdit,
            clearLineEvaluationMetadata,
        }}>
            {children}
        </WorksheetContext.Provider>
    );
}

export function useWorksheet(): WorksheetContextValue {
    const ctx = useContext(WorksheetContext);
    if (!ctx) throw new Error('useWorksheet must be used inside WorksheetProvider');
    return ctx;
}
