import { useMemo, useRef, useState } from 'react';
import { PasswordDialog, type PasswordDialogMode } from '../components/PasswordDialog';

type PasswordDialogRequest = {
    title: string;
    message: string;
    mode: PasswordDialogMode;
    confirmLabel?: string;
};

type PasswordDialogState = PasswordDialogRequest & {
    open: boolean;
};

const CLOSED_STATE: PasswordDialogState = {
    open: false,
    title: '',
    message: '',
    mode: 'single',
    confirmLabel: 'Continue',
};

export function usePasswordDialog() {
    const resolverRef = useRef<((value: string | null) => void) | null>(null);
    const [dialogState, setDialogState] = useState<PasswordDialogState>(CLOSED_STATE);

    const closeDialog = (value: string | null) => {
        const resolver = resolverRef.current;
        resolverRef.current = null;
        setDialogState(CLOSED_STATE);
        resolver?.(value);
    };

    const requestPassword = (request: PasswordDialogRequest): Promise<string | null> => {
        if (resolverRef.current) {
            resolverRef.current(null);
        }

        setDialogState({
            open: true,
            title: request.title,
            message: request.message,
            mode: request.mode,
            confirmLabel: request.confirmLabel ?? 'Continue',
        });

        return new Promise((resolve) => {
            resolverRef.current = resolve;
        });
    };

    const dialog = useMemo(() => (
        <PasswordDialog
            open={dialogState.open}
            title={dialogState.title}
            message={dialogState.message}
            mode={dialogState.mode}
            confirmLabel={dialogState.confirmLabel}
            onCancel={() => closeDialog(null)}
            onSubmit={(password) => closeDialog(password)}
        />
    ), [dialogState]);

    return {
        requestPassword,
        dialog,
    };
}
