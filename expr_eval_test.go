package main

import (
	"math"
	"strings"
	"testing"
)

func TestEvaluateExprProgram_AssignmentAndAggregation(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("@incomes = [4500, 5200, 3800, 6100]", scope)
	if err != nil {
		t.Fatalf("assignment failed: %v", err)
	}

	if _, ok := value.([]interface{}); !ok {
		t.Fatalf("expected assigned list value, got %T", value)
	}

	sumValue, err := evaluateExprProgram("@incomes | filter(# > 4000) | sum", scope)
	if err != nil {
		t.Fatalf("sum pipeline failed: %v", err)
	}

	num, ok := toFloat64(sumValue)
	if !ok || num != 15800 {
		t.Fatalf("expected 15800, got %#v", sumValue)
	}
}

func TestEvaluateExprProgram_AvgFunction(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("avg([4500, 5200, 3800, 6100])", scope)
	if err != nil {
		t.Fatalf("avg failed: %v", err)
	}

	num, ok := toFloat64(value)
	if !ok || num != 4900 {
		t.Fatalf("expected 4900, got %#v", value)
	}
}

func TestEvaluateExprProgram_CountAndAggregationFunctions(t *testing.T) {
	scope := map[string]interface{}{}

	// Test count as len alias
	countResult, err := evaluateExprProgram("count([4500, 5200, 3800, 6100])", scope)
	if err != nil {
		t.Fatalf("count failed: %v", err)
	}

	num, ok := toFloat64(countResult)
	if !ok || num != 4 {
		t.Fatalf("expected 4 from count, got %#v", countResult)
	}

	// Test count in pipeline
	pipelineValue, pipelineErr := evaluateExprProgram("@incomes = [4500, 5200, 3800, 6100]; @incomes | filter(# > 4000) | count", scope)
	if pipelineErr != nil {
		t.Fatalf("count pipeline failed: %v", pipelineErr)
	}

	pipelineNum, pipelineOK := toFloat64(pipelineValue)
	if !pipelineOK || pipelineNum != 3 {
		t.Fatalf("expected 3 from count pipeline, got %#v", pipelineValue)
	}

	// Test avg alias for mean
	avgResult, avgErr := evaluateExprProgram("avg([1, 2, 3, 4, 5])", scope)
	if avgErr != nil {
		t.Fatalf("avg alias failed: %v", avgErr)
	}

	avgNum, avgOK := toFloat64(avgResult)
	if !avgOK || avgNum != 3 {
		t.Fatalf("expected 3 from avg, got %#v", avgResult)
	}

	// Test native mean
	meanResult, meanErr := evaluateExprProgram("mean([1, 2, 3, 4, 5])", scope)
	if meanErr != nil {
		t.Fatalf("mean failed: %v", meanErr)
	}

	meanNum, meanOK := toFloat64(meanResult)
	if !meanOK || meanNum != 3 {
		t.Fatalf("expected 3 from mean, got %#v", meanResult)
	}
}

func TestEvaluateExprProgram_PipelineFunctionShorthand(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("@a = [0, PI/2]; @a | map(sin)", scope)
	if err != nil {
		t.Fatalf("map shorthand failed: %v", err)
	}

	items, ok := value.([]interface{})
	if !ok || len(items) != 2 {
		t.Fatalf("expected 2 mapped values, got %#v", value)
	}

	first, firstOK := toFloat64(items[0])
	second, secondOK := toFloat64(items[1])
	if !firstOK || !secondOK {
		t.Fatalf("expected numeric mapped values, got %#v", items)
	}

	if math.Abs(first-0) > 1e-9 || math.Abs(second-1) > 1e-9 {
		t.Fatalf("expected [0, 1], got %#v", items)
	}
}

func TestEvaluateExprProgram_EachAliasForMap(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("@a = [0, PI/2]; @a | each(sin)", scope)
	if err != nil {
		t.Fatalf("each shorthand failed: %v", err)
	}

	items, ok := value.([]interface{})
	if !ok || len(items) != 2 {
		t.Fatalf("expected 2 mapped values from each alias, got %#v", value)
	}

	first, firstOK := toFloat64(items[0])
	second, secondOK := toFloat64(items[1])
	if !firstOK || !secondOK {
		t.Fatalf("expected numeric values from each alias, got %#v", items)
	}

	if math.Abs(first-0) > 1e-9 || math.Abs(second-1) > 1e-9 {
		t.Fatalf("expected [0, 1] from each alias, got %#v", items)
	}
}

