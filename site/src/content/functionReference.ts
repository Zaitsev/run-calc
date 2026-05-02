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
        id: 'string-functions',
        title: 'String Functions',
        intro: 'Helpers for trimming, splitting, searching, and transforming text values.',
        functions: [
            { name: 'trim', signature: 'trim(str[, chars])', description: 'Removes surrounding whitespace or provided characters.', example: 'trim("__Hello__", "_")' },
            { name: 'trimPrefix', signature: 'trimPrefix(str, prefix)', description: 'Removes a matching prefix from the start of a string.', example: 'trimPrefix("HelloWorld", "Hello")' },
            { name: 'trimSuffix', signature: 'trimSuffix(str, suffix)', description: 'Removes a matching suffix from the end of a string.', example: 'trimSuffix("HelloWorld", "World")' },
            { name: 'upper', signature: 'upper(str)', description: 'Converts text to uppercase.', example: 'upper("hello")' },
            { name: 'lower', signature: 'lower(str)', description: 'Converts text to lowercase.', example: 'lower("HELLO")' },
            { name: 'split', signature: 'split(str, delimiter[, n])', description: 'Splits a string by delimiter, optionally limiting splits.', example: 'split("apple,orange,grape", ",", 2)' },
            { name: 'splitAfter', signature: 'splitAfter(str, delimiter[, n])', description: 'Splits after each delimiter occurrence.', example: 'splitAfter("a,b,c", ",")' },
            { name: 'replace', signature: 'replace(str, old, new)', description: 'Replaces all occurrences of old with new.', example: 'replace("Hello World", "World", "Universe")' },
            { name: 'repeat', signature: 'repeat(str, n)', description: 'Repeats a string n times.', example: 'repeat("Hi", 3)' },
            { name: 'indexOf', signature: 'indexOf(str, substring)', description: 'Returns first index of substring, or -1 when not found.', example: 'indexOf("apple pie", "pie")' },
            { name: 'lastIndexOf', signature: 'lastIndexOf(str, substring)', description: 'Returns last index of substring, or -1 when not found.', example: 'lastIndexOf("apple pie apple", "apple")' },
            { name: 'hasPrefix', signature: 'hasPrefix(str, prefix)', description: 'Checks if string starts with a prefix.', example: 'hasPrefix("HelloWorld", "Hello")' },
            { name: 'hasSuffix', signature: 'hasSuffix(str, suffix)', description: 'Checks if string ends with a suffix.', example: 'hasSuffix("HelloWorld", "World")' },
        ],
    },
    {
        id: 'date-functions',
        title: 'Date and Time Functions',
        intro: 'Work with current time, durations, parsing, and timezone conversion.',
        functions: [
            { name: 'now', signature: 'now()', description: 'Returns current date-time value.', example: 'now().Year()' },
            { name: 'duration', signature: 'duration(str)', description: 'Parses Go-style duration strings such as 1h or 30m.', example: 'duration("1h").Seconds()' },
            { name: 'date', signature: 'date(str[, format[, timezone]])', description: 'Parses a date-time string, optionally with format and timezone.', example: 'date("2023-08-14 00:00:00", "2006-01-02 15:04:05", "Europe/Zurich")' },
            { name: 'timezone', signature: 'timezone(str)', description: 'Returns timezone object for conversions.', example: 'date("2023-08-14 00:00:00").In(timezone("UTC"))' },
        ],
    },
    {
        id: 'number-functions',
        title: 'Number Functions',
        intro: 'Basic numeric helpers from Expr plus app-enabled advanced math.',
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
            { name: 'groupBy', signature: 'groupBy(array, predicate)', description: 'Groups elements by key generated by predicate.', example: 'groupBy(users, .Age)' },
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
        id: 'map-functions',
        title: 'Map Functions',
        intro: 'Helpers for extracting keys and values from maps.',
        functions: [
            { name: 'keys', signature: 'keys(map)', description: 'Returns map keys as an array.', example: 'keys({"name": "John", "age": 30})' },
            { name: 'values', signature: 'values(map)', description: 'Returns map values as an array.', example: 'values({"name": "John", "age": 30})' },
        ],
    },
    {
        id: 'conversion-functions',
        title: 'Type Conversion Functions',
        intro: 'Convert between numbers, strings, JSON, Base64, and pair structures.',
        functions: [
            { name: 'type', signature: 'type(v)', description: 'Returns runtime type name of value.', example: 'type(42)' },
            { name: 'int', signature: 'int(v)', description: 'Converts number or numeric string to integer.', example: 'int("123")' },
            { name: 'float', signature: 'float(v)', description: 'Converts number or numeric string to float.', example: 'float("123.45")' },
            { name: 'string', signature: 'string(v)', description: 'Converts value to string.', example: 'string(123)' },
            { name: 'toJSON', signature: 'toJSON(v)', description: 'Serializes value to JSON string.', example: 'toJSON({"name": "John"})' },
            { name: 'fromJSON', signature: 'fromJSON(v)', description: 'Parses JSON string to value.', example: "fromJSON('{\"name\":\"John\"}')" },
            { name: 'toBase64', signature: 'toBase64(v)', description: 'Encodes string to Base64.', example: 'toBase64("Hello World")' },
            { name: 'fromBase64', signature: 'fromBase64(v)', description: 'Decodes Base64 string.', example: 'fromBase64("SGVsbG8=")' },
            { name: 'toPairs', signature: 'toPairs(map)', description: 'Converts map to array of [key, value] pairs.', example: 'toPairs({"name": "John"})' },
            { name: 'fromPairs', signature: 'fromPairs(array)', description: 'Converts [key, value] pairs to map.', example: 'fromPairs([["name", "John"]])' },
        ],
    },
    {
        id: 'misc-functions',
        title: 'Misc Functions',
        intro: 'General helpers used across arrays, maps, and strings.',
        functions: [
            { name: 'len', signature: 'len(v)', description: 'Length of array, map, or string.', example: 'len([1, 2, 3])' },
            { name: 'get', signature: 'get(v, index)', description: 'Gets element/key value or nil when missing.', example: 'get({"name": "John"}, "name")' },
        ],
    },
    {
        id: 'bitwise-functions',
        title: 'Bitwise Functions',
        intro: 'Integer bitwise operations for low-level calculations.',
        functions: [
            { name: 'bitand', signature: 'bitand(int, int)', description: 'Bitwise AND.', example: 'bitand(0b1010, 0b1100)' },
            { name: 'bitor', signature: 'bitor(int, int)', description: 'Bitwise OR.', example: 'bitor(0b1010, 0b1100)' },
            { name: 'bitxor', signature: 'bitxor(int, int)', description: 'Bitwise XOR.', example: 'bitxor(0b1010, 0b1100)' },
            { name: 'bitnand', signature: 'bitnand(int, int)', description: 'Bitwise AND NOT.', example: 'bitnand(0b1010, 0b1100)' },
            { name: 'bitnot', signature: 'bitnot(int)', description: 'Bitwise NOT.', example: 'bitnot(0b1010)' },
            { name: 'bitshl', signature: 'bitshl(int, int)', description: 'Left shift.', example: 'bitshl(0b101101, 2)' },
            { name: 'bitshr', signature: 'bitshr(int, int)', description: 'Right shift.', example: 'bitshr(0b101101, 2)' },
            { name: 'bitushr', signature: 'bitushr(int, int)', description: 'Unsigned right shift.', example: 'bitushr(-0b101, 2)' },
        ],
    },
    {
        id: 'app-specific-functions',
        title: 'App-Specific Function Extensions',
        intro: 'Functions available in Run-Calc evaluator in addition to Expr documentation highlights.',
        functions: [
            { name: 'normal', signature: 'normal()', description: 'Returns random value from standard normal distribution.', example: 'normal()' },
            { name: 'uniform', signature: 'uniform()', description: 'Returns random value in [0, 1).', example: 'uniform()' },
            { name: 'mod64', signature: 'mod64(a, b)', description: 'Internal helper used to support % with mixed numeric forms.', example: 'mod64(11, 5)', notes: 'You can normally use the % operator directly.' },
        ],
    },
];
