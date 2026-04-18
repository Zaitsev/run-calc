export type DecimalDelimiter = '.' | ',';

export class ParseError extends Error {
    position: number;

    constructor(message: string, position: number) {
        super(message);
        this.name = 'ParseError';
        this.position = position;
    }
}

export function evaluateExpression(input: string, decimalDelimiter: DecimalDelimiter): number {
    let index = 0;

    const fail = (message: string, position = index): never => {
        throw new ParseError(message, position);
    };

    const skipSpaces = () => {
        while (index < input.length && /\s/.test(input[index])) {
            index++;
        }
    };

    const parseExpression = (): number => {
        let value = parseTerm();

        while (true) {
            skipSpaces();
            const op = input[index];
            if (op !== '+' && op !== '-') {
                break;
            }

            index++;
            const rhs = parseTerm();
            value = op === '+' ? value + rhs : value - rhs;
        }

        return value;
    };

    const parseTerm = (): number => {
        let value = parseUnary();

        while (true) {
            skipSpaces();
            const op = input[index];
            if (op !== '*' && op !== '/') {
                break;
            }

            index++;
            const rhs = parseUnary();
            if (op === '/') {
                if (rhs === 0) {
                    fail('Division by zero', index - 1);
                }
                value /= rhs;
            } else {
                value *= rhs;
            }
        }

        return value;
    };

    const parseUnary = (): number => {
        skipSpaces();

        const op = input[index];
        if (op === '+' || op === '-') {
            index++;
            const value = parseUnary();
            return op === '+' ? value : -value;
        }

        return parsePrimary();
    };

    const parsePrimary = (): number => {
        skipSpaces();

        if (input[index] === '(') {
            index++;
            const value = parseExpression();
            skipSpaces();
            if (input[index] !== ')') {
                fail('Missing closing bracket ")"');
            }
            index++;
            return value;
        }

        const start = index;
        let seenDecimalDelimiter = false;
        let seenDigit = false;

        while (index < input.length) {
            const ch = input[index];
            if (ch >= '0' && ch <= '9') {
                seenDigit = true;
                index++;
                continue;
            }
            if (ch === decimalDelimiter && !seenDecimalDelimiter) {
                seenDecimalDelimiter = true;
                index++;
                continue;
            }
            break;
        }

        if (start === index || !seenDigit) {
            fail('Expected a number', start);
        }

        // Support scientific notation like 1e6, 1.2e-3, or 1,2E+3.
        if (input[index] === 'e' || input[index] === 'E') {
            const exponentStart = index;
            index++;

            if (input[index] === '+' || input[index] === '-') {
                index++;
            }

            const exponentDigitsStart = index;
            while (index < input.length) {
                const exponentChar = input[index];
                if (exponentChar < '0' || exponentChar > '9') {
                    break;
                }
                index++;
            }

            if (index === exponentDigitsStart) {
                fail('Invalid scientific notation exponent', exponentStart);
            }
        }

        const rawNumber = input.slice(start, index);
        const normalizedNumber = decimalDelimiter === ','
            ? rawNumber.replace(',', '.')
            : rawNumber;
        const value = Number(normalizedNumber);
        if (!Number.isFinite(value)) {
            fail('Invalid number', start);
        }
        return value;
    };

    const result = parseExpression();
    skipSpaces();
    if (index !== input.length) {
        fail(`Unexpected symbol "${input[index]}"`, index);
    }

    if (!Number.isFinite(result)) {
        fail('Calculation overflow');
    }

    return result;
}
