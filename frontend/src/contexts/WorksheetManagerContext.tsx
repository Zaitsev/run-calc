import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { WorksheetSnapshot } from '../types/app';
import {
    WORKSHEETS_LIST_STORAGE_KEY,
    WORKSHEETS_ACTIVE_ID_STORAGE_KEY,
    WORKSHEET_CONTENT_STORAGE_KEY,
    LAST_RESULT_STORAGE_KEY,
    MARKED_LINES_STORAGE_KEY,
    VARIABLE_VALUES_STORAGE_KEY,
} from '../constants';

type WorksheetManagerContextValue = {
    worksheets: WorksheetSnapshot[];
    activeId: string;
    createWorksheet: (name?: string) => void;
    deleteWorksheet: (id: string) => void;
    renameWorksheet: (id: string, name: string) => void;
    switchWorksheet: (id: string) => void;
    lockWorksheet: (id: string, passwordHash: string) => void;
    lockProtectedWorksheets: () => void;
    unlockWorksheet: (id: string) => void;
    updateWorksheet: (id: string, updates: Partial<Omit<WorksheetSnapshot, 'id' | 'name'>>) => void;
    updateActiveWorksheet: (updates: Partial<Omit<WorksheetSnapshot, 'id' | 'name'>>) => void;
};

const WorksheetManagerContext = createContext<WorksheetManagerContextValue | null>(null);

function generateWorksheetId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getDefaultWorksheetName(index: number): string {
    return `Worksheet ${index + 1}`;
}

function migrateFromLegacyStorage(): WorksheetSnapshot | null {
    const legacyContent = localStorage.getItem(WORKSHEET_CONTENT_STORAGE_KEY);
    if (!legacyContent && !localStorage.getItem(MARKED_LINES_STORAGE_KEY) && !localStorage.getItem(VARIABLE_VALUES_STORAGE_KEY)) {
        return null; // No legacy data to migrate
    }

    const lastResultRaw = localStorage.getItem(LAST_RESULT_STORAGE_KEY);
    const lastResult = lastResultRaw ? (Number.isFinite(Number(lastResultRaw)) ? Number(lastResultRaw) : null) : null;

    const markedLinesRaw = localStorage.getItem(MARKED_LINES_STORAGE_KEY);
    let markedLines: number[] = [];
    if (markedLinesRaw) {
        try {
            const arr: unknown = JSON.parse(markedLinesRaw);
            if (Array.isArray(arr)) markedLines = arr.filter((n): n is number => typeof n === 'number');
        } catch { /* ignore */ }
    }

    const variableValuesRaw = localStorage.getItem(VARIABLE_VALUES_STORAGE_KEY);
    let variableValues: Record<string, unknown> = {};
    if (variableValuesRaw) {
        try {
            const obj = JSON.parse(variableValuesRaw);
            if (typeof obj === 'object' && obj !== null) variableValues = obj as Record<string, unknown>;
        } catch { /* ignore */ }
    }

    // Create a default worksheet from legacy data
    const worksheet: WorksheetSnapshot = {
        id: generateWorksheetId(),
        name: getDefaultWorksheetName(0),
        content: legacyContent ?? '',
        lastResult,
        markedLines,
        variableValues,
        isLocked: false,
        lockPasswordHash: undefined,
    };

    // Clear legacy storage keys
    localStorage.removeItem(WORKSHEET_CONTENT_STORAGE_KEY);
    localStorage.removeItem(LAST_RESULT_STORAGE_KEY);
    localStorage.removeItem(MARKED_LINES_STORAGE_KEY);
    localStorage.removeItem(VARIABLE_VALUES_STORAGE_KEY);

    return worksheet;
}

function loadWorksheets(): { worksheets: WorksheetSnapshot[]; activeId: string } {
    const listRaw = localStorage.getItem(WORKSHEETS_LIST_STORAGE_KEY);
    const activeIdRaw = localStorage.getItem(WORKSHEETS_ACTIVE_ID_STORAGE_KEY);

    let worksheets: WorksheetSnapshot[] = [];
    let activeId: string = '';

    // Try to load from new storage
    if (listRaw) {
        try {
            const parsed: unknown = JSON.parse(listRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                worksheets = parsed.filter((w): w is WorksheetSnapshot => {
                    return typeof w === 'object' && w !== null &&
                        typeof (w as any).id === 'string' &&
                        typeof (w as any).name === 'string' &&
                        typeof (w as any).content === 'string' &&
                        ((w as any).lastResult === null || typeof (w as any).lastResult === 'number') &&
                        Array.isArray((w as any).markedLines) &&
                        typeof (w as any).variableValues === 'object';
                }).map((w) => ({
                    ...w,
                    isLocked: typeof (w as any).isLocked === 'boolean' ? (w as any).isLocked : false,
                    lockPasswordHash: typeof (w as any).lockPasswordHash === 'string' ? (w as any).lockPasswordHash : undefined,
                }));
            }
        } catch { /* ignore */ }
    }

    // Migrate from legacy if new storage is empty
    if (worksheets.length === 0) {
        const migrated = migrateFromLegacyStorage();
        if (migrated) worksheets = [migrated];
    }

    // Ensure at least one worksheet
    if (worksheets.length === 0) {
        worksheets = [{
            id: generateWorksheetId(),
            name: getDefaultWorksheetName(0),
            content: '',
            lastResult: null,
            markedLines: [],
            variableValues: {},
            isLocked: false,
            lockPasswordHash: undefined,
        }];
    }

    // Restore active ID or default to first
    if (activeIdRaw && worksheets.some(w => w.id === activeIdRaw)) {
        activeId = activeIdRaw;
    } else {
        activeId = worksheets[0].id;
    }

    return { worksheets, activeId };
}

