---
name: application-test
description: Use when running, writing, or debugging test for frontend or Go-lang backend (Wails files). Covers test layers, commands, principles, and completion criteria for deterministic editor-logic tests in the Run-Calc app.
---

# Application Test Skill

## Goal
Keep frontend tests fast, stable, and focused on deterministic editor logic rather than DOM rendering.

## Test layers

- `src/lineExpression.test.ts` — line parsing helpers (comment splitting, expression extraction, dependency extraction)
- `src/shortcuts.test.ts` — keyboard shortcut mapping in isolation from DOM rendering
- `src/appInteractionLogic.test.ts` — main-window interaction helpers (skip evaluation, operator carry-over, error messages, stale markers)
- `src/utils/worksheetEditing.test.ts` — worksheet edit remapping and declaration parsing helpers
- `src/utils/worksheetLock.test.ts` — worksheet lock/unlock (PBKDF2 hash, legacy SHA-256 support)
- `src/utils/editorIntelligence.test.ts` — identifier context and suggestion-building helpers
- `src/hooks/useEvaluation.test.ts` — evaluation hook logic (stale verification, random state, reevaluation ordering)
- `src/contexts/WorksheetContext.test.ts` — worksheet context behavior (session metadata reset rules)
- `src/contexts/DisplaySettingsContext.test.ts` — display settings context (clipboard preview parsing)

## Backend testing

Go evaluator tests live in `expr_eval_test.go` — main calculations are validated there, not in frontend tests.

## Principles

1. Pure-function tests avoid brittle coupling to component layout, enabling safe UI refactors.
2. For editor behavior changes, add/update tests in helper modules before touching component wiring.
3. Preserve backward-compatible cases; add new cases instead of deleting old expectations.
4. If logic moves between files, move tests with it and keep equivalent coverage for:
   - basic and advanced calculations entry flow
   - syntax/error handling
   - comment handling
   - stale result detection

## Commands

| Action | Command |
|---|---|
| Run all frontend tests | `cd frontend && npm test` (alias for `vitest run`) |
| Run Go tests | `go test ./...` (requires `cd frontend && npm run build` first) |
| Full CI verify | `.\scripts\ci-verify.ps1` |

## Test config

- Framework: Vitest (`environment: 'node'`)
- Config: `frontend/vite.config.ts` — `test.environment = 'node'` (no DOM rendering)
- Test files co-located with source, `*.test.ts` naming convention

## Completion criteria

- All `npm test` Vitest runs pass before committing test changes.
- Go evaluator tests (`go test ./...`) pass when expression evaluation is affected.
- No DOM-rendering or snapshot tests added — keep in `node` environment.
