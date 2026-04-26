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
                        <li>Replaced browser-native clear confirmation with an in-app dialog that uses a proper title: Confirm Clear Worksheet.</li>
                        <li>Moved the clear chip to the first position in the status bar and added extra spacing after it for faster access.</li>
                        <li>Added a confirmation dialog before clearing the worksheet (status chip, menu action, and File {'>'} New trigger).</li>
                        <li>Fixed word-wrap selection drift by aligning overlay wrap width with the editor scrollbar width, so highlighted selection and visible text stay on the same wrapped segments.</li>
                        <li>Fixed bottom scroll desync between expression area and gutter: both now stop at the same end position and stay aligned when reversing scroll direction.</li>
                        <li>Refined Enter behavior on the final line: when Enter does not trigger an evaluation error (for example, note/comment-only lines), the app now creates a new line and moves the caret to it.</li>
                        <li>Made the Settings drawer wider by default and resizable: drag its left edge (or focus it and use arrow keys) to adjust width.</li>
                        <li>Rearranged AI settings layout: Apply settings now appears right after endpoint/model, while request timeout and Linux fallback moved into the BYOK section.</li>
                        <li>When AI settings test/save fails, drafts are now preserved (no auto-restore). You can explicitly restore the last saved state using Revert changes.</li>
                        <li>Changed AI settings apply flow: editing provider/endpoint/model no longer auto-saves or rolls back. Settings now show an unsaved notice and apply only after Test and Save succeeds.</li>
                        <li>When opening Settings on a narrow window, the app now temporarily expands the window to keep the editor visible, then restores the previous size after Settings closes.</li>
                        <li>Restored multiple AI provider presets (chatgpt, openai, gemini, openrouter, anthropic, custom). Selecting a preset now auto-fills endpoint and model fields.</li>
                        <li>Changed AI provider presets to OpenAI-focused defaults: openai is now the default preset, with custom as the alternative for other OpenAI-compatible endpoints.</li>
                        <li>Improved stale dependency visibility in the gutter: switched the marker from * to ↻ and increased contrast/size so stale lines are easier to spot at a glance.</li>
                        <li>Added a Help title-bar position control so you can dock the Help panel on the left, right, or bottom, similar to VS Code.</li>
                        <li>Adjusted Enter behavior for empty/comment lines so it now moves to the next line, while Ctrl/Cmd + Enter consistently inserts a new line below for all line types.</li>
                        <li>Added Alt + Z shortcut to toggle word wrap, matching VS Code behavior.</li>
                        <li>Added a Help icon in the status bar for one-click access to the Help panel.</li>
                        <li>Help docking now reserves workspace area instead of overlaying content, so expressions stay visible while Help is open.</li>
                        <li>Scrollbar styling now follows the active theme using VS Code scrollbar color tokens when available.</li>
                        <li>Added dedicated Help panel and single Help menu entry. Help is now separate from Settings.</li>
                        <li>Moved Word wrap toggle to the status bar for faster access while editing.</li>
                        <li>Added line numbers in the editor gutter for easy reference. Numbers now appear alongside error icons and other indicators.</li>
                        <li>Added word wrap toggle in Settings to Editor to wrap long lines at the window edge. Word wrap is disabled by default for a clean, code-like appearance.</li>
                        <li>Added Ctrl/Cmd + Enter to insert a new line below the current line without evaluating.</li>
                        <li>Switched all expression execution to Go backend Expr evaluation with a unified language model across the app.</li>
                        <li>Added pipeline analytics syntax with | pass-through and # current-item placeholders for filter/map.</li>
                        <li>Added each(...) as an alias for map(...) in pipeline stages.</li>
                        <li>Switched aggregation functions to native expr-lang builtins: sum, count/len, mean/avg, median, min, max, and many more array helpers (filter, map, all, any, find, reduce, etc.).</li>
                        <li>Added lightweight editor intelligence for known variables and allowed functions/constants, with Tab completion for the top suggestion.</li>
                        <li>Extended intelligence coverage to include pipeline helpers such as avg, filter, and map in suggestions and highlighting.</li>
                        <li>Added safe handling for bare function references so expressions like sin now return a user error instead of triggering a backend JSON panic, while map(sin) shorthand maps over each item.</li>
                        <li>Improved status-bar error messages with clearer guidance for invalid math domains (NaN/Inf), FILTER predicates, internal-name reassignment, and missing function parentheses.</li>
                        <li>Protected all internal names from reassignment so built-ins like PI, E, TAU, and sin remain immutable.</li>
                        <li>Expanded Expr math constants to include the practical full set from Go math plus TAU, including PHI, SQRTE, SQRTPI, SQRTPHI, SQRT1_2, and the existing logarithmic constants.</li>
                        <li>Added JS Math-style functions and constants in expressions (sin, cos, sqrt, pow, max, min, PI, E, and more).</li>
                        <li>Variables now use classic inline declarations like s = 2+6, with @ markers in the gutter for declaration lines.</li>
                        <li>Removed configurable variable trigger key behavior from Editor settings.</li>
                        <li>Added a quick double-Escape shortcut to hide the app window while keeping the app running.</li>
                        <li>Fixed line-bound variable remapping: deleting or inserting lines now keeps variable letters attached to the correct lines instead of moving onto empty lines.</li>
                        <li>Restored Help pages in menus: native Help menu entries and in-app menu shortcuts now open Help pages directly.</li>
                        <li>Added worksheet persistence so your content and carry-over result are restored on restart.</li>
                        <li>Added on-type line validation with red line state and gutter ! markers.</li>
                        <li>Added scientific notation support in expressions such as 1e6 and 2.5E-3.</li>
                        <li>Added decimal delimiter mode in Settings with dot, comma, and system options.</li>
                        <li>Precision modes: Auto = 10 decimal places, Full = no rounding, or set a fixed 0-15 decimal count. Use the status-bar chip or Settings to switch.</li>
                        <li>Added experimental simple code mode: backtick-wrapped blocks now support let/const/var and return the value of the last expression.</li>
                        <li>Extended simple code mode so variable declarations can assign a backtick block result (example: v = `a=2; b=3; a+b`).</li>
                        <li>Editing a previously calculated line now clears its inline = result suffix immediately, so expression updates happen on a clean source line.</li>
                        <li>Added stale dependency markers: changing a variable declaration now marks evaluated dependent lines with a gutter ↻ until they are recalculated.</li>
                        <li>Added a top stale-state banner with quick actions to re-evaluate all expression lines or clear stale markers.</li>
                        <li>Smart brackets: selecting text and pressing (, [, or {'{'} wraps the selection in the matching bracket pair.</li>
                        <li>Updated editor intelligence timing: pop-up hints now wait 300 ms after typing, are not shown on startup, and auto-hide after 3 seconds of no typing.</li>
                        <li>Changed end-of-line comment support to use " as the comment starter in backend evaluation and frontend source parsing.</li>
                        <li>Updated comment behavior so comment-only lines are treated as notes and no longer evaluate to = error.</li>
                        <li>Adjusted Enter handling so pressing Enter inside trailing comment text acts like an empty execution, and failed evaluation now keeps the caret on the same spot instead of jumping.</li>
                        <li>Removed editor-side multiline backtick block entry, so Enter no longer keeps unfinished backtick blocks open across multiple lines.</li>
                        <li>Added theme-aware comment token coloring so text after " is rendered with comment styling from the active theme.</li>
                        <li>Added AI mode for ? prompt lines with structured answer/comment/code handling and automatic code re-evaluation.</li>
                        <li>Added dedicated AI settings with provider preset, endpoint, model id, timeout, default context mode, and BYOK key management.</li>
                        <li>Removed editable AI system prompt from Settings; the app now always uses the built-in default system prompt template for consistent behavior.</li>
                        <li>Replaced AI stub transport with a real OpenAI-compatible chat API call and secure keyring storage, plus explicit Linux insecure fallback mode.</li>
                        <li>Added animated editor-line background for in-progress AI prompt lines, making the active waiting line easier to spot.</li>
                        <li>AI code output wrapped in markdown fences is now cleaned automatically before insertion, so stray ``` markers do not appear in the worksheet.</li>
                    </ul>
                )}
            </div>
        </div>
    );
}
