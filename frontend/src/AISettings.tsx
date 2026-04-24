import { useState } from 'react';
import iconOpenAI from './assets/images/icons/openai.svg';
import iconGemini from './assets/images/icons/gemini.svg';
import iconOpenRouter from './assets/images/icons/openrouter_light.svg';
import iconAnthropic from './assets/images/icons/anthropic_black.svg';

export type AIContextMode = 'above' | 'full';

export type AISettingsState = {
    providerPreset: string;
    endpoint: string;
    modelId: string;
    defaultContextMode: AIContextMode;
    allowInsecureKeyFallback: boolean;
    allowCustomEndpointKeyReuse: boolean;
    customKeySourceEndpoint?: string;
    requestTimeoutSeconds: number;
};

export type AIKeyStatusState = {
    hasKey: boolean;
    storageMode: string;
    lastError?: string;
};

export type AISettingsPanelProps = {
    settings: AISettingsState;
    keyStatus: AIKeyStatusState;
    busy: boolean;
    hasUnsavedChanges: boolean;
    showRevertChanges: boolean;
    applyErrorMessage: string;
    onChange: (next: AISettingsState) => void;
    onTestAndSave: () => Promise<void>;
    onRevertChanges: () => void;
    onSaveKey: (apiKey: string) => Promise<void>;
    onClearKey: () => Promise<void>;
};

type ProviderPresetOption = {
    key: string;
    label: string;
    icon?: string;
    iconText?: string;
    iconInvert?: boolean;
    meta: string;
    endpoint?: string;
    modelId?: string;
};

const providerPresetOptions: ProviderPresetOption[] = [
    {
        key: 'openai',
        label: 'OpenAI',
        icon: iconOpenAI,
        iconInvert: true,
        meta: 'api.openai.com',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        modelId: 'gpt-4o-mini',
    },
    {
        key: 'gemini',
        label: 'Gemini',
        icon: iconGemini,
        meta: 'generativelanguage.googleapis.com',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        modelId: 'gemini-3.1-flash-lite-preview',
    },
    {
        key: 'openrouter',
        label: 'OpenRouter',
        icon: iconOpenRouter,
        meta: 'openrouter.ai',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        modelId: 'openai/gpt-4o-mini',
    },
    {
        key: 'anthropic',
        label: 'Anthropic',
        icon: iconAnthropic,
        iconInvert: true,
        meta: 'via openrouter.ai',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        modelId: 'anthropic/claude-3.5-sonnet',
    },
    {
        key: 'custom',
        label: 'Custom',
        iconText: 'C',
        meta: 'manual endpoint and model',
    },
];

