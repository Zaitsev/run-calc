---
applyTo: "**/*.go,frontend/src/**/*.{ts,tsx},site/src/**/*.{ts,tsx}"
description: "Flag dead code patterns: write-only variables, unused imports, unexported/unexported symbols with no non-test callers, and unreachable branches."
---

When writing or editing code in this file, enforce the following dead-code rules:

## Go

- **Write-only variables**: Every variable must be read at least once after its last assignment. If you assign a variable and never use the value, remove it or replace the assignment with a blank identifier `_` only when the call has a necessary side-effect.
- **Unused imports**: Do not introduce import paths whose identifiers are not referenced in non-test code.
- **Unexported symbols with no app callers**: Before adding a new unexported function or type, confirm it will be called from non-test code. If only tests will call it, reconsider whether it belongs in a `_test.go` file or as a test helper.
- **Exported symbols**: Before exporting a new symbol (capitalised identifier), confirm it is part of the Wails binding surface or will be imported by another non-test package. Do not export for the sole purpose of making it testable.
- **Unreachable code**: Do not write statements after an unconditional `return`, `panic`, or `os.Exit`. Remove dead `else` branches that follow a `return`.

## TypeScript / TSX

- **Unused local variables**: Every declared variable must be read. Prefix intentionally unused destructuring bindings with `_`.
- **Unused imports**: Do not import a module or named export that is not referenced in the file body.
- **Dead exports**: Do not export a symbol from a non-entry-point file unless at least one other file in the source tree imports it.
- **Write-only state**: React state setters must produce state that is read somewhere in the render or passed as a prop. State that is set but never consumed is dead.

## General

When you detect any of the above patterns in code you are reviewing or modifying, flag them in your response and remove them if the task allows file edits.
