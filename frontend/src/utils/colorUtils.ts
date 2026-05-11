function parseHexColor(hexColor: string): [number, number, number] | null {
    const hex = hexColor.trim();
    if (!hex.startsWith('#')) {
        return null;
    }

    const value = hex.slice(1);
    if (value.length === 3 || value.length === 4) {
        const r = parseInt(value[0] + value[0], 16);
        const g = parseInt(value[1] + value[1], 16);
        const b = parseInt(value[2] + value[2], 16);
        return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : [r, g, b];
    }

    if (value.length === 6 || value.length === 8) {
        const r = parseInt(value.slice(0, 2), 16);
        const g = parseInt(value.slice(2, 4), 16);
        const b = parseInt(value.slice(4, 6), 16);
        return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : [r, g, b];
    }

    return null;
}

function parseRgbColor(rgbColor: string): [number, number, number] | null {
    const match = rgbColor.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) {
        return null;
    }

    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    if (![r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
        return null;
    }

    return [r, g, b];
}

export function inferCustomThemeMode(customColors?: Record<string, string>): 'light' | 'dark' {
    const bg = customColors?.['editor.background'] || customColors?.['sideBar.background'];
    if (!bg) {
        return 'dark';
    }

    const rgb = parseHexColor(bg) || parseRgbColor(bg);
    if (!rgb) {
        return 'dark';
    }

    const [r, g, b] = rgb;
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.58 ? 'light' : 'dark';
}
