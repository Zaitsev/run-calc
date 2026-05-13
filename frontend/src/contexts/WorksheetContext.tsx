import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import {
    WORKSHEET_CONTENT_STORAGE_KEY,
    LAST_RESULT_STORAGE_KEY,
    MARKED_LINES_STORAGE_KEY,
    VARIABLE_VALUES_STORAGE_KEY,
} from '../constants';

type WorksheetContextValue = {
    content: string;
    setContent: React.Dispatch<React.SetStateAction<string>>;
    lastResult: number | null;
    setLastResult: (v: number | null) => void;
    markedLines: ReadonlySet<number>;
    setMarkedLines: React.Dispatch<React.SetStateAction<ReadonlySet<number>>>;
    variableValues: Record<string, unknown>;
    setVariableValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
    variableVersions: Record<string, number>;
    setVariableVersions: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    lineDependencies: Record<number, string[]>;
    setLineDependencies: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
    lineDependencyVersions: Record<number, Record<string, number>>;
    setLineDependencyVersions: React.Dispatch<React.SetStateAction<Record<number, Record<string, number>>>>;
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

// ─────────────────────────────────────────────────────────────────────────────

export function WorksheetProvider({ children }: { children: ReactNode }) {
    const [content, setContent] = useState(() => localStorage.getItem(WORKSHEET_CONTENT_STORAGE_KEY) ?? '');

    const [lastResult, setLastResultState] = useState<number | null>(() => {
        const raw = localStorage.getItem(LAST_RESULT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    });

    const [markedLines, setMarkedLines] = useState<ReadonlySet<number>>(() => {
        const raw = localStorage.getItem(MARKED_LINES_STORAGE_KEY);
        if (!raw) return new Set<number>();
        try {
            const arr: unknown = JSON.parse(raw);
            if (Array.isArray(arr)) return new Set<number>(arr.filter((n): n is number => typeof n === 'number'));
        } catch { /* ignore */ }
        return new Set<number>();
    });

    const [variableValues, setVariableValues] = useState<Record<string, unknown>>(() => {
        const raw = localStorage.getItem(VARIABLE_VALUES_STORAGE_KEY);
        if (!raw) return {};
        try {
            const obj = JSON.parse(raw);
            if (typeof obj === 'object' && obj !== null) return obj as Record<string, unknown>;
        } catch { /* ignore */ }
        return {};
    });

    const [variableVersions, setVariableVersions] = useState<Record<string, number>>({});
    const [lineDependencies, setLineDependencies] = useState<Record<number, string[]>>({});
    const [lineDependencyVersions, setLineDependencyVersions] = useState<Record<number, Record<string, number>>>({});

    const setLastResult = (v: number | null) => setLastResultState(v);

    const clearWorksheet = (editorFocusCb?: () => void) => {
        setContent('');
        setLastResultState(null);
        setMarkedLines(new Set());
        setVariableValues({});
        setVariableVersions({});
        setLineDependencies({});
        setLineDependencyVersions({});
        localStorage.removeItem(WORKSHEET_CONTENT_STORAGE_KEY);
        localStorage.removeItem(LAST_RESULT_STORAGE_KEY);
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
        setLineDependencies((prev) => {
            if (!(lineIndex in prev)) return prev;
            const next = { ...prev };
            delete next[lineIndex];
            return next;
        });
        setLineDependencyVersions((prev) => {
            if (!(lineIndex in prev)) return prev;
            const next = { ...prev };
            delete next[lineIndex];
            return next;
        });
    };

    return (
        <WorksheetContext.Provider value={{
            content, setContent,
            lastResult, setLastResult,
            markedLines, setMarkedLines,
            variableValues, setVariableValues,
            variableVersions, setVariableVersions,
            lineDependencies, setLineDependencies,
            lineDependencyVersions, setLineDependencyVersions,
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
