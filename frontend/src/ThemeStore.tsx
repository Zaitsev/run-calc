import React, { useEffect, useState } from 'react';
import { SearchThemes, InstallTheme } from '../wailsjs/go/main/App';
import './ThemeStore.css';

interface ThemeSearchResult {
    namespace?: string;
    name: string;
    publisher?: string;
    displayName?: string;
    description?: string;
    downloadUrl?: string;
    files?: {
        icon?: string;
    };
}

export interface AcceptedThemeEntry {
    id: string;
    name: string;
    publisher?: string;
    iconUrl?: string;
    colors: Record<string, string>;
}

export interface ThemeStoreProps {
    onPreviewTheme: (theme: AcceptedThemeEntry) => void;
    onAcceptTheme: (theme: AcceptedThemeEntry) => void;
    onCancelThemePreview: () => void;
    currentPreviewThemeId: string | null;
}

export function ThemeStore({ onPreviewTheme, onAcceptTheme, onCancelThemePreview, currentPreviewThemeId }: ThemeStoreProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ThemeSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [installingId, setInstallingId] = useState<string | null>(null);
    const [previewMap, setPreviewMap] = useState<Record<string, AcceptedThemeEntry>>({});

    useEffect(() => {
        let cancelled = false;

        const loadPopularThemes = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await SearchThemes('');
                if (!cancelled) {
                    setResults((res || []) as ThemeSearchResult[]);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err.message || String(err));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadPopularThemes();

        return () => {
            cancelled = true;
        };
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setResults([]);
        try {
            const res = await SearchThemes(query);
            setResults((res || []) as ThemeSearchResult[]);
        } catch (err: any) {
            setError(err.message || String(err));
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async (ext: ThemeSearchResult) => {
        if (!ext.downloadUrl) {
            setError('Theme package URL missing; try another theme.');
            return;
        }

        setInstallingId(ext.name);
        setError('');
        try {
            const customTheme = await InstallTheme(ext.name, ext.downloadUrl) as { id: string; colors: Record<string, string> };
            const themeToPreview: AcceptedThemeEntry = {
                id: customTheme.id,
                name: ext.displayName || ext.name,
                publisher: ext.publisher,
                iconUrl: ext.files?.icon,
                colors: customTheme.colors || {},
            };
            setPreviewMap((prev) => ({ ...prev, [themeToPreview.id]: themeToPreview }));
            onPreviewTheme(themeToPreview);
        } catch (err: any) {
            setError(err.message || String(err));
        } finally {
            setInstallingId(null);
        }
    };

    const handleAccept = (themeId: string) => {
        const previewed = previewMap[themeId];
        if (!previewed) {
            setError('Preview this theme before accepting.');
            return;
        }
        onAcceptTheme(previewed);
    };

    return (
        <div className="theme-store-pane">
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
                    {results.map((ext, idx) => {
                        const isPreviewActive = currentPreviewThemeId === ext.name;
                        return (
                        <div key={idx} className="theme-store-card">
                            <div className="theme-store-card-icon-wrap">
                                {ext.files?.icon ? (
                                    <img
                                        className="theme-store-card-icon"
                                        src={ext.files.icon}
                                        alt={`${ext.displayName || ext.name} icon`}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="theme-store-card-icon-fallback" aria-hidden="true">
                                        {((ext.displayName || ext.name || '?').trim().charAt(0) || '?').toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="theme-store-card-info">
                                <div className="theme-store-card-title">{ext.displayName || ext.name}</div>
                                <div className="theme-store-card-author">{ext.publisher}</div>
                                <div className="theme-store-card-desc">{ext.description}</div>
                            </div>
                            <div className="theme-store-actions">
                                {isPreviewActive ? (
                                    <>
                                        <button
                                            type="button"
                                            className="theme-store-install-btn theme-store-install-btn--accept"
                                            onClick={() => handleAccept(ext.name)}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            className="theme-store-install-btn"
                                            onClick={onCancelThemePreview}
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        className="theme-store-install-btn"
                                        onClick={() => handlePreview(ext)}
                                        disabled={installingId === ext.name}
                                    >
                                        {installingId === ext.name ? 'Loading...' : 'Preview'}
                                    </button>
                                )}
                            </div>
                        </div>
                        );
                    })}
                    {!loading && results.length === 0 && !error && (
                        <div className="theme-store-empty">
                            {query ? 'No matching themes found.' : 'No popular themes available right now.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}