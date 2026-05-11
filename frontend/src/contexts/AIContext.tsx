import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AIContextMode, AISettingsState, AIKeyStatusState } from '../AISettings';
import type { AIDebugEntry } from '../AIDebugDrawer';
import type { AIRunResponse, AISettingsResponse, AIProgressEvent } from '../types/app';
import { defaultAISettingsState, defaultAIKeyStatusState, areAISettingsEqual } from '../types/app';
import {
    ClearAIAPIKey,
    GetAIKeyStatusForSettings,
    GetAISettings,
    RunAIQuery,
    SaveAISettings,
    SetAIAPIKey,
} from '../../wailsjs/go/main/App';

type AIContextValue = {
    aiSettings: AISettingsState;
    setAISettings: React.Dispatch<React.SetStateAction<AISettingsState>>;
    aiSettingsDraft: AISettingsState;
    setAISettingsDraft: React.Dispatch<React.SetStateAction<AISettingsState>>;
    aiKeyStatus: AIKeyStatusState;
    setAIKeyStatus: React.Dispatch<React.SetStateAction<AIKeyStatusState>>;
    aiSettingsBusy: boolean;
    setAISettingsBusy: (v: boolean) => void;
    aiSettingsHasUnsavedChanges: boolean;
    aiSettingsActionFailed: boolean;
    setAISettingsActionFailed: (v: boolean) => void;
    aiSettingsApplyError: string;
    setAISettingsApplyError: (v: string) => void;
    aiContextMode: AIContextMode;
    setAIContextMode: (v: AIContextMode) => void;
    aiDebugLog: AIDebugEntry[];
    setAIDebugLog: React.Dispatch<React.SetStateAction<AIDebugEntry[]>>;
    aiDebugIdRef: React.RefObject<number>;
    isAIQueryPending: boolean;
    setIsAIQueryPending: (v: boolean) => void;
    aiPendingLineIndex: number | null;
    setAIPendingLineIndex: (v: number | null) => void;
    aiProgressMessage: string;
    setAIProgressMessage: (v: string) => void;
    testAndSaveAISettings: (
        opts: { setStatusText: (s: string) => void; setIsStatusError: (v: boolean) => void; setDevError: (v: string) => void }
    ) => Promise<void>;
    revertAISettingsDraftToSaved: (
        opts: { setStatusText: (s: string) => void; setIsStatusError: (v: boolean) => void; setDevError: (v: string) => void }
    ) => void;
    saveAIKeyToBackend: (
        apiKey: string,
        opts: { setStatusText: (s: string) => void; setIsStatusError: (v: boolean) => void; setDevError: (v: string) => void }
    ) => Promise<void>;
    clearAIKeyInBackend: (
        opts: { setStatusText: (s: string) => void; setIsStatusError: (v: boolean) => void; setDevError: (v: string) => void }
    ) => Promise<void>;
    runAIQuery: (
        params: {
            prompt: string;
            contextMode: AIContextMode;
            linesAbove: string[];
            fullContent: string;
        }
    ) => Promise<AIRunResponse>;
    handleAIProgressEvent: (payload: AIProgressEvent | string | null | undefined) => void;
};

