import { afterEach, describe, expect, it } from 'vitest';
import { hashWorksheetPassword, verifyWorksheetPassword } from './worksheetLock';

const originalWindow = globalThis.window;

function toBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary);
}

describe('worksheetLock', () => {
    afterEach(() => {
        Object.defineProperty(globalThis, 'window', {
            value: originalWindow,
            configurable: true,
            writable: true,
        });
    });

    it('creates a salted PBKDF2 hash that verifies successfully', async () => {
        Object.defineProperty(globalThis, 'window', {
            value: { crypto: globalThis.crypto },
            configurable: true,
            writable: true,
        });

        const hash = await hashWorksheetPassword('correct horse battery staple');

        expect(hash.startsWith('pbkdf2-sha256$310000$')).toBe(true);
        expect(await verifyWorksheetPassword('correct horse battery staple', hash)).toBe(true);
        expect(await verifyWorksheetPassword('wrong password', hash)).toBe(false);
    });

    it('supports legacy SHA-256 worksheet hashes for existing stored worksheets', async () => {
        Object.defineProperty(globalThis, 'window', {
            value: { crypto: globalThis.crypto },
            configurable: true,
            writable: true,
        });

        const digest = await globalThis.crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode('legacy password'),
        );
        const legacyHash = toBase64(new Uint8Array(digest));

        expect(await verifyWorksheetPassword('legacy password', legacyHash)).toBe(true);
        expect(await verifyWorksheetPassword('not it', legacyHash)).toBe(false);
    });
});
