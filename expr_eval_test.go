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
