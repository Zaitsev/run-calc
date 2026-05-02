package main

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

func TestFunctionReference_DocumentedFunctionsAreEvaluatorBacked(t *testing.T) {
	content, err := os.ReadFile("site/src/content/functionReference.ts")
	if err != nil {
		t.Fatalf("failed to read function reference content: %v", err)
	}

	nameRe := regexp.MustCompile(`name:\s*'([A-Za-z0-9]+)'`)
	matches := nameRe.FindAllStringSubmatch(string(content), -1)
	if len(matches) == 0 {
		t.Fatalf("expected at least one documented function name in functionReference.ts")
	}

	allowed := make(map[string]struct{}, len(internalExprFunctions)+len(pipelineItemFirstFunctions)+3)
	for name := range internalExprFunctions {
		allowed[strings.ToLower(name)] = struct{}{}
	}
	for name := range pipelineItemFirstFunctions {
		allowed[strings.ToLower(name)] = struct{}{}
	}

	// Stage-specific functions and aliases handled by the evaluator pipeline/preprocessor.
	allowed["filter"] = struct{}{}
	allowed["map"] = struct{}{}
	allowed["each"] = struct{}{}
	allowed["avg"] = struct{}{}

	for _, match := range matches {
		docName := strings.ToLower(match[1])
		if _, ok := allowed[docName]; !ok {
			t.Fatalf("documented function %q is not evaluator-backed", match[1])
		}
	}
}
