import {describe, expect, it} from 'vitest';
import {getPrimaryShortcutAction} from './editorShortcuts';

type TestShortcutEvent = {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    code?: string;
};

function event(input: TestShortcutEvent) {
    return {
        key: input.key,
        ctrlKey: input.ctrlKey ?? false,
        metaKey: input.metaKey ?? false,
        altKey: input.altKey ?? false,
        code: input.code,
    };
}

describe('getPrimaryShortcutAction', () => {
    it('matches insert line below shortcut', () => {
        expect(getPrimaryShortcutAction(event({key: 'Enter', ctrlKey: true}))).toBe('insert-line-below');
        expect(getPrimaryShortcutAction(event({key: 'Enter', metaKey: true, code: 'NumpadEnter'}))).toBe('insert-line-below');
    });

    it('matches mark toggle shortcut', () => {
        expect(getPrimaryShortcutAction(event({key: 'm', ctrlKey: true}))).toBe('toggle-mark-line');
        expect(getPrimaryShortcutAction(event({key: 'M', metaKey: true}))).toBe('toggle-mark-line');
    });

    it('matches increase font size shortcuts', () => {
        expect(getPrimaryShortcutAction(event({key: '=', ctrlKey: true}))).toBe('increase-font-size');
        expect(getPrimaryShortcutAction(event({key: '+', ctrlKey: true}))).toBe('increase-font-size');
        expect(getPrimaryShortcutAction(event({key: 'Add', ctrlKey: true, code: 'NumpadAdd'}))).toBe('increase-font-size');
    });

    it('matches decrease font size shortcuts', () => {
        expect(getPrimaryShortcutAction(event({key: '-', ctrlKey: true}))).toBe('decrease-font-size');
        expect(getPrimaryShortcutAction(event({key: '_', ctrlKey: true}))).toBe('decrease-font-size');
        expect(getPrimaryShortcutAction(event({key: 'Subtract', ctrlKey: true, code: 'NumpadSubtract'}))).toBe('decrease-font-size');
    });

    it('matches reset font size shortcuts', () => {
        expect(getPrimaryShortcutAction(event({key: '0', ctrlKey: true}))).toBe('reset-font-size');
        expect(getPrimaryShortcutAction(event({key: '0', metaKey: true, code: 'Numpad0'}))).toBe('reset-font-size');
    });

    it('does not map Ctrl/Cmd + letter to a shortcut', () => {
        expect(getPrimaryShortcutAction(event({key: 'a', ctrlKey: true}))).toBeNull();
        expect(getPrimaryShortcutAction(event({key: 'Z', metaKey: true}))).toBeNull();
    });

    it('ignores combinations without primary modifier or with Alt', () => {
        expect(getPrimaryShortcutAction(event({key: 'a'}))).toBeNull();
        expect(getPrimaryShortcutAction(event({key: 'a', ctrlKey: true, altKey: true}))).toBeNull();
        expect(getPrimaryShortcutAction(event({key: '0', altKey: true}))).toBeNull();
    });
});
