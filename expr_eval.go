package main

import (
	"fmt"
	"math"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/expr-lang/expr"
)

type ExprEvalResponse struct {
	OK          bool                   `json:"ok"`
	Error       string                 `json:"error,omitempty"`
	Value       interface{}            `json:"value,omitempty"`
	Variables   map[string]interface{} `json:"variables"`
	IsNumber    bool                   `json:"isNumber"`
	NumberValue float64                `json:"numberValue,omitempty"`
}

var (
	identifierRe = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)
	internalExprFunctions = map[string]interface{}{
		"sum":    sumValue,
		"avg":    avgValue,
		"min":    minExpr,
		"max":    maxExpr,
		"median": medianValue,
		"abs":    math.Abs,
		"acos":   math.Acos,
		"acosh":  math.Acosh,
		"asin":   math.Asin,
		"asinh":  math.Asinh,
		"atan":   math.Atan,
		"atan2":  math.Atan2,
		"atanh":  math.Atanh,
		"cbrt":   math.Cbrt,
		"ceil":   math.Ceil,
		"cos":    math.Cos,
		"cosh":   math.Cosh,
		"exp":    math.Exp,
		"floor":  math.Floor,
		"hypot":  hypotExpr,
		"log":    math.Log,
		"log10":  math.Log10,
		"log2":   math.Log2,
		"pow":    math.Pow,
		"round":  math.Round,
		"sign":   signExpr,
		"sin":    math.Sin,
		"sinh":   math.Sinh,
		"sqrt":   math.Sqrt,
		"tan":    math.Tan,
		"tanh":   math.Tanh,
		"trunc":  math.Trunc,
	}
	internalExprConstants = map[string]float64{
		"e":       math.E,
		"pi":      math.Pi,
		"tau":     2 * math.Pi,
		"phi":     math.Phi,
		"ln2":     math.Ln2,
		"ln10":    math.Ln10,
		"log2e":   math.Log2E,
		"log10e":  math.Log10E,
		"sqrt1_2": 1 / math.Sqrt2,
		"sqrt2":   math.Sqrt2,
		"sqrte":   math.SqrtE,
		"sqrtpi":  math.SqrtPi,
		"sqrtphi": math.SqrtPhi,
	}
	pipelineShorthandFloatArgFunctions = map[string]struct{}{
		"abs":   {},
		"acos":  {},
		"acosh": {},
		"asin":  {},
		"asinh": {},
		"atan":  {},
		"atanh": {},
		"cbrt":  {},
		"ceil":  {},
		"cos":   {},
		"cosh":  {},
		"exp":   {},
		"floor": {},
		"log":   {},
		"log10": {},
		"log2":  {},
		"round": {},
		"sin":   {},
		"sinh":  {},
		"sqrt":  {},
		"tan":   {},
		"tanh":  {},
		"trunc": {},
		"sign":  {},
	}
	internalExprReservedNames = func() map[string]struct{} {
		reserved := make(map[string]struct{}, len(internalExprFunctions)+len(internalExprConstants)+7)
		for name := range internalExprFunctions {
			reserved[name] = struct{}{}
		}
		for name := range internalExprConstants {
			reserved[name] = struct{}{}
		}

		// Stage helpers and language literals are reserved as internal names.
		reserved["filter"] = struct{}{}
		reserved["map"] = struct{}{}
		reserved["each"] = struct{}{}
		reserved["item"] = struct{}{}
		reserved["true"] = struct{}{}
		reserved["false"] = struct{}{}
		reserved["nil"] = struct{}{}

		return reserved
	}()
)

func (a *App) EvaluateExprProgram(input string, variables map[string]interface{}) ExprEvalResponse {
	scope := cloneScope(variables)

	value, err := evaluateExprProgram(input, scope)
	if err != nil {
		return ExprEvalResponse{
			OK:        false,
			Error:     err.Error(),
			Variables: scope,
		}
	}

	response := ExprEvalResponse{
		OK:        true,
		Value:     value,
		Variables: scope,
	}

	if n, ok := toFloat64(value); ok && !math.IsNaN(n) && !math.IsInf(n, 0) {
		response.IsNumber = true
		response.NumberValue = n
	}

	return response
}

