import { BrowserOpenURL, WindowReload, Quit } from '../../wailsjs/runtime/runtime';
import { HELP_SITE_URL } from '../constants';

type Props = {
    aiDebugLogCount: number;
    onClose: () => void;
    onNewWorksheet: () => void;
    onChangeFontScale: (dir: 1 | -1) => void;
    onResetFontSize: () => void;
    onResetWindowLayout: () => void;
    onOpenThemeStore: () => void;
    onOpenHelp: () => void;
    onOpenAIDebug: () => void;
};

export function BurgerMenu({
    aiDebugLogCount,
    onClose,
    onNewWorksheet,
    onChangeFontScale,
    onResetFontSize,
    onResetWindowLayout,
    onOpenThemeStore,
    onOpenHelp,
    onOpenAIDebug,
}: Props) {
    return (
        <div className="status-menu-popover" role="menu" aria-label="App menu">
            <button type="button" className="status-menu-item" onClick={onNewWorksheet}>New worksheet</button>
            <button type="button" className="status-menu-item" onClick={() => { onClose(); WindowReload(); }}>Reload app</button>
            <button type="button" className="status-menu-item" onClick={() => onChangeFontScale(1)}>Increase font size</button>
            <button type="button" className="status-menu-item" onClick={() => onChangeFontScale(-1)}>Decrease font size</button>
            <button type="button" className="status-menu-item" onClick={onResetFontSize}>Reset font size</button>
            <button type="button" className="status-menu-item" onClick={onResetWindowLayout}>Reset window layout</button>
            <button type="button" className="status-menu-item" onClick={onOpenThemeStore}>Open Theme Store</button>
            <button type="button" className="status-menu-item" onClick={onOpenHelp}>Help</button>
            <button type="button" className="status-menu-item" onClick={() => { onClose(); BrowserOpenURL(HELP_SITE_URL); }}>Open Full Help Site</button>
            <button type="button" className="status-menu-item" onClick={onOpenAIDebug}>
                AI Debug Log{aiDebugLogCount > 0 ? ` (${aiDebugLogCount})` : ''}
            </button>
            <button type="button" className="status-menu-item" onClick={() => { onClose(); BrowserOpenURL('https://github.com/Zaitsev/run-calc'); }}>GitHub</button>
            <button type="button" className="status-menu-item" onClick={() => { onClose(); alert('Run-Calc is a native Wails desktop calculator with a system menu and standard OS window chrome.'); }}>About</button>
            <button type="button" className="status-menu-item status-menu-item--danger" onClick={() => { onClose(); Quit(); }}>Quit (your work is saved)</button>
        </div>
    );
}
