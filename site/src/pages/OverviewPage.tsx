import { HelpLayout } from '../components/HelpLayout';
import { Link } from 'react-router-dom';

export function OverviewPage() {
    return (
        <HelpLayout
            title="Run-Calc"
            subtitle="A fast desktop calculator that feels like a notepad, not a form."
        >
            <section className="panel hero-panel">
                <p className="hero-badge">Desktop app for everyday math, planning, and quick analysis</p>
                <h2 className="hero-title">Type naturally. Press Enter. Get instant answers inline.</h2>
                <p className="hero-subtitle">
                    Run-Calc lets you calculate the way you think. Write one line after another, keep your notes,
                    and see results exactly where you typed the expression.
                </p>
                <div className="hero-cta-row">
                    <Link className="hero-btn hero-btn--primary" to="/operations">See how it works</Link>
                    <Link className="hero-btn hero-btn--secondary" to="/shortcuts">View shortcuts</Link>
                    <Link className="hero-btn hero-btn--secondary" to="/functions">Browse functions</Link>
                    <Link className="hero-btn hero-btn--secondary" to="/byok">Set up BYOK</Link>
                </div>
            </section>

            <section className="panel">
                <h2>Why people like Run-Calc</h2>
                <ul>
                    <li>No button hunting: just type expressions like <code>2+3*4</code> and press <code>Enter</code>.</li>
                    <li>Keep momentum: start next line with <code>+</code>, <code>-</code>, <code>*</code>, or <code>/</code> to continue from the last result.</li>
                    <li>Local-first and practical: your worksheet and settings stay on your machine.</li>
                    <li>Optional AI (BYOK): you choose provider and key only if you want it.</li>
                </ul>
            </section>

            <section className="stat-grid" aria-label="Run-Calc value highlights">
                <article className="panel stat-card">
                    <h2>Readable by design</h2>
                    <p>
                        Calculations stay in plain text, so your work is easy to scan, revisit, and share as notes.
                    </p>
                </article>
                <article className="panel stat-card">
                    <h2>Beginner-friendly</h2>
                    <p>
                        In-app help stays short and clear. Deeper guides and details live on this site when you need more.
                    </p>
                </article>
                <article className="panel stat-card">
                    <h2>Powerful when needed</h2>
                    <p>
                        Variables, pipelines, math functions, themes, and precision controls are ready as your work grows.
                    </p>
                </article>
            </section>

            <section className="panel">
                <h2>Explore the docs</h2>
                <ul>
                    <li><strong>Operations</strong>: expression syntax, variables, comments, functions, and AI flow.</li>
                    <li><strong>Shortcuts</strong>: keyboard commands to work faster with less friction.</li>
                    <li><strong>Functions</strong>: grouped reference for all functions exposed in Run-Calc.</li>
                    <li><strong>AI key Setup</strong>: where to create API keys for each provider and what to paste into Run-Calc.</li>
                    <li><strong>What's New</strong>: latest improvements and behavior updates.</li>
                    <li><strong>Privacy</strong>: data handling summary, policy, and legal links.</li>
                </ul>
            </section>

            <section className="panel">
                <h2>Expression Engine</h2>
                <p>
                    Run-Calc expression parsing and evaluation are powered by{' '}
                    <a href="https://github.com/expr-lang/expr">Expr language</a>.
                </p>
            </section>

            <p className="footer">Run-Calc help site powered by React + Vite.</p>
        </HelpLayout>
    );
}
