import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type StatusContextValue = {
    statusText: string;
    setStatusText: (text: string) => void;
    isStatusError: boolean;
    setIsStatusError: (v: boolean) => void;
    devError: string;
    setDevError: (v: string) => void;
    setStatus: (text: string, isError: boolean, devMsg?: string) => void;
    clearStatus: () => void;
};

const StatusContext = createContext<StatusContextValue | null>(null);

export function StatusProvider({ children }: { children: ReactNode }) {
    const [statusText, setStatusText] = useState('Ready');
    const [isStatusError, setIsStatusError] = useState(false);
    const [devError, setDevError] = useState('');

    const setStatus = (text: string, isError: boolean, devMsg = '') => {
        setStatusText(text);
        setIsStatusError(isError);
        setDevError(devMsg);
    };

    const clearStatus = () => {
        setStatusText('Ready');
        setIsStatusError(false);
        setDevError('');
    };

    return (
        <StatusContext.Provider value={{ statusText, setStatusText, isStatusError, setIsStatusError, devError, setDevError, setStatus, clearStatus }}>
            {children}
        </StatusContext.Provider>
    );
}

export function useStatus(): StatusContextValue {
    const ctx = useContext(StatusContext);
    if (!ctx) throw new Error('useStatus must be used inside StatusProvider');
    return ctx;
}