func TestEvaluateExprProgram_ArrayPipelineFunctions(t *testing.T) {
	scope := map[string]interface{}{}

	sortedValue, err := evaluateExprProgram("[3, 1, 2] | sort", scope)
	if err != nil {
		t.Fatalf("sort pipeline failed: %v", err)
	}

	sortedItems, ok := sortedValue.([]interface{})
	if !ok || len(sortedItems) != 3 {
		t.Fatalf("expected sorted array of 3 items, got %#v", sortedValue)
	}

	if first, _ := toFloat64(sortedItems[0]); first != 1 {
		t.Fatalf("expected sorted first value 1, got %#v", sortedItems[0])
	}
	if second, _ := toFloat64(sortedItems[1]); second != 2 {
		t.Fatalf("expected sorted second value 2, got %#v", sortedItems[1])
	}
	if third, _ := toFloat64(sortedItems[2]); third != 3 {
		t.Fatalf("expected sorted third value 3, got %#v", sortedItems[2])
	}

	reversedValue, reverseErr := evaluateExprProgram("[1, 2, 3] | reverse", scope)
	if reverseErr != nil {
		t.Fatalf("reverse pipeline failed: %v", reverseErr)
	}

	reversedItems, ok := reversedValue.([]interface{})
	if !ok || len(reversedItems) != 3 {
		t.Fatalf("expected reversed array of 3 items, got %#v", reversedValue)
	}

	if first, _ := toFloat64(reversedItems[0]); first != 3 {
		t.Fatalf("expected reverse first value 3, got %#v", reversedItems[0])
	}

	uniqValue, uniqErr := evaluateExprProgram("[1, 1, 2, 3, 3] | uniq", scope)
	if uniqErr != nil {
		t.Fatalf("uniq pipeline failed: %v", uniqErr)
	}

	uniqItems, ok := uniqValue.([]interface{})
	if !ok || len(uniqItems) != 3 {
		t.Fatalf("expected uniq array of 3 items, got %#v", uniqValue)
	}

	firstValue, firstErr := evaluateExprProgram("[9, 8, 7] | first", scope)
	if firstErr != nil {
		t.Fatalf("first pipeline failed: %v", firstErr)
	}
	if first, ok := toFloat64(firstValue); !ok || first != 9 {
		t.Fatalf("expected first value 9, got %#v", firstValue)
	}

	lastValue, lastErr := evaluateExprProgram("[9, 8, 7] | last", scope)
	if lastErr != nil {
		t.Fatalf("last pipeline failed: %v", lastErr)
	}
	if last, ok := toFloat64(lastValue); !ok || last != 7 {
		t.Fatalf("expected last value 7, got %#v", lastValue)
	}

	takeValue, takeErr := evaluateExprProgram("[9, 8, 7, 6] | take(2)", scope)
	if takeErr != nil {
		t.Fatalf("take pipeline failed: %v", takeErr)
	}

	takenItems, ok := takeValue.([]interface{})
	if !ok || len(takenItems) != 2 {
		t.Fatalf("expected take(2) array of 2 items, got %#v", takeValue)
	}
	if first, _ := toFloat64(takenItems[0]); first != 9 {
		t.Fatalf("expected take first value 9, got %#v", takenItems[0])
	}
	if second, _ := toFloat64(takenItems[1]); second != 8 {
		t.Fatalf("expected take second value 8, got %#v", takenItems[1])
	}
}

func TestEvaluateExprProgram_TakeCoercesIntegralFloatCount(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("index_floor = floor(2.9); [10, 20, 30, 40] | take(index_floor)", scope)
	if err != nil {
		t.Fatalf("take with coerced float count failed: %v", err)
	}

	items, ok := value.([]interface{})
	if !ok || len(items) != 2 {
		t.Fatalf("expected 2 items after take(index_floor), got %#v", value)
	}

	first, firstOK := toFloat64(items[0])
	second, secondOK := toFloat64(items[1])
	if !firstOK || !secondOK || first != 10 || second != 20 {
		t.Fatalf("expected [10, 20], got %#v", items)
	}
}

func TestEvaluateExprProgram_TakeRejectsNonIntegralFloatCount(t *testing.T) {
	scope := map[string]interface{}{}

	_, err := evaluateExprProgram("[10, 20, 30] | take(1.5)", scope)
	if err == nil {
		t.Fatalf("expected take(1.5) to fail")
	}

	if !strings.Contains(strings.ToLower(err.Error()), "take expects an integer count") {
		t.Fatalf("expected integer-count error, got %v", err)
	}
}

