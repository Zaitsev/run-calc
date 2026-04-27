import { useState } from 'react';

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
                        <li>Type an expression directly in the editor (example: 2+3*4).</li>
                        <li>Press Enter to evaluate the current line and append result inline as expression = result.</li>
                        <li>Start a line with ? to run AI mode for that prompt.</li>
                        <li>AI returns structured output: answer, answerNumber, comment, and/or code.</li>
                        <li>Numeric AI answers are inserted as ai0 = Number. AI comments use the same " comment style.</li>
                        <li>If AI returns calc code lines, they are inserted and re-evaluated automatically.</li>
                        <li>While AI is processing, the active AI prompt line in the editor gets an animated background so you can quickly spot what is waiting.</li>
                        <li>Configure AI in Settings to AI: provider preset (openai, gemini, openrouter, anthropic, or custom), endpoint, model id, and timeout.</li>
                        <li>AI settings edits are draft-only until you click Test and Save. If testing fails, your changes stay unsaved, and a Revert changes action appears to restore the last saved configuration.</li>
                        <li>BYOK API keys are stored in OS secure storage. On Linux you can explicitly enable insecure file fallback mode in Settings to AI.</li>
                        <li>Start a new line with +, -, *, or / to continue from the previous result.</li>
                        <li>Assign variables with name = expression or @name = expression (example: @incomes = [4500, 5200, 3800]).</li>
                        <li>Use pipelines with | to pass data to the next step (example: @incomes | filter(# &gt; 4000) | sum).</li>
                        <li>Use # inside filter/map/each stages to refer to the current item.</li>
                        <li>Available aggregation functions: sum(...), count(...)/len(...), avg(...) or mean(...), median(...), min(...), max(...), first(...), last(...), all(...), any(...), one(...), none(...), reduce(...), filter(...), map(...), find(...), flatten(...), reverse(...), sort(...), uniq(...).</li>
                        <li>Available math functions include sin, cos, tan, asin, acos, atan, atan2, sqrt, pow, abs, ceil, floor, round, trunc, exp, log, log10, log2, hypot, sign, and constants such as PI, TAU, E, PHI, LN2, LN10, LOG2E, LOG10E, SQRT1_2, SQRT2, SQRTE, SQRTPI, and SQRTPHI.</li>
                        <li>Functions must be called with parentheses (example: sin(PI/2)); bare references such as sin are rejected except in pipeline shorthand like map(sin).</li>
                        <li>Internal names are read-only and cannot be reassigned, including built-in constants and functions (examples: PI = 30 and sin = 5 are rejected).</li>
                        <li>Small editor intelligence suggests known variables plus allowed functions and constants near the caret. Press Tab to accept the top suggestion.</li>
                        <li>Intelligence hints are typing-triggered: they appear after 300 ms, do not show automatically on app start, and hide after 3 seconds of inactivity.</li>
                        <li>Use " to start an end-of-line comment in expressions and declarations (example: total = price * qty " monthly subtotal).</li>
                        <li>Comment-only and empty lines are treated as notes: pressing Enter skips evaluation and moves the caret to the next line (or creates one if you are on the last line).</li>
                        <li>If the caret is inside trailing comment text, Enter also skips evaluation and moves the caret to the next line; on the last line, it creates a new line and moves the caret there. Use Ctrl/Cmd + Enter to always insert a new line below.</li>
                        <li>Everything after " is treated as comment text, and commented tails are shown in a dedicated style that follows your active theme colors.</li>
                        <li>If you need text values inside expressions, use single quotes (') or backticks (`), not double quotes.</li>
                        <li>Line numbers appear in the left gutter for easy reference and navigation.</li>
                        <li>Toggle word wrap from the status bar to wrap long lines at the window edge (disabled by default for a clean appearance).</li>
                        <li>Clear/New worksheet actions now show a confirmation dialog before wiping the worksheet.</li>
                        <li>Click the precision chip in the status bar to quickly change decimal precision or toggle scientific mode.</li>
                        <li>Invalid lines are highlighted in red with a gutter ! marker until corrected.</li>
                        <li>When you start editing a calculated line, its existing = result suffix is removed automatically so you can revise the expression cleanly.</li>
                        <li>When a variable declaration changes, previously evaluated dependent lines are marked stale with a gutter ↻ indicator until you recalculate them.</li>
                        <li>When stale lines exist, a compact banner appears above the first line with actions to Re-evaluate All expressions or Clear Stale markers.</li>
                        <li>Status messages use plain language and examples to help fix common mistakes quickly, even if you are new to formulas.</li>
                    </ul>
                )}
                {activeHelpPage === 'shortcuts' && (
                    <ul>
                        <li>Enter: Evaluate current line, or move to the next line when the current line is empty/comment-only or caret is in trailing comment text. On the last line, Enter creates a new line and moves the caret to it when no evaluation error occurs.</li>
                        <li>Ctrl/Cmd + Enter: Always insert a new line below and move the caret to it.</li>
                        <li>Ctrl/Cmd + N: New worksheet.</li>
                        <li>New worksheet (Ctrl/Cmd + N or menu) asks for confirmation before clearing content.</li>
                        <li>Ctrl/Cmd + =: Increase font size.</li>
                        <li>Ctrl/Cmd + -: Decrease font size.</li>
                        <li>Ctrl/Cmd + 0: Reset font size.</li>
                        <li>Alt + Z: Toggle word wrap (VS Code-style shortcut).</li>
                        <li>Tab: Accept the top variable/function/constant suggestion when shown.</li>
                        <li>( [ {'{'}: With text selected, wraps the selection in the matching bracket pair.</li>
                        <li>Ctrl/Cmd + R: Reload app window.</li>
                        <li>Ctrl/Cmd + Q: Quit (your work is saved).</li>
                        <li>Press Escape twice quickly: Hide app window.</li>
                    </ul>
                )}
                {activeHelpPage === 'new' && (
                    <ul>
                        <li><strong>Version 0.5.1 – First Test-Drive Release</strong></li>
                        <li>This is the initial test-drive version of Run-Calc. All core features are included and ready for feedback.</li>
                        <li>Features: inline expression evaluation, AI mode with structured output, pipeline analytics, comprehensive math functions, themed editor, help system, and worksheet persistence.</li>
                        <li>Please report any issues or suggestions to help us improve the app for general release.</li>
                    </ul>
                )}
            </div>
        </div>
    );
}
