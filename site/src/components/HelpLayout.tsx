import { NavLink } from 'react-router-dom';
import type { PropsWithChildren } from 'react';

type HelpLayoutProps = PropsWithChildren<{
    title: string;
    subtitle: string;
}>;

export function HelpLayout({ title, subtitle, children }: HelpLayoutProps) {
    return (
        <main className="container">
            <header>
                <h1>{title}</h1>
                <p className="subtitle">{subtitle}</p>
                <nav aria-label="Main help pages">
                    <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                        Overview
                    </NavLink>
                    <NavLink to="/operations" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                        Operations
                    </NavLink>
                    <NavLink to="/shortcuts" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                        Shortcuts
                    </NavLink>
                    <NavLink to="/functions" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                        Functions
                    </NavLink>
                    <NavLink to="/whats-new" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                        What's New
                    </NavLink>
                    <NavLink to="/privacy" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                        Privacy
                    </NavLink>
                </nav>
            </header>
            {children}
        </main>
    );
}
