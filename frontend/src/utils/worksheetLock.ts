function toBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary);
}

export async function hashWorksheetPassword(password: string): Promise<string> {
    if (!window.crypto?.subtle) {
        return password;
    }

    const encoded = new TextEncoder().encode(password);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return toBase64(new Uint8Array(digest));
}
