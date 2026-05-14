import { useEffect, useRef, useState } from 'react';

export type PasswordDialogMode = 'single' | 'create';

export type PasswordDialogProps = {
    open: boolean;
    title: string;
    message: string;
    mode: PasswordDialogMode;
    confirmLabel?: string;
    onCancel: () => void;
    onSubmit: (password: string) => void;
};

export function PasswordDialog({
    open,
    title,
    message,
    mode,
    confirmLabel = 'Continue',
    onCancel,
    onSubmit,
}: PasswordDialogProps) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const passwordInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!open) {
            setPassword('');
            setConfirmPassword('');
            setError('');
            return;
        }

        const timerId = window.setTimeout(() => {
            passwordInputRef.current?.focus();
            passwordInputRef.current?.select();
        }, 0);

        return () => window.clearTimeout(timerId);
    }, [open]);

    if (!open) {
        return null;
    }

    const submit = () => {
        if (!password) {
            setError('Enter a password.');
            return;
        }

        if (mode === 'create' && confirmPassword !== password) {
            setError('Passwords do not match.');
            return;
        }

        setError('');
        onSubmit(password);
    };

    return (
        <div
            className="recalc-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-dialog-title"
            aria-describedby="password-dialog-message"
            onMouseDown={onCancel}
        >
            <div
                className="recalc-modal password-modal"
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        onCancel();
                    }
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        submit();
                    }
                }}
            >
                <h3 id="password-dialog-title">{title}</h3>
                <p id="password-dialog-message">{message}</p>
                <div className="password-modal-fields">
                    <label className="password-modal-label">
                        Password
                        <input
                            ref={passwordInputRef}
                            className="password-modal-input"
                            type="password"
                            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                            value={password}
                            onChange={(event) => {
                                setPassword(event.target.value);
                                if (error) {
                                    setError('');
                                }
                            }}
                        />
                    </label>
                    {mode === 'create' && (
                        <label className="password-modal-label">
                            Confirm password
                            <input
                                className="password-modal-input"
                                type="password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(event) => {
                                    setConfirmPassword(event.target.value);
                                    if (error) {
                                        setError('');
                                    }
                                }}
                            />
                        </label>
                    )}
                </div>
                {error && <div className="password-modal-error" role="alert">{error}</div>}
                <div className="recalc-modal-actions">
                    <button type="button" className="recalc-btn-no" onClick={onCancel}>Cancel</button>
                    <button type="button" className="recalc-btn-yes" onClick={submit}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}
