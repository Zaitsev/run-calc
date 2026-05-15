const PASSWORD_KDF_ALGORITHM = 'pbkdf2-sha256';
const PASSWORD_KDF_ITERATIONS = 310000;
const PASSWORD_KDF_SALT_BYTES = 16;
const PASSWORD_KDF_LENGTH_BITS = 256;

function toBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function getCrypto(): Crypto {
    if (!window.crypto?.subtle || !window.crypto.getRandomValues) {
        throw new Error('Secure password hashing is unavailable in this environment.');
    }
    return window.crypto;
}

async function derivePasswordKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    const cryptoApi = getCrypto();
    const encoded = new TextEncoder().encode(password);
    const saltBytes = Uint8Array.from(salt);
    const importedKey = await cryptoApi.subtle.importKey(
        'raw',
        encoded,
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const derivedBits = await cryptoApi.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations,
            hash: 'SHA-256',
        },
        importedKey,
        PASSWORD_KDF_LENGTH_BITS,
    );
    return new Uint8Array(derivedBits);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.length !== right.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < left.length; i++) {
        diff |= left[i] ^ right[i];
    }
    return diff === 0;
}

export async function hashWorksheetPassword(password: string): Promise<string> {
    const cryptoApi = getCrypto();
    const salt = cryptoApi.getRandomValues(new Uint8Array(PASSWORD_KDF_SALT_BYTES));
    const derivedKey = await derivePasswordKey(password, salt, PASSWORD_KDF_ITERATIONS);
    return `${PASSWORD_KDF_ALGORITHM}$${PASSWORD_KDF_ITERATIONS}$${toBase64(salt)}$${toBase64(derivedKey)}`;
}

async function verifyLegacyWorksheetPassword(password: string, storedHash: string): Promise<boolean> {
    const encoded = new TextEncoder().encode(password);
    const digest = await getCrypto().subtle.digest('SHA-256', encoded);
    return toBase64(new Uint8Array(digest)) === storedHash;
}

export async function verifyWorksheetPassword(password: string, storedHash: string): Promise<boolean> {
    const [algorithm, iterationsValue, saltBase64, hashBase64] = storedHash.split('$');
    if (
        algorithm !== PASSWORD_KDF_ALGORITHM ||
        !iterationsValue ||
        !saltBase64 ||
        !hashBase64
    ) {
        return verifyLegacyWorksheetPassword(password, storedHash);
    }

    const iterations = Number(iterationsValue);
    if (!Number.isInteger(iterations) || iterations <= 0) {
        return false;
    }

    try {
        const salt = fromBase64(saltBase64);
        const expectedHash = fromBase64(hashBase64);
        const actualHash = await derivePasswordKey(password, salt, iterations);
        return timingSafeEqual(actualHash, expectedHash);
    } catch {
        return false;
    }
}
