package main

import (
	"fmt"
	"math"
	"math/rand"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

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
	randomSeedOnce = sync.Once{}
	internalExprFunctions = map[string]interface{}{
		// Most aggregation functions (sum, mean, median, min, max, etc.) are now provided
		// natively by expr-lang and used directly via pipeline stages.
		// We only keep custom math functions that aren't in expr-lang.
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
		"mod64":  mod64Expr,
		"pow":    math.Pow,
		"round":  math.Round,
		"normal": normalExpr,
		"sign":   signExpr,
		"sin":    math.Sin,
		"sinh":   math.Sinh,
		"sqrt":   math.Sqrt,
		"tan":    math.Tan,
		"tanh":   math.Tanh,
		"take":   takeExpr,
		"trunc":  math.Trunc,
		"uniform": uniformExpr,
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
	pipelineItemFirstFunctions = map[string]struct{}{
		"sum":           {},
		"count":         {},
		"len":           {},
		"mean":          {},
		"avg":           {},
		"median":        {},
		"min":           {},
		"max":           {},
		"all":           {},
		"any":           {},
		"one":           {},
		"none":          {},
		"find":          {},
		"findindex":     {},
		"findlast":      {},
		"findlastindex": {},
		"groupby":       {},
		"concat":        {},
		"flatten":       {},
		"uniq":          {},
		"join":          {},
		"first":         {},
		"last":          {},
		"take":          {},
		"reverse":       {},
		"sort":          {},
		"sortby":        {},
		"reduce":        {},
	}
	internalExprReservedNames = func() map[string]struct{} {
		reserved := make(map[string]struct{}, 50)
		for name := range internalExprFunctions {
			reserved[name] = struct{}{}
		}
		for name := range internalExprConstants {
			reserved[name] = struct{}{}
		}

		// Stage helpers, language literals, and native expr-lang builtins are reserved
		reserved["filter"] = struct{}{}
		reserved["map"] = struct{}{}
		reserved["each"] = struct{}{}
		reserved["item"] = struct{}{}
		reserved["len"] = struct{}{}
		reserved["count"] = struct{}{}
		reserved["sum"] = struct{}{}
		reserved["avg"] = struct{}{}
		reserved["mean"] = struct{}{}
		reserved["median"] = struct{}{}
		reserved["min"] = struct{}{}
		reserved["max"] = struct{}{}
		reserved["all"] = struct{}{}
		reserved["any"] = struct{}{}
		reserved["in"] = struct{}{}
		reserved["one"] = struct{}{}
		reserved["none"] = struct{}{}
		reserved["reduce"] = struct{}{}
		reserved["find"] = struct{}{}
		reserved["findindex"] = struct{}{}
		reserved["findlast"] = struct{}{}
		reserved["findlastindex"] = struct{}{}
		reserved["groupby"] = struct{}{}
		reserved["concat"] = struct{}{}
		reserved["flatten"] = struct{}{}
		reserved["uniq"] = struct{}{}
		reserved["join"] = struct{}{}
		reserved["first"] = struct{}{}
		reserved["last"] = struct{}{}
		reserved["take"] = struct{}{}
		reserved["reverse"] = struct{}{}
		reserved["sort"] = struct{}{}
		reserved["sortby"] = struct{}{}
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

	if _, ok := pipelineItemFirstFunctions[lowerTrimmed]; ok {
		return evaluateExprExpression(lowerTrimmed+"(item)", scope, map[string]interface{}{"item": current})
	}

	if _, ok := pipelineShorthandFloatArgFunctions[lowerTrimmed]; ok {
		return evaluateExprExpression(lowerTrimmed+"((item)*1.0)", scope, map[string]interface{}{"item": current})
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

	if fnName, args, ok := parsePipelineFunctionCall(trimmed); ok {
		if _, supported := pipelineItemFirstFunctions[fnName]; supported {
			expression := fnName + "(item)"
			if args != "" {
				expression = fnName + "(item, " + args + ")"
			}
			return evaluateExprExpression(expression, scope, map[string]interface{}{"item": current})
		}
	}

	return nil, fmt.Errorf("unsupported pipeline stage %q", trimmed)
}

func parsePipelineFunctionCall(stage string) (string, string, bool) {
	trimmed := strings.TrimSpace(stage)
	if trimmed == "" || !strings.HasSuffix(trimmed, ")") {
		return "", "", false
	}

	openIdx := strings.Index(trimmed, "(")
	if openIdx <= 0 {
		return "", "", false
	}

	name := strings.TrimSpace(trimmed[:openIdx])
	if !identifierRe.MatchString(name) {
		return "", "", false
	}

	args := strings.TrimSpace(trimmed[openIdx+1 : len(trimmed)-1])
	return strings.ToLower(name), args, true
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

// enrichExprError replaces opaque expr-lang parser errors with actionable
// messages when a known root cause can be detected in the original expression.
//
// Currently handles: pipe operator used inside parentheses / sub-expressions.
// When adding new enrichment cases, add a corresponding test in
// TestEvaluateExprProgram_EnrichedErrors.
func enrichExprError(expression string, original error) error {
	if strings.Contains(original.Error(), "unexpected token") && hasPipeInsideParens(expression) {
		return fmt.Errorf(
			"pipe operator inside parentheses is not supported — " +
				"assign the pipeline to a variable first, " +
				"e.g. n = arr | count, then use n in the expression",
		)
	}
	return fmt.Errorf("%w", original)
}

// hasPipeInsideParens reports whether expression contains at least one '|'
// nested inside round brackets, skipping quoted strings.
func hasPipeInsideParens(expression string) bool {
	depth := 0
	inQuote := rune(0)
	for _, ch := range expression {
		if inQuote != 0 {
			if ch == inQuote {
				inQuote = 0
			}
			continue
		}
		switch ch {
		case '\'', '`':
			inQuote = ch
		case '(':
			depth++
		case ')':
			if depth > 0 {
				depth--
			}
		case '|':
			if depth > 0 {
				return true
			}
		}
	}
	return false
}

func evaluateExprExpression(expression string, scope map[string]interface{}, extra map[string]interface{}) (interface{}, error) {
	prepared := preprocessExpr(expression)
	env := buildExprEnv(scope, extra)

	program, err := expr.Compile(prepared, expr.Env(env), expr.AsAny())
	if err != nil {
		return nil, enrichExprError(expression, err)
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

			identifier := strings.ToLower(expression[start:end])
			next := end
			for next < len(expression) && (expression[next] == ' ' || expression[next] == '\t' || expression[next] == '\n' || expression[next] == '\r') {
				next++
			}
			if next < len(expression) && expression[next] == '(' {
				// Rewrite count(...) to len(...) and avg(...) to mean(...) as expr-lang aliases
				if identifier == "count" {
					out.WriteString("len")
				} else if identifier == "avg" {
					out.WriteString("mean")
				} else {
					out.WriteString(identifier)
				}
			} else {
				out.WriteString(identifier)
			}

			i = end - 1
			continue
		}

		out.WriteRune(ch)
	}

	return rewriteModuloToFunction(out.String())
}

func rewriteModuloToFunction(expression string) string {
	if !strings.Contains(expression, "%") {
		return expression
	}

	rewritten := expression
	searchFrom := 0
	for searchFrom < len(rewritten) {
		idx := findModuloIndexOutsideQuotes(rewritten, searchFrom)
		if idx == -1 {
			break
		}

		leftStart, okLeft := findLeftOperandStart(rewritten, idx)
		rightEnd, okRight := findRightOperandEnd(rewritten, idx)
		if !okLeft || !okRight || leftStart >= idx || rightEnd <= idx+1 {
			searchFrom = idx + 1
			continue
		}

		left := strings.TrimSpace(rewritten[leftStart:idx])
		right := strings.TrimSpace(rewritten[idx+1 : rightEnd])
		replacement := fmt.Sprintf("mod64(%s, %s)", left, right)

		rewritten = rewritten[:leftStart] + replacement + rewritten[rightEnd:]
		searchFrom = leftStart + len(replacement)
	}

	return rewritten
}

func findModuloIndexOutsideQuotes(expression string, start int) int {
	inQuote := rune(0)
	for i := start; i < len(expression); i++ {
		ch := rune(expression[i])
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
		if ch == '%' {
			return i
		}
	}

	return -1
}

func findLeftOperandStart(expression string, moduloIdx int) (int, bool) {
	i := moduloIdx - 1
	for i >= 0 && isSpaceByte(expression[i]) {
		i--
	}
	if i < 0 {
		return 0, false
	}

	start, ok := scanOperandStartBackward(expression, i)
	if !ok {
		return 0, false
	}

	if start > 0 {
		signIdx := start - 1
		for signIdx >= 0 && isSpaceByte(expression[signIdx]) {
			signIdx--
		}
		if signIdx >= 0 && (expression[signIdx] == '+' || expression[signIdx] == '-') {
			if signIdx == 0 || isUnaryPrefixByte(expression, signIdx-1) {
				start = signIdx
			}
		}
	}

	return start, true
}

func scanOperandStartBackward(expression string, end int) (int, bool) {
	if end < 0 {
		return 0, false
	}

	ch := expression[end]
	if ch == ')' || ch == ']' {
		open, ok := findMatchingOpenBackward(expression, end)
		if !ok {
			return 0, false
		}
		start := open
		if ch == ')' {
			j := open - 1
			for j >= 0 && isSpaceByte(expression[j]) {
				j--
			}
			for j >= 0 && isIdentifierPart(rune(expression[j])) {
				j--
			}
			start = j + 1
		}
		return start, true
	}

	if isIdentifierPart(rune(ch)) {
		j := end
		for j >= 0 && isIdentifierPart(rune(expression[j])) {
			j--
		}
		return j + 1, true
	}

	if isNumericTokenByte(ch) {
		j := end
		for j >= 0 && isNumericTokenByte(expression[j]) {
			j--
		}
		return j + 1, true
	}

	return 0, false
}

func findRightOperandEnd(expression string, moduloIdx int) (int, bool) {
	i := moduloIdx + 1
	for i < len(expression) && isSpaceByte(expression[i]) {
		i++
	}
	if i >= len(expression) {
		return 0, false
	}

	if expression[i] == '+' || expression[i] == '-' {
		i++
		for i < len(expression) && isSpaceByte(expression[i]) {
			i++
		}
		if i >= len(expression) {
			return 0, false
		}
	}

	end, ok := scanOperandEndForward(expression, i)
	if !ok {
		return 0, false
	}

	return end, true
}

func scanOperandEndForward(expression string, start int) (int, bool) {
	if start >= len(expression) {
		return 0, false
	}

	ch := expression[start]
	if ch == '(' || ch == '[' {
		close, ok := findMatchingCloseForward(expression, start)
		if !ok {
			return 0, false
		}
		return close + 1, true
	}

	if isIdentifierStart(rune(ch)) {
		i := start + 1
		for i < len(expression) && isIdentifierPart(rune(expression[i])) {
			i++
		}

		j := i
		for j < len(expression) && isSpaceByte(expression[j]) {
			j++
		}
		if j < len(expression) && expression[j] == '(' {
			close, ok := findMatchingCloseForward(expression, j)
			if !ok {
				return 0, false
			}
			return close + 1, true
		}

		return i, true
	}

	if isNumericTokenByte(ch) {
		i := start + 1
		for i < len(expression) && isNumericTokenByte(expression[i]) {
			i++
		}
		return i, true
	}

	return 0, false
}

func findMatchingOpenBackward(expression string, closeIdx int) (int, bool) {
	closeCh := expression[closeIdx]
	openCh := byte('(')
	if closeCh == ']' {
		openCh = '['
	}

	depth := 1
	for i := closeIdx - 1; i >= 0; i-- {
		ch := expression[i]
		if ch == closeCh {
			depth++
			continue
		}
		if ch == openCh {
			depth--
			if depth == 0 {
				return i, true
			}
		}
	}

	return 0, false
}

func findMatchingCloseForward(expression string, openIdx int) (int, bool) {
	openCh := expression[openIdx]
	closeCh := byte(')')
	if openCh == '[' {
		closeCh = ']'
	}

	depth := 1
	inQuote := rune(0)
	for i := openIdx + 1; i < len(expression); i++ {
		ch := rune(expression[i])
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

		if byte(ch) == openCh {
			depth++
			continue
		}
		if byte(ch) == closeCh {
			depth--
			if depth == 0 {
				return i, true
			}
		}
	}

	return 0, false
}

func isSpaceByte(ch byte) bool {
	return ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r'
}

func isNumericTokenByte(ch byte) bool {
	return (ch >= '0' && ch <= '9') || ch == '.' || ch == 'e' || ch == 'E'
}

func isUnaryPrefixByte(expression string, idx int) bool {
	for idx >= 0 && isSpaceByte(expression[idx]) {
		idx--
	}
	if idx < 0 {
		return true
	}

	switch expression[idx] {
	case '(', '[', '{', ',', '+', '-', '*', '/', '%', '^', '<', '>', '=', '!', '&', '|', '?', ':':
		return true
	default:
		return false
	}
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

func ensureRandomSeeded() {
	randomSeedOnce.Do(func() {
		rand.Seed(time.Now().UnixNano())
	})
}

func uniformExpr() float64 {
	ensureRandomSeeded()
	return rand.Float64()
}

func normalExpr() float64 {
	ensureRandomSeeded()
	return rand.NormFloat64()
}

func takeExpr(input interface{}, count interface{}) ([]interface{}, error) {
	items, err := toAnySlice(input)
	if err != nil {
		return nil, err
	}

	n, err := coerceIntegralInt(count)
	if err != nil {
		return nil, fmt.Errorf("take expects an integer count")
	}

	if n <= 0 {
		return []interface{}{}, nil
	}
	if n >= len(items) {
		return items, nil
	}

	return items[:n], nil
}

func mod64Expr(left interface{}, right interface{}) (int64, error) {
	l, err := coerceIntegralInt64(left)
	if err != nil {
		return 0, fmt.Errorf("modulo expects integer operands")
	}
	r, err := coerceIntegralInt64(right)
	if err != nil {
		return 0, fmt.Errorf("modulo expects integer operands")
	}
	if r == 0 {
		return 0, fmt.Errorf("modulo by zero")
	}

	return l % r, nil
}

func coerceIntegralInt64(value interface{}) (int64, error) {
	switch v := value.(type) {
	case int:
		return int64(v), nil
	case int8:
		return int64(v), nil
	case int16:
		return int64(v), nil
	case int32:
		return int64(v), nil
	case int64:
		return v, nil
	case uint:
		if uint64(v) > uint64(math.MaxInt64) {
			return 0, fmt.Errorf("out of range")
		}
		return int64(v), nil
	case uint8:
		return int64(v), nil
	case uint16:
		return int64(v), nil
	case uint32:
		return int64(v), nil
	case uint64:
		if v > uint64(math.MaxInt64) {
			return 0, fmt.Errorf("out of range")
		}
		return int64(v), nil
	case float32:
		f := float64(v)
		if math.IsNaN(f) || math.IsInf(f, 0) || math.Trunc(f) != f {
			return 0, fmt.Errorf("not an integer")
		}
		if f < float64(math.MinInt64) || f > float64(math.MaxInt64) {
			return 0, fmt.Errorf("out of range")
		}
		return int64(f), nil
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) || math.Trunc(v) != v {
			return 0, fmt.Errorf("not an integer")
		}
		if v < float64(math.MinInt64) || v > float64(math.MaxInt64) {
			return 0, fmt.Errorf("out of range")
		}
		return int64(v), nil
	default:
		return 0, fmt.Errorf("unsupported type")
	}
}

func coerceIntegralInt(value interface{}) (int, error) {
	switch v := value.(type) {
	case int:
		return v, nil
	case int8:
		return int(v), nil
	case int16:
		return int(v), nil
	case int32:
		return int(v), nil
	case int64:
		return int(v), nil
	case uint:
		if uint64(v) > uint64(^uint(0)>>1) {
			return 0, fmt.Errorf("out of range")
		}
		return int(v), nil
	case uint8:
		return int(v), nil
	case uint16:
		return int(v), nil
	case uint32:
		return int(v), nil
	case uint64:
		if v > uint64(^uint(0)>>1) {
			return 0, fmt.Errorf("out of range")
		}
		return int(v), nil
	case float32:
		f := float64(v)
		if math.IsNaN(f) || math.IsInf(f, 0) || math.Trunc(f) != f {
			return 0, fmt.Errorf("not an integer")
		}
		if f < float64(math.MinInt) || f > float64(math.MaxInt) {
			return 0, fmt.Errorf("out of range")
		}
		return int(f), nil
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) || math.Trunc(v) != v {
			return 0, fmt.Errorf("not an integer")
		}
		if v < float64(math.MinInt) || v > float64(math.MaxInt) {
			return 0, fmt.Errorf("out of range")
		}
		return int(v), nil
	default:
		return 0, fmt.Errorf("unsupported type")
	}
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
