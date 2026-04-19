export type PrimaryShortcutAction =
    | 'insert-line-below'
    | 'toggle-mark-line'
    | 'increase-font-size'
    | 'decrease-font-size'
    | 'reset-font-size';

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

    if (event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter') {
        return 'insert-line-below';
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

    return null;
}
