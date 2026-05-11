import { HelpPanel } from '../HelpPanel';
import type { HelpPanelPosition } from '../types/app';
import { HELP_SITE_URL } from '../constants';

type Props = {
    helpPanelPosition: HelpPanelPosition;
    setHelpPanelPosition: (v: HelpPanelPosition) => void;
    onClose: () => void;
};

export function HelpPanelContainer({ helpPanelPosition, setHelpPanelPosition, onClose }: Props) {
    return (
        <div
            className={`settings-panel settings-panel--open${helpPanelPosition === 'left' ? ' settings-panel--left' : ''}${helpPanelPosition === 'bottom' ? ' settings-panel--bottom' : ''}`}
            role="dialog"
            aria-label="Help"
        >
            <div className="settings-header">
                <button type="button" className="settings-back" onClick={onClose} aria-label="Back">
                    &#8594;
                </button>
                <span className="settings-title">Help</span>
                <div className="settings-header-actions" role="group" aria-label="Help panel position">
                    <button
                        type="button"
                        className={`settings-pos-btn${helpPanelPosition === 'left' ? ' settings-pos-btn--active' : ''}`}
                        aria-label="Move help panel to left"
                        title="Move help panel to left"
                        onClick={() => { if (helpPanelPosition === 'left') { onClose(); return; } setHelpPanelPosition('left'); }}
                    >
                        <span className="settings-pos-icon settings-pos-icon--left" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className={`settings-pos-btn${helpPanelPosition === 'right' ? ' settings-pos-btn--active' : ''}`}
                        aria-label="Move help panel to right"
                        title="Move help panel to right"
                        onClick={() => { if (helpPanelPosition === 'right') { onClose(); return; } setHelpPanelPosition('right'); }}
                    >
                        <span className="settings-pos-icon settings-pos-icon--right" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className={`settings-pos-btn${helpPanelPosition === 'bottom' ? ' settings-pos-btn--active' : ''}`}
                        aria-label="Move help panel to bottom"
                        title="Move help panel to bottom"
                        onClick={() => { if (helpPanelPosition === 'bottom') { onClose(); return; } setHelpPanelPosition('bottom'); }}
                    >
                        <span className="settings-pos-icon settings-pos-icon--bottom" aria-hidden="true" />
                    </button>
                </div>
            </div>
            <div className="settings-body">
                <HelpPanel helpSiteUrl={HELP_SITE_URL} />
            </div>
        </div>
    );
}
