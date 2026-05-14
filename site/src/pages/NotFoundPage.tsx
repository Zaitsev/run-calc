import { HelpLayout } from '../components/HelpLayout';

export function NotFoundPage() {
    return (
        <HelpLayout
            currentPage="overview"
            title="Run-Calc"
            subtitle="A fast desktop calculator that feels like a notepad, not a form."
        >
            <section className="panel hero-panel">
                <p className="hero-badge">404</p>
                <h2 className="hero-title">This page does not exist.</h2>
                <p className="hero-subtitle">
                    The link may be outdated or typed incorrectly. Use the actions below to continue.
                </p>
                <div className="hero-cta-row">
                    <a className="hero-btn hero-btn--primary" href="/">Open help overview</a>
                    <a className="hero-btn hero-btn--secondary" href="/operations">See operations</a>
                    <a className="hero-btn hero-btn--secondary" href="https://github.com/Zaitsev/run-calc/releases" target="_blank" rel="noreferrer">Download app</a>
                </div>
            </section>
        </HelpLayout>
    );
}