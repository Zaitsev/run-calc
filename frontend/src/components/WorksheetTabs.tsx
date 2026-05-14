import { useEffect, useMemo, useState } from 'react';
import type { WorksheetTabPosition, WorksheetSnapshot } from '../types/app';
import { useWorksheetManager, useWorksheet } from '../contexts';
import { SaveWorksheetToFile, LoadWorksheetFromFile, GetDefaultWorksheetDirectory } from '../../wailsjs/go/main/App';

type WorksheetTabsProps = {
    placement: WorksheetTabPosition;
};

type ContextMenuState = {
    x: number;
    y: number;
    worksheetId: string;
} | null;

export function WorksheetTabs({ placement }: WorksheetTabsProps) {
    const {
        worksheets,
        activeId,
        createWorksheet,
        deleteWorksheet,
        renameWorksheet,
        switchWorksheet,
        updateActiveWorksheet,
    } = useWorksheetManager();
    const activeWorksheet = useWorksheet();

    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!contextMenu) return;
        const closeMenu = () => setContextMenu(null);
        // Defer listener registration so the current right-click event doesn't close the menu immediately
        const timerId = window.setTimeout(() => {
            window.addEventListener('click', closeMenu);
            window.addEventListener('contextmenu', closeMenu);
        }, 0);
        return () => {
            window.clearTimeout(timerId);
            window.removeEventListener('click', closeMenu);
            window.removeEventListener('contextmenu', closeMenu);
        };
    }, [contextMenu]);

    const canDeleteWorksheet = worksheets.length > 1;

    const activeIndex = useMemo(() => {
        const index = worksheets.findIndex((w) => w.id === activeId);
        return index < 0 ? 0 : index;
    }, [worksheets, activeId]);

    const startRename = (worksheetId: string, currentName: string) => {
        setRenamingId(worksheetId);
        setRenameValue(currentName);
    };

    const commitRename = (worksheetId: string) => {
        renameWorksheet(worksheetId, renameValue);
        setRenamingId(null);
        setRenameValue('');
    };

    const handleSaveToFile = async (worksheetId: string) => {
        const worksheet = worksheets.find((w) => w.id === worksheetId);
        if (!worksheet) return;

        setIsSaving(true);
        try {
            // Construct the export payload
            const payload = {
                content: worksheet.content,
                lastResult: worksheet.lastResult ?? null,
                markedLines: worksheet.markedLines,
                variableValues: worksheet.variableValues,
            };

            // Get default directory
            const defaultDir = await GetDefaultWorksheetDirectory();
            const defaultFileName = `${worksheet.name.replace(/\s+/g, '_')}.rcalc`;
            const defaultPath = `${defaultDir}/${defaultFileName}`;

            // TODO: In production, use Wails file dialog: wruntime.SaveFileDialog()
            // For now, we'll construct a basic path. File dialog integration requires runtime API.
            // Example: const filePath = await wruntime.SaveFileDialog(...)
            const filePath = prompt(
                `Save worksheet to file (default: ${defaultPath}):`,
                defaultPath
            );

            if (!filePath) {
                setIsSaving(false);
                return; // User cancelled
            }

            const result = await SaveWorksheetToFile(
                JSON.stringify(payload),
                filePath
            );

            if (result.ok) {
                alert(`Worksheet saved to: ${result.filePath}`);
            } else {
                alert(`Failed to save worksheet: ${result.error}`);
            }
        } catch (error) {
            alert(`Error saving worksheet: ${error}`);
        } finally {
            setIsSaving(false);
            setContextMenu(null);
        }
    };

    const handleLoadFromFile = async (worksheetId: string) => {
        setIsLoading(true);
        try {
            // TODO: Use Wails file dialog: wruntime.OpenFileDialog()
            // For now, we'll use prompt to get file path
            const filePath = prompt('Enter path to worksheet file (.rcalc):');

            if (!filePath) {
                setIsLoading(false);
                return; // User cancelled
            }

            const result = await LoadWorksheetFromFile(filePath);

            if (result.ok && result.payload) {
                // Update the active worksheet with loaded data
                updateActiveWorksheet({
                    content: result.payload.content,
                    lastResult: result.payload.lastResult,
                    markedLines: result.payload.markedLines,
                    variableValues: result.payload.variableValues,
                });
                alert('Worksheet loaded successfully');
            } else {
                alert(`Failed to load worksheet: ${result.error}`);
            }
        } catch (error) {
            alert(`Error loading worksheet: ${error}`);
        } finally {
            setIsLoading(false);
            setContextMenu(null);
        }
    };

    return (
        <div className={`worksheet-tabs worksheet-tabs--${placement}`} aria-label="Worksheets" role="tablist">
            <div className="worksheet-tabs-list">
                {worksheets.map((worksheet) => {
                    const isActive = worksheet.id === activeId;
                    const isRenaming = worksheet.id === renamingId;
                    return (
                        <div
                            key={worksheet.id}
                            className={`worksheet-tab${isActive ? ' worksheet-tab--active' : ''}${isRenaming ? ' worksheet-tab--renaming' : ''}`}
                            role="tab"
                            aria-selected={isActive}
                            title={worksheet.name}
                            tabIndex={0}
                            onClick={() => switchWorksheet(worksheet.id)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    switchWorksheet(worksheet.id);
                                }
                            }}
                            onDoubleClick={() => startRename(worksheet.id, worksheet.name)}
                            onContextMenu={(event) => {
                                event.preventDefault();
                                setContextMenu({ x: event.clientX, y: event.clientY, worksheetId: worksheet.id });
                            }}
                        >
                            <span className="worksheet-tab-index">{worksheets.indexOf(worksheet) + 1}</span>
                            {isRenaming ? (
                                <input
                                    className="worksheet-tab-rename"
                                    value={renameValue}
                                    onChange={(event) => setRenameValue(event.target.value)}
                                    onBlur={() => commitRename(worksheet.id)}
                                    onClick={(event) => event.stopPropagation()}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            commitRename(worksheet.id);
                                        }
                                        if (event.key === 'Escape') {
                                            event.preventDefault();
                                            setRenamingId(null);
                                            setRenameValue('');
                                        }
                                    }}
                                    autoFocus
                                />
                            ) : (
                                <span className="worksheet-tab-name">{worksheet.name}</span>
                            )}
                            {canDeleteWorksheet && (
                                <button
                                    type="button"
                                    className="worksheet-tab-close"
                                    title="Close worksheet"
                                    aria-label={`Close ${worksheet.name}`}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        deleteWorksheet(worksheet.id);
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
            <button
                type="button"
                className="worksheet-tabs-add"
                onClick={() => createWorksheet()}
                title="Add worksheet"
                aria-label="Add worksheet"
            >
                +
            </button>

            {contextMenu && (
                <div
                    className="worksheet-tab-menu"
                    role="menu"
                    style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
                >
                    <button
                        type="button"
                        className="worksheet-tab-menu-item"
                        role="menuitem"
                        onClick={() => {
                            const ws = worksheets.find((w) => w.id === contextMenu.worksheetId);
                            if (ws) startRename(ws.id, ws.name);
                            setContextMenu(null);
                        }}
                    >
                        Rename
                    </button>
                    <button
                        type="button"
                        className="worksheet-tab-menu-item"
                        role="menuitem"
                        onClick={() => {
                            createWorksheet();
                            setContextMenu(null);
                        }}
                    >
                        Add worksheet
                    </button>
                    <button
                        type="button"
                        className="worksheet-tab-menu-item"
                        role="menuitem"
                        disabled={!canDeleteWorksheet}
                        onClick={() => {
                            if (!canDeleteWorksheet) return;
                            deleteWorksheet(contextMenu.worksheetId);
                            setContextMenu(null);
                        }}
                    >
                        Delete worksheet
                    </button>
                    <div className="worksheet-tab-menu-divider" />
                    <button
                        type="button"
                        className="worksheet-tab-menu-item"
                        role="menuitem"
                        disabled={isSaving}
                        onClick={() => handleSaveToFile(contextMenu.worksheetId)}
                        title="Save worksheet to encrypted file"
                    >
                        {isSaving ? 'Saving...' : 'Save to file'}
                    </button>
                    <button
                        type="button"
                        className="worksheet-tab-menu-item"
                        role="menuitem"
                        disabled={isLoading}
                        onClick={() => handleLoadFromFile(contextMenu.worksheetId)}
                        title="Load worksheet from encrypted file"
                    >
                        {isLoading ? 'Loading...' : 'Load from file'}
                    </button>
                </div>
            )}

            <div className="worksheet-tab-active-hint" aria-hidden="true">
                {activeIndex + 1}/{worksheets.length}
            </div>
        </div>
    );
}
