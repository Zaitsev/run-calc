export type PrecisionMode = 'auto' | 'full' | number;

export function getSystemDecimalDelimiter(): '.' | ',' {
    const parts = new Intl.NumberFormat().formatToParts(1.1);
    const decimalPart = parts.find((part) => part.type === 'decimal')?.value;
    return decimalPart === ',' ? ',' : '.';
}

export function resolveDecimalDelimiter(mode: 'dot' | 'comma' | 'system'): '.' | ',' {
    if (mode === 'dot') {
        return '.';
    }
    if (mode === 'comma') {
        return ',';
    }

    return getSystemDecimalDelimiter();
}

export function formatNumber(
    value: number,
    decimalDelimiter: '.' | ',',
    precision: PrecisionMode = 'auto',
    useScientific = false,
): string {
    const absVal = Math.abs(value);
    if (useScientific && value !== 0 && (absVal >= 1e7 || absVal < 1e-7)) {
        let expStr: string;
        if (precision === 'full') {
            expStr = value.toExponential();
        } else {
            const decPlaces = precision === 'auto' ? 10 : precision;
            const [mantissa, exponent] = value.toExponential(decPlaces).split('e');
            expStr = mantissa.replace(/\.?0+$/, '') + 'e' + exponent;
        }
        return decimalDelimiter === ',' ? expStr.replace('.', ',') : expStr;
    }

    if (Number.isInteger(value)) {
        return String(value);
    }

    let str: string;
    if (precision === 'full') {
        str = String(value);
    } else if (precision === 'auto') {
        const rounded = Number(value.toFixed(10));
        str = String(rounded);
    } else {
        str = value.toFixed(precision);
        str = str.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    }

    return decimalDelimiter === ',' ? str.replace('.', ',') : str;
}

export function getPrecisionScale(precision: PrecisionMode): number {
    if (precision === 'full') {
        return Number.POSITIVE_INFINITY;
    }
    if (precision === 'auto') {
        return 10;
    }

    return precision;
}
