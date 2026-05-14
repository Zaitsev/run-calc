import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

export function renderStaticPage(Page: ComponentType) {
    const rootElement = document.getElementById('root');

    if (!rootElement) {
        throw new Error('Missing root element for static page rendering.');
    }

    createRoot(rootElement).render(
        <StrictMode>
            <Page />
        </StrictMode>,
    );
}