func TestEvaluateExprProgram_ArrayFunctionTypedArgumentFlow(t *testing.T) {
	scope := map[string]interface{}{}

	// Desc sort order from variable should flow to sort(item, order).
	sortedDesc, sortErr := evaluateExprProgram("order = 'desc'; [1, 3, 2] | sort(order)", scope)
	if sortErr != nil {
		t.Fatalf("sort(order) failed: %v", sortErr)
	}

	sortedItems, ok := sortedDesc.([]interface{})
	if !ok || len(sortedItems) != 3 {
		t.Fatalf("expected sorted array, got %#v", sortedDesc)
	}
	if first, _ := toFloat64(sortedItems[0]); first != 3 {
		t.Fatalf("expected desc sort first value 3, got %#v", sortedItems[0])
	}

	// This mirrors the real world issue: floor() returns float64 and must still work for take().
	takeFromFloatExpr, takeErr := evaluateExprProgram("count_floor = floor(3.2); [10, 20, 30, 40] | take(count_floor)", scope)
	if takeErr != nil {
		t.Fatalf("take(count_floor) failed: %v", takeErr)
	}

	taken, ok := takeFromFloatExpr.([]interface{})
	if !ok || len(taken) != 3 {
		t.Fatalf("expected 3 taken items, got %#v", takeFromFloatExpr)
	}
}

func TestEvaluateExprProgram_TakeCoercionMatrix(t *testing.T) {
	tests := []struct {
		name        string
		expr        string
		expectedLen int
		wantErr     bool
	}{
		{
			name:        "int literal",
			expr:        "[1,2,3,4] | take(2)",
			expectedLen: 2,
		},
		{
			name:        "integral float literal",
			expr:        "[1,2,3,4] | take(2.0)",
			expectedLen: 2,
		},
		{
			name:        "integral float variable",
			expr:        "n = floor(2.8); [1,2,3,4] | take(n)",
			expectedLen: 2,
		},
		{
			name:        "direct call integral float",
			expr:        "take([1,2,3,4], floor(2.8))",
			expectedLen: 2,
		},
		{
			name:        "zero count",
			expr:        "[1,2,3] | take(0)",
			expectedLen: 0,
		},
		{
			name:        "negative count",
			expr:        "[1,2,3] | take(-3)",
			expectedLen: 0,
		},
		{
			name:        "non integral float",
			expr:        "[1,2,3] | take(1.2)",
			wantErr:     true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			scope := map[string]interface{}{}
			value, err := evaluateExprProgram(tc.expr, scope)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error for expression %q", tc.expr)
				}
				if !strings.Contains(strings.ToLower(err.Error()), "take expects an integer count") {
					t.Fatalf("expected integer count error, got %v", err)
				}
				return
			}

			if err != nil {
				t.Fatalf("expression failed: %v", err)
			}

			items, ok := value.([]interface{})
			if !ok {
				t.Fatalf("expected array result, got %#v", value)
			}
			if len(items) != tc.expectedLen {
				t.Fatalf("expected %d items, got %d (%#v)", tc.expectedLen, len(items), items)
			}
		})
	}
}

func TestEvaluateExprProgram_ModuloWithVariableOperands(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("a = 11; a % 5", scope)
	if err != nil {
		t.Fatalf("a %% 5 failed: %v", err)
	}

	n, ok := toFloat64(value)
	if !ok || n != 1 {
		t.Fatalf("expected 1 for a %% 5, got %#v", value)
	}

	value, err = evaluateExprProgram("a = 11; 5 % a", scope)
	if err != nil {
		t.Fatalf("5 %% a failed: %v", err)
	}

	n, ok = toFloat64(value)
	if !ok || n != 5 {
		t.Fatalf("expected 5 for 5 %% a, got %#v", value)
	}

	value, err = evaluateExprProgram("a = 17; b = 5; a % b", scope)
	if err != nil {
		t.Fatalf("a %% b failed: %v", err)
	}

	n, ok = toFloat64(value)
	if !ok || n != 2 {
		t.Fatalf("expected 2 for a %% b, got %#v", value)
	}
}

func TestEvaluateExprProgram_ModuloCoercesIntegralFloats(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("a = floor(11.9); b = floor(3.9); a % b", scope)
	if err != nil {
		t.Fatalf("modulo with integral-float vars failed: %v", err)
	}

	n, ok := toFloat64(value)
	if !ok || n != 2 {
		t.Fatalf("expected 2 for floor-based modulo, got %#v", value)
	}
}

