export type FunctionEntry = {
    name: string;
    signature: string;
    description: string;
    example?: string;
    notes?: string;
};

export type FunctionGroup = {
    id: string;
    title: string;
    intro: string;
    functions: FunctionEntry[];
};

export const functionReferenceGroups: FunctionGroup[] = [
    {
        id: 'number-functions',
        title: 'Number Functions',
        intro: 'Numeric helpers currently available in the Run-Calc evaluator.',
        functions: [
            { name: 'max', signature: 'max(n1, n2)', description: 'Returns the larger of two numbers.', example: 'max(5, 7)' },
            { name: 'min', signature: 'min(n1, n2)', description: 'Returns the smaller of two numbers.', example: 'min(5, 7)' },
            { name: 'abs', signature: 'abs(n)', description: 'Returns absolute value.', example: 'abs(-5)' },
            { name: 'ceil', signature: 'ceil(n)', description: 'Rounds up to nearest integer.', example: 'ceil(1.5)' },
            { name: 'floor', signature: 'floor(n)', description: 'Rounds down to nearest integer.', example: 'floor(1.5)' },
            { name: 'round', signature: 'round(n)', description: 'Rounds to nearest integer.', example: 'round(1.5)' },
            { name: 'pow', signature: 'pow(base, exponent)', description: 'Raises base to exponent.', example: 'pow(2, 8)' },
            { name: 'sqrt', signature: 'sqrt(n)', description: 'Square root.', example: 'sqrt(9)' },
            { name: 'cbrt', signature: 'cbrt(n)', description: 'Cube root.', example: 'cbrt(27)' },
            { name: 'exp', signature: 'exp(n)', description: 'Exponential function e^n.', example: 'exp(1)' },
            { name: 'log', signature: 'log(n)', description: 'Natural logarithm.', example: 'log(E)' },
            { name: 'log10', signature: 'log10(n)', description: 'Base-10 logarithm.', example: 'log10(100)' },
            { name: 'log2', signature: 'log2(n)', description: 'Base-2 logarithm.', example: 'log2(8)' },
            { name: 'sin', signature: 'sin(n)', description: 'Sine (radians).', example: 'sin(PI / 2)' },
            { name: 'cos', signature: 'cos(n)', description: 'Cosine (radians).', example: 'cos(PI)' },
            { name: 'tan', signature: 'tan(n)', description: 'Tangent (radians).', example: 'tan(PI / 4)' },
            { name: 'asin', signature: 'asin(n)', description: 'Arc-sine (radians).', example: 'asin(1)' },
            { name: 'acos', signature: 'acos(n)', description: 'Arc-cosine (radians).', example: 'acos(0)' },
            { name: 'atan', signature: 'atan(n)', description: 'Arc-tangent (radians).', example: 'atan(1)' },
            { name: 'atan2', signature: 'atan2(y, x)', description: 'Arc-tangent from y/x preserving quadrant.', example: 'atan2(1, 1)' },
            { name: 'sinh', signature: 'sinh(n)', description: 'Hyperbolic sine.', example: 'sinh(1)' },
            { name: 'cosh', signature: 'cosh(n)', description: 'Hyperbolic cosine.', example: 'cosh(1)' },
            { name: 'tanh', signature: 'tanh(n)', description: 'Hyperbolic tangent.', example: 'tanh(1)' },
            { name: 'asinh', signature: 'asinh(n)', description: 'Inverse hyperbolic sine.', example: 'asinh(1)' },
            { name: 'acosh', signature: 'acosh(n)', description: 'Inverse hyperbolic cosine.', example: 'acosh(2)' },
            { name: 'atanh', signature: 'atanh(n)', description: 'Inverse hyperbolic tangent.', example: 'atanh(0.5)' },
            { name: 'hypot', signature: 'hypot(x, y)', description: 'Hypotenuse length sqrt(x*x + y*y).', example: 'hypot(3, 4)' },
            { name: 'trunc', signature: 'trunc(n)', description: 'Truncates fractional part.', example: 'trunc(1.9)' },
            { name: 'sign', signature: 'sign(n)', description: 'Returns -1, 0, or 1 based on sign.', example: 'sign(-42)' },
        ],
    },
    {
        id: 'array-functions',
        title: 'Array and Predicate Functions',
        intro: 'Filtering, projection, aggregation, searching, sorting, and reduction over lists.',
        functions: [
            { name: 'all', signature: 'all(array, predicate)', description: 'True when every element matches.', example: 'all(tweets, {.Size < 280})' },
            { name: 'any', signature: 'any(array, predicate)', description: 'True when any element matches.', example: 'any(tweets, {.Size > 280})' },
            { name: 'one', signature: 'one(array, predicate)', description: 'True when exactly one element matches.', example: 'one(users, {.Winner})' },
            { name: 'none', signature: 'none(array, predicate)', description: 'True when no elements match.', example: 'none(tweets, {.Size > 280})' },
            { name: 'map', signature: 'map(array, predicate)', description: 'Transforms each element and returns a new array.', example: 'map(tweets, {.Size})' },
            { name: 'filter', signature: 'filter(array, predicate)', description: 'Returns elements that satisfy predicate.', example: 'filter(users, .Name startsWith "J")' },
            { name: 'find', signature: 'find(array, predicate)', description: 'Returns first matching element.', example: 'find([1, 2, 3, 4], # > 2)' },
            { name: 'findIndex', signature: 'findIndex(array, predicate)', description: 'Returns first matching index.', example: 'findIndex([1, 2, 3, 4], # > 2)' },
            { name: 'findLast', signature: 'findLast(array, predicate)', description: 'Returns last matching element.', example: 'findLast([1, 2, 3, 4], # > 2)' },
            { name: 'findLastIndex', signature: 'findLastIndex(array, predicate)', description: 'Returns last matching index.', example: 'findLastIndex([1, 2, 3, 4], # > 2)' },
            { name: 'count', signature: 'count(array[, predicate])', description: 'Counts matched elements; alias to len(array) when used as function call.', example: 'count(users, .Age > 18)' },
            { name: 'concat', signature: 'concat(array1, array2[, ...])', description: 'Concatenates two or more arrays.', example: 'concat([1, 2], [3, 4])' },
            { name: 'flatten', signature: 'flatten(array)', description: 'Flattens nested arrays into one level.', example: 'flatten([1, [2, 3]])' },
            { name: 'uniq', signature: 'uniq(array)', description: 'Removes duplicate values.', example: 'uniq([1, 2, 3, 2])' },
            { name: 'join', signature: 'join(array[, delimiter])', description: 'Joins array of strings into one string.', example: 'join(["a", "b"], ",")' },
            { name: 'reduce', signature: 'reduce(array, predicate[, initialValue])', description: 'Reduces array to one value using #acc, #, and #index.', example: 'reduce(1..9, #acc + #, 0)' },
            { name: 'sum', signature: 'sum(array[, predicate])', description: 'Sums numeric elements or projected values.', example: 'sum(accounts, .Balance)' },
            { name: 'mean', signature: 'mean(array)', description: 'Average of numeric elements.', example: 'mean([1, 2, 3])' },
            { name: 'median', signature: 'median(array)', description: 'Median of numeric elements.', example: 'median([1, 2, 3])' },
            { name: 'first', signature: 'first(array)', description: 'First element or nil for empty array.', example: 'first([1, 2, 3])' },
            { name: 'last', signature: 'last(array)', description: 'Last element or nil for empty array.', example: 'last([1, 2, 3])' },
            { name: 'take', signature: 'take(array, n)', description: 'Returns first n elements.', example: 'take([1, 2, 3, 4], 2)' },
            { name: 'reverse', signature: 'reverse(array)', description: 'Returns reversed copy of array.', example: 'reverse([3, 1, 4])' },
            { name: 'sort', signature: 'sort(array[, order])', description: 'Sorts ascending by default, or desc.', example: 'sort([3, 1, 4], "desc")' },
            { name: 'sortBy', signature: 'sortBy(array[, predicate, order])', description: 'Sorts by derived value from predicate.', example: 'sortBy(users, .Age, "desc")' },
            { name: 'avg', signature: 'avg(array)', description: 'App alias for mean(...).', example: 'avg([1, 2, 3])', notes: 'In function-call form, avg(...) is rewritten to mean(...).' },
            { name: 'each', signature: 'array | each(mapper)', description: 'App pipeline alias for map(...) stage.', example: '[0, PI/2] | each(sin)', notes: 'Supported in pipeline stages as an alias of map.' },
        ],
    },
    {
        id: 'app-specific-functions',
        title: 'App-Specific Function Extensions',
        intro: 'Functions and helpers that are explicitly provided by Run-Calc.',
        functions: [
            { name: 'normal', signature: 'normal()', description: 'Returns random value from standard normal distribution.', example: 'normal()' },
            { name: 'uniform', signature: 'uniform()', description: 'Returns random value in [0, 1).', example: 'uniform()' },
            { name: 'mod64', signature: 'mod64(a, b)', description: 'Internal helper used to support % with mixed numeric forms.', example: 'mod64(11, 5)', notes: 'You can normally use the % operator directly.' },
        ],
    },
];