func evaluateExprProgram(input string, scope map[string]interface{}) (interface{}, error) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return nil, fmt.Errorf("expression is empty")
	}

	// Allow wrapped multiline input by stripping surrounding backticks.
	if strings.HasPrefix(trimmed, "`") && strings.HasSuffix(trimmed, "`") && len(trimmed) >= 2 {
		trimmed = strings.TrimSpace(trimmed[1 : len(trimmed)-1])
	}

	// Remove " comments outside single-quote/backtick strings while keeping line breaks.
	trimmed = strings.TrimSpace(stripLineComments(trimmed))
	if trimmed == "" {
		return nil, nil
	}

	// Split by top-level ';' so semicolons inside strings/lists are ignored.
	statements := splitTopLevel(trimmed, ';', true)
	if len(statements) == 0 {
		return nil, nil
	}

	var last interface{}
	for _, statement := range statements {
		part := strings.TrimSpace(statement)
		if part == "" {
			continue
		}

		value, err := evaluateExprStatement(part, scope)
		if err != nil {
			return nil, err
		}
		last = value
	}

	if last == nil {
		return nil, nil
	}

	return last, nil
}

func evaluateExprStatement(statement string, scope map[string]interface{}) (interface{}, error) {
	if name, rhs, ok := parseAssignment(statement); ok {
		if _, isInternalName := internalExprReservedNames[name]; isInternalName {
			return nil, fmt.Errorf("cannot reassign internal name %q", strings.ToUpper(name))
		}

		value, err := evaluateExprValue(rhs, scope)
		if err != nil {
			return nil, err
		}
		if err := ensureNoFunctionValues(value); err != nil {
			return nil, err
		}
		if err := ensureNoInvalidFloats(value); err != nil {
			return nil, err
		}
		scope[name] = value
		return value, nil
	}

	value, err := evaluateExprValue(statement, scope)
	if err != nil {
		return nil, err
	}
	if err := ensureNoFunctionValues(value); err != nil {
		return nil, err
	}
	if err := ensureNoInvalidFloats(value); err != nil {
		return nil, err
	}

	return value, nil
}

func evaluateExprValue(expression string, scope map[string]interface{}) (interface{}, error) {
	// Pipeline stages are separated by top-level '|'.
	stages := splitTopLevel(expression, '|', false)
	if len(stages) == 0 {
		return nil, fmt.Errorf("expression is empty")
	}

	current, err := evaluateExprExpression(stages[0], scope, nil)
	if err != nil {
		return nil, err
	}

	for _, stage := range stages[1:] {
		// Each stage receives the previous stage result as input.
		nextValue, stageErr := applyPipelineStage(current, stage, scope)
		if stageErr != nil {
			return nil, stageErr
		}
		current = nextValue
	}

	return current, nil
}

func applyPipelineStage(current interface{}, stage string, scope map[string]interface{}) (interface{}, error) {
	trimmed := strings.TrimSpace(stage)
	if trimmed == "" {
		return nil, fmt.Errorf("invalid pipeline stage")
	}
	lowerTrimmed := strings.ToLower(trimmed)

	switch lowerTrimmed {
	case "sum":
		return sumValue(current)
	case "avg":
		return avgValue(current)
	case "min":
		return minValue(current)
	case "max":
		return maxValue(current)
	case "median":
		return medianValue(current)
	}

	if strings.HasPrefix(lowerTrimmed, "filter(") && strings.HasSuffix(trimmed, ")") {
		predicate := strings.TrimSpace(trimmed[len("filter(") : len(trimmed)-1])
		return filterValue(current, predicate, scope)
	}

	if strings.HasPrefix(lowerTrimmed, "map(") && strings.HasSuffix(trimmed, ")") {
		mapper := strings.TrimSpace(trimmed[len("map(") : len(trimmed)-1])
		return mapValue(current, mapper, scope)
	}

	if strings.HasPrefix(lowerTrimmed, "each(") && strings.HasSuffix(trimmed, ")") {
		mapper := strings.TrimSpace(trimmed[len("each(") : len(trimmed)-1])
		return mapValue(current, mapper, scope)
	}

	return nil, fmt.Errorf("unsupported pipeline stage %q", trimmed)
}

