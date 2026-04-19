import { splitLineComment } from './lineExpression';

type DecimalDelimiter = '.' | ',';

export function shouldSkipEvaluation(lineText: string): boolean {
    const trimmed = lineText.trim();
    const {body} = splitLineComment(lineText);
    return trimmed.length === 0 || body.trim().length === 0;
}

export function buildEvaluationExpression(
    editableLine: string,
    trimmedLine: string,
    lastResult: number | null,
    decimalDelimiter: DecimalDelimiter,
    formatNumber: (value: number, decimalDelimiter: DecimalDelimiter) => string,
): string {
    if (!trimmedLine.match(/^[+\-*/]/) || lastResult === null) {
        return editableLine;
    }

    return `${formatNumber(lastResult, decimalDelimiter)}${trimmedLine}`;
}

export function getFriendlyEvalErrorMessage(message: string): string {
    const normalized = message.toLowerCase();

    if (normalized.includes('expression is empty')) {
        return 'There is nothing to calculate on this line yet. Type an expression and press Enter.';
    }

    if (normalized.includes('result contains nan or inf')) {
        return 'This line produced an invalid number. Try values in a valid range (for example: ASIN needs -1..1, LOG needs a number above 0), then press Enter again.';
    }

    if (normalized.includes('filter predicate must return true or false')) {
        return 'FILTER needs a yes/no test for each item. Example: filter(# > 10). Then press Enter again.';
    }

    if (normalized.includes('function values are not supported')) {
        return 'Use function calls with parentheses, like SIN(item) or SQRT(9), then press Enter again.';
    }

    if (normalized.includes('cannot reassign internal name')) {
        return 'Internal names are read-only. Use a different variable name and press Enter again.';
    }

    if (normalized.includes('unsupported pipeline stage') || normalized.includes('invalid pipeline stage')) {
        return 'A pipeline step after | is not valid. Use filter(...), map(...), each(...), or a function like sum, avg, min, max, median.';
    }

    if (normalized.includes('expected a list')) {
        return 'This step needs a list of values. Example: a = [1,2,3] then a | map(# * 2).';
    }

    if (normalized.includes('expected numeric values') || normalized.includes('expects a numeric value')) {
        return 'This operation needs numbers only. Check for text, empty values, or missing variables.';
    }

    if (normalized.includes('requires at least one value')) {
        return 'This operation needs at least one value in the list.';
    }

    if (normalized.includes('unexpected token') || normalized.includes('unexpected character') || normalized.includes('mismatched input') || normalized.includes('syntax')) {
        return 'There is a typing mistake in this expression. Check brackets, commas, and operators, then press Enter again.';
    }

    if (normalized.includes('unknown name') || normalized.includes('unknown variable') || normalized.includes('undefined')) {
        return 'A name in this line is not recognized. Define it first (example: price = 20), then try again.';
    }

    if (normalized.includes('divide by zero') || normalized.includes('division by zero')) {
        return 'Division by zero is not allowed. Change the denominator and press Enter again.';
    }

    return 'Cannot evaluate this line yet. Fix it and press Enter again.';
}

export function buildStaleLineDetails(
    lineDependencyVersions: Record<number, Record<string, number>>,
    variableVersions: Record<string, number>,
): Map<number, string[]> {
    const details = new Map<number, string[]>();
    Object.entries(lineDependencyVersions).forEach(([lineKey, snapshot]) => {
        const lineIndex = Number(lineKey);
        if (!Number.isFinite(lineIndex)) {
            return;
        }

        const staleVariables: string[] = [];
        Object.entries(snapshot).forEach(([variableName, version]) => {
            const currentVersion = variableVersions[variableName] ?? 0;
            if (currentVersion !== version) {
                staleVariables.push(variableName);
            }
        });

        if (staleVariables.length > 0) {
            details.set(lineIndex, staleVariables);
        }
    });

    return details;
}