func TestEvaluateExprProgram_ModuloRejectsNonIntegralOperands(t *testing.T) {
	scope := map[string]interface{}{}

	_, err := evaluateExprProgram("a = 5.5; a % 2", scope)
	if err == nil {
		t.Fatalf("expected non-integral modulo to fail")
	}

	if !strings.Contains(strings.ToLower(err.Error()), "modulo expects integer operands") {
		t.Fatalf("expected integer-operand modulo error, got %v", err)
	}
}

func TestEvaluateExprProgram_MultilineBacktickBlock(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("`@a = 2\n@b = 3\n@a + @b`", scope)
	if err != nil {
		t.Fatalf("multiline block failed: %v", err)
	}

	num, ok := toFloat64(value)
	if !ok || num != 5 {
		t.Fatalf("expected 5, got %#v", value)
	}
}

func TestEvaluateExprProgram_SupportsLineComments(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("2 + 3 \" simple comment", scope)
	if err != nil {
		t.Fatalf("commented expression failed: %v", err)
	}

	num, ok := toFloat64(value)
	if !ok || num != 5 {
		t.Fatalf("expected 5 from commented expression, got %#v", value)
	}

	_, assignErr := evaluateExprProgram("@a = 10 \" keep for notes", scope)
	if assignErr != nil {
		t.Fatalf("commented assignment failed: %v", assignErr)
	}

	assigned, exists := scope["a"]
	if !exists {
		t.Fatalf("expected variable a to be assigned")
	}

	assignedNum, ok := toFloat64(assigned)
	if !ok || assignedNum != 10 {
		t.Fatalf("expected assigned value 10, got %#v", assigned)
	}
}

func TestEvaluateExprProgram_CommentOnlyIsNoOp(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("\"comment only", scope)
	if err != nil {
		t.Fatalf("comment-only expression should not fail: %v", err)
	}
	if value != nil {
		t.Fatalf("expected nil value for comment-only expression, got %#v", value)
	}

	blockValue, blockErr := evaluateExprProgram("\" first\n\" second", scope)
	if blockErr != nil {
		t.Fatalf("comment-only multiline expression should not fail: %v", blockErr)
	}
	if blockValue != nil {
		t.Fatalf("expected nil value for comment-only multiline expression, got %#v", blockValue)
	}
}

func TestEvaluateExprProgram_TrigAndCommonMathFunctions(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("sin(PI / 2) + cos(0) + sqrt(16) + pow(2, 3)", scope)
	if err != nil {
		t.Fatalf("math function evaluation failed: %v", err)
	}

	num, ok := toFloat64(value)
	if !ok {
		t.Fatalf("expected numeric result, got %T", value)
	}

	if math.Abs(num-14) > 1e-9 {
		t.Fatalf("expected 14, got %v", num)
	}
}

func TestEvaluateExprProgram_MinMaxHypotSignAndConstants(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("max(1, 5, -2) + min([8, 3, 9]) + hypot(3, 4) + sign(-8) + LN2", scope)
	if err != nil {
		t.Fatalf("extended math function evaluation failed: %v", err)
	}

	num, ok := toFloat64(value)
	if !ok {
		t.Fatalf("expected numeric result, got %T", value)
	}

	expected := 5 + 3 + 5 - 1 + math.Ln2
	if math.Abs(num-expected) > 1e-9 {
		t.Fatalf("expected %v, got %v", expected, num)
	}
}

func TestEvaluateExprProgram_ExpandedMathConstants(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("TAU + PHI + SQRTE + SQRTPI + SQRTPHI + SQRT1_2", scope)
	if err != nil {
		t.Fatalf("expanded constants evaluation failed: %v", err)
	}

	num, ok := toFloat64(value)
	if !ok {
		t.Fatalf("expected numeric result, got %T", value)
	}

	expected := 2*math.Pi + math.Phi + math.SqrtE + math.SqrtPi + math.SqrtPhi + 1/math.Sqrt2
	if math.Abs(num-expected) > 1e-9 {
		t.Fatalf("expected %v, got %v", expected, num)
	}
}