func filterValue(current interface{}, predicate string, scope map[string]interface{}) ([]interface{}, error) {
	items, err := toAnySlice(current)
	if err != nil {
		return nil, err
	}
	predicateExpr := expandPipelineFunctionShorthand(predicate)

	out := make([]interface{}, 0, len(items))
	for _, item := range items {
		okValue, predErr := evaluateExprExpression(predicateExpr, scope, map[string]interface{}{"item": item})
		if predErr != nil {
			return nil, predErr
		}

		include, convErr := toBool(okValue)
		if convErr != nil {
			return nil, convErr
		}

		if include {
			out = append(out, item)
		}
	}

	return out, nil
}

func mapValue(current interface{}, mapper string, scope map[string]interface{}) ([]interface{}, error) {
	items, err := toAnySlice(current)
	if err != nil {
		return nil, err
	}
	mapperExpr := expandPipelineFunctionShorthand(mapper)

	out := make([]interface{}, 0, len(items))
	for _, item := range items {
		mapped, mapErr := evaluateExprExpression(mapperExpr, scope, map[string]interface{}{"item": item})
		if mapErr != nil {
			return nil, mapErr
		}
		out = append(out, mapped)
	}

	return out, nil
}

func expandPipelineFunctionShorthand(expression string) string {
	trimmed := strings.TrimSpace(expression)
	if !identifierRe.MatchString(trimmed) {
		return expression
	}

	name := strings.ToLower(trimmed)
	if _, ok := internalExprFunctions[name]; !ok {
		return expression
	}
	if _, needsFloatArg := pipelineShorthandFloatArgFunctions[name]; needsFloatArg {
		return fmt.Sprintf("%s((item) * 1.0)", name)
	}

	return fmt.Sprintf("%s(item)", name)
}

func evaluateExprExpression(expression string, scope map[string]interface{}, extra map[string]interface{}) (interface{}, error) {
	prepared := preprocessExpr(expression)
	env := buildExprEnv(scope, extra)

	program, err := expr.Compile(prepared, expr.Env(env), expr.AsAny())
	if err != nil {
		return nil, fmt.Errorf("%w", err)
	}

	value, runErr := expr.Run(program, env)
	if runErr != nil {
		return nil, fmt.Errorf("%w", runErr)
	}

	return value, nil
}

func preprocessExpr(expression string) string {
	var out strings.Builder
	var inQuote rune

	for i := 0; i < len(expression); i++ {
		ch := rune(expression[i])

		if inQuote != 0 {
			out.WriteRune(ch)
			if ch == '\\' {
				if i+1 < len(expression) {
					i++
					out.WriteByte(expression[i])
				}
				continue
			}
			if ch == inQuote {
				inQuote = 0
			}
			continue
		}

		if ch == '\'' || ch == '"' || ch == '`' {
			inQuote = ch
			out.WriteRune(ch)
			continue
		}

		if ch == '#' {
			out.WriteString("item")
			continue
		}

		if ch == '@' && i+1 < len(expression) && isIdentifierStart(rune(expression[i+1])) {
			start := i + 1
			end := start + 1
			for end < len(expression) && isIdentifierPart(rune(expression[end])) {
				end++
			}
			out.WriteString(strings.ToLower(expression[start:end]))
			i = end - 1
			continue
		}

		if isIdentifierStart(ch) {
			start := i
			end := i + 1
			for end < len(expression) && isIdentifierPart(rune(expression[end])) {
				end++
			}
			out.WriteString(strings.ToLower(expression[start:end]))
			i = end - 1
			continue
		}

		out.WriteRune(ch)
	}

	return out.String()
}

func stripLineComments(input string) string {
	var out strings.Builder
	var inQuote rune

	for i := 0; i < len(input); i++ {
		ch := rune(input[i])

		if inQuote != 0 {
			out.WriteRune(ch)
			if ch == '\\' {
				if i+1 < len(input) {
					i++
					out.WriteByte(input[i])
				}
				continue
			}
			if ch == inQuote {
				inQuote = 0
			}
			continue
		}

		if ch == '\'' || ch == '`' {
			inQuote = ch
			out.WriteRune(ch)
			continue
		}

		if ch == '"' {
			i++
			for ; i < len(input); i++ {
				next := input[i]
				if next == '\n' || next == '\r' {
					out.WriteByte(next)
					if next == '\r' && i+1 < len(input) && input[i+1] == '\n' {
						i++
						out.WriteByte(input[i])
					}
					break
				}
			}
			if i >= len(input) {
				break
			}
			continue
		}

		out.WriteRune(ch)
	}

	return out.String()
}

