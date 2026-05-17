import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BYOKPage } from './pages/BYOKPage';
import { FunctionsPage } from './pages/FunctionsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OperationsPage } from './pages/OperationsPage';
import { OverviewPage } from './pages/OverviewPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ShortcutsPage } from './pages/ShortcutsPage';
import { ThemesPage } from './pages/ThemesPage';
import { WhatsNewPage } from './pages/WhatsNewPage';
import { WorksheetsPage } from './pages/WorksheetsPage';

export type StaticPage = {
    fileName: string;
    title: string;
    description: string;
    Component: ComponentType;
};

export const staticPages: StaticPage[] = [
    {
        fileName: 'index.html',
        title: 'Run-Calc Help Overview',
        description: 'Run-Calc help overview with links to operations, shortcuts, function reference, themes, AI key setup, and privacy.',
        Component: OverviewPage,
    },
    {
        fileName: 'operations.html',
        title: 'Run-Calc Operations Help',
        description: 'Learn Run-Calc operations, inline evaluation, variables, comments, pipelines, and practical calculator workflows.',
        Component: OperationsPage,
    },
    {
        fileName: 'shortcuts.html',
        title: 'Run-Calc Keyboard Shortcuts',
        description: 'Run-Calc keyboard shortcuts for editing, evaluating, navigation, and fast worksheet workflows.',
        Component: ShortcutsPage,
    },
    {
        fileName: 'worksheets.html',
        title: 'Run-Calc Worksheets Help',
        description: 'Learn how to create, rename, switch, delete, and save independent worksheet tabs in Run-Calc.',
        Component: WorksheetsPage,
    },
    {
        fileName: 'functions.html',
        title: 'Run-Calc Function Reference',
        description: 'Function reference for the Run-Calc evaluator, including math, array, predicate, and app-specific functions.',
        Component: FunctionsPage,
    },
    {
        fileName: 'byok.html',
        title: 'Run-Calc AI Key Setup',
        description: 'Set up your own AI provider key for Run-Calc with step-by-step BYOK instructions for OpenAI, Gemini, OpenRouter, and Anthropic.',
        Component: BYOKPage,
    },
    {
        fileName: 'themes.html',
        title: 'Run-Calc Themes Help',
        description: 'Theme help for Run-Calc, including built-in themes, Theme Store usage, and how VS Code-compatible custom themes work.',
        Component: ThemesPage,
    },
    {
        fileName: 'whats-new.html',
        title: "Run-Calc What's New",
        description: 'Latest Run-Calc release highlights, workflow changes, and behavior updates.',
        Component: WhatsNewPage,
    },
    {
        fileName: 'privacy.html',
        title: 'Run-Calc Privacy and Legal',
        description: 'Run-Calc privacy summary, legal links, and local-first data handling notes.',
        Component: PrivacyPage,
    },
    {
        fileName: '404.html',
        title: 'Run-Calc Help - Page Not Found',
        description: 'The requested help page was not found. Open the Run-Calc help overview to continue.',
        Component: NotFoundPage,
    },
];

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function renderPageDocument(page: StaticPage): string {
    const PageComponent = page.Component;
    const bodyMarkup = renderToStaticMarkup(<PageComponent />);

    return [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '    <meta charset="UTF-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        '    <link rel="icon" type="image/png" href="/hare-calc-128.png" />',
        `    <meta name="description" content="${escapeHtml(page.description)}" />`,
        `    <title>${escapeHtml(page.title)}</title>`,
        '    <link rel="stylesheet" href="/styles.css" />',
        '</head>',
        '<body>',
        bodyMarkup,
        '</body>',
        '</html>',
    ].join('\n');
}
