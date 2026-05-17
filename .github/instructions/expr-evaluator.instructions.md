---
applyTo: "expr_eval.go,expr_eval_test.go,function_reference_sync_test.go"
description: "Use when changing evaluator functions, exposed Expr behavior, or evaluator tests. Assume expr numeric intermediates may be float64, keep integer coercion explicit and local, and add direct-call and pipeline tests plus rejection cases when integer semantics are required."
---

# Expr Evaluator Rules

## Scope
- Applies to evaluator function changes, exposed Expr behavior changes, and evaluator test updates in the matched files.
- Treat file names in this document as the current evaluator surface. If evaluator responsibilities move, follow the active implementation and tests rather than the historical path.

## Numeric argument rules
- Assume numeric intermediate values from Expr can arrive as `float64`.
- If a function semantically requires an integer argument such as a count, index, or limit, add explicit coercion.
- Accept integral float values such as `2.0`.
- Reject non-integral float values such as `1.5`.
- Return a clear user-facing error for rejected values.
- Keep coercion local to the function wrapper or a small shared helper used only for that coercion path.

## Test requirements
- Add or update evaluator tests for each function behavior change.
- Cover literal-argument success cases.
- Cover success cases where arguments come from prior expressions such as `floor(...)` or arithmetic chains.
- Cover boundary behavior such as zero, negatives, and oversized counts when applicable.
- Cover rejection cases for wrong types and non-integral numeric values when integer semantics are required.
- When both forms are supported, cover both direct-call form and pipeline form.

## Reference sync
- If the set of evaluator-exposed functions changes, keep function reference sync expectations aligned with the evaluator surface.