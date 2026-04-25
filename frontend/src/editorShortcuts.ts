export type PrimaryShortcutAction =
    | 'insert-line-below'
    | 'toggle-mark-line'
    | 'toggle-word-wrap'
    | 'increase-font-size'
    | 'decrease-font-size'
    | 'reset-font-size';

type PrimaryShortcutModifierLike = {
    ctrlKey: boolean;
    metaKey: boolean;
};

type ShortcutKeyLike = PrimaryShortcutModifierLike & {
    key: string;
    altKey: boolean;
    code?: string;
};

type ShortcutWheelLike = PrimaryShortcutModifierLike & {
    altKey: boolean;
    deltaY: number;
};

function isPrimaryModifierPressed(event: PrimaryShortcutModifierLike): boolean {
    return event.ctrlKey || event.metaKey;
}

export function getPrimaryShortcutAction(event: ShortcutKeyLike): PrimaryShortcutAction | null {
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
        if (event.key === 'z' || event.key === 'Z' || event.code === 'KeyZ') {
            return 'toggle-word-wrap';
        }
        return null;
    }

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

export function getFontResizeDirectionFromWheel(event: ShortcutWheelLike): 1 | -1 | null {
    if (!isPrimaryModifierPressed(event) || event.altKey) {
        return null;
    }

    if (event.deltaY < 0) {
        return 1;
    }

    if (event.deltaY > 0) {
        return -1;
    }

    return null;
}
