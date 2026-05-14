import { HelpLayout } from '../components/HelpLayout';
import { ThumbsUp, BookOpen, GraduationCap, Zap, Map, Code2 } from 'lucide-react';
import { GitHubIcon } from '../components/GitHubIcon';

export function OverviewPage() {
    return (
        <HelpLayout
            currentPage="overview"
            title="Run-Calc"
            subtitle="A fast desktop calculator that feels like a notepad, not a form. Windows and Mac. Local-first, with optional AI."
        >
            <section className="panel hero-panel">
                <h2>Run-Calc: Calculate at the Speed of Thought</h2>

                <p>
                    <strong>Run-Calc</strong> is a high-speed <strong>desktop calculator</strong> for Windows and Mac that empowers you to <strong>calculate the way you think</strong>. Designed to feel like a natural <strong>notepad</strong> rather than a rigid form, it allows you to jot down notes, stack equations line by line, and get <strong>instant answers</strong> exactly where you type them. Whether you are performing quick analysis or detailed planning, Run-Calc keeps your momentum high by delivering <strong>inline results</strong> the moment you press Enter.
                </p>

                <h2>Why Choose Run-Calc?</h2>

                <ul className="emoji-list">
                    <li><span className="emoji-bullet">⌨️</span><span><strong>Calculate Naturally:</strong> Type expressions naturally &mdash; like <code>42 + 3 * 4 - 5 * ( 2 + sin(3 + 2 * pi / 2) )</code> &mdash; and get results instantly without searching for a keypad.</span></li>
                    <li><span className="emoji-bullet">❓</span><span><strong>Ask questions:</strong> <code>?? what is the speed of light in nautical miles per second?</code> <span>(😊 161874.97 nautical miles per second)</span></span></li>
                    <li><span className="emoji-bullet">⚡</span><span><strong>Fluid Momentum:</strong> Start any new line with <code>+</code>, <code>-</code>, <code>*</code>, or <code>/</code> to automatically continue calculating from your previous result.</span></li>
                    <li><span className="emoji-bullet">🛠️</span><span><strong>Powerful Data Tools:</strong> Use <strong>variables</strong> to store values and <strong>pipelines</strong> to filter, map, or sum lists of data step-by-step.</span></li>
                    <li><span className="emoji-bullet">🎨</span><span><strong>Personalized Themes:</strong> Switch between built-in Dark, Light, and High Contrast modes, or install any community-made theme directly from the Open VSX registry.</span></li>
                    <li><span className="emoji-bullet">🤖</span><span><strong>AI (BYOK):</strong> Connect your own AI provider to ask complex questions or generate ready-to-run calculation lines.</span></li>
                    <li><span className="emoji-bullet">🚀</span><span><strong>Lightweight Performance:</strong> Enjoy an ultra-lean footprint that stays out of your way while you work.</span></li>
                    <li><span className="emoji-bullet">📖</span><span><strong>Readable by Design:</strong> Calculations stay in <strong>plain text</strong>, making your work easy to scan, revisit, and share as notes.</span></li>
                    <li><span className="emoji-bullet">🔒</span><span><strong>Local-First Privacy:</strong> Your worksheets and settings stay securely on your machine, ensuring your data remains private.</span></li>
                </ul>
            </section>
            <section className="panel hero-panel">
                <h2 className="hero-title">Type naturally. Press Enter. Get instant answers inline.</h2>
                <p className="hero-badge">Desktop app for everyday math, planning,   and quick analysis</p>
                <h3>Easy calculate</h3>
                <p><img src="/images/im0.png" alt="Basic arithmetic" /></p>
                <h3>Any conversions (AI powered)</h3>
                <p><img src="/images/im1.png" alt="AI powered conversions" /></p>
                <p className="hero-subtitle">
                    Run-Calc lets you calculate the way you think. Write one line after another, keep your notes,
                    and see results exactly where you typed the expression.
                </p>
                <div className="hero-cta-row">
                    <a className="hero-btn hero-btn--primary" href="/operations">See how it works</a>
                    <a className="hero-btn hero-btn--secondary" href="/shortcuts">View shortcuts</a>
                    <a className="hero-btn hero-btn--secondary" href="/functions">Browse functions</a>
                    <a className="hero-btn hero-btn--secondary" href="/byok">Set up BYOK</a>
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
                    <li><a href="/operations"><strong>Operations</strong></a>: expression syntax, variables, comments, functions, and AI flow.</li>
                    <li><a href="/shortcuts"><strong>Shortcuts</strong></a>: keyboard commands to work faster with less friction.</li>
                    <li><a href="/functions"><strong>Functions</strong></a>: grouped reference for all functions exposed in Run-Calc.</li>
                    <li><a href="/byok"><strong>AI key Setup</strong></a>: where to create API keys for each provider and what to paste into Run-Calc.</li>
                    <li><a href="/whats-new"><strong>What's New</strong></a>: latest improvements and behavior updates.</li>
                    <li><a href="/privacy"><strong>Privacy</strong></a>: data handling summary, policy, and legal links.</li>
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
