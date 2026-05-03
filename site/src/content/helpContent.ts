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
        'When a variable changes, dependent lines are marked stale until you run them again.',
        'Status messages are written in plain language with practical examples for faster troubleshooting.'
    ],
    shortcuts: [
        'Enter: Evaluate current line, or move to the next line when the current line is empty/comment-only or caret is in trailing comment text. On the last line, Enter creates a new line and moves the caret to it when no evaluation error occurs.',
        'Ctrl/Cmd + Enter: Always insert a new line below and move the caret to it.',
        'Ctrl/Cmd + N: New worksheet.',
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
    new: [
        'Version 0.5.1 - First Test-Drive Release',
        'This is the initial test-drive version of Run-Calc. All core features are included and ready for feedback.',
        'Features: inline expression evaluation, AI mode with structured output, pipeline analytics, comprehensive math functions, themed editor, help system, and worksheet persistence.',
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
