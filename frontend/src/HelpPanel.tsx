import { BrowserOpenURL } from '../wailsjs/runtime/runtime';
import { helpContent } from '@site/content/helpContent';
import type { HelpPage } from './types/app';

interface HelpPanelProps {
    helpSiteUrl: string;
    activeHelpPage: HelpPage;
    onActiveHelpPageChange: (page: HelpPage) => void;
}

type HelpSegment = { header?: string; items: string[] };

function toHelpSegments(items: string[]): HelpSegment[] {
    return items.reduce<HelpSegment[]>((acc, item) => {
        if (item.startsWith('## ')) {
            acc.push({ header: item.slice(3), items: [] });
            return acc;
        }

        if (acc.length === 0) {
            acc.push({ items: [] });
        }

        acc[acc.length - 1].items.push(item);
        return acc;
    }, []);
}

const APP_DOWNLOAD_URL = 'https://github.com/Zaitsev/run-calc/releases';

export function HelpPanel({ helpSiteUrl, activeHelpPage, onActiveHelpPageChange }: HelpPanelProps) {

    return (
        <div className="settings-card">
            <div className="settings-card-header">
                <div className="settings-card-title">In-app help</div>
                <div className="settings-card-desc">
                    <button
                        type="button"
                        className="help-site-link"
                        onClick={() => BrowserOpenURL(helpSiteUrl)}
                    >
                        Full documentation site
                    </button>
                    {' | '}
                    <button
                        type="button"
                        className="help-site-link"
                        onClick={() => BrowserOpenURL(APP_DOWNLOAD_URL)}
                    >
                        Download app
                    </button>
                </div>
            </div>
            <div className="settings-help-tabs" role="tablist" aria-label="Help pages">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeHelpPage === 'operations'}
                    className={`settings-help-tab${activeHelpPage === 'operations' ? ' settings-help-tab--active' : ''}`}
                    onClick={() => onActiveHelpPageChange('operations')}
                >
                    Operations
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeHelpPage === 'shortcuts'}
                    className={`settings-help-tab${activeHelpPage === 'shortcuts' ? ' settings-help-tab--active' : ''}`}
                    onClick={() => onActiveHelpPageChange('shortcuts')}
                >
                    Shortcuts
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeHelpPage === 'new'}
                    className={`settings-help-tab${activeHelpPage === 'new' ? ' settings-help-tab--active' : ''}`}
                    onClick={() => onActiveHelpPageChange('new')}
                >
                    New
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeHelpPage === 'worksheets'}
                    className={`settings-help-tab${activeHelpPage === 'worksheets' ? ' settings-help-tab--active' : ''}`}
                    onClick={() => onActiveHelpPageChange('worksheets')}
                >
                    Worksheets
                </button>
            </div>
            <div className="settings-help-content" role="tabpanel">
                {activeHelpPage === 'operations' && (
                    <ul>
                        {helpContent.operations.map((item) => (
                            item.startsWith('## ')
                                ? <li key={item} className="help-subsection-header"><strong>{item.slice(3)}</strong></li>
                                : <li key={item}>{item}</li>
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
                    toHelpSegments(helpContent.new).map((segment, index) => (
                        <div className="settings-help-section" key={`${segment.header ?? 'section'}-${index}`}>
                            {segment.header && <h3 className="settings-help-section-title">{segment.header}</h3>}
                            {segment.items.length > 0 && (
                                <ul>
                                    {segment.items.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))
                )}
                {activeHelpPage === 'worksheets' && (
                    <ul>
                        {helpContent.worksheets.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
