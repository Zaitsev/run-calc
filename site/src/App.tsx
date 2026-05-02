import { Navigate, Route, Routes } from 'react-router-dom';
import { OverviewPage } from './pages/OverviewPage';
import { OperationsPage } from './pages/OperationsPage';
import { ShortcutsPage } from './pages/ShortcutsPage';
import { FunctionsPage } from './pages/FunctionsPage';
import { WhatsNewPage } from './pages/WhatsNewPage';
import { PrivacyPage } from './pages/PrivacyPage';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/shortcuts" element={<ShortcutsPage />} />
            <Route path="/functions" element={<FunctionsPage />} />
            <Route path="/whats-new" element={<WhatsNewPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
