import { HelpLayout } from '../components/HelpLayout';
import { HelpList } from '../components/HelpList';
import { helpContent } from '../content/helpContent';
import { Sparkles } from 'lucide-react';

export function WhatsNewPage() {
    return (
        <HelpLayout currentPage="whats-new" title="What's New" subtitle="Current release highlights and behavior updates.">
            <section className="panel">
                <h2 className="icon-heading"><Sparkles size={20} />Latest Highlights</h2>
                <HelpList items={helpContent.new} />
            </section>
        </HelpLayout>
    );
}
