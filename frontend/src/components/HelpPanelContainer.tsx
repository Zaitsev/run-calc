import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from 'react';
import { HelpPanel } from '../HelpPanel';
import type { HelpPage, HelpPanelPosition } from '../types/app';
import { DEFAULT_HELP_PANEL_BOTTOM_SIZE, DEFAULT_HELP_PANEL_SIDE_SIZE, HELP_SITE_URL } from '../constants';

type Props = {
    helpPanelPosition: HelpPanelPosition;
    setHelpPanelPosition: (v: HelpPanelPosition) => void;
    helpActivePage: HelpPage;
    setHelpActivePage: (page: HelpPage) => void;
    helpPanelSideSize: number;
    setHelpPanelSideSize: Dispatch<SetStateAction<number>>;
    helpPanelBottomSize: number;
    setHelpPanelBottomSize: Dispatch<SetStateAction<number>>;
    startHelpPanelResize: (event: ReactMouseEvent<HTMLDivElement>, position: HelpPanelPosition) => void;
    clampHelpPanelSideSize: (size: number) => number;
    clampHelpPanelBottomSize: (size: number) => number;
    onClose: () => void;
};

export function HelpPanelContainer({
    helpPanelPosition,
    setHelpPanelPosition,
    helpActivePage,
    setHelpActivePage,
    helpPanelSideSize,
    setHelpPanelSideSize,
    helpPanelBottomSize,
    setHelpPanelBottomSize,
    startHelpPanelResize,
    clampHelpPanelSideSize,
    clampHelpPanelBottomSize,
    onClose,
}: Props) {
    const isBottom = helpPanelPosition === 'bottom';
    const panelStyle = isBottom ? { height: `${helpPanelBottomSize}px` } : { width: `${helpPanelSideSize}px` };

    return (
        <div
            className={`settings-panel settings-panel--open${helpPanelPosition === 'left' ? ' settings-panel--left' : ''}${helpPanelPosition === 'bottom' ? ' settings-panel--bottom' : ''}`}
            role="dialog"
            aria-label="Help"
            style={panelStyle}
        >
            <div
                className={`help-resize-handle help-resize-handle--${helpPanelPosition}`}
                role="separator"
                aria-label="Resize help drawer"
                aria-orientation={isBottom ? 'horizontal' : 'vertical'}
                tabIndex={0}
                onMouseDown={(event) => startHelpPanelResize(event, helpPanelPosition)}
                onDoubleClick={() => {
                    if (isBottom) {
                        setHelpPanelBottomSize(clampHelpPanelBottomSize(DEFAULT_HELP_PANEL_BOTTOM_SIZE));
                        return;
                    }
                    setHelpPanelSideSize(clampHelpPanelSideSize(DEFAULT_HELP_PANEL_SIDE_SIZE));
                }}
                onKeyDown={(event) => {
                    if (isBottom) {
                        if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            setHelpPanelBottomSize((current) => clampHelpPanelBottomSize(current + 16));
                        } else if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            setHelpPanelBottomSize((current) => clampHelpPanelBottomSize(current - 16));
                        }
                        return;
                    }

                    if (event.key === 'ArrowLeft') {
                        event.preventDefault();
                        const delta = helpPanelPosition === 'left' ? -16 : 16;
                        setHelpPanelSideSize((current) => clampHelpPanelSideSize(current + delta));
                    } else if (event.key === 'ArrowRight') {
                        event.preventDefault();
                        const delta = helpPanelPosition === 'left' ? 16 : -16;
                        setHelpPanelSideSize((current) => clampHelpPanelSideSize(current + delta));
                    }
                }}
                title="Drag to resize"
            />
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
                <HelpPanel
                    helpSiteUrl={HELP_SITE_URL}
                    activeHelpPage={helpActivePage}
                    onActiveHelpPageChange={setHelpActivePage}
                />
            </div>
        </div>
    );
}
