import type { AcceptedThemeEntry } from '../ThemeStore';
import type { AISettingsState, AIKeyStatusState } from '../AISettings';
import type { PrecisionMode } from '../utils/formatting';

export type { PrecisionMode };

export type SavedThemeEntry = AcceptedThemeEntry;
export type DecimalDelimiter = '.' | ',';
export type DecimalDelimiterMode = 'dot' | 'comma' | 'system';
export type HelpPanelPosition = 'left' | 'right' | 'bottom';
export type HelpPage = 'operations' | 'shortcuts' | 'worksheets' | 'new';
export type WorksheetTabPosition = 'top' | 'bottom' | 'left';
export type SuggestionKind = 'variable' | 'function' | 'constant';

export type SuggestionItem = {
    label: string;
    kind: SuggestionKind;
    matchText: string;
};

export type WorksheetSnapshot = {
    id: string;
    name: string;
    content: string;
    lastResult: number | null;
    markedLines: number[];
    variableValues: Record<string, unknown>;
    isLocked: boolean;
    lockPasswordHash?: string;
};

export type IdentifierContext = {
    start: number;
    end: number;
    token: string;
    baseToken: string;
    wantsAtPrefix: boolean;
    lineStart: number;
    startInLine: number;
};

export type StoredWindowState = {
    w: number;
    h: number;
    x: number;
    y: number;
};

export type AIModelOutput = {
    answer?: string;
    answerNumber?: number;
    comment?: string;
    code?: string;
};

export type AIRunResponse = {
    ok: boolean;
    error?: string;
    output: AIModelOutput;
    preview: {
        systemPrompt: string;
        userPrompt: string;
        contextMode: string;
        contextLineCount: number;
        endpoint?: string;
        modelId?: string;
        rawContextText?: string;
        rawLinesAbove?: string[];
        rawFullContent?: string;
        rawInitialPayload?: string;
        rawExchangeLog?: string;
        rawFinalMessage?: string;
        rawFinalContent?: string;
    };
};

export type AISettingsResponse = {
    settings: AISettingsState;
    keyStatus: AIKeyStatusState;
};

export type AIProgressEvent = {
    message?: string;
};

export function defaultAISettingsState(): AISettingsState {
    return {
        providerPreset: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        modelId: 'gpt-4o-mini',
        defaultContextMode: 'above',
        allowInsecureKeyFallback: false,
        allowCustomEndpointKeyReuse: false,
        customKeySourceEndpoint: '',
        requestTimeoutSeconds: 45,
    };
}

export function defaultAIKeyStatusState(): AIKeyStatusState {
    return {
        hasKey: false,
        storageMode: 'none',
    };
}

export function areAISettingsEqual(left: AISettingsState, right: AISettingsState): boolean {
    return left.providerPreset === right.providerPreset &&
        left.endpoint === right.endpoint &&
        left.modelId === right.modelId &&
        left.defaultContextMode === right.defaultContextMode &&
        left.allowInsecureKeyFallback === right.allowInsecureKeyFallback &&
        left.allowCustomEndpointKeyReuse === right.allowCustomEndpointKeyReuse &&
        left.requestTimeoutSeconds === right.requestTimeoutSeconds;
}
