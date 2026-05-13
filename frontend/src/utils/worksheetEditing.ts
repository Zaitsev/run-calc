export type DeclaredVariable = {
    key: string;
    label: string;
    expression: string;
};

export type LineBounds = {
    lineStart: number;
    lineEnd: number;
};

type LineEditInfo = {
    startLine: number;
    beforeBreaks: number;
    afterBreaks: number;
    delta: number;
};

const countLineBreaks = (text: string): number => {
    let count = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') {
            count++;
        }
    }

    return count;
};

const getLineEditInfo = (beforeText: string, afterText: string): LineEditInfo => {
    let start = 0;
    const maxStart = Math.min(beforeText.length, afterText.length);
    while (start < maxStart && beforeText[start] === afterText[start]) {
        start++;
    }

    let beforeEnd = beforeText.length;
    let afterEnd = afterText.length;
    while (
        beforeEnd > start
        && afterEnd > start
        && beforeText[beforeEnd - 1] === afterText[afterEnd - 1]
    ) {
        beforeEnd--;
        afterEnd--;
    }

    const beforeChanged = beforeText.slice(start, beforeEnd);
    const afterChanged = afterText.slice(start, afterEnd);
    const startLine = countLineBreaks(beforeText.slice(0, start));
    const beforeBreaks = countLineBreaks(beforeChanged);
    const afterBreaks = countLineBreaks(afterChanged);

    return {
        startLine,
        beforeBreaks,
        afterBreaks,
        delta: afterBreaks - beforeBreaks,
    };
};

const remapLineIndex = (lineIndex: number, edit: LineEditInfo): number | null => {
    const editEndLineBefore = edit.startLine + edit.beforeBreaks;
    if (lineIndex < edit.startLine) {
        return lineIndex;
    }

    if (lineIndex > editEndLineBefore) {
        return lineIndex + edit.delta;
    }

    const relative = lineIndex - edit.startLine;
    if (relative <= edit.afterBreaks) {
        return edit.startLine + relative;
    }

    return null;
};

export const remapMarkedLinesForEdit = (
    prevMarked: ReadonlySet<number>,
    beforeText: string,
    afterText: string,
): ReadonlySet<number> => {
    const edit = getLineEditInfo(beforeText, afterText);
    if (edit.delta === 0) {
        return prevMarked;
    }

    const next = new Set<number>();
    prevMarked.forEach((lineIndex) => {
        const remapped = remapLineIndex(lineIndex, edit);
        if (remapped !== null) {
            next.add(remapped);
        }
    });

    return next;
};

export const remapLineRecordForEdit = <T,>(
    prevRecord: Record<number, T>,
    beforeText: string,
    afterText: string,
): Record<number, T> => {
    const edit = getLineEditInfo(beforeText, afterText);
    if (edit.delta === 0) {
        return prevRecord;
    }

    const nextRecord: Record<number, T> = {};
    Object.entries(prevRecord).forEach(([key, value]) => {
        const lineIndex = Number(key);
        if (!Number.isFinite(lineIndex)) {
            return;
        }

        const remapped = remapLineIndex(lineIndex, edit);
        if (remapped !== null) {
            nextRecord[remapped] = value;
        }
    });

    return nextRecord;
};

export const lineIndexAtPosition = (text: string, position: number): number => {
    return countLineBreaks(text.slice(0, position));
};

export const getLineBounds = (text: string, pos: number): LineBounds => {
    const lineStart = text.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
    const nextBreak = text.indexOf('\n', pos);
    const lineEnd = nextBreak === -1 ? text.length : nextBreak;

    return {lineStart, lineEnd};
};

export const parseDeclaredVariable = (lineText: string): DeclaredVariable | null => {
    const match = lineText.match(/^\s*(@?[a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (!match) {
        return null;
    }

    const label = match[1];
    const key = (label.startsWith('@') ? label.slice(1) : label).toLowerCase();

    return {
        key,
        label,
        expression: match[2].trim(),
    };
};