func TestEvaluateExprProgram_PreventsInternalNameReassignment(t *testing.T) {
	scope := map[string]interface{}{}

	blockedAssignments := []string{
		"pi = 30",
		"sin = 5",
		"sum = 9",
		"filter = 1",
		"map = 1",
		"each = 1",
		"item = 1",
		"true = 1",
	}

	for _, statement := range blockedAssignments {
		_, err := evaluateExprProgram(statement, scope)
		if err == nil {
			t.Fatalf("expected reassignment to fail for %q", statement)
		}

		if !strings.Contains(strings.ToLower(err.Error()), "cannot reassign internal name") {
			t.Fatalf("expected internal name reassignment error for %q, got %v", statement, err)
		}
	}

	if _, exists := scope["pi"]; exists {
		t.Fatalf("scope should not contain reassigned internal name")
	}
	if _, exists := scope["sin"]; exists {
		t.Fatalf("scope should not contain reassigned internal name")
	}

	value, evalErr := evaluateExprProgram("PI", scope)
	if evalErr != nil {
		t.Fatalf("constant should remain available after failed internal reassignment: %v", evalErr)
	}

	num, ok := toFloat64(value)
	if !ok || math.Abs(num-math.Pi) > 1e-9 {
		t.Fatalf("expected PI constant value, got %#v", value)
	}

	sinValue, sinErr := evaluateExprProgram("sin(PI/2)", scope)
	if sinErr != nil {
		t.Fatalf("function should remain available after failed internal reassignment: %v", sinErr)
	}

	sinNum, ok := toFloat64(sinValue)
	if !ok || math.Abs(sinNum-1) > 1e-9 {
		t.Fatalf("expected sin(PI/2) to be 1, got %#v", sinValue)
	}
}

func TestEvaluateExprProgram_RejectsFunctionValues(t *testing.T) {
	scope := map[string]interface{}{}

	_, err := evaluateExprProgram("sin", scope)
	if err == nil {
		t.Fatalf("expected bare function reference to fail")
	}

	if !strings.Contains(strings.ToLower(err.Error()), "function values are not supported") {
		t.Fatalf("expected function-value rejection error, got %v", err)
	}

	_, assignErr := evaluateExprProgram("f = sin", scope)
	if assignErr == nil {
		t.Fatalf("expected function assignment to fail")
	}

	if _, exists := scope["f"]; exists {
		t.Fatalf("scope should not keep function value assignment")
	}

	filterErrCase, filterErr := evaluateExprProgram("@a = [0, PI/2]; @a | filter(sin)", scope)
	if filterErr == nil {
		t.Fatalf("expected filter(sin) shorthand to fail boolean conversion, got %#v", filterErrCase)
	}

	if !strings.Contains(strings.ToLower(filterErr.Error()), "filter predicate must return true or false") {
		t.Fatalf("expected boolean predicate error for filter(sin), got %v", filterErr)
	}
}

func TestEvaluateExprProgram_RejectsNaNAndInf(t *testing.T) {
	scope := make(map[string]interface{})

	// asin domain is [-1, 1], so asin(2) produces NaN
	_, asinErr := evaluateExprProgram("@out = [1, 2] | map(asin)", scope)
	if asinErr == nil {
		t.Fatalf("expected NaN in array to be rejected")
	}

	if !strings.Contains(strings.ToLower(asinErr.Error()), "nan") {
		t.Fatalf("expected NaN rejection error, got %v", asinErr)
	}

	// acos domain is [-1, 1], so acos(2) produces NaN
	_, acosErr := evaluateExprProgram("@result = [-2, 0, 2] | map(acos)", scope)
	if acosErr == nil {
		t.Fatalf("expected NaN in array from acos to be rejected")
	}

	if !strings.Contains(strings.ToLower(acosErr.Error()), "nan") {
		t.Fatalf("expected NaN rejection error for acos, got %v", acosErr)
	}

	// log of negative or zero produces -Inf/NaN
	_, logErr := evaluateExprProgram("@data = [-1, 0, 1] | map(log)", scope)
	if logErr == nil {
		t.Fatalf("expected Inf/NaN in array from log to be rejected")
	}

	if !strings.Contains(strings.ToLower(logErr.Error()), "inf") && !strings.Contains(strings.ToLower(logErr.Error()), "nan") {
		t.Fatalf("expected Inf/NaN rejection error for log, got %v", logErr)
	}
}