export function AISettingsPanel({
    settings,
    keyStatus,
    busy,
    hasUnsavedChanges,
    showRevertChanges,
    applyErrorMessage,
    onChange,
    onTestAndSave,
    onRevertChanges,
    onSaveKey,
    onClearKey,
}: AISettingsPanelProps) {
    const [apiKeyInput, setAPIKeyInput] = useState('');

    const customEndpointSource = (settings.customKeySourceEndpoint || '').trim();
    const customEndpointCurrent = settings.endpoint.trim();
    const customEndpointReuseRisk =
        settings.providerPreset === 'custom' &&
        keyStatus.hasKey &&
        customEndpointSource.length > 0 &&
        customEndpointCurrent.length > 0 &&
        customEndpointSource.toLowerCase() !== customEndpointCurrent.toLowerCase() &&
        !settings.allowCustomEndpointKeyReuse;

    const saveKey = async () => {
        await onSaveKey(apiKeyInput);
        setAPIKeyInput('');
    };

    const selectProviderPreset = (preset: ProviderPresetOption) => {
        const next: AISettingsState = {
            ...settings,
            providerPreset: preset.key,
        };

        if (preset.endpoint) {
            next.endpoint = preset.endpoint;
        }
        if (preset.modelId) {
            next.modelId = preset.modelId;
        }

        onChange(next);
    };

    return (
        <>
            <div className="settings-card">
                <div className="settings-card-header">
                    <div className="settings-card-title">Provider</div>
                    <div className="settings-card-desc">Choose a preset to auto-fill endpoint and model, or set them manually.</div>
                </div>
                <div className="settings-provider-list" role="radiogroup" aria-label="AI provider preset">
                    {providerPresetOptions.map((preset) => (
                        <label
                            key={preset.key}
                            className={`settings-provider-option${settings.providerPreset === preset.key ? ' settings-provider-option--active' : ''}`}
                        >
                            <input
                                type="radio"
                                name="ai-provider-preset"
                                value={preset.key}
                                checked={settings.providerPreset === preset.key}
                                onChange={() => selectProviderPreset(preset)}
                                disabled={busy}
                            />
                            {preset.icon
                                ? <img src={preset.icon} alt="" aria-hidden="true" className={`settings-provider-icon settings-provider-icon--img${preset.iconInvert ? ' settings-provider-icon--invert' : ''}`} />
                                : <span className={`settings-provider-icon settings-provider-icon--${preset.key}`} aria-hidden="true">{preset.iconText}</span>
                            }
                            <span className="settings-provider-text">
                                <span className="settings-provider-name">{preset.label}</span>
                                <span className="settings-provider-meta">{preset.meta}</span>
                            </span>
                            <span className="settings-provider-check" aria-hidden="true">v</span>
                        </label>
                    ))}
                </div>
                <div className="settings-row settings-row--stack settings-row--divider-top">
                    <div className="settings-row-info">
                        <div className="settings-row-title">Endpoint</div>
                        <div className="settings-row-desc">OpenAI-compatible chat endpoint or base URL.</div>
                        {customEndpointReuseRisk && (
                            <div className="settings-row-desc settings-row-desc--error" role="alert">
                                Warning: your saved custom API key was last used with {customEndpointSource}. Testing this endpoint will reuse that key.
                                Enable "Allow key reuse across custom endpoints" below to opt in, or clear/save a key for this endpoint.
                            </div>
                        )}
                    </div>
                    <input
                        type="text"
                        className="settings-text-input"
                        value={settings.endpoint}
                        onChange={(e) => onChange({ ...settings, endpoint: e.target.value })}
                        placeholder="https://.../chat/completions"
                        disabled={busy}
                    />
                </div>
                <div className="settings-row settings-row--stack">
                    <div className="settings-row-info">
                        <div className="settings-row-title">Model ID</div>
                        <div className="settings-row-desc">Raw model id string sent to provider.</div>
                    </div>
                    <input
                        type="text"
                        className="settings-text-input"
                        value={settings.modelId}
                        onChange={(e) => onChange({ ...settings, modelId: e.target.value })}
                        placeholder="gpt-4o-mini"
                        disabled={busy}
                    />
                </div>
                {settings.providerPreset === 'custom' && (
                    <div className="settings-row">
                        <div className="settings-row-info">
                            <div className="settings-row-title">Allow key reuse across custom endpoints</div>
                            <div className="settings-row-desc">Required when changing custom endpoint while a custom API key already exists.</div>
                        </div>
                        <label className="settings-toggle" aria-label="Toggle custom endpoint key reuse">
                            <input
                                type="checkbox"
                                checked={settings.allowCustomEndpointKeyReuse}
                                onChange={(e) => onChange({ ...settings, allowCustomEndpointKeyReuse: e.target.checked })}
                                disabled={busy}
                            />
                            <span className="settings-toggle-track" />
                        </label>
                    </div>
                )}
            </div>

            <div className={`settings-card settings-card--apply${hasUnsavedChanges ? ' settings-card--action-required' : ''}`}>
                <div className="settings-card-header">
                    <div className="settings-card-title">Apply settings</div>
                    <div className="settings-card-desc">Changes stay local until a test passes and settings are saved.</div>
                </div>
                <div className="settings-row settings-row--stack">
                    <div className="settings-row-info">
                        <div className={`settings-row-desc${hasUnsavedChanges ? ' settings-row-desc--action-required' : ''}`}>
                            {hasUnsavedChanges
                                ? (showRevertChanges
                                    ? 'Test or save failed. Your draft is kept. Run Test and Save again, or use Revert changes.'
                                    : 'Your changes are not saved yet. Run Test and Save to validate and apply them.')
                                : 'Saved settings are active.'}
                        </div>
                        {applyErrorMessage && (
                            <div className="settings-row-desc settings-row-desc--error" role="alert">
                                Last test/save error: {applyErrorMessage}
                            </div>
                        )}
                    </div>
                    <div className="settings-inline-actions">
                        <button
                            type="button"
                            className={`settings-action-btn${hasUnsavedChanges ? ' settings-action-btn--attention' : ''}`}
                            onClick={() => void onTestAndSave()}
                            disabled={busy || !hasUnsavedChanges}
                        >
                            Test and Save
                        </button>
                        <button
                            type="button"
                            className="settings-action-btn settings-action-btn--secondary"
                            onClick={onRevertChanges}
                            disabled={busy || !hasUnsavedChanges}
                        >
                            Revert changes
                        </button>
                    </div>
                </div>
            </div>

            <div className="settings-card">
                <div className="settings-card-header">
                    <div className="settings-card-title">API key (BYOK)</div>
                    <div className="settings-card-desc">Stored in OS secure storage. Linux can explicitly use insecure key-file fallback.</div>
                </div>
                <div className="settings-row settings-row--stack">
                    <div className="settings-row-info">
                        <div className="settings-row-title">Current key status</div>
                        <div className="settings-row-desc">
                            {keyStatus.hasKey ? `Available via ${keyStatus.storageMode}` : 'Not configured for selected provider. Save an API key before Test and Save.'}
                        </div>
                        {keyStatus.lastError && <div className="settings-row-desc settings-row-desc--error">Last error: {keyStatus.lastError}</div>}
                    </div>
                    <input
                        type="password"
                        className="settings-text-input"
                        value={apiKeyInput}
                        onChange={(e) => setAPIKeyInput(e.target.value)}
                        placeholder="Paste API key"
                        disabled={busy}
                    />
                    <div className="settings-inline-actions">
                        <button
                            type="button"
                            className="settings-action-btn"
                            onClick={() => void saveKey()}
                            disabled={busy || apiKeyInput.trim().length === 0}
                        >
                            Save key
                        </button>
                        <button
                            type="button"
                            className="settings-action-btn settings-action-btn--secondary"
                            onClick={() => void onClearKey()}
                            disabled={busy || !keyStatus.hasKey}
                        >
                            Clear key
                        </button>
                    </div>
                </div>
                <div className="settings-row settings-row--stack">
                    <div className="settings-row-info">
                        <div className="settings-row-title">Request timeout (seconds)</div>
                        <div className="settings-row-desc">Allowed range: 5 to 180 seconds.</div>
                    </div>
                    <input
                        type="number"
                        min={5}
                        max={180}
                        className="settings-text-input settings-text-input--short"
                        value={settings.requestTimeoutSeconds}
                        onChange={(e) => onChange({ ...settings, requestTimeoutSeconds: Number(e.target.value) || 45 })}
                        disabled={busy}
                    />
                </div>
                <div className="settings-row">
                    <div className="settings-row-info">
                        <div className="settings-row-title">Linux fallback mode</div>
                        <div className="settings-row-desc">Allow explicit insecure key-file fallback if secure store fails.</div>
                    </div>
                    <label className="settings-toggle" aria-label="Toggle Linux fallback mode">
                        <input
                            type="checkbox"
                            checked={settings.allowInsecureKeyFallback}
                            onChange={(e) => onChange({ ...settings, allowInsecureKeyFallback: e.target.checked })}
                            disabled={busy}
                        />
                        <span className="settings-toggle-track" />
                    </label>
                </div>
            </div>
        </>
    );
}
