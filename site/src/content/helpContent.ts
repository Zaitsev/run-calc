import type { HelpContentMap, OperationVisualStep } from '../types/help';

export const helpContent: HelpContentMap = {
    operations: [
        'Type a formula in plain text, for example: 2 + 2 * 4.',
        'Press Enter to calculate the current line. Run-Calc adds the result inline: 2 + 2 * 4 = 10.',
        'Start a new line with +, -, *, or / to continue from the previous result quickly.',
        'Save values with variables so you can reuse them: total = 120 or @prices = [19, 35, 42].',
        'Use | pipelines to process lists step-by-step: @prices | filter(# > 20) | sum.',
        'Inside filter/map/each, # means the current item.',
        'Need help from AI? Start a line with ? and write your request.',
        'AI can return a number, an explanation, or ready-to-run calc lines. Numeric results are saved as ai0, ai1, and so on.',
        'Configure AI in Settings -> AI. Changes are saved only after Test and Save succeeds.',
        'Use " to add notes at the end of a line: total = price * qty " monthly subtotal.',
        'Pressing Enter on an empty or comment-only line simply moves to the next line (or creates one at the end).',
        'If a line is invalid, it is marked in red with a gutter ! so it is easy to spot and fix.',
        'If you edit a line that already has = result, Run-Calc removes the old result so you can recalculate cleanly.',
        'When a variable changes, dependent lines are visually marked as out-of-date until recalculated.',
        'Status messages are written in plain language with practical examples for faster troubleshooting.',
        '## Copying results',
        'Hover over any evaluated line to reveal a copy icon (⧉) next to the result.',
        'Click the icon to copy the result value to the clipboard. The status bar confirms the copy.',
        'Only numeric results are copyable — error lines do not show the icon.',
    ],
    shortcuts: [
        'Enter: Evaluate current line, or move to the next line when the current line is empty/comment-only or caret is in trailing comment text. On the last line, Enter creates a new line and moves the caret to it when no evaluation error occurs.',
        'Ctrl/Cmd + Enter: Insert a new line and move the caret to it. When the cursor is at the start of a line, inserts above; otherwise inserts below.',
        'Ctrl/Cmd + N: New worksheet.',
        'Ctrl/Cmd + L: Create a lock for the current worksheet if needed, then lock it.',
        'New worksheet (Ctrl/Cmd + N or menu) asks for confirmation before clearing content.',
        'Ctrl/Cmd + =: Increase font size.',
        'Ctrl/Cmd + -: Decrease font size.',
        'Ctrl/Cmd + 0: Reset font size.',
        'Alt + Z: Toggle word wrap (VS Code-style shortcut).',
        'Tab: Accept the top variable/function/constant suggestion when shown.',
        '( [ {: With text selected, wraps the selection in the matching bracket pair.',
        'Ctrl/Cmd + R: Reload app window.',
        'Ctrl/Cmd + Q: Quit (your work is saved).',
        'Press Escape twice quickly: Hide app window.'
    ],
    worksheets: [
        'Worksheets are independent tabs — each has its own expressions, variables, and results.',
        'Create a new worksheet with the + button in the tab bar, or press Ctrl/Cmd + N.',
        'Switch between worksheets by clicking a tab. Your work on each is preserved automatically.',
        'Rename a worksheet by double-clicking its tab, or right-click → Rename. Press Enter to confirm, Escape to cancel.',
        'Close a worksheet by clicking the × button on its tab, or right-click → Delete worksheet. The last worksheet cannot be closed.',
        'Tabs resize dynamically — they share the available width and shrink as you open more.',
        'Tab position (top, bottom, or left sidebar) can be changed in Settings → Worksheet tabs position.',
        'Lock a worksheet with Ctrl/Cmd + L or right-click → Lock worksheet. When locked, the worksheet content is hidden until you unlock the tab.',
        'Save a worksheet to an encrypted file: right-click the tab → Save to file.',
        'Load a previously saved worksheet: right-click the tab → Load from file.',
        'Variables and results are isolated: a variable defined in one worksheet is not visible in another.',
    ],
    new: [
        '## Version 6.2.0',
        'Copy-paste expressions autoevaluation is now optional: toggle "Auto-eval copied expressions" in Settings or the Status Bar to control whether pasted expressions calculate immediately or wait for you to review and press Enter.',
        'Better stale result tracking: when you change a variable, all dependent lines are now marked with a yellow warning icon in the gutter until you recalculate them.',
        'Improved background power consumption: the app now reduces CPU usage when idle, while keeping the interface responsive and ready for your next calculation.',
        'Removed Ctrl-NumLock shortcut to restore app from tray. ',
        'Use Escape twice quickly to hide the app window instead.',
        '## Version 6.1.0 - Modern Copy-Paste',
        `You can now copy evaluated results directly from the editor with the new hover copy button.`,
        'You can now toggle "Copy expressions only" in Settings and the Status Bar to copy selected text without its calculated results.',
        'The "Use variables for new lines" setting now inserts the variable name when the previous line is a variable assignment.',
        '## Version 6.0.0 - Worksheets Release',
        'Worksheets are now a core part of Run-Calc: use independent tabs for separate calculations and variable scopes.',
        'This release adds worksheet locking with password protection, hidden content while locked, and unlock controls in the lock screen.',
        'Auto-lock options are included for inactivity timeout, minimize/hide, and system sleep/resume to protect worksheet data.',
        'Evaluated numeric results can now be copied directly from the editor with the hover copy button.',
        '## Version 0.5.1 - First Test-Drive Release',
        'This is the initial test-drive version of Run-Calc. All core features are included and ready for feedback.',
        'Features include inline expression evaluation, AI mode with structured output, pipeline analytics, comprehensive math functions, themed editor, help system, and worksheet persistence.',
        'Please report any issues or suggestions to help us improve the app for general release.'
    ],
};

