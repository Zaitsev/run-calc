import { KeyboardEvent, WheelEvent as ReactWheelEvent, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import {
    EventsOn,
    WindowGetSize,
    WindowHide,
    WindowSetSize
} from '../wailsjs/runtime/runtime';
import { AIDebugDrawer } from './AIDebugDrawer';
import './App.css';
import {
    buildStaleLineDetails,
    isAITriggerSourceLine,
    reformatComputedLineResult
} from './appInteractionLogic';
import appLogoDark from './assets/images/icons/hare-calc-1024-black.png';
import appLogo from './assets/images/icons/hare-calc-1024.png';
import { ClearWorksheetModal } from './components/ClearWorksheetModal';
import { HelpPanelContainer } from './components/HelpPanelContainer';
import { SettingsPanel } from './components/SettingsPanel';
import { StaleBanner } from './components/StaleBanner';
import { StatusBar } from './components/StatusBar';
import { getFontResizeDirectionFromWheel, getPrimaryShortcutAction } from './editorShortcuts';
import { getExpressionSource, splitLineComment } from './lineExpression';
import { useTheme } from './useTheme';

import {
    DEFAULT_FONT_SCALE,
    DOUBLE_ESCAPE_HIDE_WINDOW_MS,
    EDITOR_BOTTOM_PADDING_PX,
    EDITOR_SIDE_PADDING_PX,
    EDITOR_TOP_PADDING_PX,
    FONT_SCALE_MAX,
    FONT_SCALE_MIN,
    FONT_SCALE_STEP,
    INTELLIGENCE_HINT_HIDE_IDLE_MS,
    INTELLIGENCE_HINT_SHOW_DELAY_MS,
    IS_DEV,
    OPERATOR_KEY_RE,
    SETTINGS_DRAWER_MIN_EDITOR_WIDTH,
    SETTINGS_DRAWER_MIN_WINDOW_WIDTH
} from './constants';
import { useAI, useDisplaySettings, useEditorUI, useStatus, useThemeStore, useUIState, useWindow, useWorksheet } from './contexts';
import { buildEvaluationHooks } from './hooks/useEvaluation';
import type {
    PrecisionMode,
    SavedThemeEntry,
    SuggestionItem,
} from './types/app';
import { inferCustomThemeMode } from './utils/colorUtils';
import { buildIntelligenceSuggestions, buildSuggestionCatalog, collectKnownVariableNames, getIdentifierContextAtPosition } from './utils/editorIntelligence';
import { formatNumber, getPrecisionScale, getSystemDecimalDelimiter, resolveDecimalDelimiter } from './utils/formatting';
import { MATH_CONSTANT_NAMES, MATH_FUNCTION_NAMES, usePrefersDark } from './utils/identifierUtils';
import { getLineBounds, lineIndexAtPosition, parseDeclaredVariable, remapLineRecordForEdit, remapMarkedLinesForEdit } from './utils/worksheetEditing';



function App() {
    const {
        content,
        setContent,
        lastResult,
        setLastResult,
        markedLines,
        setMarkedLines,
        variableValues,
        setVariableValues,
        variableVersions,
        setVariableVersions,
        lineDependencies,
        setLineDependencies,
        lineDependencyVersions,
        setLineDependencyVersions,
        clearWorksheet: clearWorksheetState,
    } = useWorksheet();
    const { decimalDelimiterMode, precision, scientificNotation, wordWrap, setWordWrap, uiFontScale } = useDisplaySettings();
    const {
        fontScale,
        setFontScale,
        editorFontSpec,
        caretPos,
        setCaretPos,
        editorScrollTop,
        setEditorScrollTop,
        editorScrollLeft,
        setEditorScrollLeft,
        editorScrollbarWidth,
        syncEditorScrollbarWidth,
        lineHeightPx,
        lineRowHeights,
        editorRef,
        overlayRef,
        gutterRef,
    } = useEditorUI();
    const {
        showSettings,
        setShowSettings,
        showHelp,
        setShowHelp,
        showThemeStore,
        setShowThemeStore,
        helpPanelPosition,
        setHelpPanelPosition,
        showIntelligenceHint,
        setShowIntelligenceHint,
        showClearWorksheetConfirm,
        setShowClearWorksheetConfirm,
        isReevaluatingAll,
        setIsReevaluatingAll,
        showAIDebug,
        setShowAIDebug,
        settingsDrawerWidth,
        setSettingsDrawerWidth,
        startSettingsDrawerResize,
        intelligenceShowTimerRef,
        intelligenceHideTimerRef,
        lastEscapeKeyAtRef,
    } = useUIState();
    const {
        resetWindowLayout: resetWindowLayoutFromContext,
        themeStoreOriginalSizeRef,
        settingsDrawerOriginalSizeRef,
        syncWindowTheme,
    } = useWindow();
    const {
        pendingThemePreview,
        cancelThemePreview: cancelThemePreviewInStore,
    } = useThemeStore();
    const { isStatusError, devError, setStatusText, setIsStatusError, setDevError } = useStatus();
    const {
        aiContextMode,
        aiSettings,
        setAIDebugLog,
        isAIQueryPending,
        setIsAIQueryPending,
        aiPendingLineIndex,
        setAIPendingLineIndex,
        aiProgressMessage,
        setAIProgressMessage,
        aiDebugIdRef,
        handleAIProgressEvent,
    } = useAI();
    const {theme, setTheme} = useTheme();
    const prefersDark = usePrefersDark();
    const isDarkTheme =
        theme.type === 'dark' ||
        (theme.type === 'custom' && (theme.customThemeBase ?? inferCustomThemeMode(theme.customColors)) === 'dark') ||
        (theme.type === 'system' && prefersDark);
    const isContentEmpty = content.trim() === '';
    const previousPrecisionRef = useRef<PrecisionMode>(precision);

    const decimalDelimiter = resolveDecimalDelimiter(decimalDelimiterMode);

    useEffect(() => {
        const previousPrecision = previousPrecisionRef.current;
        const precisionIncreased = getPrecisionScale(precision) > getPrecisionScale(previousPrecision);
        previousPrecisionRef.current = precision;

        if (!precisionIncreased) {
            return;
        }

        void reevaluateAllExpressions();
    }, [precision]);


    // Re-format already-computed numeric result suffixes when display settings change.
    useEffect(() => {
        setContent((currentContent) => {
            const lines = currentContent.split('\n');
            let changed = false;
            const newLines = lines.map((line) => {
                const newLine = reformatComputedLineResult(
                    line,
                    decimalDelimiter,
                    precision,
                    scientificNotation,
                    formatNumber,
                );
                if (newLine !== line) {
                    changed = true;
                    return newLine;
                }

                return line;
            });
            return changed ? newLines.join('\n') : currentContent;
        });
    }, [precision, scientificNotation, decimalDelimiter]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        syncWindowTheme(theme);
    }, [syncWindowTheme, theme]);

    useEffect(() => {
        if (!showClearWorksheetConfirm) {
            return;
        }

        const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setShowClearWorksheetConfirm(false);
            }
        };

        document.addEventListener('keydown', onDocumentKeyDown);
        return () => {
            document.removeEventListener('keydown', onDocumentKeyDown);
        };
    }, [showClearWorksheetConfirm]);

    const changeFontScale = (direction: 1 | -1) => {
        setFontScale((current) => {
            const next = current + direction * FONT_SCALE_STEP;
            return Number(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, next)).toFixed(2));
        });
    };

    const clearWorksheet = () => {
        clearWorksheetState(() => {
            requestAnimationFrame(() => {
                if (!editorRef.current) {
                    return;
                }

                editorRef.current.focus();
                editorRef.current.selectionStart = 0;
                editorRef.current.selectionEnd = 0;
            });
        });
        setStatusText('Ready');
        setIsStatusError(false);
        setDevError('');
    };

    const cancelClearWorksheet = () => {
        setShowClearWorksheetConfirm(false);
    };

    const confirmClearWorksheet = () => {
        setShowClearWorksheetConfirm(false);
        clearWorksheet();
    };

    const toggleMarkLine = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const lineIndex = content.slice(0, editor.selectionStart).split('\n').length - 1;
        setMarkedLines((prev) => {
            const next = new Set(prev);
            if (next.has(lineIndex)) {
                next.delete(lineIndex);
            } else {
                next.add(lineIndex);
            }
            return next;
        });
    };

    const resetFontSize = () => {
        setFontScale(DEFAULT_FONT_SCALE);
        setStatusText('Font size reset');
        setIsStatusError(false);
        setDevError('');
    };

    const resetWindowLayout = () => {
        resetWindowLayoutFromContext();
        setStatusText('Window layout reset');
        setIsStatusError(false);
        setDevError('');
    };

    // --- Menu / keyboard event subscriptions ---

    useEffect(() => {
        const unsubThemeStore = EventsOn('theme-store:open', () => {
            setShowHelp(false);
            setShowSettings(true);
            setShowThemeStore(true);
            void expandWindowForThemeStore();
        });
        const unsubNew = EventsOn('menu:file:new', () => setShowClearWorksheetConfirm(true));
        const unsubResetWindow = EventsOn('menu:view:reset-window-layout', resetWindowLayout);
        const unsubIncrease = EventsOn('menu:view:increase-font-size', () => changeFontScale(1));
        const unsubDecrease = EventsOn('menu:view:decrease-font-size', () => changeFontScale(-1));
        const unsubResetFont = EventsOn('menu:view:reset-font-size', resetFontSize);
        const unsubOpenHelp = EventsOn('menu:help:open', () => {
            setShowThemeStore(false);
            setShowSettings(false);
            setShowHelp(true);
        });
        const unsubAIProgress = EventsOn('ai:progress', handleAIProgressEvent);
        return () => {
            unsubThemeStore();
            unsubNew();
            unsubResetWindow();
            unsubIncrease();
            unsubDecrease();
            unsubResetFont();
            unsubOpenHelp();
            unsubAIProgress();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Editor helpers ---

    const setContentAndCaret = (nextContent: string, caretPos: number) => {
        setContent(nextContent);
        setCaretPos(caretPos);
        requestAnimationFrame(() => {
            if (!editorRef.current) {
                return;
            }
            editorRef.current.selectionStart = caretPos;
            editorRef.current.selectionEnd = caretPos;
        });
    };

    const insertAtSelection = (insertText: string) => {
        const editor = editorRef.current;
        if (!editor) {
            return;
        }

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const nextContent = content.slice(0, start) + insertText + content.slice(end);
        const nextCaret = start + insertText.length;

        setContentAndCaret(nextContent, nextCaret);
    };

    const insertLineBelowCurrent = () => {
        const editor = editorRef.current;
        if (!editor) {
            return;
        }

        const {lineEnd} = getLineBounds(content, editor.selectionStart);
        const insertPos = lineEnd;
        const nextContent = content.slice(0, insertPos) + '\n' + content.slice(insertPos);
        const nextCaret = insertPos + 1;

        setContentAndCaret(nextContent, nextCaret);
    };

    const updateCaretPosFromEditor = () => {
        if (!editorRef.current) {
            return;
        }

        setCaretPos(editorRef.current.selectionStart);
    };

    const scheduleIntelligenceHintFromTyping = () => {
        if (intelligenceShowTimerRef.current !== null) {
            window.clearTimeout(intelligenceShowTimerRef.current);
            intelligenceShowTimerRef.current = null;
        }
        if (intelligenceHideTimerRef.current !== null) {
            window.clearTimeout(intelligenceHideTimerRef.current);
            intelligenceHideTimerRef.current = null;
        }

        setShowIntelligenceHint(false);

        intelligenceShowTimerRef.current = window.setTimeout(() => {
            setShowIntelligenceHint(true);
            intelligenceShowTimerRef.current = null;
        }, INTELLIGENCE_HINT_SHOW_DELAY_MS);

        intelligenceHideTimerRef.current = window.setTimeout(() => {
            setShowIntelligenceHint(false);
            intelligenceHideTimerRef.current = null;
        }, INTELLIGENCE_HINT_HIDE_IDLE_MS);
    };

    const clearLineEvaluationMetadata = (lineIndex: number) => {
        setLineDependencies((prev) => {
            if (!(lineIndex in prev)) {
                return prev;
            }

            const next = {...prev};
            delete next[lineIndex];
            return next;
        });

        setLineDependencyVersions((prev) => {
            if (!(lineIndex in prev)) {
                return prev;
            }

            const next = {...prev};
            delete next[lineIndex];
            return next;
        });
    };

    const knownVariableNames = useMemo(
        () => collectKnownVariableNames(content, variableValues),
        [content, variableValues],
    );

    const suggestionCatalog = useMemo<SuggestionItem[]>(
        () => buildSuggestionCatalog(knownVariableNames),
        [knownVariableNames],
    );

    const identifierContext = useMemo(
        () => getIdentifierContextAtPosition(content, caretPos),
        [content, caretPos],
    );

    const intelligenceSuggestions = useMemo(
        () => buildIntelligenceSuggestions(identifierContext, suggestionCatalog),
        [identifierContext, suggestionCatalog],
    );
    const acceptSuggestion = (suggestion: SuggestionItem) => {
        if (!editorRef.current || !identifierContext) {
            return;
        }

        const nextChar = content[identifierContext.end] ?? '';
        const replacementBase = suggestion.kind === 'constant'
            ? suggestion.label
            : suggestion.label.toLowerCase();
        const replacementCore = identifierContext.wantsAtPrefix && suggestion.kind === 'variable'
            ? `@${replacementBase}`
            : replacementBase;
        const replacement = suggestion.kind === 'function' && nextChar !== '('
            ? `${replacementCore}(`
            : replacementCore;

        const nextContent = content.slice(0, identifierContext.start)
            + replacement
            + content.slice(identifierContext.end);
        const nextCaret = identifierContext.start + replacement.length;

        setContentAndCaret(nextContent, nextCaret);
        setStatusText(`${suggestion.kind}: ${replacementBase}`);
        setIsStatusError(false);
        setDevError('');
        setShowIntelligenceHint(false);
    };

    const renderSyntaxText = (text: string, keyPrefix: string) => {
        type TokenKind =
            | 'plain'
            | 'variable-decl'
            | 'variable'
            | 'function'
            | 'operator'
            | 'number'
            | 'constant'
            | 'punctuation'
            | 'comment';

        const chunks: Array<{text: string; kind: TokenKind}> = [];
        const pushChunk = (part: string, kind: TokenKind) => {
            if (part.length > 0) {
                chunks.push({text: part, kind});
            }
        };

        let i = 0;
        const declMatch = text.match(/^(\s*)(@?[a-zA-Z_][a-zA-Z0-9_]*)(\s*=.*)$/);
        if (declMatch) {
            pushChunk(declMatch[1], 'plain');
            pushChunk(declMatch[2], 'variable-decl');
            i = declMatch[1].length + declMatch[2].length;
        }

        while (i < text.length) {
            const current = text[i];

            if (current === '"') {
                pushChunk(text.slice(i), 'comment');
                break;
            }

            if (/\s/.test(current)) {
                const start = i;
                while (i < text.length && /\s/.test(text[i])) i++;
                pushChunk(text.slice(start, i), 'plain');
                continue;
            }

            if (current === '@' && i + 1 < text.length && /[a-zA-Z_]/.test(text[i + 1])) {
                const start = i;
                i += 2;
                while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) i++;
                pushChunk(text.slice(start, i), 'variable');
                continue;
            }

            if (/[a-zA-Z_]/.test(current)) {
                const start = i;
                i++;
                while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) i++;
                const identifier = text.slice(start, i);
                const upper = identifier.toUpperCase();
                const lower = identifier.toLowerCase();

                let j = i;
                while (j < text.length && /\s/.test(text[j])) j++;
                const nextChar = text[j];

                if (MATH_FUNCTION_NAMES.has(upper) && nextChar === '(') {
                    pushChunk(identifier, 'function');
                } else if (MATH_CONSTANT_NAMES.has(upper)) {
                    pushChunk(identifier, 'constant');
                } else if (knownVariableNames.has(lower) || upper.length === 1) {
                    pushChunk(identifier, 'variable');
                } else {
                    pushChunk(identifier, 'plain');
                }
                continue;
            }

            const numberMatch = text.slice(i).match(/^(\d+(?:[\.,]\d+)?(?:[eE][+\-]?\d+)?)/);
            if (numberMatch) {
                pushChunk(numberMatch[1], 'number');
                i += numberMatch[1].length;
                continue;
            }

            if ('+-*/='.includes(current)) {
                pushChunk(current, 'operator');
                i++;
                continue;
            }

            if ('(),;'.includes(current)) {
                pushChunk(current, 'punctuation');
                i++;
                continue;
            }

            pushChunk(current, 'plain');
            i++;
        }

        return chunks.map((chunk, idx) => {
            if (chunk.kind === 'plain') {
                return <span key={`${keyPrefix}-${idx}`}>{chunk.text}</span>;
            }

            return (
                <span key={`${keyPrefix}-${idx}`} className={`syntax-token syntax-token--${chunk.kind}`}>
                    {chunk.text}
                </span>
            );
        });
    };

    const { evaluateCurrentLine, reevaluateAllExpressions, clearStaleStates } = buildEvaluationHooks({
        content, lastResult, variableValues, variableVersions, lineDependencies, lineDependencyVersions,
        isReevaluatingAll, isAIQueryPending, aiContextMode, aiSettings,
        decimalDelimiter, precision, scientificNotation,
        setContent, setCaretPos, setLastResult,
        setVariableValues,
        setVariableVersions,
        setLineDependencies,
        setLineDependencyVersions,
        setIsReevaluatingAll, setIsAIQueryPending, setAIPendingLineIndex, setAIProgressMessage,
        setAIDebugLog, setStatusText, setIsStatusError, setDevError,
        clearLineEvaluationMetadata, editorRef, aiDebugIdRef,
    });

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
            const now = Date.now();
            const elapsed = now - lastEscapeKeyAtRef.current;
            lastEscapeKeyAtRef.current = now;
            if (elapsed <= DOUBLE_ESCAPE_HIDE_WINDOW_MS) {
                event.preventDefault();
                WindowHide();
            }
            return;
        }

        const shortcutAction = getPrimaryShortcutAction(event);
        if (shortcutAction === 'insert-line-below') {
            event.preventDefault();
            insertLineBelowCurrent();
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            void evaluateCurrentLine();
            setShowIntelligenceHint(false);
            return;
        }

        if (event.key === 'Tab' && intelligenceSuggestions.length > 0 && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            acceptSuggestion(intelligenceSuggestions[0]);
            return;
        }

        if (shortcutAction === 'toggle-mark-line') {
            event.preventDefault();
            toggleMarkLine();
            return;
        }

        if (shortcutAction === 'toggle-word-wrap') {
            event.preventDefault();
            setWordWrap((prev) => !prev);
            return;
        }

        if (shortcutAction === 'increase-font-size') {
            event.preventDefault();
            changeFontScale(1);
            return;
        }

        if (shortcutAction === 'decrease-font-size') {
            event.preventDefault();
            changeFontScale(-1);
            return;
        }

        if (shortcutAction === 'reset-font-size') {
            event.preventDefault();
            resetFontSize();
            return;
        }

        const BRACKET_PAIRS: Record<string, string> = {'(': ')', '[': ']', '{': '}'};
        if (BRACKET_PAIRS[event.key] && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const editor = editorRef.current;
            if (editor && editor.selectionStart !== editor.selectionEnd) {
                event.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                const selected = content.slice(start, end);
                const close = BRACKET_PAIRS[event.key];
                const nextContent = content.slice(0, start) + event.key + selected + close + content.slice(end);
                setContent(nextContent);
                setCaretPos(end + 2);
                requestAnimationFrame(() => {
                    if (!editorRef.current) return;
                    editorRef.current.selectionStart = start + 1;
                    editorRef.current.selectionEnd = end + 1;
                });
                return;
            }
        }

        if (!OPERATOR_KEY_RE.test(event.key) || event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        const editor = editorRef.current;
        if (!editor || lastResult === null) {
            return;
        }

        if (editor.selectionStart !== editor.selectionEnd) {
            return;
        }

        const {lineStart, lineEnd} = getLineBounds(content, editor.selectionStart);
        const lineText = content.slice(lineStart, lineEnd);
        if (lineText.trim().length !== 0) {
            return;
        }

        event.preventDefault();
        insertAtSelection(`${formatNumber(lastResult, decimalDelimiter, 'auto', false)}${event.key}`);
    };

    const onEditorWheel = (event: ReactWheelEvent<HTMLTextAreaElement>) => {
        const direction = getFontResizeDirectionFromWheel(event);
        if (direction === null) {
            return;
        }

        event.preventDefault();
        changeFontScale(direction);
    };

    const {lines: contentLines, lineErrors, truncatedZeroLines, truncatedLines, declarationLines, aiTriggerLines} = useMemo(() => {
        const nextLineErrors = new Map<number, string>();
        const nextTruncatedZeroLines = new Map<number, number>();
        const nextTruncatedLines = new Map<number, number>(); // significant truncation, non-zero
        const nextDeclarationLines = new Set<number>();
        const nextAITriggerLines = new Set<number>();
        const lines = content.split('\n');
        let insideMultilineCodeBlock = false;

        lines.forEach((line, i) => {
            const tickCount = line.match(/`/g)?.length ?? 0;
            const source = getExpressionSource(line);
            const declaration = parseDeclaredVariable(source);
            if (declaration) {
                nextDeclarationLines.add(i);
            }

            if (isAITriggerSourceLine(source)) {
                nextAITriggerLines.add(i);
            }

            if (insideMultilineCodeBlock || tickCount % 2 === 1) {
                if (tickCount % 2 === 1) {
                    insideMultilineCodeBlock = !insideMultilineCodeBlock;
                }
                return;
            }

            const {body} = splitLineComment(line);
            if (body.trimEnd().endsWith(' = error')) {
                nextLineErrors.set(i, 'error');
            }
        });

        return {
            lines,
            lineErrors: nextLineErrors,
            truncatedZeroLines: nextTruncatedZeroLines,
            truncatedLines: nextTruncatedLines,
            declarationLines: nextDeclarationLines,
            aiTriggerLines: nextAITriggerLines,
        };
    }, [content]);

    const staleLineDetails = useMemo(() => {
        return buildStaleLineDetails(lineDependencyVersions, variableVersions);
    }, [lineDependencyVersions, variableVersions]);

    const renderOverlayLines = () => {
        return contentLines.map((line, i) => {
            const isPendingAILine = isAIQueryPending && aiPendingLineIndex === i;
            const lineClassName = `editor-line-row${lineErrors.has(i) ? ' line-error' : ''}${!lineErrors.has(i) && staleLineDetails.has(i) ? ' line-stale' : ''}${aiTriggerLines.has(i) ? ' line-ai' : ''}${isPendingAILine ? ' line-ai-waiting' : ''}`;
            const isVariableLine = declarationLines.has(i);
            const isMarkedLine = markedLines.has(i);

            const {body: lineBody, comment: lineComment} = splitLineComment(line);
            const eqIdx = isVariableLine ? lineBody.lastIndexOf(' = ') : lineBody.indexOf(' = ');
            if (eqIdx === -1) {
                return (
                    <div key={i} className={lineClassName}>
                        {renderSyntaxText(line, `${i}-full`)}
                    </div>
                );
            }

            if (!isMarkedLine && !isVariableLine) {
                return (
                    <div key={i} className={lineClassName}>
                        {renderSyntaxText(line, `${i}-line`)}
                    </div>
                );
            }

            const resultClass = isVariableLine
                ? 'marked-result marked-result--var'
                : 'marked-result';

            return (
                <div key={i} className={lineClassName}>
                    {renderSyntaxText(lineBody.slice(0, eqIdx), `${i}-lhs`)}
                    <span className={resultClass}>{lineBody.slice(eqIdx)}</span>
                    {lineComment && renderSyntaxText(lineComment, `${i}-cmt`)}
                </div>
            );
        });
    };

    const activeLineIndex = content.slice(0, caretPos).split('\n').length - 1;
    const activeLineError = lineErrors.get(activeLineIndex) ?? '';
    const activeLineText = contentLines[activeLineIndex] ?? '';
    const measureLineWidth = (text: string): number => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return 0;
            ctx.font = editorFontSpec;
            return ctx.measureText(text).width;
        } catch {
            return 0;
        }
    };
    const EDITOR_PADDING = 20;
    const getLineTop = (idx: number): number => {
        if (lineRowHeights.length > 0) {
            let top = 0;
            for (let j = 0; j < idx && j < lineRowHeights.length; j++) top += lineRowHeights[j];
            return top;
        }
        return idx * lineHeightPx;
    };
    const activeLineH = lineRowHeights[activeLineIndex] ?? lineHeightPx;
    const activeLineErrorTop = EDITOR_TOP_PADDING_PX + getLineTop(activeLineIndex) - editorScrollTop + activeLineH * 0.9;
    const activeLineErrorLeft = Math.max(EDITOR_PADDING, EDITOR_PADDING + measureLineWidth(activeLineText) + 8 - editorScrollLeft);
    const pendingAILineHeight = aiPendingLineIndex !== null ? (lineRowHeights[aiPendingLineIndex] ?? lineHeightPx) : lineHeightPx;
    const aiProgressTop = aiPendingLineIndex !== null
        ? EDITOR_TOP_PADDING_PX + getLineTop(aiPendingLineIndex) - editorScrollTop + pendingAILineHeight + 4
        : 0;
    const intelligenceTop = identifierContext
        ? EDITOR_TOP_PADDING_PX + getLineTop(activeLineIndex) - editorScrollTop + activeLineH * 2.2
        : 0;
    const intelligenceLeft = identifierContext
        ? Math.max(EDITOR_PADDING, EDITOR_PADDING + measureLineWidth(activeLineText.slice(0, identifierContext.startInLine)) - editorScrollLeft)
        : 0;


    const cancelThemePreview = () => {
        cancelThemePreviewInStore(setTheme);
    };



    const expandWindowForThemeStore = async () => {
        try {
            const current = await WindowGetSize();
            if (!themeStoreOriginalSizeRef.current) {
                themeStoreOriginalSizeRef.current = { w: current.w, h: current.h };
            }

            const targetWidth = Math.min(1800, Math.max(1360, current.w + 260));
            if (targetWidth !== current.w) {
                WindowSetSize(targetWidth, current.h);
            }
        } catch {
            // Keep UI functional even if window APIs fail.
        }
    };

    const expandWindowForSettingsDrawer = async () => {
        try {
            const current = await WindowGetSize();
            const requiredWidth = Math.min(
                1800,
                Math.max(SETTINGS_DRAWER_MIN_WINDOW_WIDTH, settingsDrawerWidth + SETTINGS_DRAWER_MIN_EDITOR_WIDTH),
            );
            if (current.w >= requiredWidth) {
                return;
            }

            if (!settingsDrawerOriginalSizeRef.current) {
                settingsDrawerOriginalSizeRef.current = { w: current.w, h: current.h };
            }

            WindowSetSize(requiredWidth, current.h);
        } catch {
            // Keep UI functional even if window APIs fail.
        }
    };

    const restoreWindowAfterThemeStore = async () => {
        const original = themeStoreOriginalSizeRef.current;
        if (!original) {
            return;
        }

        themeStoreOriginalSizeRef.current = null;
        try {
            WindowSetSize(original.w, original.h);
        } catch {
            // Ignore restore failures.
        }
    };

    const restoreWindowAfterSettingsDrawer = async () => {
        const original = settingsDrawerOriginalSizeRef.current;
        if (!original) {
            return;
        }

        settingsDrawerOriginalSizeRef.current = null;
        try {
            WindowSetSize(original.w, original.h);
        } catch {
            // Ignore restore failures.
        }
    };

    useEffect(() => {
        if (showSettings && !showThemeStore) {
            void expandWindowForSettingsDrawer();
            return;
        }

        void restoreWindowAfterSettingsDrawer();
    }, [showSettings, showThemeStore]); // eslint-disable-line react-hooks/exhaustive-deps

    const openThemeStoreInSidebar = () => {
        void restoreWindowAfterSettingsDrawer();
        setShowThemeStore(true);
        void expandWindowForThemeStore();
    };

    const closeThemeStoreInSidebar = () => {
        if (pendingThemePreview) {
            cancelThemePreview();
        }
        setShowThemeStore(false);
        void restoreWindowAfterThemeStore();
    };

    const helpDockClass = !showHelp
        ? ''
        : helpPanelPosition === 'left'
            ? ' window--help-left'
            : helpPanelPosition === 'bottom'
                ? ' window--help-bottom'
                : ' window--help-right';
    const windowStyle = {
        '--window-logo-image': `url(${isDarkTheme ? appLogoDark : appLogo})`,
        '--logo-layer-opacity': isContentEmpty ? '1' : (isDarkTheme ? '0.02' : '0.025'),
        '--ui-font-scale': uiFontScale,
    } as CSSProperties;

    return (
        <div id="app" className={`window${helpDockClass}`} style={windowStyle}>
            <div className="editor-container">
                <div className="gutter" ref={gutterRef}>
                    <div className="gutter-lines" style={{paddingTop: EDITOR_TOP_PADDING_PX, paddingBottom: EDITOR_BOTTOM_PADDING_PX}}>
                        {contentLines.map((_, i) => (
                            <div
                                key={i}
                                className={`gutter-line${(lineRowHeights[i] ?? lineHeightPx) > lineHeightPx + 1 ? ' gutter-line--wrapped' : ''}${markedLines.has(i) ? ' gutter-line--marked' : ''}${lineErrors.has(i) ? ' gutter-line--error' : ''}${!lineErrors.has(i) && (truncatedZeroLines.has(i) || truncatedLines.has(i)) ? ' gutter-line--truncated' : ''}${!lineErrors.has(i) && staleLineDetails.has(i) ? ' gutter-line--stale' : ''}${declarationLines.has(i) ? ' gutter-line--var' : ''}${aiTriggerLines.has(i) ? ' gutter-line--ai' : ''}`}
                                style={{height: lineRowHeights[i] ?? lineHeightPx}}
                                onClick={() => {
                                    setMarkedLines((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(i)) next.delete(i); else next.add(i);
                                        return next;
                                    });
                                }}
                                title={
                                    lineErrors.get(i)
                                    ?? (truncatedZeroLines.has(i)
                                        ? `Result rounded to 0 — actual: ${formatNumber(truncatedZeroLines.get(i)!, decimalDelimiter, 'auto', false)} (precision: ${precision})`
                                        : (truncatedLines.has(i)
                                            ? `Result truncated — actual: ${formatNumber(truncatedLines.get(i)!, decimalDelimiter, 'auto', false)}, displayed: ${formatNumber(truncatedLines.get(i)!, decimalDelimiter, precision, scientificNotation)} (precision: ${precision})`
                                            : (staleLineDetails.has(i)
                                                ? `Stale result: depends on changed variable${staleLineDetails.get(i)!.length === 1 ? '' : 's'} ${staleLineDetails.get(i)!.join(', ')}`
                                            : (aiTriggerLines.has(i)
                                                ? 'AI prompt line'
                                            : (declarationLines.has(i)
                                                ? 'Variable declaration'
                                                : (markedLines.has(i) ? 'Remove mark' : 'Mark line'))))))
                                }
                            >
                                <span className="gutter-line-number" aria-hidden="true">{i + 1}</span>
                                <span className="gutter-line-indicator" aria-hidden="true">
                                    {lineErrors.has(i) && (
                                        <span className="gutter-error-icon">!</span>
                                    )}
                                    {!lineErrors.has(i) && truncatedZeroLines.has(i) && (
                                        <span className="gutter-truncated-icon">~0</span>
                                    )}
                                    {!lineErrors.has(i) && !truncatedZeroLines.has(i) && truncatedLines.has(i) && (
                                        <span className="gutter-truncated-icon">≈</span>
                                    )}
                                    {!lineErrors.has(i) && !truncatedZeroLines.has(i) && !truncatedLines.has(i) && staleLineDetails.has(i) && (
                                        <span className="gutter-stale-icon">↻</span>
                                    )}
                                    {!lineErrors.has(i) && !truncatedZeroLines.has(i) && !truncatedLines.has(i) && !staleLineDetails.has(i) && aiTriggerLines.has(i) && (
                                        <span className="gutter-ai-icon">?</span>
                                    )}
                                    {markedLines.has(i) && !lineErrors.has(i) && !truncatedZeroLines.has(i) && !truncatedLines.has(i) && !staleLineDetails.has(i) && !declarationLines.has(i) && (
                                        <span className="gutter-mark">&#9670;</span>
                                    )}
                                    {declarationLines.has(i) && !lineErrors.has(i) && !truncatedZeroLines.has(i) && !truncatedLines.has(i) && !staleLineDetails.has(i) && (
                                        <span className="gutter-var">@</span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="editor-area">
                    <StaleBanner
                        staleCount={staleLineDetails.size}
                        isReevaluatingAll={isReevaluatingAll}
                        onReevaluateAll={() => void reevaluateAllExpressions()}
                        onClearStale={clearStaleStates}
                    />
                    <textarea
                        ref={editorRef}
                        className={`editor${wordWrap ? ' editor--wrap' : ''}`}
                        spellCheck={false}
                        value={content}
                        onChange={(e) => {
                            const rawNextContent = e.target.value;
                            const rawCaretPos = e.target.selectionStart;
                            scheduleIntelligenceHintFromTyping();
                            const {lineStart, lineEnd} = getLineBounds(rawNextContent, rawCaretPos);
                            const editedLine = rawNextContent.slice(lineStart, lineEnd);
                            const cleanedLine = getExpressionSource(editedLine);

                            let nextContent = rawNextContent;
                            let nextCaretPos = rawCaretPos;
                            if (cleanedLine !== editedLine) {
                                nextContent = rawNextContent.slice(0, lineStart) + cleanedLine + rawNextContent.slice(lineEnd);
                                nextCaretPos = Math.min(rawCaretPos, lineStart + cleanedLine.length);
                            }

                            const activeLineIndex = lineIndexAtPosition(nextContent, nextCaretPos);
                            const previousLine = content.split('\n')[activeLineIndex] ?? '';
                            const nextLine = nextContent.split('\n')[activeLineIndex] ?? '';
                            const previousLineSource = getExpressionSource(previousLine);
                            const nextLineSource = getExpressionSource(nextLine);
                            const sourceChanged = previousLineSource !== nextLineSource;

                            if (sourceChanged) {
                                setLastResult(null);
                                clearLineEvaluationMetadata(activeLineIndex);
                            }

                            setContent(nextContent);
                            setCaretPos(nextCaretPos);

                            if (isStatusError || devError) {
                                setStatusText('Ready');
                                setIsStatusError(false);
                                setDevError('');
                            }

                            if (nextContent !== rawNextContent || nextCaretPos !== rawCaretPos) {
                                requestAnimationFrame(() => {
                                    if (!editorRef.current) {
                                        return;
                                    }
                                    editorRef.current.selectionStart = nextCaretPos;
                                    editorRef.current.selectionEnd = nextCaretPos;
                                });
                            }

                            setVariableValues((prevValues) => {
                                const activeVariables = new Set<string>();
                                nextContent.split('\n').forEach((line) => {
                                    const declaration = parseDeclaredVariable(getExpressionSource(line));
                                    if (declaration) {
                                        activeVariables.add(declaration.key);
                                    }
                                });

                                const nextValues: Record<string, unknown> = {};
                                let changed = false;
                                for (const [name, value] of Object.entries(prevValues)) {
                                    if (activeVariables.has(name)) {
                                        nextValues[name] = value;
                                    } else {
                                        changed = true;
                                    }
                                }

                                // Version bumps are evaluation-driven. Editing alone should not create stale markers.

                                return changed ? nextValues : prevValues;
                            });

                            setMarkedLines((prev) => remapMarkedLinesForEdit(prev, content, nextContent));
                            setLineDependencies((prev) => remapLineRecordForEdit(prev, content, nextContent));
                            setLineDependencyVersions((prev) => remapLineRecordForEdit(prev, content, nextContent));
                        }}
                        onSelect={updateCaretPosFromEditor}
                        onClick={updateCaretPosFromEditor}
                        onKeyUp={updateCaretPosFromEditor}
                        onKeyDown={onKeyDown}
                        onWheel={onEditorWheel}
                        onScroll={() => {
                            const el = editorRef.current;
                            if (!el) return;
                            setEditorScrollTop(el.scrollTop);
                            setEditorScrollLeft(el.scrollLeft);
                            syncEditorScrollbarWidth();
                            if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;
                            if (overlayRef.current) {
                                overlayRef.current.scrollTop = el.scrollTop;
                                overlayRef.current.scrollLeft = el.scrollLeft;
                            }
                        }}
                        style={{
                            fontSize: `${fontScale}em`,
                            paddingTop: `${EDITOR_TOP_PADDING_PX}px`,
                            paddingBottom: `${EDITOR_BOTTOM_PADDING_PX}px`,
                        }}
                    />
                    <div
                        ref={overlayRef}
                        className={`editor-overlay${wordWrap ? ' editor-overlay--wrap' : ''}`}
                        aria-hidden="true"
                        style={{
                            fontSize: `${fontScale}em`,
                            paddingTop: `${EDITOR_TOP_PADDING_PX}px`,
                            paddingBottom: `${EDITOR_BOTTOM_PADDING_PX}px`,
                            paddingRight: `${EDITOR_SIDE_PADDING_PX + editorScrollbarWidth}px`,
                        }}
                    >
                        {renderOverlayLines()}
                    </div>
                    {activeLineError && (
                        <div
                            className="line-error-floating"
                            style={{top: activeLineErrorTop, left: activeLineErrorLeft}}
                            aria-live="polite"
                        >
                            {activeLineError}
                        </div>
                    )}
                    {isAIQueryPending && aiPendingLineIndex !== null && aiProgressMessage && (
                        <div
                            className="line-ai-progress"
                            style={{top: aiProgressTop, left: EDITOR_PADDING - editorScrollLeft}}
                            aria-live="polite"
                        >
                            <span className="line-ai-progress-prefix">" </span>
                            <span>AI: {aiProgressMessage}</span>
                        </div>
                    )}
                    {showIntelligenceHint && intelligenceSuggestions.length > 0 && (
                        <div
                            className="editor-intelligence"
                            style={{top: intelligenceTop, left: intelligenceLeft}}
                            aria-live="polite"
                        >
                            {intelligenceSuggestions.map((suggestion, index) => (
                                <div key={`${suggestion.kind}-${suggestion.label}`} className={`editor-intelligence-item${index === 0 ? ' editor-intelligence-item--active' : ''}`}>
                                    <span className={`editor-intelligence-kind editor-intelligence-kind--${suggestion.kind}`}>{suggestion.kind}</span>
                                    <span className="editor-intelligence-label">{suggestion.label}</span>
                                </div>
                            ))}
                            <div className="editor-intelligence-hint">Tab to accept</div>
                        </div>
                    )}
                </div>
            </div>
            <StatusBar />

            <SettingsPanel
                showSettings={showSettings}
                showThemeStore={showThemeStore}
                setShowThemeStore={setShowThemeStore}
                settingsDrawerWidth={settingsDrawerWidth}
                setSettingsDrawerWidth={setSettingsDrawerWidth}
                startSettingsDrawerResize={startSettingsDrawerResize}
                onClose={() => setShowSettings(false)}
                onOpenThemeStore={openThemeStoreInSidebar}
                onCloseThemeStore={closeThemeStoreInSidebar}
            />

            <AIDebugDrawer />

            {showHelp && (
                <HelpPanelContainer
                    helpPanelPosition={helpPanelPosition}
                    setHelpPanelPosition={setHelpPanelPosition}
                    onClose={() => setShowHelp(false)}
                />
            )}
            {showClearWorksheetConfirm && (
                <ClearWorksheetModal onConfirm={confirmClearWorksheet} onCancel={cancelClearWorksheet} />
            )}
        </div>
    );
}

export default App;
