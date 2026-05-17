import { HelpLayout } from '../components/HelpLayout';
import { HelpList } from '../components/HelpList';
import { helpContent } from '../content/helpContent';
import { BookOpen } from 'lucide-react';

export function WorksheetsPage() {
    return (
        <HelpLayout currentPage="worksheets" title="Worksheets" subtitle="Organize independent calculations in tab-based workspaces.">
            <section className="panel">
                <h2 className="icon-heading"><BookOpen size={20} />Worksheets</h2>
                <HelpList items={helpContent.worksheets} />
            </section>
        </HelpLayout>
    );
}