func parseAssignment(statement string) (string, string, bool) {
	idx := findTopLevelAssignment(statement)
	if idx == -1 {
		return "", "", false
	}

	lhs := strings.TrimSpace(statement[:idx])
	rhs := strings.TrimSpace(statement[idx+1:])
	if rhs == "" {
		return "", "", false
	}

	if strings.HasPrefix(lhs, "@") {
		lhs = lhs[1:]
	}

	lhs = strings.ToLower(lhs)

	if !identifierRe.MatchString(lhs) {
		return "", "", false
	}

	return lhs, rhs, true
}

func findTopLevelAssignment(text string) int {
	depthRound := 0
	depthSquare := 0
	depthCurly := 0
	var inQuote rune

	for i := 0; i < len(text); i++ {
		ch := rune(text[i])

		if inQuote != 0 {
			if ch == '\\' {
				i++
				continue
			}
			if ch == inQuote {
				inQuote = 0
			}
			continue
		}

		if ch == '\'' || ch == '"' || ch == '`' {
			inQuote = ch
			continue
		}

		switch ch {
		case '(':
			depthRound++
		case ')':
			depthRound--
		case '[':
			depthSquare++
		case ']':
			depthSquare--
		case '{':
			depthCurly++
		case '}':
			depthCurly--
		case '=':
			if depthRound != 0 || depthSquare != 0 || depthCurly != 0 {
				continue
			}

			prev := byte(0)
			next := byte(0)
			if i > 0 {
				prev = text[i-1]
			}
			if i+1 < len(text) {
				next = text[i+1]
			}

			if prev == '!' || prev == '<' || prev == '>' || prev == '=' || next == '=' {
				continue
			}

			return i
		}
	}

	return -1
}

func splitTopLevel(input string, delimiter rune, treatNewlineAsDelimiter bool) []string {
	out := make([]string, 0)
	current := strings.Builder{}

	depthRound := 0
	depthSquare := 0
	depthCurly := 0
	var inQuote rune

	flush := func() {
		part := strings.TrimSpace(current.String())
		if part != "" {
			out = append(out, part)
		}
		current.Reset()
	}

	for i := 0; i < len(input); i++ {
		ch := rune(input[i])

		if inQuote != 0 {
			current.WriteRune(ch)
			if ch == '\\' {
				if i+1 < len(input) {
					i++
					current.WriteByte(input[i])
				}
				continue
			}
			if ch == inQuote {
				inQuote = 0
			}
			continue
		}

		if ch == '\'' || ch == '"' || ch == '`' {
			inQuote = ch
			current.WriteRune(ch)
			continue
		}

		switch ch {
		case '(':
			depthRound++
		case ')':
			depthRound--
		case '[':
			depthSquare++
		case ']':
			depthSquare--
		case '{':
			depthCurly++
		case '}':
			depthCurly--
		}

		if depthRound == 0 && depthSquare == 0 && depthCurly == 0 {
			if ch == delimiter {
				flush()
				continue
			}
			if treatNewlineAsDelimiter && (ch == '\n' || ch == '\r') {
				flush()
				if ch == '\r' && i+1 < len(input) && input[i+1] == '\n' {
					i++
				}
				continue
			}
		}

		current.WriteRune(ch)
	}

	flush()
	return out
}

func cloneScope(input map[string]interface{}) map[string]interface{} {
	cloned := make(map[string]interface{}, len(input))
	for key, value := range input {
		cloned[strings.ToLower(key)] = value
	}
	return cloned
}

func buildExprEnv(scope map[string]interface{}, extra map[string]interface{}) map[string]interface{} {
	env := map[string]interface{}{}

	for key, value := range internalExprFunctions {
		env[key] = value
	}

	for key, value := range internalExprConstants {
		env[key] = value
	}

	for key, value := range scope {
		env[strings.ToLower(key)] = value
	}
	for key, value := range extra {
		env[strings.ToLower(key)] = value
	}

	return env
}

