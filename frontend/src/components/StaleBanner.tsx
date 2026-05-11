type Props = {
    staleCount: number;
    isReevaluatingAll: boolean;
    onReevaluateAll: () => void;
    onClearStale: () => void;
};

export function StaleBanner({ staleCount, isReevaluatingAll, onReevaluateAll, onClearStale }: Props) {
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
                    className="stale-banner-btn stale-banner-btn--ghost"
                    onClick={onClearStale}
                    disabled={isReevaluatingAll}
                >
                    Clear Stale
                </button>
            </div>
        </div>
    );
}
