import React, { useEffect, useRef, useState } from 'react';
import { SearchThemes, InstallTheme } from '../wailsjs/go/main/App';
import { useThemeContext, useThemeStore } from './contexts';
import './ThemeStore.css';

const SEARCH_DEBOUNCE_MS = 1000;

function isCancelledSearchError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err ?? '');
    return /cancelled|canceled|aborted|context canceled/i.test(message);
}

function toFriendlyThemeError(err: unknown): string {
    const raw = (err instanceof Error ? err.message : String(err ?? '')).trim();
    const normalized = raw.toLowerCase();

    if (!normalized) {
        return 'This theme could not be previewed. Please try another theme.';
    }

    if (normalized.includes('tmtheme') || normalized.includes('plist') || normalized.includes('xml')) {
        return 'This theme format is not supported here yet. Please try a different theme.';
    }

    if (normalized.includes('json/jsonc') || normalized.includes('no json')) {
        return 'This theme uses a format that is not supported in this app.';
    }

    if (normalized.includes('no supported color') || normalized.includes('no supported colors')) {
        return 'This theme does not provide compatible colors for this app.';
    }

    if (normalized.includes('theme package is too large')) {
        return 'This theme package is too large to import.';
    }

    if (normalized.includes('theme package url missing')) {
        return 'This theme is missing download information. Please try another one.';
    }

    if (normalized.includes('failed to download') || normalized.includes('status:')) {
        return 'We could not download this theme right now. Please try again.';
    }

    return 'This theme could not be previewed. Please try another theme.';
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

export function ThemeStore() {
    const themeStore = useThemeStore();
    const theme = useThemeContext();
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState<ThemeSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [installingId, setInstallingId] = useState<string | null>(null);
    const [inlineError, setInlineError] = useState<{ extensionName: string; message: string } | null>(null);
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
        setInlineError(null);
        try {
            const customTheme = await InstallTheme(ext.name, ext.downloadUrl) as { id: string; colors: Record<string, string>; type?: string };
            const colorCount = Object.keys(customTheme.colors || {}).length;
            if (colorCount === 0) {
                throw new Error('Theme incompatible: no supported colors were found for this app.');
            }
            const themeToPreview: AcceptedThemeEntry = {
                id: customTheme.id,
                name: ext.displayName || ext.name,
                publisher: ext.publisher,
                iconUrl: ext.files?.icon,
                colors: customTheme.colors || {},
                themeBase: customTheme.type === 'dark' || customTheme.type === 'light' ? customTheme.type : undefined,
            };
            setPreviewMap((prev) => ({ ...prev, [ext.name]: themeToPreview }));
            themeStore.startThemePreview(themeToPreview, theme.theme, theme.setTheme);
        } catch (err: unknown) {
            const message = toFriendlyThemeError(err);
            setError(message);
            setInlineError({ extensionName: ext.name, message });
        } finally {
            setInstallingId(null);
        }
    };

    const handleAccept = (extensionName: string) => {
        const previewed = previewMap[extensionName];
        if (!previewed) {
            setError('Preview this theme before accepting.');
            return;
        }
        themeStore.acceptThemePreview(previewed, theme.setTheme);
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
                        const previewed = previewMap[ext.name];
                        const isPreviewActive =
                            !!previewed &&
                            themeStore.pendingThemePreview?.id === previewed.id;
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
                                            onClick={() => themeStore.cancelThemePreview(theme.setTheme)}
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
                            {inlineError?.extensionName === ext.name && (
                                <div className="theme-store-card-error" role="alert">
                                    {inlineError.message}
                                </div>
                            )}
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