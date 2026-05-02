import { HelpLayout } from '../components/HelpLayout';
import { functionReferenceGroups } from '../content/functionReference';

function getFunctionAnchorId(groupId: string, functionName: string): string {
    const normalizedName = functionName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${groupId}-${normalizedName}`;
}

export function FunctionsPage() {
    const totalFunctions = functionReferenceGroups.reduce((sum, group) => sum + group.functions.length, 0);

    return (
        <HelpLayout
            title="Function Reference"
            subtitle="Functions currently exposed by the Run-Calc evaluator."
        >
            <div className="reference-layout">
                <aside className="panel reference-sidebar" aria-label="Function reference navigation">
                    <h2>Function Groups</h2>
                    <p className="reference-summary-text">
                        {totalFunctions} documented functions across {functionReferenceGroups.length} groups.
                    </p>
                    <nav className="reference-sidebar-nav" aria-label="Function groups">
                        {functionReferenceGroups.map((group) => (
                            <details key={group.id} className="reference-nav-group">
                                <summary className="reference-nav-group-summary">
                                    <span>{group.title}</span>
                                    <strong>{group.functions.length}</strong>
                                </summary>
                                <ul className="reference-nav-function-list">
                                    {group.functions.map((fn) => (
                                        <li key={`${group.id}-${fn.name}`}>
                                            <a
                                                href={`#${getFunctionAnchorId(group.id, fn.name)}`}
                                                className="reference-nav-function-link"
                                            >
                                                {fn.name}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        ))}
                    </nav>
                </aside>

                <div className="reference-content">
                    <section className="panel">
                        <h2>How to use this page</h2>
                        <ul>
                            <li>Use the left sidebar to jump to a function group.</li>
                            <li>Examples are evaluator-ready snippets you can paste into Run-Calc lines.</li>
                            <li>For operators and expression syntax, see the language definition section.</li>
                        </ul>
                    </section>

                    {functionReferenceGroups.map((group) => (
                        <section key={group.id} id={group.id} className="panel reference-group">
                            <h2>{group.title}</h2>
                            <p className="reference-summary-text">{group.intro}</p>
                            <ul className="reference-function-list">
                                {group.functions.map((fn) => (
                                    <li
                                        key={`${group.id}-${fn.name}`}
                                        id={getFunctionAnchorId(group.id, fn.name)}
                                        className="reference-function-item"
                                    >
                                        <p className="reference-signature">
                                            <code>{fn.signature}</code>
                                        </p>
                                        <p>{fn.description}</p>
                                        {fn.example ? (
                                            <p className="reference-example">
                                                Example: <code>{fn.example}</code>
                                            </p>
                                        ) : null}
                                        {fn.notes ? <p className="reference-notes">{fn.notes}</p> : null}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </HelpLayout>
    );
}
