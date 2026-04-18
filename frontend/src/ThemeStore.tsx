import React, { useState } from 'react';
import { SearchThemes, InstallTheme } from '../wailsjs/go/main/App';
import './ThemeStore.css';

export interface ThemeStoreProps {
    onClose: () => void;
    onApplyTheme: (theme: any) => void;
}

export function ThemeStore({ onClose, onApplyTheme }: ThemeStoreProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [installingId, setInstallingId] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setResults([]);
        try {
            const res = await SearchThemes(query);
            setResults(res || []);
        } catch (err: any) {
            setError(err.message || String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async (ext: any) => {
        setInstallingId(ext.name);
        setError('');
        try {
            const customTheme = await InstallTheme(ext.name, ext.downloadUrl);
            onApplyTheme(customTheme);
        } catch (err: any) {
            setError(err.message || String(err));
        } finally {
            setInstallingId(null);
        }
    };

    return (
        <div className="theme-store-overlay">
            <div className="theme-store-window">
                <div className="theme-store-header">
                    <h2>Theme Store (Open VSX)</h2>
                    <button className="theme-store-close" onClick={onClose}>×</button>
                </div>
                <div className="theme-store-body">
                    <form className="theme-store-search" onSubmit={handleSearch}>
                        <input
                            type="text"
                            placeholder="Search themes (e.g., dracula, one dark, github)"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" disabled={loading}>
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                    
                    {error && <div className="theme-store-error">{error}</div>}
                    
                    <div className="theme-store-results">
                        {results.map((ext, idx) => (
                            <div key={idx} className="theme-store-card">
                                <div className="theme-store-card-info">
                                    <div className="theme-store-card-title">{ext.displayName || ext.name}</div>
                                    <div className="theme-store-card-author">{ext.publisher}</div>
                                    <div className="theme-store-card-desc">{ext.description}</div>
                                </div>
                                <button 
                                    className="theme-store-install-btn"
                                    onClick={() => handleInstall(ext)}
                                    disabled={installingId === ext.name}
                                >
                                    {installingId === ext.name ? 'Installing...' : 'Apply'}
                                </button>
                            </div>
                        ))}
                        {!loading && results.length === 0 && !error && query && (
                            <div className="theme-store-empty">No results found or waiting for search.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}