export function WorksheetManagerProvider({ children }: { children: ReactNode }) {
    // Use lazy initialization to load from localStorage synchronously
    const { worksheets: initialWorksheets, activeId: initialActiveId } = loadWorksheets();
    
    const [worksheets, setWorksheets] = useState<WorksheetSnapshot[]>(initialWorksheets);
    const [activeId, setActiveId] = useState<string>(initialActiveId);
    const persistTimerRef = useRef<number | null>(null);

    // Persist worksheets to localStorage (debounced)
    useEffect(() => {
        if (persistTimerRef.current !== null) {
            window.clearTimeout(persistTimerRef.current);
        }

        persistTimerRef.current = window.setTimeout(() => {
            localStorage.setItem(WORKSHEETS_LIST_STORAGE_KEY, JSON.stringify(worksheets));
        }, 400);

        return () => {
            if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
        };
    }, [worksheets]);

    // Persist active ID to localStorage
    useEffect(() => {
        if (activeId) localStorage.setItem(WORKSHEETS_ACTIVE_ID_STORAGE_KEY, activeId);
    }, [activeId]);

    const createWorksheet = useCallback((name?: string) => {
        const newId = generateWorksheetId();
        setWorksheets((prev) => {
            const newWorksheet: WorksheetSnapshot = {
                id: newId,
                name: name ?? getDefaultWorksheetName(prev.length),
                content: '',
                lastResult: null,
                markedLines: [],
                variableValues: {},
                isLocked: false,
                lockPasswordHash: undefined,
            };
            return [...prev, newWorksheet];
        });
        setActiveId(newId);
    }, []);

    const deleteWorksheet = (id: string) => {
        // Guard: do not allow deleting if it's the last worksheet
        if (worksheets.length <= 1) return;
        
        setWorksheets(prev => prev.filter(w => w.id !== id));
        
        // If the deleted worksheet was active, switch to the first remaining
        if (activeId === id) {
            setActiveId(worksheets.find(w => w.id !== id)?.id ?? '');
        }
    };

    const renameWorksheet = (id: string, name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) return; // Ignore empty names

        setWorksheets(prev =>
            prev.map(w => w.id === id ? { ...w, name: trimmedName } : w)
        );
    };

    const switchWorksheet = (id: string) => {
        if (worksheets.some(w => w.id === id)) {
            setActiveId(id);
        }
    };

    const lockWorksheet = (id: string, passwordHash: string) => {
        if (!passwordHash.trim()) return;
        setWorksheets(prev =>
            prev.map((w) => w.id === id ? { ...w, isLocked: true, lockPasswordHash: passwordHash } : w)
        );
    };

    const lockProtectedWorksheets = () => {
        setWorksheets((prev) =>
            prev.map((w) => {
                if (!w.lockPasswordHash || w.isLocked) {
                    return w;
                }
                return { ...w, isLocked: true };
            })
        );
    };

    const unlockWorksheet = (id: string) => {
        setWorksheets(prev =>
            prev.map((w) => w.id === id ? { ...w, isLocked: false } : w)
        );
    };

    const updateWorksheet = useCallback((id: string, updates: Partial<Omit<WorksheetSnapshot, 'id' | 'name'>>) => {
        setWorksheets(prev =>
            prev.map(w =>
                w.id === id
                    ? {
                        ...w,
                        ...updates,
                    }
                    : w
            )
        );
    }, []);

    const updateActiveWorksheet = useCallback((updates: Partial<Omit<WorksheetSnapshot, 'id' | 'name'>>) => {
        updateWorksheet(activeId, updates);
    }, [activeId, updateWorksheet]);

    const contextValue = useMemo(() => ({
        worksheets,
        activeId,
        createWorksheet,
        deleteWorksheet,
        renameWorksheet,
        switchWorksheet,
        lockWorksheet,
        lockProtectedWorksheets,
        unlockWorksheet,
        updateWorksheet,
        updateActiveWorksheet,
    }), [worksheets, activeId, createWorksheet, updateWorksheet, updateActiveWorksheet]);

    return (
        <WorksheetManagerContext.Provider value={contextValue}>
            {children}
        </WorksheetManagerContext.Provider>
    );
}

export function useWorksheetManager(): WorksheetManagerContextValue {
    const ctx = useContext(WorksheetManagerContext);
    if (!ctx) throw new Error('useWorksheetManager must be used inside WorksheetManagerProvider');
    return ctx;
}