const AIContext = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: ReactNode }) {
    const [aiSettings, setAISettings] = useState<AISettingsState>(() => defaultAISettingsState());
    const [aiSettingsDraft, setAISettingsDraft] = useState<AISettingsState>(() => defaultAISettingsState());
    const [aiKeyStatus, setAIKeyStatus] = useState<AIKeyStatusState>(() => defaultAIKeyStatusState());
    const [aiSettingsBusy, setAISettingsBusyState] = useState(false);
    const [aiSettingsActionFailed, setAISettingsActionFailedState] = useState(false);
    const [aiSettingsApplyError, setAISettingsApplyErrorState] = useState('');
    const [aiContextMode, setAIContextModeState] = useState<AIContextMode>('above');
    const [aiDebugLog, setAIDebugLog] = useState<AIDebugEntry[]>([]);
    const [isAIQueryPending, setIsAIQueryPendingState] = useState(false);
    const [aiPendingLineIndex, setAIPendingLineIndexState] = useState<number | null>(null);
    const [aiProgressMessage, setAIProgressMessageState] = useState('');

    const aiDebugIdRef = useRef(0);

    const aiSettingsHasUnsavedChanges = !areAISettingsEqual(aiSettingsDraft, aiSettings);

    // Load settings on mount
    useState(() => {
        let cancelled = false;
        const load = async () => {
            setAISettingsBusyState(true);
            try {
                const response = await GetAISettings() as AISettingsResponse;
                if (cancelled) return;
                const loaded = response.settings || defaultAISettingsState();
                setAISettings(loaded);
                setAISettingsDraft(loaded);
                setAISettingsActionFailedState(false);
                setAISettingsApplyErrorState('');
                setAIKeyStatus(response.keyStatus || defaultAIKeyStatusState());
                setAIContextModeState(loaded.defaultContextMode === 'full' ? 'full' : 'above');
            } catch {
                if (cancelled) return;
            } finally {
                if (!cancelled) setAISettingsBusyState(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    });

    // Refresh key status when draft provider changes
    useState(() => {
        let cancelled = false;
        const refresh = async () => {
            try {
                const status = await GetAIKeyStatusForSettings(aiSettingsDraft as any) as AIKeyStatusState;
                if (!cancelled) setAIKeyStatus(status || defaultAIKeyStatusState());
            } catch { /* ignore */ }
        };
        void refresh();
        return () => { cancelled = true; };
    });

    const revertAISettingsDraftToSaved = (opts: { setStatusText: (s: string) => void; setIsStatusError: (v: boolean) => void; setDevError: (v: string) => void }) => {
        setAISettingsDraft(aiSettings);
        setAIContextModeState(aiSettings.defaultContextMode === 'full' ? 'full' : 'above');
        setAISettingsActionFailedState(false);
        setAISettingsApplyErrorState('');
        opts.setStatusText('AI settings draft reverted to last saved state.');
        opts.setIsStatusError(false);
        opts.setDevError('');
    };

    const testAndSaveAISettings = async (opts: { setStatusText: (s: string) => void; setIsStatusError: (v: boolean) => void; setDevError: (v: string) => void }) => {
        if (!aiSettingsHasUnsavedChanges) {
            opts.setStatusText('AI settings are already up to date.');
            opts.setIsStatusError(false);
            setAISettingsApplyErrorState('');
            opts.setDevError('');
            return;
        }
        setAISettingsBusyState(true);
        setAISettingsActionFailedState(false);
        setAISettingsApplyErrorState('');
        try {
            opts.setStatusText('Testing AI settings...');
            opts.setIsStatusError(false);
            opts.setDevError('');
            const health = await RunAIQuery({ prompt: 'Health check: respond with answerNumber 1.', contextMode: aiSettingsDraft.defaultContextMode, linesAbove: [], fullContent: '', settingsOverride: aiSettingsDraft } as any) as AIRunResponse;
            if (!health.ok) {
                const msg = health.error || 'AI settings test failed';
                opts.setStatusText(`AI settings test failed. Changes were not saved: ${msg}`);
                opts.setIsStatusError(true);
                opts.setDevError(msg);
                setAISettingsActionFailedState(true);
                setAISettingsApplyErrorState(msg);
                return;
            }
            const response = await SaveAISettings(aiSettingsDraft as any) as AISettingsResponse;
            const settingsError = response.keyStatus?.lastError || '';
            if (settingsError.startsWith('settings validation failed:') || settingsError.startsWith('settings save failed:')) {
                setAIKeyStatus(response.keyStatus || defaultAIKeyStatusState());
                opts.setStatusText(`AI settings save failed. Changes were not saved: ${settingsError}`);
                opts.setIsStatusError(true);
                opts.setDevError(settingsError);
                setAISettingsActionFailedState(true);
                setAISettingsApplyErrorState(settingsError);
                return;
            }
            const saved = response.settings || aiSettingsDraft;
            setAISettings(saved);
            setAISettingsDraft(saved);
            setAISettingsActionFailedState(false);
            setAISettingsApplyErrorState('');
            setAIKeyStatus(response.keyStatus || defaultAIKeyStatusState());
            setAIContextModeState(saved.defaultContextMode === 'full' ? 'full' : 'above');
            opts.setStatusText('AI settings test passed and settings were saved.');
            opts.setIsStatusError(false);
            opts.setDevError('');
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown AI settings test error';
            opts.setStatusText(`AI settings test failed. Changes were not saved: ${msg}`);
            opts.setIsStatusError(true);
            opts.setDevError(msg);
            setAISettingsActionFailedState(true);
            setAISettingsApplyErrorState(msg);
        } finally {
            setAISettingsBusyState(false);
        }
    };

    const saveAIKeyToBackend = async (apiKey: string, opts: { setStatusText: (s: string) => void; setIsStatusError: (v: boolean) => void; setDevError: (v: string) => void }) => {
        setAISettingsBusyState(true);
        try {
            const keyStatus = await SetAIAPIKey(apiKey, aiSettingsDraft as any) as AIKeyStatusState;
            setAIKeyStatus(keyStatus || defaultAIKeyStatusState());
            if (keyStatus?.hasKey) {
                setAISettings((c) => c.providerPreset !== 'custom' ? c : { ...c, customKeySourceEndpoint: c.endpoint });
                setAISettingsDraft((c) => c.providerPreset !== 'custom' ? c : { ...c, customKeySourceEndpoint: c.endpoint });
                opts.setStatusText(`API key saved (${keyStatus.storageMode})`);
                opts.setIsStatusError(false);
                opts.setDevError('');
            } else {
                opts.setStatusText(`API key save failed: ${keyStatus?.lastError || 'unknown error'}`);
                opts.setIsStatusError(true);
                opts.setDevError(keyStatus?.lastError || 'AI key save failed');
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown API key error';
            opts.setStatusText(`API key save failed: ${msg}`);
            opts.setIsStatusError(true);
            opts.setDevError(msg);
        } finally {
            setAISettingsBusyState(false);
        }
    };

    const clearAIKeyInBackend = async (opts: { setStatusText: (s: string) => void; setIsStatusError: (v: boolean) => void; setDevError: (v: string) => void }) => {
        setAISettingsBusyState(true);
        try {
            const keyStatus = await ClearAIAPIKey(aiSettingsDraft as any) as AIKeyStatusState;
            setAIKeyStatus(keyStatus || defaultAIKeyStatusState());
            setAISettings((c) => ({ ...c, customKeySourceEndpoint: '' }));
            setAISettingsDraft((c) => ({ ...c, customKeySourceEndpoint: '' }));
            opts.setStatusText('API key cleared');
            opts.setIsStatusError(false);
            opts.setDevError('');
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown API key clear error';
            opts.setStatusText(`API key clear failed: ${msg}`);
            opts.setIsStatusError(true);
            opts.setDevError(msg);
        } finally {
            setAISettingsBusyState(false);
        }
    };

    const runAIQuery = async (params: { prompt: string; contextMode: AIContextMode; linesAbove: string[]; fullContent: string }): Promise<AIRunResponse> => {
        return RunAIQuery({ ...params, settingsOverride: aiSettings } as any) as Promise<AIRunResponse>;
    };

    const handleAIProgressEvent = (payload: AIProgressEvent | string | null | undefined) => {
        if (typeof payload === 'string') { setAIProgressMessageState(payload.trim()); return; }
        setAIProgressMessageState(payload?.message?.trim() || '');
    };

    return (
        <AIContext.Provider value={{
            aiSettings, setAISettings,
            aiSettingsDraft, setAISettingsDraft,
            aiKeyStatus, setAIKeyStatus,
            aiSettingsBusy, setAISettingsBusy: setAISettingsBusyState,
            aiSettingsHasUnsavedChanges,
            aiSettingsActionFailed, setAISettingsActionFailed: setAISettingsActionFailedState,
            aiSettingsApplyError, setAISettingsApplyError: setAISettingsApplyErrorState,
            aiContextMode, setAIContextMode: setAIContextModeState,
            aiDebugLog, setAIDebugLog,
            aiDebugIdRef,
            isAIQueryPending, setIsAIQueryPending: setIsAIQueryPendingState,
            aiPendingLineIndex, setAIPendingLineIndex: setAIPendingLineIndexState,
            aiProgressMessage, setAIProgressMessage: setAIProgressMessageState,
            testAndSaveAISettings,
            revertAISettingsDraftToSaved,
            saveAIKeyToBackend,
            clearAIKeyInBackend,
            runAIQuery,
            handleAIProgressEvent,
        }}>
            {children}
        </AIContext.Provider>
    );
}

export function useAI(): AIContextValue {
    const ctx = useContext(AIContext);
    if (!ctx) throw new Error('useAI must be used inside AIProvider');
    return ctx;
}
