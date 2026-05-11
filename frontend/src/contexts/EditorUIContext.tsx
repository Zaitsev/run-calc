import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
    FONT_SCALE_STORAGE_KEY,
    FONT_SCALE_MIN,
    FONT_SCALE_MAX,
    FONT_SCALE_STEP,
    DEFAULT_FONT_SCALE,
} from '../constants';

type EditorUIContextValue = {
    // Font
    fontScale: number;
    setFontScale: React.Dispatch<React.SetStateAction<number>>;
    changeFontScale: (direction: 1 | -1) => void;
    resetFontScale: () => void;
    editorFontSpec: string;
    // Caret
    caretPos: number;
    setCaretPos: (pos: number) => void;
    // Scroll
    editorScrollTop: number;
    setEditorScrollTop: (v: number) => void;
    editorScrollLeft: number;
    setEditorScrollLeft: (v: number) => void;
    editorScrollbarWidth: number;
    syncEditorScrollbarWidth: () => void;
    // Line heights
    lineHeightPx: number;
    lineRowHeights: number[];
    measureLineRowHeights: () => void;
    // DOM refs
    editorRef: React.RefObject<HTMLTextAreaElement | null>;
    overlayRef: React.RefObject<HTMLDivElement | null>;
    gutterRef: React.RefObject<HTMLDivElement | null>;
    burgerMenuRef: React.RefObject<HTMLDivElement | null>;
    precisionMenuRef: React.RefObject<HTMLDivElement | null>;
};

const EditorUIContext = createContext<EditorUIContextValue | null>(null);

export function EditorUIProvider({ children }: { children: ReactNode }) {
    const [fontScale, setFontScale] = useState(() => {
        const raw = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
        if (!raw) return DEFAULT_FONT_SCALE;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return DEFAULT_FONT_SCALE;
        return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, parsed));
    });

    const [editorFontSpec, setEditorFontSpec] = useState('16px Nunito, Segoe UI, Tahoma, sans-serif');
    const [caretPos, setCaretPos] = useState(0);
    const [editorScrollTop, setEditorScrollTop] = useState(0);
    const [editorScrollLeft, setEditorScrollLeft] = useState(0);
    const [editorScrollbarWidth, setEditorScrollbarWidth] = useState(0);
    const [lineHeightPx, setLineHeightPx] = useState(22);
    const [lineRowHeights, setLineRowHeights] = useState<number[]>([]);

    const editorRef = useRef<HTMLTextAreaElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const gutterRef = useRef<HTMLDivElement | null>(null);
    const burgerMenuRef = useRef<HTMLDivElement | null>(null);
    const precisionMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(fontScale));
    }, [fontScale]);

    useEffect(() => {
        if (!editorRef.current) return;
        const cs = getComputedStyle(editorRef.current);
        const lh = parseFloat(cs.lineHeight);
        if (Number.isFinite(lh) && lh > 0) setLineHeightPx(lh);
        setEditorFontSpec(`${cs.fontSize} ${cs.fontFamily}`);
    }, [fontScale]);

    const syncEditorScrollbarWidth = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const nextWidth = Math.max(0, editor.offsetWidth - editor.clientWidth);
        setEditorScrollbarWidth((prev) => (Math.abs(prev - nextWidth) < 0.5 ? prev : nextWidth));
    };

    useLayoutEffect(() => {
        syncEditorScrollbarWidth();
    });

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const ro = new ResizeObserver(() => syncEditorScrollbarWidth());
        ro.observe(editor);
        return () => ro.disconnect();
    }, []);

    const measureLineRowHeights = () => {
        const container = overlayRef.current;
        if (!container) return;
        const children = container.children;
        const heights: number[] = [];
        for (let i = 0; i < children.length; i++) {
            const row = children[i] as HTMLElement;
            const measured = row.getBoundingClientRect().height;
            heights.push(measured > 0 ? measured : row.offsetHeight);
        }
        setLineRowHeights((prev) => {
            if (prev.length === heights.length && prev.every((h, idx) => Math.abs(h - heights[idx]) < 0.01)) return prev;
            return heights;
        });
    };

    useLayoutEffect(() => {
        measureLineRowHeights();
    });

    useEffect(() => {
        const container = overlayRef.current;
        if (!container) return;
        const ro = new ResizeObserver(() => measureLineRowHeights());
        ro.observe(container);
        return () => ro.disconnect();
    }, []);

    const changeFontScale = (direction: 1 | -1) => {
        setFontScale((current) => {
            const next = current + direction * FONT_SCALE_STEP;
            return Number(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, next)).toFixed(2));
        });
    };

    const resetFontScale = () => {
        localStorage.removeItem(FONT_SCALE_STORAGE_KEY);
        setFontScale(DEFAULT_FONT_SCALE);
    };

    return (
        <EditorUIContext.Provider value={{
            fontScale, setFontScale, changeFontScale, resetFontScale, editorFontSpec,
            caretPos, setCaretPos,
            editorScrollTop, setEditorScrollTop,
            editorScrollLeft, setEditorScrollLeft,
            editorScrollbarWidth, syncEditorScrollbarWidth,
            lineHeightPx, lineRowHeights, measureLineRowHeights,
            editorRef, overlayRef, gutterRef, burgerMenuRef, precisionMenuRef,
        }}>
            {children}
        </EditorUIContext.Provider>
    );
}

export function useEditorUI(): EditorUIContextValue {
    const ctx = useContext(EditorUIContext);
    if (!ctx) throw new Error('useEditorUI must be used inside EditorUIProvider');
    return ctx;
}
