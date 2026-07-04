# Coding Conventions & Constraints

## Critical Constraints

- **LF line endings only**: Enforced via `.gitattributes` and `.github/copilot-instructions.md`. Never introduce CRLF.
- **Indentation**: Go uses tabs (4-wide). Everything else uses 2-space indent (via `.editorconfig`).
- **Auto-generated files** (do not edit directly):
  - `frontend/wailsjs/` — Wails bindings
  - `frontend/dist/` — go:embed dependency
  - `build/bin/` — build output (gitignored)

## File-Scoped Instruction Files

These files auto-trigger during edits of matching file paths:

| File | Applies To | Purpose |
|---|---|---|
| `.github/instructions/expr-evaluator.instructions.md` | `expr_eval.go`, `expr_eval_test.go`, `function_reference_sync_test.go` | Expr function policy, integer coercion, test coverage |
| `.github/instructions/frontend-state-ownership.instructions.md` | `frontend/src/App.tsx`, `frontend/src/contexts/**/*.tsx` | Context ownership boundaries |
| `.github/instructions/dead-code-prevention.instructions.md` | `**/*.go`, `frontend/src/**/*.{ts,tsx}`, `site/src/**/*.{ts,tsx}` | Dead code detection rules |
| `.github/instructions/site-help-sync.instructions.md` | `frontend/src/HelpPanel.tsx`, `site/src/content/helpContent.ts`, site components/pages | Help content sync enforcement |
| `.github/copilot-instructions.md` | All files | General coding rules (minimal code, LF endings, narrow edits) |

## Reference Docs

- `frontend/DESIGN.md` — Visual design system, color tokens, typography