export const operationsVisualGuide: OperationVisualStep[] = [
    {
        id: 'type-and-run',
        title: 'Type and press Enter',
        summary: 'Write a simple expression and press Enter to get an instant inline result.',
        example: '2 + 2 * 4 = 10',
        image: '/images/operations/01-type-and-enter-placeholder.mp4',
        alt: 'Placeholder screenshot for typing an expression and pressing Enter.',
        notes: [
            'Great first check: try "+ 5", then change precision from the status bar.',
            'Use Ctrl/Cmd + Enter if you only want to add a new line without calculating.'
        ]
    },
    {
        id: 'store-and-reuse',
        title: 'Store values in variables',
        summary: 'Name important numbers once, then reuse them in later lines.',
        example: 'subtotal = 89.5',
        image: '/images/operations/02-variables-placeholder.mp4',
        alt: 'Placeholder screenshot for variable assignment and reuse.',
        notes: [
            'Use plain names like taxRate or monthlyRent for readability.',
            'Arrays are useful for grouped values: @bills = [45, 72, 18].'
        ]
    },
    {
        id: 'pipeline-lists',
        title: 'Process lists with pipelines',
        summary: 'Use | to build readable steps like filter, map, and sum.',
        example: 'bills | filter(# > 20) | sum',
        image: '/images/operations/03-pipeline-placeholder.mp4',
        alt: 'Placeholder screenshot for a list pipeline with filter and sum.',
        notes: [
            'Think of | as "then do this" for data.',
            'Inside filter/map, # is the current item in the list.'
        ]
    },
    {
        id: 'ask-ai',
        title: 'Ask AI for help',
        summary: 'Start with ? to ask a question (like "What is 20% of 150?") , use   ?? for a detailed explanation. IMPORTANT: you need to setup AI key before using this feature.',
        example: '? Convert 6.5 feet to centimeters and show formula',
        image: '/images/operations/04-ai-placeholder.mp4',
        alt: 'Placeholder screenshot for AI prompt line and result.',
        notes: [
            'AI can insert calculation lines you can review and rerun.',
            'If your AI settings fail testing, use Revert changes to go back to last saved.'
        ]
    }
];
