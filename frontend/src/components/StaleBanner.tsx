type Props = {
    staleCount: number;
    isReevaluatingAll: boolean;
    onReevaluateAll: () => void;
    autoEvalEnabled: boolean;
    onToggleAutoEval: () => void;
};

export function StaleBanner({ staleCount, isReevaluatingAll, onReevaluateAll, autoEvalEnabled, onToggleAutoEval }: Props) {
    if (staleCount === 0) return null;
    return (
        <div className="stale-banner" role="status" aria-live="polite">
            <span className="stale-banner-text">
                {`Stale results detected on ${staleCount} line${staleCount === 1 ? '' : 's'}.`}
            </span>
            <div className="stale-banner-actions">
                <button
                    type="button"
                    className="stale-banner-btn"
                    onClick={onReevaluateAll}
                    disabled={isReevaluatingAll}
                >
                    {isReevaluatingAll ? 'Re-evaluating...' : 'Re-evaluate All'}
                </button>
                <button
                    type="button"
                    className={`stale-banner-btn stale-banner-btn--ghost${autoEvalEnabled ? ' stale-banner-btn--active' : ''}`}
                    onClick={onToggleAutoEval}
                    disabled={isReevaluatingAll}
                    aria-pressed={autoEvalEnabled}
                >
                    Auto-eval: {autoEvalEnabled ? 'on' : 'off'}
                </button>
            </div>
        </div>
    );
}
