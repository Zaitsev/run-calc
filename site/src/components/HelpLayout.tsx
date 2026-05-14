import type { PropsWithChildren } from 'react';

export type SitePageKey = 'overview' | 'operations' | 'shortcuts' | 'functions' | 'byok' | 'themes' | 'whats-new' | 'privacy';

type HelpLayoutProps = PropsWithChildren<{
    title: string;
    subtitle: string;
    currentPage: SitePageKey;
}>;

type NavItem = {
    key: SitePageKey;
    label: string;
    href: string;
};

const navItems: NavItem[] = [
    { key: 'overview', label: 'Overview', href: '/' },
    { key: 'operations', label: 'Operations', href: '/operations' },
    { key: 'shortcuts', label: 'Shortcuts', href: '/shortcuts' },
    { key: 'functions', label: 'Functions', href: '/functions' },
    { key: 'byok', label: 'AI Key Setup', href: '/byok' },
    { key: 'themes', label: 'Themes', href: '/themes' },
    { key: 'whats-new', label: "What's New", href: '/whats-new' },
    { key: 'privacy', label: 'Privacy', href: '/privacy' },
];

export function HelpLayout({ title, subtitle, currentPage, children }: HelpLayoutProps) {
    return (
        <main className="container">
            <header>
                <h1><img src="/hare-calc-128.png" alt="" width={64} height={64} style={{ verticalAlign: 'middle', marginRight: '0.4em' }} />{title}</h1>
                <p className="subtitle">{subtitle}</p>
                <nav aria-label="Main help pages">
                    {navItems.map((item) => (
                        <a
                            key={item.key}
                            href={item.href}
                            className={`nav-link${item.key === currentPage ? ' active' : ''}`}
                            aria-current={item.key === currentPage ? 'page' : undefined}
                        >
                            {item.label}
                        </a>
                    ))}
                    <a
                        href="https://github.com/Zaitsev/run-calc/releases"
                        className="nav-link"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Download App
                    </a>
                </nav>
            </header>
            {children}
        </main>
    );
}
