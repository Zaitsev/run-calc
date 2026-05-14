import { useEffect, useMemo, useState } from 'react';
import type { WorksheetTabPosition } from '../types/app';
import { useWorksheetManager } from '../contexts';

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
    } = useWorksheetManager();

    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

    useEffect(() => {
        if (!contextMenu) return;
        const closeMenu = () => setContextMenu(null);
        window.addEventListener('click', closeMenu);
        window.addEventListener('contextmenu', closeMenu);
        return () => {
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

    return (
        <div className={`worksheet-tabs worksheet-tabs--${placement}`} aria-label="Worksheets" role="tablist">
            <button
                type="button"
                className="worksheet-tabs-add"
                onClick={() => createWorksheet()}
                title="Add worksheet"
                aria-label="Add worksheet"
            >
                +
            </button>
            <div className="worksheet-tabs-list">
                {worksheets.map((worksheet) => {
                    const isActive = worksheet.id === activeId;
                    const isRenaming = worksheet.id === renamingId;
                    return (
                        <div
                            key={worksheet.id}
                            className={`worksheet-tab${isActive ? ' worksheet-tab--active' : ''}`}
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
                        </div>
                    );
                })}
            </div>

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
                </div>
            )}

            <div className="worksheet-tab-active-hint" aria-hidden="true">
                {activeIndex + 1}/{worksheets.length}
            </div>
        </div>
    );
}
