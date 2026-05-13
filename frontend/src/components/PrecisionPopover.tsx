import type { PrecisionMode } from '../types/app';
import { PRECISION_MAX, FINANCIAL_PRECISION, FOUR_POINT_PRECISION } from '../constants';

type Props = {
    precision: PrecisionMode;
    setPrecision: (v: PrecisionMode) => void;
    scientificNotation: boolean;
    setScientificNotation: (v: boolean) => void;
    decreasePrecision: () => void;
    increasePrecision: () => void;
    applyFinancialPrecision: () => void;
    applyFourPointPrecision: () => void;
    resetPrecision: () => void;
};

export function PrecisionPopover({
    precision,
    setPrecision,
    scientificNotation,
    setScientificNotation,
    decreasePrecision,
    increasePrecision,
    applyFinancialPrecision,
    applyFourPointPrecision,
    resetPrecision,
}: Props) {
    return (
        <div className="precision-popover" role="dialog" aria-label="Precision selector">
            <div className="precision-popover-title">Display precision</div>
            <div className="precision-popover-desc">Applies to rendered result text.</div>
            <div className="precision-popover-row">
                <div className="precision-popover-row-info">
                    <div className="precision-popover-label">Decimals</div>
                    <div className="precision-popover-value">
                        {precision === 'full' ? 'Full — no rounding' : precision === 'auto' ? 'Auto — 10 dec. places' : `${precision} place${precision === 1 ? '' : 's'}`}
                    </div>
                </div>
                <div className="settings-stepper-group precision-popover-stepper">
                    <button
                        type="button"
                        className="settings-stepper"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={decreasePrecision}
                        disabled={precision === 'full'}
                        aria-label="Decrease precision"
                    >
                        −
                    </button>
                    <span className="settings-stepper-value">
                        {precision === 'full' ? 'Full' : precision === 'auto' ? 'Auto' : String(precision)}
                    </span>
                    <button
                        type="button"
                        className="settings-stepper"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={increasePrecision}
                        disabled={precision === PRECISION_MAX}
                        aria-label="Increase precision"
                    >
                        +
                    </button>
                </div>
            </div>
            <div className="precision-popover-actions">
                <button
                    type="button"
                    className="precision-popover-link"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setPrecision('full')}
                    disabled={precision === 'full'}
                >
                    Full
                </button>
                <button
                    type="button"
                    className="precision-popover-link"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={applyFinancialPrecision}
                    disabled={precision === FINANCIAL_PRECISION}
                >
                    Financial (2)
                </button>
                <button
                    type="button"
                    className="precision-popover-link"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={applyFourPointPrecision}
                    disabled={precision === FOUR_POINT_PRECISION}
                >
                    Intermediate (4)
                </button>
                <button
                    type="button"
                    className="precision-popover-link"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={resetPrecision}
                    disabled={precision === 'auto'}
                >
                    Auto (10)
                </button>
            </div>
            <div className="precision-popover-row precision-popover-row--toggle">
                <div className="precision-popover-row-info">
                    <div className="precision-popover-label">Scientific mode</div>
                    <div className="precision-popover-value">Use 1e+7 and 1e-7 for extreme values.</div>
                </div>
                <label className="settings-toggle" aria-label="Toggle scientific notation">
                    <input
                        type="checkbox"
                        checked={scientificNotation}
                        onChange={(e) => setScientificNotation(e.target.checked)}
                    />
                    <span className="settings-toggle-track" />
                </label>
            </div>
        </div>
    );
}
