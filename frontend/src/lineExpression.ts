const ERROR_SUFFIX = ' = error';

export function stripErrorSuffix(lineText: string): string {
    if (!lineText.endsWith(ERROR_SUFFIX)) {
        return lineText;
    }

    return lineText.slice(0, -ERROR_SUFFIX.length);
}

export function getExpressionSource(lineText: string): string {
    const withoutError = stripErrorSuffix(lineText);

    const declarationMatch = withoutError.match(/^(\s*@?[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*)(.+)$/);
    if (declarationMatch) {
        const declarationPrefix = declarationMatch[1];
        const declarationRhs = declarationMatch[2].trimEnd();

        if (declarationRhs.startsWith('`')) {
            const closingTick = declarationRhs.lastIndexOf('`');
            if (closingTick > 0) {
                const afterTick = declarationRhs.slice(closingTick + 1);
                if (afterTick.startsWith(' = ')) {
                    return `${declarationPrefix}${declarationRhs.slice(0, closingTick + 1)}`.trimEnd();
                }
            }

            return `${declarationPrefix}${declarationRhs}`.trimEnd();
        }

        const rhsResultIndex = declarationRhs.lastIndexOf(' = ');
        if (rhsResultIndex !== -1) {
            return `${declarationPrefix}${declarationRhs.slice(0, rhsResultIndex)}`.trimEnd();
        }

        return `${declarationPrefix}${declarationRhs}`.trimEnd();
    }

    const lastEqualsIndex = withoutError.lastIndexOf(' = ');
    if (lastEqualsIndex !== -1) {
        const declarationCandidate = withoutError.slice(0, lastEqualsIndex).trimEnd();
        if (/^\s*@?[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*.+$/.test(declarationCandidate)) {
            return declarationCandidate;
        }
    }

    const equalsIndex = withoutError.indexOf(' = ');
    if (equalsIndex === -1) {
        return withoutError;
    }

    return withoutError.slice(0, equalsIndex).trimEnd();
}
