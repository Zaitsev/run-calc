import { useState } from 'react';

export type AIDebugEntry = {
    id: number;
    timestamp: Date;
    prompt: string;
    model: string;
    endpoint: string;
    systemPrompt: string;
    userPrompt: string;
    contextMode: string;
    contextLineCount: number;
    status: 'ok' | 'error';
    output?: {
        answer?: string;
        answerNumber?: number;
        comment?: string;
        code?: string;
    };
    error?: string;
    durationMs: number;
    raw?: unknown;
};

type Props = {
    entries: AIDebugEntry[];
    onClear: () => void;
    onClose: () => void;
};

function EntryCard({ entry }: { entry: AIDebugEntry }) {
    const [expanded, setExpanded] = useState(false);

    const timeStr = entry.timestamp.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const outputJson = entry.output
        ? JSON.stringify(entry.output, null, 2)
        : null;
    const rawJson = entry.raw
        ? JSON.stringify(entry.raw, null, 2)
        : null;

    return (
        <div className={`ai-debug-entry${entry.status === 'error' ? ' ai-debug-entry--error' : ''}`}>
            <button
                type="button"
                className="ai-debug-entry-header"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
            >
                <span className={`ai-debug-badge ai-debug-badge--${entry.status}`}>
                    {entry.status === 'ok' ? 'ok' : 'err'}
                </span>
                <span className="ai-debug-entry-prompt" title={entry.prompt}>
                    {entry.prompt.length > 60 ? entry.prompt.slice(0, 60) + '…' : entry.prompt}
                </span>
                <span className="ai-debug-entry-meta">
                    {entry.model} · {timeStr} · {entry.durationMs}ms
                </span>
                <span className="ai-debug-entry-chevron" aria-hidden="true">
                    {expanded ? '▲' : '▼'}
                </span>
            </button>

            {expanded && (
                <div className="ai-debug-entry-body">
                    <div className="ai-debug-section">
                        <div className="ai-debug-section-label">Model / Endpoint</div>
                        <div className="ai-debug-section-value">
                            <strong>{entry.model || '(default)'}</strong>
                        </div>
                        <div className="ai-debug-section-value" style={{fontSize: '11px', opacity: 0.65, wordBreak: 'break-all'}}>
                            {entry.endpoint}
                        </div>
                    </div>
                    <div className="ai-debug-section">
                        <div className="ai-debug-section-label">Context</div>
                        <div className="ai-debug-section-value">
                            mode: <strong>{entry.contextMode}</strong> · lines: <strong>{entry.contextLineCount}</strong>
                        </div>
                    </div>

                    <div className="ai-debug-section">
                        <div className="ai-debug-section-label">System prompt</div>
                        <pre className="ai-debug-pre">{entry.systemPrompt || '(none)'}</pre>
                    </div>

                    <div className="ai-debug-section">
                        <div className="ai-debug-section-label">User prompt sent</div>
                        <pre className="ai-debug-pre">{entry.userPrompt || '(none)'}</pre>
                    </div>

                    {entry.status === 'ok' && outputJson && (
                        <div className="ai-debug-section">
                            <div className="ai-debug-section-label">Model output (parsed JSON)</div>
                            <pre className="ai-debug-pre ai-debug-pre--output">{outputJson}</pre>
                        </div>
                    )}

                    {entry.status === 'error' && (
                        <div className="ai-debug-section">
                            <div className="ai-debug-section-label">Error</div>
                            <pre className="ai-debug-pre ai-debug-pre--error">{entry.error}</pre>
                        </div>
                    )}

                    {rawJson && (
                        <div className="ai-debug-section">
                            <div className="ai-debug-section-label">Raw debug data</div>
                            <pre className="ai-debug-pre ai-debug-pre--raw">{rawJson}</pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function AIDebugDrawer({ entries, onClear, onClose }: Props) {
    return (
        <>
            <div className="settings-header">
                <button
                    type="button"
                    className="settings-back"
                    onClick={onClose}
                    aria-label="Close"
                >
                    &#8594;
                </button>
                <span className="settings-title">AI Debug Log</span>
                {entries.length > 0 && (
                    <button
                        type="button"
                        className="ai-debug-clear-btn"
                        onClick={onClear}
                        title="Clear log"
                    >
                        Clear
                    </button>
                )}
            </div>
            <div className="settings-body ai-debug-body">
                {entries.length === 0 ? (
                    <div className="ai-debug-empty">
                        No AI requests yet. Type a line starting with <code>?</code> and press Enter.
                    </div>
                ) : (
                    <div className="ai-debug-list">
                        {[...entries].reverse().map((entry) => (
                            <EntryCard key={entry.id} entry={entry} />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
