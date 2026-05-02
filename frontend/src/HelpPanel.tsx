import { useState } from 'react';
import { helpContent } from '@site/content/helpContent';

export type HelpPage = 'operations' | 'shortcuts' | 'new';

export function HelpPanel() {
    const [activeHelpPage, setActiveHelpPage] = useState<HelpPage>('operations');

    return (
        <div className="settings-card">
            <div className="settings-card-header">
                <div className="settings-card-title">In-app help</div>
                <div className="settings-card-desc">Reference pages for operations, shortcuts, and latest changes</div>
            </div>
            <div className="settings-help-tabs" role="tablist" aria-label="Help pages">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeHelpPage === 'operations'}
                    className={`settings-help-tab${activeHelpPage === 'operations' ? ' settings-help-tab--active' : ''}`}
                    onClick={() => setActiveHelpPage('operations')}
                >
                    Operations
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeHelpPage === 'shortcuts'}
                    className={`settings-help-tab${activeHelpPage === 'shortcuts' ? ' settings-help-tab--active' : ''}`}
                    onClick={() => setActiveHelpPage('shortcuts')}
                >
                    Shortcuts
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeHelpPage === 'new'}
                    className={`settings-help-tab${activeHelpPage === 'new' ? ' settings-help-tab--active' : ''}`}
                    onClick={() => setActiveHelpPage('new')}
                >
                    New
                </button>
            </div>
            <div className="settings-help-content" role="tabpanel">
                {activeHelpPage === 'operations' && (
                    <ul>
                        {helpContent.operations.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                )}
                {activeHelpPage === 'shortcuts' && (
                    <ul>
                        {helpContent.shortcuts.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                )}
                {activeHelpPage === 'new' && (
                    <ul>
                        {helpContent.new.map((item, index) => (
                            index === 0 ? <li key={item}><strong>{item}</strong></li> : <li key={item}>{item}</li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
