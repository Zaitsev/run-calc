import React, { useEffect, useRef, useState } from 'react';
import { SearchThemes, InstallTheme } from '../wailsjs/go/main/App';
import './ThemeStore.css';

const SEARCH_DEBOUNCE_MS = 1000;

function isCancelledSearchError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err ?? '');
    return /cancelled|canceled|aborted|context canceled/i.test(message);
}

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
    themeBase?: 'dark' | 'light';
}

export interface ThemeStoreProps {
    onPreviewTheme: (theme: AcceptedThemeEntry) => void;
    onAcceptTheme: (theme: AcceptedThemeEntry) => void;
    onCancelThemePreview: () => void;
    currentPreviewThemeId: string | null;
}

export function ThemeStore({ onPreviewTheme, onAcceptTheme, onCancelThemePreview, currentPreviewThemeId }: ThemeStoreProps) {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState<ThemeSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [installingId, setInstallingId] = useState<string | null>(null);
    const [previewMap, setPreviewMap] = useState<Record<string, AcceptedThemeEntry>>({});
    const searchRequestIdRef = useRef(0);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedQuery(query.trim());
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [query]);

    useEffect(() => {
        let active = true;
        const requestId = ++searchRequestIdRef.current;

        const runSearch = async () => {
            setError('');
        setLoading(true);
            try {
                const res = await SearchThemes(debouncedQuery);
                if (!active || requestId !== searchRequestIdRef.current) {
                    return;
                }
                setResults((res || []) as ThemeSearchResult[]);
            } catch (err: unknown) {
                if (!active || requestId !== searchRequestIdRef.current) {
                    return;
                }
                if (isCancelledSearchError(err)) {
                    return;
                }
                setError(err instanceof Error ? err.message : String(err));
                setResults([]);
            } finally {
                if (active && requestId === searchRequestIdRef.current) {
                    setLoading(false);
                }
            }
        };

        runSearch();

        return () => {
            active = false;
        };
    }, [debouncedQuery]);

    const handlePreview = async (ext: ThemeSearchResult) => {
        if (!ext.downloadUrl) {
            setError('Theme package URL missing; try another theme.');
            return;
        }

        setInstallingId(ext.name);
        setError('');
        try {
            const customTheme = await InstallTheme(ext.name, ext.downloadUrl) as { id: string; colors: Record<string, string>; type?: string };
            const themeToPreview: AcceptedThemeEntry = {
                id: customTheme.id,
                name: ext.displayName || ext.name,
                publisher: ext.publisher,
                iconUrl: ext.files?.icon,
                colors: customTheme.colors || {},
                themeBase: customTheme.type === 'dark' || customTheme.type === 'light' ? customTheme.type : undefined,
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
                <div className="theme-store-search">
                    <input
                        type="text"
                        placeholder="Search themes (e.g., dracula, one dark, github)"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoFocus
                    />
                    <span aria-live="polite" className="theme-store-search-status">
                        {loading ? 'Searching...' : ''}
                    </span>
                </div>

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