func sumValue(input interface{}) (float64, error) {
	values, err := toFloatSlice(input)
	if err != nil {
		return 0, err
	}

	sum := 0.0
	for _, value := range values {
		sum += value
	}
	return sum, nil
}

func avgValue(input interface{}) (float64, error) {
	values, err := toFloatSlice(input)
	if err != nil {
		return 0, err
	}
	if len(values) == 0 {
		return 0, fmt.Errorf("avg requires at least one value")
	}

	sum := 0.0
	for _, value := range values {
		sum += value
	}
	return sum / float64(len(values)), nil
}

func minValue(input interface{}) (float64, error) {
	values, err := toFloatSlice(input)
	if err != nil {
		return 0, err
	}
	if len(values) == 0 {
		return 0, fmt.Errorf("min requires at least one value")
	}

	min := values[0]
	for _, value := range values[1:] {
		if value < min {
			min = value
		}
	}
	return min, nil
}

func maxValue(input interface{}) (float64, error) {
	values, err := toFloatSlice(input)
	if err != nil {
		return 0, err
	}
	if len(values) == 0 {
		return 0, fmt.Errorf("max requires at least one value")
	}

	max := values[0]
	for _, value := range values[1:] {
		if value > max {
			max = value
		}
	}
	return max, nil
}

func medianValue(input interface{}) (float64, error) {
	values, err := toFloatSlice(input)
	if err != nil {
		return 0, err
	}
	if len(values) == 0 {
		return 0, fmt.Errorf("median requires at least one value")
	}

	sorted := append([]float64(nil), values...)
	sort.Float64s(sorted)

	mid := len(sorted) / 2
	if len(sorted)%2 == 1 {
		return sorted[mid], nil
	}

	return (sorted[mid-1] + sorted[mid]) / 2, nil
}

func minExpr(args ...interface{}) (float64, error) {
	values, err := flattenNumericArgs(args)
	if err != nil {
		return 0, err
	}
	if len(values) == 0 {
		return 0, fmt.Errorf("min requires at least one value")
	}

	min := values[0]
	for _, value := range values[1:] {
		if value < min {
			min = value
		}
	}

	return min, nil
}

func maxExpr(args ...interface{}) (float64, error) {
	values, err := flattenNumericArgs(args)
	if err != nil {
		return 0, err
	}
	if len(values) == 0 {
		return 0, fmt.Errorf("max requires at least one value")
	}

	max := values[0]
	for _, value := range values[1:] {
		if value > max {
			max = value
		}
	}

	return max, nil
}

func hypotExpr(args ...interface{}) (float64, error) {
	values, err := flattenNumericArgs(args)
	if err != nil {
		return 0, err
	}
	if len(values) == 0 {
		return 0, fmt.Errorf("hypot requires at least one value")
	}

	sumSquares := 0.0
	for _, value := range values {
		sumSquares += value * value
	}

	return math.Sqrt(sumSquares), nil
}

func signExpr(value interface{}) (float64, error) {
	n, ok := toFloat64(value)
	if !ok {
		return 0, fmt.Errorf("sign expects a numeric value")
	}
	if n == 0 {
		return 0, nil
	}
	if n > 0 {
		return 1, nil
	}
	return -1, nil
}

func flattenNumericArgs(args []interface{}) ([]float64, error) {
	out := make([]float64, 0, len(args))
	for _, arg := range args {
		switch value := arg.(type) {
		case []interface{}, []float64:
			values, err := toFloatSlice(value)
			if err != nil {
				return nil, err
			}
			out = append(out, values...)
		default:
			n, ok := toFloat64(value)
			if !ok {
				return nil, fmt.Errorf("expected numeric values")
			}
			out = append(out, n)
		}
	}

	return out, nil
}

func toFloatSlice(input interface{}) ([]float64, error) {
	values, err := toAnySlice(input)
	if err != nil {
		return nil, err
	}

	out := make([]float64, 0, len(values))
	for _, value := range values {
		n, ok := toFloat64(value)
		if !ok {
			return nil, fmt.Errorf("expected numeric values")
		}
		out = append(out, n)
	}

	return out, nil
}

