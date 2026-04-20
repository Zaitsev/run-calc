const ERROR_SUFFIX = ' = error';

const BUILTIN_FUNCTION_NAMES = new Set([
    'ABS', 'ACOS', 'ACOSH', 'ASIN', 'ASINH', 'ALL', 'ANY', 'ATAN', 'ATAN2', 'ATANH',
    'AVG', 'CBRT', 'CEIL', 'COS', 'COSH', 'COUNT', 'EACH', 'EXP', 'FILTER', 'FIND', 'FIRST', 'FLATTEN', 'FLOOR',
    'HYPOT', 'LEN', 'LAST', 'LOG', 'LOG10', 'LOG2', 'MAP', 'MAX', 'MEAN', 'MEDIAN', 'MIN', 'NONE', 'ONE', 'POW',
    'REDUCE', 'REVERSE', 'ROUND', 'SIGN', 'SIN', 'SINH', 'SORT', 'SQRT', 'SUM', 'TAN', 'TANH', 'TAKE', 'TRUNC', 'UNIQ',
]);

const BUILTIN_CONSTANT_NAMES = new Set([
    'E', 'PI', 'TAU', 'PHI', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT1_2', 'SQRT2', 'SQRTE', 'SQRTPI', 'SQRTPHI',
]);

type ParsedDeclaration = {
    key: string;
    expression: string;
};

type SplitLineCommentResult = {
    body: string;
    comment: string;
};

function findLineCommentIndex(lineText: string): number {
    let quote: string | null = null;

    for (let i = 0; i < lineText.length; i++) {
        const ch = lineText[i];

        if (quote) {
            if (ch === '\\') {
                i++;
                continue;
            }
            if (ch === quote) {
                quote = null;
            }
            continue;
        }

        if (ch === '\'' || ch === '`') {
            quote = ch;
            continue;
        }

        if (ch === '"') {
            return i;
        }
    }

    return -1;
}

function joinBodyAndComment(body: string, comment: string): string {
    if (!comment) {
        return body;
    }

    const trimmedBody = body.trimEnd();
    return trimmedBody.length > 0 ? `${trimmedBody} ${comment}` : comment;
}

export function splitLineComment(lineText: string): SplitLineCommentResult {
    const commentIndex = findLineCommentIndex(lineText);
    if (commentIndex === -1) {
        return {body: lineText, comment: ''};
    }

    return {
        body: lineText.slice(0, commentIndex),
        comment: lineText.slice(commentIndex),
    };
}

