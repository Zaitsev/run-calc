import {describe, expect, it} from 'vitest';
import {getFontResizeDirectionFromWheel, getPrimaryShortcutAction, shouldHideWindowOnDoubleEscape} from './editorShortcuts';

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

type TestEscapeEvent = TestShortcutEvent & {
    defaultPrevented?: boolean;
    shiftKey?: boolean;
};

function escapeEvent(input: TestEscapeEvent) {
    return {
        key: input.key,
        ctrlKey: input.ctrlKey ?? false,
        metaKey: input.metaKey ?? false,
        altKey: input.altKey ?? false,
        defaultPrevented: input.defaultPrevented ?? false,
        shiftKey: input.shiftKey ?? false,
        code: input.code,
    };
}

type TestWheelEvent = {
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    deltaY: number;
};

function wheelEvent(input: TestWheelEvent) {
    return {
        ctrlKey: input.ctrlKey ?? false,
        metaKey: input.metaKey ?? false,
        altKey: input.altKey ?? false,
        deltaY: input.deltaY,
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

    it('matches lock shortcut', () => {
        expect(getPrimaryShortcutAction(event({key: 'l', ctrlKey: true}))).toBe('lock-active-worksheet');
        expect(getPrimaryShortcutAction(event({key: 'L', metaKey: true, code: 'KeyL'}))).toBe('lock-active-worksheet');
    });

    it('matches word wrap shortcut', () => {
        expect(getPrimaryShortcutAction(event({key: 'z', altKey: true}))).toBe('toggle-word-wrap');
        expect(getPrimaryShortcutAction(event({key: 'Z', altKey: true, code: 'KeyZ'}))).toBe('toggle-word-wrap');
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
        expect(getPrimaryShortcutAction(event({key: 'z', ctrlKey: true, altKey: true}))).toBeNull();
    });
});

describe('getFontResizeDirectionFromWheel', () => {
    it('matches zoom in and out with Ctrl/Cmd + wheel', () => {
        expect(getFontResizeDirectionFromWheel(wheelEvent({ctrlKey: true, deltaY: -1}))).toBe(1);
        expect(getFontResizeDirectionFromWheel(wheelEvent({metaKey: true, deltaY: -10}))).toBe(1);
        expect(getFontResizeDirectionFromWheel(wheelEvent({ctrlKey: true, deltaY: 1}))).toBe(-1);
        expect(getFontResizeDirectionFromWheel(wheelEvent({metaKey: true, deltaY: 10}))).toBe(-1);
    });

    it('ignores wheel without primary modifier, with Alt, or no delta', () => {
        expect(getFontResizeDirectionFromWheel(wheelEvent({deltaY: -1}))).toBeNull();
        expect(getFontResizeDirectionFromWheel(wheelEvent({ctrlKey: true, altKey: true, deltaY: -1}))).toBeNull();
        expect(getFontResizeDirectionFromWheel(wheelEvent({metaKey: true, deltaY: 0}))).toBeNull();
    });
});

describe('shouldHideWindowOnDoubleEscape', () => {
    it('hides only on second plain Escape within threshold', () => {
        const first = shouldHideWindowOnDoubleEscape(escapeEvent({key: 'Escape'}), 0, 1000, 420);
        expect(first.shouldHideWindow).toBe(false);
        expect(first.nextLastEscapeKeyAt).toBe(1000);

        const second = shouldHideWindowOnDoubleEscape(escapeEvent({key: 'Escape'}), first.nextLastEscapeKeyAt, 1300, 420);
        expect(second.shouldHideWindow).toBe(true);
        expect(second.nextLastEscapeKeyAt).toBe(1300);
    });

    it('does not hide when outside threshold', () => {
        const result = shouldHideWindowOnDoubleEscape(escapeEvent({key: 'Escape'}), 1000, 2000, 420);
        expect(result.shouldHideWindow).toBe(false);
        expect(result.nextLastEscapeKeyAt).toBe(2000);
    });

    it('ignores modified or non-Escape keys and keeps timestamp', () => {
        expect(shouldHideWindowOnDoubleEscape(escapeEvent({key: 'Escape', defaultPrevented: true}), 1000, 1100, 420)).toEqual({
            shouldHideWindow: false,
            nextLastEscapeKeyAt: 1000,
        });
        expect(shouldHideWindowOnDoubleEscape(escapeEvent({key: 'Escape', ctrlKey: true}), 1000, 1100, 420)).toEqual({
            shouldHideWindow: false,
            nextLastEscapeKeyAt: 1000,
        });
        expect(shouldHideWindowOnDoubleEscape(escapeEvent({key: 'Escape', metaKey: true}), 1000, 1100, 420)).toEqual({
            shouldHideWindow: false,
            nextLastEscapeKeyAt: 1000,
        });
        expect(shouldHideWindowOnDoubleEscape(escapeEvent({key: 'Escape', altKey: true}), 1000, 1100, 420)).toEqual({
            shouldHideWindow: false,
            nextLastEscapeKeyAt: 1000,
        });
        expect(shouldHideWindowOnDoubleEscape(escapeEvent({key: 'Escape', shiftKey: true}), 1000, 1100, 420)).toEqual({
            shouldHideWindow: false,
            nextLastEscapeKeyAt: 1000,
        });
        expect(shouldHideWindowOnDoubleEscape(escapeEvent({key: 'Enter'}), 1000, 1100, 420)).toEqual({
            shouldHideWindow: false,
            nextLastEscapeKeyAt: 1000,
        });
    });
});
