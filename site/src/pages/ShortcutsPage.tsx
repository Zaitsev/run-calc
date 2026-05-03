import { HelpLayout } from '../components/HelpLayout';
import { HelpList } from '../components/HelpList';
import { helpContent } from '../content/helpContent';

export function ShortcutsPage() {
    return (
        <HelpLayout title="Keyboard Shortcuts" subtitle="Fast interaction and navigation inside the app.">
            <section className="panel">
                <h2>Shortcuts</h2>
                <HelpList items={helpContent.shortcuts} />
            </section>
        </HelpLayout>
    );
}