function parseDeclaration(lineText: string): ParsedDeclaration | null {
    const match = lineText.match(/^\s*(@?[a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (!match) {
        return null;
    }

    const label = match[1];
    const expression = match[2].trim();
    return {
        key: (label.startsWith('@') ? label.slice(1) : label).toLowerCase(),
        expression,
    };
}

function isIdentifierStart(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
}

function isIdentifierPart(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
}

export function stripErrorSuffix(lineText: string): string {
    const {body, comment} = splitLineComment(lineText);
    const trimmedBody = body.trimEnd();
    if (!trimmedBody.endsWith(ERROR_SUFFIX)) {
        return lineText;
    }

    return joinBodyAndComment(trimmedBody.slice(0, -ERROR_SUFFIX.length), comment);
}

export function getExpressionSource(lineText: string): string {
    const withoutError = stripErrorSuffix(lineText);
    const {body, comment} = splitLineComment(withoutError);

    // AI prompt lines start with '?' and should keep their full source text.
    if (body.trimStart().startsWith('?')) {
        return joinBodyAndComment(body, comment);
    }

    // Handle declarations first so result suffixes are removed only from the RHS.
    const declarationMatch = body.match(/^(\s*@?[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*)(.+)$/);
    if (declarationMatch) {
        const declarationPrefix = declarationMatch[1];
        const declarationRhs = declarationMatch[2].trimEnd();

        if (declarationRhs.startsWith('`')) {
            const closingTick = declarationRhs.lastIndexOf('`');
            if (closingTick > 0) {
                const afterTick = declarationRhs.slice(closingTick + 1);
                if (afterTick.startsWith(' = ')) {
                    const sourceBody = `${declarationPrefix}${declarationRhs.slice(0, closingTick + 1)}`.trimEnd();
                    return joinBodyAndComment(sourceBody, comment);
                }
            }

            const sourceBody = `${declarationPrefix}${declarationRhs}`.trimEnd();
            return joinBodyAndComment(sourceBody, comment);
        }

        const rhsResultIndex = declarationRhs.lastIndexOf(' = ');
        if (rhsResultIndex !== -1) {
            const sourceBody = `${declarationPrefix}${declarationRhs.slice(0, rhsResultIndex)}`.trimEnd();
            return joinBodyAndComment(sourceBody, comment);
        }

        const sourceBody = `${declarationPrefix}${declarationRhs}`.trimEnd();
        return joinBodyAndComment(sourceBody, comment);
    }

    const lastEqualsIndex = body.lastIndexOf(' = ');
    if (lastEqualsIndex !== -1) {
        const declarationCandidate = body.slice(0, lastEqualsIndex).trimEnd();
        if (/^\s*@?[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*.+$/.test(declarationCandidate)) {
            return joinBodyAndComment(declarationCandidate, comment);
        }
    }

    const equalsIndex = body.indexOf(' = ');
    if (equalsIndex === -1) {
        return joinBodyAndComment(body, comment);
    }

    const sourceBody = body.slice(0, equalsIndex).trimEnd();
    return joinBodyAndComment(sourceBody, comment);
}

export function isAITriggerLine(lineText: string): boolean {
    const {body} = splitLineComment(getExpressionSource(lineText));
    return body.trimStart().startsWith('?');
}

export function getAITriggerPrompt(lineText: string): string {
    const {body} = splitLineComment(getExpressionSource(lineText));
    const trimmed = body.trimStart();
    if (!trimmed.startsWith('?')) {
        return '';
    }

    return trimmed.slice(1).trim();
}

export function extractExpressionDependencies(lineText: string): string[] {
    const source = getExpressionSource(lineText);
    const {body} = splitLineComment(source);
    const declaration = parseDeclaration(body);
    const expression = declaration ? declaration.expression : body;
    const excludedName = declaration?.key;
    const dependencies = new Set<string>();

    let index = 0;
    while (index < expression.length) {
        const current = expression[index];

        // Skip template-literal blocks: variable names inside are not dependencies.
        if (current === '`') {
            const close = expression.indexOf('`', index + 1);
            if (close === -1) {
                break;
            }
            index = close + 1;
            continue;
        }

        // Skip quoted strings while preserving escaped characters.
        if (current === '"' || current === '\'') {
            const quote = current;
            index++;
            while (index < expression.length) {
                const ch = expression[index];
                if (ch === '\\') {
                    index += 2;
                    continue;
                }
                if (ch === quote) {
                    index++;
                    break;
                }
                index++;
            }
            continue;
        }

        let atPrefix = false;
        if (current === '@' && index + 1 < expression.length && isIdentifierStart(expression[index + 1])) {
            atPrefix = true;
            index++;
        }

        if (!isIdentifierStart(expression[index])) {
            index++;
            continue;
        }

        const start = index;
        index++;
        while (index < expression.length && isIdentifierPart(expression[index])) {
            index++;
        }

        const token = expression.slice(start, index);
        const normalized = token.toLowerCase();
        const upper = token.toUpperCase();
        // Builtin functions/constants are not worksheet dependencies.
        if (!atPrefix && (BUILTIN_FUNCTION_NAMES.has(upper) || BUILTIN_CONSTANT_NAMES.has(upper))) {
            continue;
        }

        if (normalized === excludedName) {
            continue;
        }

        let lookahead = index;
        while (lookahead < expression.length && /\s/.test(expression[lookahead])) {
            lookahead++;
        }

        if (!atPrefix && expression[lookahead] === '(') {
            continue;
        }

        dependencies.add(normalized);
    }

    return [...dependencies];
}
