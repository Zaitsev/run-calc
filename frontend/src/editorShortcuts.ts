export type PrimaryShortcutAction =
    | 'toggle-mark-line'
    | 'increase-font-size'
    | 'decrease-font-size'
    | 'reset-font-size'
    | 'assign-variable';

type ShortcutKeyLike = {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    code?: string;
};

function isPrimaryModifierPressed(event: ShortcutKeyLike): boolean {
    return event.ctrlKey || event.metaKey;
}

export function getPrimaryShortcutAction(event: ShortcutKeyLike): PrimaryShortcutAction | null {
    if (!isPrimaryModifierPressed(event) || event.altKey) {
        return null;
    }

    if (event.key === 'm' || event.key === 'M') {
        return 'toggle-mark-line';
    }

    if (
        event.key === '+' ||
        event.key === '=' ||
        event.key === 'Add' ||
        event.code === 'NumpadAdd'
    ) {
        return 'increase-font-size';
    }

    if (
        event.key === '-' ||
        event.key === '_' ||
        event.key === 'Subtract' ||
        event.code === 'NumpadSubtract'
    ) {
        return 'decrease-font-size';
    }

    if (event.key === '0' || event.code === 'Digit0' || event.code === 'Numpad0') {
        return 'reset-font-size';
    }

    if (event.key.length === 1 && /[a-zA-Z]/.test(event.key)) {
        return 'assign-variable';
    }

    return null;
}
