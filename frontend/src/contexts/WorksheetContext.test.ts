import { describe, expect, it } from 'vitest';
import { shouldResetSessionEvaluationMetadata } from './WorksheetContext';
import type { WorksheetSnapshot } from '../types/app';

function createWorksheet(overrides: Partial<WorksheetSnapshot> = {}): WorksheetSnapshot {
    return {
        id: 'ws-1',
        name: 'Worksheet',
        content: 'a = 1 = 1',
        lastResult: 1,
        markedLines: [0],
        variableValues: { a: 1 },
        isLocked: false,
        ...overrides,
    };
}

describe('shouldResetSessionEvaluationMetadata', () => {
    it('resets metadata when switching to a different worksheet', () => {
        expect(shouldResetSessionEvaluationMetadata({
            activeWorksheet: createWorksheet({ id: 'ws-2' }),
            syncedWorksheetId: 'ws-1',
            hasPendingContentSync: false,
            content: 'a = 1 = 1',
            lastResult: 1,
            markedLines: new Set([0]),
            variableValues: { a: 1 },
        })).toBe(true);
    });

    it('preserves metadata for the provider’s own persisted updates', () => {
        expect(shouldResetSessionEvaluationMetadata({
            activeWorksheet: createWorksheet(),
            syncedWorksheetId: 'ws-1',
            hasPendingContentSync: false,
            content: 'a = 1 = 1',
            lastResult: 1,
            markedLines: new Set([0]),
            variableValues: { a: 1 },
        })).toBe(false);
    });

    it('resets metadata when the active worksheet is externally replaced in place', () => {
        expect(shouldResetSessionEvaluationMetadata({
            activeWorksheet: createWorksheet({
                content: 'price = 5 = 5',
                lastResult: 5,
                markedLines: [2],
                variableValues: { price: 5 },
            }),
            syncedWorksheetId: 'ws-1',
            hasPendingContentSync: false,
            content: 'a = 1 = 1',
            lastResult: 1,
            markedLines: new Set([0]),
            variableValues: { a: 1 },
        })).toBe(true);
    });

    it('does not reset metadata while a local content sync is still pending', () => {
        expect(shouldResetSessionEvaluationMetadata({
            activeWorksheet: createWorksheet({ content: 'a = 2 = 2' }),
            syncedWorksheetId: 'ws-1',
            hasPendingContentSync: true,
            content: 'a = 1 = 1',
            lastResult: 1,
            markedLines: new Set([0]),
            variableValues: { a: 1 },
        })).toBe(false);
    });
});