func toAnySlice(input interface{}) ([]interface{}, error) {
	switch v := input.(type) {
	case []interface{}:
		return v, nil
	case []float64:
		out := make([]interface{}, len(v))
		for i, n := range v {
			out[i] = n
		}
		return out, nil
	}

	rv := reflect.ValueOf(input)
	if !rv.IsValid() || rv.Kind() != reflect.Slice {
		return nil, fmt.Errorf("expected a list")
	}

	out := make([]interface{}, rv.Len())
	for i := 0; i < rv.Len(); i++ {
		out[i] = rv.Index(i).Interface()
	}

	return out, nil
}

func toBool(input interface{}) (bool, error) {
	value, ok := input.(bool)
	if ok {
		return value, nil
	}
	return false, fmt.Errorf("filter predicate must return true or false")
}

func ensureNoFunctionValues(value interface{}) error {
	if containsFunctionValue(reflect.ValueOf(value)) {
		return fmt.Errorf("function values are not supported; call functions with parentheses")
	}

	return nil
}

func containsFunctionValue(v reflect.Value) bool {
	if !v.IsValid() {
		return false
	}

	switch v.Kind() {
	case reflect.Func:
		return true
	case reflect.Interface, reflect.Pointer:
		if v.IsNil() {
			return false
		}
		return containsFunctionValue(v.Elem())
	case reflect.Slice, reflect.Array:
		for i := 0; i < v.Len(); i++ {
			if containsFunctionValue(v.Index(i)) {
				return true
			}
		}
		return false
	case reflect.Map:
		it := v.MapRange()
		for it.Next() {
			if containsFunctionValue(it.Key()) || containsFunctionValue(it.Value()) {
				return true
			}
		}
		return false
	case reflect.Struct:
		for i := 0; i < v.NumField(); i++ {
			if containsFunctionValue(v.Field(i)) {
				return true
			}
		}
		return false
	default:
		return false
	}
}

func ensureNoInvalidFloats(value interface{}) error {
	if containsInvalidFloat(reflect.ValueOf(value)) {
		return fmt.Errorf("result contains NaN or Inf which cannot be serialized to JSON")
	}
	return nil
}

func containsInvalidFloat(v reflect.Value) bool {
	if !v.IsValid() {
		return false
	}

	switch v.Kind() {
	case reflect.Float32, reflect.Float64:
		f := v.Float()
		return math.IsNaN(f) || math.IsInf(f, 0)
	case reflect.Interface, reflect.Pointer:
		if v.IsNil() {
			return false
		}
		return containsInvalidFloat(v.Elem())
	case reflect.Slice, reflect.Array:
		for i := 0; i < v.Len(); i++ {
			if containsInvalidFloat(v.Index(i)) {
				return true
			}
		}
		return false
	case reflect.Map:
		it := v.MapRange()
		for it.Next() {
			if containsInvalidFloat(it.Key()) || containsInvalidFloat(it.Value()) {
				return true
			}
		}
		return false
	case reflect.Struct:
		for i := 0; i < v.NumField(); i++ {
			if containsInvalidFloat(v.Field(i)) {
				return true
			}
		}
		return false
	default:
		return false
	}
}

func toFloat64(input interface{}) (float64, bool) {
	switch v := input.(type) {
	case float64:
		return v, true
	case float32:
		return float64(v), true
	case int:
		return float64(v), true
	case int8:
		return float64(v), true
	case int16:
		return float64(v), true
	case int32:
		return float64(v), true
	case int64:
		return float64(v), true
	case uint:
		return float64(v), true
	case uint8:
		return float64(v), true
	case uint16:
		return float64(v), true
	case uint32:
		return float64(v), true
	case uint64:
		return float64(v), true
	case string:
		parsed, err := strconv.ParseFloat(v, 64)
		if err == nil {
			return parsed, true
		}
	}

	return 0, false
}

func isIdentifierStart(ch rune) bool {
	return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch == '_'
}

func isIdentifierPart(ch rune) bool {
	return isIdentifierStart(ch) || (ch >= '0' && ch <= '9')
}
