import { useEffect, useRef, useState } from 'react';
import type { WorksheetTabPosition, WorksheetSnapshot } from '../types/app';
import { useWorksheetManager } from '../contexts';
import { usePasswordDialog } from '../hooks/usePasswordDialog';
import { hashWorksheetPassword } from '../utils/worksheetLock';
import {
    SaveWorksheetToFile,
    LoadWorksheetFromFile,
    ExportWorksheetPlaintextToFile,
    SelectWorksheetEncryptedSavePath,
    SelectWorksheetPlaintextExportPath,
    SelectWorksheetLoadPath,
} from '../../wailsjs/go/main/App';

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
        lockWorksheet,
        unlockWorksheet,
        updateActiveWorksheet,
    } = useWorksheetManager();

    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const contextMenuRef = useRef<HTMLDivElement | null>(null);
    const { requestPassword, dialog: passwordDialog } = usePasswordDialog();

    const contextMenuOffsetX = 2;
    const contextMenuOffsetY = placement === 'bottom' ? -8 : 2;

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

    useEffect(() => {
        if (!contextMenu || !contextMenuRef.current) return;

        const margin = 8;
        const rect = contextMenuRef.current.getBoundingClientRect();
        let nextX = contextMenu.x;
        let nextY = contextMenu.y;

        if (rect.right > window.innerWidth - margin) {
            nextX = Math.max(margin, contextMenu.x - (rect.right - (window.innerWidth - margin)));
        }
        if (rect.bottom > window.innerHeight - margin) {
            nextY = Math.max(margin, contextMenu.y - (rect.bottom - (window.innerHeight - margin)));
        }
        if (rect.left < margin) {
            nextX = margin;
        }
        if (rect.top < margin) {
            nextY = margin;
        }

        if (nextX !== contextMenu.x || nextY !== contextMenu.y) {
            setContextMenu((prev) => {
                if (!prev) return prev;
                return { ...prev, x: nextX, y: nextY };
            });
        }
    }, [contextMenu]);

    const canDeleteWorksheet = worksheets.length > 1;
    const contextMenuWorksheet = contextMenu
        ? worksheets.find((w) => w.id === contextMenu.worksheetId) ?? null
        : null;

    const verifyPassword = async (storedHash: string, promptMessage: string): Promise<boolean> => {
        const password = await requestPassword({
            title: 'Password required',
            message: promptMessage,
            mode: 'single',
            confirmLabel: 'Continue',
        });
        if (!password) {
            return false;
        }
        const inputHash = await hashWorksheetPassword(password);
        return inputHash === storedHash;
    };

    const verifyForLockedWorksheetIfNeeded = async (worksheet: WorksheetSnapshot, promptMessage: string): Promise<boolean> => {
        if (!worksheet.isLocked || !worksheet.lockPasswordHash) {
            return true;
        }
        const isValid = await verifyPassword(worksheet.lockPasswordHash, promptMessage);
        if (!isValid) {
            alert('Incorrect password. Operation canceled.');
            return false;
        }
        return true;
    };

    const startRename = (worksheetId: string, currentName: string) => {
        setRenamingId(worksheetId);
        setRenameValue(currentName);
    };

    const commitRename = (worksheetId: string) => {
        renameWorksheet(worksheetId, renameValue);
        setRenamingId(null);
        setRenameValue('');
    };

    const handleExportPlainText = async (worksheetId: string) => {
        const worksheet = worksheets.find((w) => w.id === worksheetId);
        if (!worksheet) return;

        setIsExporting(true);
        try {
            const payload = {
                content: worksheet.content,
                lastResult: worksheet.lastResult ?? null,
                markedLines: worksheet.markedLines,
                variableValues: worksheet.variableValues,
                isLocked: worksheet.isLocked,
                lockPasswordHash: worksheet.lockPasswordHash,
            };

            const canProceed = await verifyForLockedWorksheetIfNeeded(
                worksheet,
                `Enter password to export locked worksheet "${worksheet.name}":`
            );
            if (!canProceed) {
                setIsExporting(false);
                return;
            }

            const defaultFileName = `${worksheet.name.replace(/\s+/g, '_')}.rcalc.json`;
            const filePath = await SelectWorksheetPlaintextExportPath(defaultFileName);

            if (!filePath) {
                setIsExporting(false);
                return;
            }

            const result = await ExportWorksheetPlaintextToFile(
                JSON.stringify(payload),
                filePath
            );

            if (result.ok) {
                alert(`Plaintext worksheet exported to: ${result.filePath}`);
            } else {
                alert(`Failed to export plaintext worksheet: ${result.error}`);
            }
        } catch (error) {
            alert(`Error exporting plaintext worksheet: ${error}`);
        } finally {
            setIsExporting(false);
            setContextMenu(null);
        }
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
                isLocked: worksheet.isLocked,
                lockPasswordHash: worksheet.lockPasswordHash,
            };

            const canProceed = await verifyForLockedWorksheetIfNeeded(
                worksheet,
                `Enter password to save locked worksheet "${worksheet.name}":`
            );
            if (!canProceed) {
                setIsSaving(false);
                return;
            }

            const defaultFileName = `${worksheet.name.replace(/\s+/g, '_')}.rcalc`;
            const filePath = await SelectWorksheetEncryptedSavePath(defaultFileName);

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
            const filePath = await SelectWorksheetLoadPath();

            if (!filePath) {
                setIsLoading(false);
                return; // User cancelled
            }

            const result = await LoadWorksheetFromFile(filePath);

            if (result.ok && result.payload) {
                if (result.payload.isLocked && result.payload.lockPasswordHash) {
                    const isValid = await verifyPassword(
                        result.payload.lockPasswordHash,
                        'This file contains a locked worksheet. Enter password to load:'
                    );
                    if (!isValid) {
                        alert('Incorrect password. File was not loaded.');
                        return;
                    }
                }

                // Update the active worksheet with loaded data
                updateActiveWorksheet({
                    content: result.payload.content,
                    lastResult: result.payload.lastResult,
                    markedLines: result.payload.markedLines,
                    variableValues: result.payload.variableValues,
                    isLocked: !!result.payload.isLocked,
                    lockPasswordHash: result.payload.lockPasswordHash,
                });

                // Auto-rename tab from the loaded file name
                const fileNameWithExt = filePath.split(/[\\/]/).pop() ?? filePath;
                const loadedName = fileNameWithExt.replace(/\.(rcalc|json)$/i, '').trim();
                if (loadedName) {
                    renameWorksheet(worksheetId, loadedName);
                }
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

    const handleLockWorksheet = async (worksheetId: string) => {
        const worksheet = worksheets.find((w) => w.id === worksheetId);
        if (!worksheet || worksheet.isLocked) return;

        if (worksheet.lockPasswordHash) {
            lockWorksheet(worksheetId, worksheet.lockPasswordHash);
            setContextMenu(null);
            return;
        }

        const password = await requestPassword({
            title: 'Lock worksheet',
            message: `Set a password for worksheet "${worksheet.name}".`,
            mode: 'create',
            confirmLabel: 'Lock',
        });
        if (!password) return;

        const passwordHash = await hashWorksheetPassword(password);
        lockWorksheet(worksheetId, passwordHash);
        setContextMenu(null);
    };

    const handleUnlockWorksheet = async (worksheetId: string) => {
        const worksheet = worksheets.find((w) => w.id === worksheetId);
        if (!worksheet?.isLocked || !worksheet.lockPasswordHash) return;

        const isValid = await verifyPassword(worksheet.lockPasswordHash, `Enter password to unlock "${worksheet.name}":`);
        if (!isValid) {
            alert('Incorrect password.');
            return;
        }

        unlockWorksheet(worksheetId);
        setContextMenu(null);
    };

    return (
        <>
            {passwordDialog}
            <div className={`worksheet-tabs worksheet-tabs--${placement}`} aria-label="Worksheets" role="tablist">
                <div className="worksheet-tabs-list">
                {worksheets.map((worksheet) => {
                    const isActive = worksheet.id === activeId;
                    const isRenaming = worksheet.id === renamingId;
                    const hasLockEnhancement = !!worksheet.lockPasswordHash;
                    const lockIcon = worksheet.isLocked ? '🔒' : hasLockEnhancement ? '🔓' : null;
                    const lockLabel = worksheet.isLocked ? 'Locked worksheet' : 'Unlocked protected worksheet';
                    return (
                        <div
                            key={worksheet.id}
                            className={`worksheet-tab${isActive ? ' worksheet-tab--active' : ''}${isRenaming ? ' worksheet-tab--renaming' : ''}`}
                            role="tab"
                            aria-selected={isActive}
                            title={worksheet.name}
                            tabIndex={0}
                            onClick={() => switchWorksheet(worksheet.id)}
                            onMouseDown={(event) => {
                                if (event.button !== 1) return; // middle click
                                event.preventDefault();
                                event.stopPropagation();
                                if (worksheet.isLocked) return;
                                if (!canDeleteWorksheet) return;
                                deleteWorksheet(worksheet.id);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    switchWorksheet(worksheet.id);
                                }
                            }}
                            onDoubleClick={() => {
                                if (worksheet.isLocked) return;
                                startRename(worksheet.id, worksheet.name);
                            }}
                            onContextMenu={(event) => {
                                event.preventDefault();
                                setContextMenu({
                                    x: event.clientX + contextMenuOffsetX,
                                    y: event.clientY + contextMenuOffsetY,
                                    worksheetId: worksheet.id,
                                });
                            }}
                        >
                            {lockIcon && <span className="worksheet-tab-lock" aria-label={lockLabel}>{lockIcon}</span>}
                            {isRenaming ? (
                                <input
                                    className="worksheet-tab-rename"
                                    value={renameValue}
                                    onChange={(event) => setRenameValue(event.target.value)}
                                    onBlur={() => commitRename(worksheet.id)}
                                    onFocus={(event) => event.currentTarget.select()}
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
                                        if (worksheet.isLocked) return;
                                        deleteWorksheet(worksheet.id);
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    );
                })}
                <button
                    type="button"
                    className="worksheet-tabs-add"
                    onClick={() => createWorksheet()}
                    title="Add worksheet"
                    aria-label="Add worksheet"
                >
                    +
                </button>
                </div>

                {contextMenu && (
                    <div
                        ref={contextMenuRef}
                        className="worksheet-tab-menu"
                        role="menu"
                        style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
                    >
                    <button
                        type="button"
                        className="worksheet-tab-menu-item"
                        role="menuitem"
                        disabled={!contextMenuWorksheet || contextMenuWorksheet.isLocked}
                        onClick={() => {
                            const ws = contextMenuWorksheet;
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
                            if (!contextMenuWorksheet) return;
                            if (contextMenuWorksheet.isLocked) {
                                void handleUnlockWorksheet(contextMenuWorksheet.id);
                            } else {
                                void handleLockWorksheet(contextMenuWorksheet.id);
                            }
                        }}
                    >
                        {contextMenuWorksheet?.isLocked ? 'Unlock worksheet' : 'Lock worksheet'}
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
                        disabled={!canDeleteWorksheet || !contextMenuWorksheet || contextMenuWorksheet.isLocked}
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
                        disabled={isSaving || isExporting || isLoading}
                        onClick={() => handleSaveToFile(contextMenu.worksheetId)}
                        title="Save worksheet to encrypted file"
                    >
                        {isSaving ? 'Saving...' : 'Save to file'}
                    </button>
                    <button
                        type="button"
                        className="worksheet-tab-menu-item"
                        role="menuitem"
                        disabled={isSaving || isExporting || isLoading}
                        onClick={() => handleExportPlainText(contextMenu.worksheetId)}
                        title="Export worksheet as plaintext JSON"
                    >
                        {isExporting ? 'Exporting...' : 'Export plain text'}
                    </button>
                    <button
                        type="button"
                        className="worksheet-tab-menu-item"
                        role="menuitem"
                        disabled={isSaving || isExporting || isLoading}
                        onClick={() => handleLoadFromFile(contextMenu.worksheetId)}
                        title="Load worksheet from encrypted file"
                    >
                        {isLoading ? 'Loading...' : 'Load from file'}
                    </button>
                    </div>
                )}

            </div>
        </>
    );
}