func TestEvaluateExprProgram_IsCaseAgnostic(t *testing.T) {
	scope := map[string]interface{}{}

	_, err := evaluateExprProgram("@IncomeS = [4500, 5200, 3800, 6100]", scope)
	if err != nil {
		t.Fatalf("mixed-case assignment failed: %v", err)
	}

	value, err := evaluateExprProgram("@INCOMES | FiLtEr(# > 4000) | SuM", scope)
	if err != nil {
		t.Fatalf("case-agnostic pipeline evaluation failed: %v", err)
	}

	num, ok := toFloat64(value)
	if !ok {
		t.Fatalf("expected numeric result, got %T", value)
	}

	expected := 4500.0 + 5200.0 + 6100.0
	if math.Abs(num-expected) > 1e-9 {
		t.Fatalf("expected %v, got %v", expected, num)
	}

	mathValue, err := evaluateExprProgram("SiN(pI / 2) + sqRT(16) + tAu", scope)
	if err != nil {
		t.Fatalf("case-agnostic math evaluation failed: %v", err)
	}

	mathNum, ok := toFloat64(mathValue)
	if !ok {
		t.Fatalf("expected numeric math result, got %T", mathValue)
	}

	mathExpected := 1.0 + 4.0 + 2*math.Pi
	if math.Abs(mathNum-mathExpected) > 1e-9 {
		t.Fatalf("expected %v, got %v", mathExpected, mathNum)
	}

	if _, exists := scope["incomes"]; !exists {
		t.Fatalf("expected normalized lowercase variable key in scope")
	}
}
func TestEvaluateExprProgram_MathFunctionPipelineStage(t *testing.T) {
	tests := []struct {
		name     string
		expr     string
		expected float64
	}{
		{"ceil via pipeline", "3.2 | ceil", 4},
		{"floor via pipeline", "3.9 | floor", 3},
		{"round via pipeline", "3.5 | round", 4},
		{"abs via pipeline", "-5 | abs", 5},
		{"sqrt via pipeline", "9 | sqrt", 3},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			scope := map[string]interface{}{}
			val, err := evaluateExprProgram(tc.expr, scope)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			n, ok := toFloat64(val)
			if !ok {
				t.Fatalf("expected number, got %T", val)
			}
			if math.Abs(n-tc.expected) > 1e-9 {
				t.Fatalf("expected %v, got %v", tc.expected, n)
			}
		})
	}
}

func TestEvaluateExprProgram_EnrichedErrors(t *testing.T) {
	tests := []struct {
		name    string
		expr    string
		wantMsg string
	}{
		{
			name:    "pipe inside arithmetic parens",
			expr:    "a = [1,2,3,4]; 0.9 * (a | count)",
			wantMsg: "pipe operator inside parentheses is not supported",
		},
		{
			name:    "pipe inside divisor parens",
			expr:    "a = [1,2,3]; 100 / (a | sum)",
			wantMsg: "pipe operator inside parentheses is not supported",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			scope := map[string]interface{}{}
			_, err := evaluateExprProgram(tc.expr, scope)
			if err == nil {
				t.Fatalf("expected error for %q", tc.expr)
			}
			if !strings.Contains(err.Error(), tc.wantMsg) {
				t.Fatalf("expected %q in error, got: %v", tc.wantMsg, err)
			}
		})
	}
}

func TestEvaluateExprProgram_UniformRandom(t *testing.T) {
	scope := map[string]interface{}{}

	for i := 0; i < 50; i++ {
		value, err := evaluateExprProgram("uniform()", scope)
		if err != nil {
			t.Fatalf("uniform() failed: %v", err)
		}
		n, ok := toFloat64(value)
		if !ok {
			t.Fatalf("expected numeric result from uniform(), got %T", value)
		}
		if n < 0 || n >= 1 {
			t.Fatalf("uniform() out of range [0,1): %v", n)
		}
	}

	_, err := evaluateExprProgram("uniform(5)", scope)
	if err == nil {
		t.Fatalf("expected uniform(5) to fail because uniform() accepts no arguments")
	}
}

func TestEvaluateExprProgram_NormalRandom(t *testing.T) {
	scope := map[string]interface{}{}

	value, err := evaluateExprProgram("normal()", scope)
	if err != nil {
		t.Fatalf("normal() failed: %v", err)
	}
	n, ok := toFloat64(value)
	if !ok {
		t.Fatalf("expected numeric result from normal(), got %T", value)
	}
	if math.IsNaN(n) || math.IsInf(n, 0) {
		t.Fatalf("expected finite value from normal(), got %v", n)
	}

	_, err = evaluateExprProgram("normal(0)", scope)
	if err == nil {
		t.Fatalf("expected normal(0) to fail because normal() accepts no arguments")
	}
}