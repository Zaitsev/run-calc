import { HelpLayout } from '../components/HelpLayout';
import { Link } from 'react-router-dom';
import { ThumbsUp, BookOpen, GraduationCap, Zap, Map, Code2 } from 'lucide-react';
import { GitHubIcon } from '../components/GitHubIcon';

export function OverviewPage() {
    return (
        <HelpLayout
            title="Run-Calc"
            subtitle="A fast desktop calculator that feels like a notepad, not a form. Windows and Mac. Local-first, with optional AI."
            >
            <section className="panel hero-panel">
                <h2 className="hero-title">Type naturally. Press Enter. Get instant answers inline.</h2>
                <p className="hero-badge">Desktop app for everyday math, planning,   and quick analysis</p>
                <p><img src="/images/im0.png" alt="Description of image" /></p>
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
                <h2 className="icon-heading"><ThumbsUp size={20} />Why people like Run-Calc</h2>
                <ul>
                    <li>No button hunting: just type expressions like <code>2+3*4</code> and press <code>Enter</code>.</li>
                    <li>Keep momentum: start next line with <code>+</code>, <code>-</code>, <code>*</code>, or <code>/</code> to continue from the last result.</li>
                    <li>Local-first and practical: your worksheet and settings stay on your machine.</li>
                    <li>Optional AI (BYOK): you choose provider and key only if you want it.</li>
                </ul>
            </section>

            <section className="stat-grid" aria-label="Run-Calc value highlights">
                <article className="panel stat-card">
                    <h2 className="icon-heading"><BookOpen size={18} />Readable by design</h2>
                    <p>
                        Calculations stay in plain text, so your work is easy to scan, revisit, and share as notes.
                    </p>
                </article>
                <article className="panel stat-card">
                    <h2 className="icon-heading"><GraduationCap size={18} />Beginner-friendly</h2>
                    <p>
                        In-app help stays short and clear. Deeper guides and details live on this site when you need more.
                    </p>
                </article>
                <article className="panel stat-card">
                    <h2 className="icon-heading"><Zap size={18} />Powerful when needed</h2>
                    <p>
                        Variables, pipelines, math functions, themes, and precision controls are ready as your work grows.
                    </p>
                </article>
            </section>

            <section className="panel">
                <h2 className="icon-heading"><Map size={20} />Explore the docs</h2>
                <ul>
                    <li><Link to="/operations"><strong>Operations</strong></Link>: expression syntax, variables, comments, functions, and AI flow.</li>
                    <li><Link to="/shortcuts"><strong>Shortcuts</strong></Link>: keyboard commands to work faster with less friction.</li>
                    <li><Link to="/functions"><strong>Functions</strong></Link>: grouped reference for all functions exposed in Run-Calc.</li>
                    <li><Link to="/byok"><strong>AI key Setup</strong></Link>: where to create API keys for each provider and what to paste into Run-Calc.</li>
                    <li><Link to="/whats-new"><strong>What's New</strong></Link>: latest improvements and behavior updates.</li>
                    <li><Link to="/privacy"><strong>Privacy</strong></Link>: data handling summary, policy, and legal links.</li>
                </ul>
            </section>

            <section className="panel">
                <h2 className="icon-heading"><Code2 size={20} />Expression Engine</h2>
                <p>
                    Run-Calc expression parsing and evaluation are powered by{' '}
                    <a href="https://github.com/expr-lang/expr">Expr language</a>.
                </p>
            </section>

            <section className="panel">
                <h2 className="icon-heading"><GitHubIcon size={20} />GitHub</h2>
                <p>
                    <a href="https://github.com/Zaitsev/run-calc" target="_blank" rel="noopener noreferrer">Run-Calc on GitHub</a> — source code, releases, and issue tracker.
                </p>
            </section>
        </HelpLayout>
    );
}
