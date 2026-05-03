import { HelpLayout } from '../components/HelpLayout';
import { HelpList } from '../components/HelpList';
import { helpContent, operationsVisualGuide } from '../content/helpContent';

export function OperationsPage() {
    return (
        <HelpLayout title="Operations" subtitle="A beginner-friendly path from first formula to practical workflows.">
            <section className="panel hero-panel operations-hero">
                <span className="hero-badge">Start Here</span>
                <h2 className="hero-title">Learn Run-Calc in four tiny wins</h2>
                <p className="hero-subtitle">
                    If this is your first calculator that works like a notepad, follow the steps below in order.
                    Each step builds confidence, and each screenshot block is ready for your real app captures.
                </p>
            </section>

            <section className="panel">
                <h2>Visual Walkthrough</h2>
                <div className="operations-step-grid">
                    {operationsVisualGuide.map((step, index) => (
                        <article key={step.id} className="operations-step-card">
                            <h3>{step.title}</h3>
                            <p>{step.summary}</p>
                            <p className="operations-step-example">Example: <code>{step.example}</code></p>
                            <figure className="operations-step-figure">
                                <video controls muted playsInline>
                                    <source src={step.image} type="video/mp4" />
                                    Your browser does not support the video tag.
                                </video>
                            </figure>
                            <ul className="operations-step-notes">
                                {step.notes.map((note) => (
                                    <li key={note}>{note}</li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </div>
            </section>

            <section className="panel">
                <h2>Operations Reference</h2>
                <HelpList items={helpContent.operations} />
            </section>
        </HelpLayout>
    );
}
