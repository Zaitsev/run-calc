import { HelpLayout } from '../components/HelpLayout';
import { HelpList } from '../components/HelpList';
import { helpContent } from '../content/helpContent';

export function WhatsNewPage() {
    return (
        <HelpLayout title="What's New" subtitle="Current release highlights and behavior updates.">
            <section className="panel">
                <h2>Latest Highlights</h2>
                <HelpList items={helpContent.new} />
            </section>
        </HelpLayout>
    );
}
