# Frontend Testing Architecture

This project keeps frontend tests focused on deterministic editor logic, so tests stay fast and stable while app UI structure evolves.

## Test layers

- `src/lineExpression.test.ts`
  - Tests line parsing helpers used by the main editor flow:
    - comment splitting
    - extracting original expression from `line = result`
    - dependency extraction for stale-line tracking
- `src/shortcuts.test.ts`
  - Tests keyboard shortcut mapping in isolation from DOM rendering.
- `src/appInteractionLogic.test.ts`
  - Tests main-window interaction helpers:
    - when line evaluation should be skipped (empty/comment-only)
    - operator carry-over behavior from previous result
    - user-facing error message mapping
    - stale variable/version marker computation

## Why this structure

- Main calculations are validated in Go (`/expr_eval_test.go`), while frontend tests validate editor interaction decisions.
- Pure-function tests avoid brittle coupling to component layout, enabling safe UI refactors (including planned multi-component + Redux changes).

## Updating tests during refactor

1. Keep parser/evaluation assertions in Go tests unless frontend behavior changes.
2. For editor behavior changes, prefer adding/updating tests in helper modules before touching component wiring.
3. Preserve backward-compatible cases in tests when possible; add new cases instead of deleting old expectations.
4. If logic moves between files, move tests with it and keep equivalent coverage for:
   - basic and advanced calculations entry flow
   - syntax/error handling
   - comment handling
   - stale result detection

## Commands

From `/frontend`:

```bash
npm run test
npm run build
```
