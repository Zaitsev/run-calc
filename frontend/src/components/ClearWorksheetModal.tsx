type Props = {
    onConfirm: () => void;
    onCancel: () => void;
};

export function ClearWorksheetModal({ onConfirm, onCancel }: Props) {
    return (
        <div
            className="recalc-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-worksheet-title"
            aria-describedby="clear-worksheet-message"
            onMouseDown={onCancel}
        >
            <div className="recalc-modal" onMouseDown={(e) => e.stopPropagation()}>
                <h3 id="clear-worksheet-title">Confirm Clear Worksheet</h3>
                <p id="clear-worksheet-message">Clear worksheet and remove all expressions?</p>
                <div className="recalc-modal-actions">
                    <button type="button" className="recalc-btn-no" onClick={onCancel}>Cancel</button>
                    <button type="button" className="recalc-btn-yes" onClick={onConfirm}>Clear</button>
                </div>
            </div>
        </div>
    );
}
