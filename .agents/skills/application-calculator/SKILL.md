---
name: application-calculator
description: Provides architecture overview and guidance for Run-Calc, a Wails (Go + React + TypeScript) notepad-style expression evaluator with worksheet management, AI assistant integration, and advanced mathematical functions.
---

# Application Calculator Skill

## Goal
Understand and maintain the Run-Calc desktop expression evaluator app architecture:
- Notepad-style editor with inline evaluation (no calculator buttons)
- User types expressions and presses Enter to evaluate inline as `expression = result`
- Backend expression evaluation via `expr-lang/expr` with custom math functions
- Multi-worksheet management with secure file save/load
- AI assistant integration with context-aware queries
- Theme system with OpenVSX import support
- Cross-platform desktop deployment (Windows, macOS, Linux)

## Architecture Overview

### Backend (Go)
- **Expression evaluator** (`expr_eval.go`): Evaluates expressions using `github.com/expr-lang/expr` with custom math functions
- **Worksheet security** (`secure_worksheet_*.go`): Platform-specific encrypted file save/load using OS secure storage
- **Theme support** (`theme.go`): OpenVSX theme import and validation
- **Wails bindings**: Exposed Go methods callable from frontend TypeScript

### Frontend (React 19 + TypeScript)
- **Provider nesting** (`frontend/src/main.tsx`): Theme → Status → DisplaySettings → WorksheetManager → Worksheet → EditorUI → UIState → Window → AI → ThemeStore → App
- **State ownership** (see `application-state-ownership` skill): Each persistence domain has one owner context
- **App orchestration** (`frontend/src/App.tsx`): DOM/timing-coupled logic, editor events, keyboard flows
- **Help system** (`frontend/src/HelpPanel.tsx`): Renders from shared `@site/content/helpContent` source

### Site (Documentation)
- MPA Vite + React documentation site in `site/`
- Shared help content source of truth: `site/src/content/helpContent.ts`
- Deployed to Firebase at `https://run-calc.taalgem.nl/`

### Expression Features
- **Operators**: `+`, `-`, `*`, `/`, `%`, `^`, comparison, logical
- **Variables**: User-defined variables with assignment (`x = 5`)
- **Functions**: Extensive math library (trig, stats, aggregation, etc.)
- **Pipeline syntax**: expr-lang pipeline support (`[1,2,3] | sum()`)
- **Comments**: Line comments with `#` or `//`

## Key Workflows

### Making Feature Changes
1. **Check scope**: Determine which layer(s) are affected (Go backend, frontend contexts, UI components, site docs)
2. **Review state ownership**: If adding/modifying shared state, identify the owner context (see `application-state-ownership` skill)
3. **Update help content**: Use `application-help-content-sync` skill to update shared help content source
4. **Follow design system**: Use tokens from `frontend/DESIGN.md` for any UI changes
5. **Test in dev mode**: Run `wails dev` for live reload during development
6. **Update relevant skills**: If the change affects architecture patterns, update this or other application-* skills

### Expression Evaluator Changes
When modifying expression evaluation behavior:
1. Edit Go backend in `expr_eval.go`
2. Follow `expr-evaluator.instructions.md` for function rules (integer coercion, test coverage)
3. Add tests in `expr_eval_test.go`
4. Update function reference sync if exposing new functions
5. Update help content Operations list if user-visible

### Worksheet Management Changes
When modifying worksheet lifecycle, tabs, or file operations:
1. Use `application-worksheet-management` skill for guidance
2. Respect single-owner persistence rule
3. Test multi-worksheet isolation
4. Verify secure file save/load flow if touching encryption

### Version Bump
Use `application-version-bump` skill when releasing - it updates canonical version files without touching generated installer stubs or historical help entries.

## Development Commands

| Action | Command |
|---|---|
| Dev server | `wails dev` (from repo root) |
| Multi-session dev (Windows) | `.\scripts\dev-wails.ps1` |
| Release build | `wails build` |
| Windows installer | `wails build -clean -nsis` |
| Go tests | `go test ./...` (requires `cd frontend && npm run build` first) |
| Frontend tests | `cd frontend && npm test` |
| Site build | `cd site && npm run build` |
| Full CI verify | `.\scripts\ci-verify.ps1` |

### Important Dev Notes
- **Always run from repo root**: `wails dev`, `go test ./...`, `go build` must run from project root, not `frontend/`
- **Dev mode auto-rebuilds frontend**: No need to run `npm run build` during active development
- **Go tests require frontend build**: Run `cd frontend && npm run build` before `go test ./...` (frontend dist is go:embed dependency)
- **Linux CI requires xvfb**: Use `xvfb-run -a go test ./...` for headless testing
- **Do not use `npm ci`**: This repo uses `npm install --no-fund` in CI (using `npm ci` breaks Go security/build jobs)

## Core Editor Behaviors

### Line Evaluation (Enter key)
- **Empty line**: Insert newline only
- **Line with existing `=`**: Insert newline only (don't re-evaluate)
- **Expression line**: Send to Go backend via `EvaluateExpression` binding
- **Operator-only line**: Auto-prefix with previous result if available
- **Success**: Replace line with `expr = result`, store result in session state
- **Error**: Replace line with `expr = error`, show user-friendly status message

### Variable Persistence
- Variables are worksheet-scoped (each worksheet has independent variable state)
- Marked lines (`=variable` syntax) persist across evaluation
- Gutter shows variable declaration indicator
- Variable values stored in worksheet snapshot

### AI Integration
- Trigger with `?` prefix or keyboard shortcut
- Context modes: Above (default) or Full worksheet
- BYOK model support: OpenAI, Gemini, OpenRouter, Custom (Ollama-compatible)
- Streaming responses with inline rendering

### Multi-Worksheet Support
- Create, rename, delete, switch worksheets via tabs UI
- Each worksheet has isolated content, variables, marked lines
- localStorage persistence with debounced updates
- Secure file save/load with AES-256-GCM encryption + OS keychain storage

## Cross-References

When working on specific subsystems, use these specialized skills:
- **Help content changes**: `application-help-content-sync` skill
- **State/context changes**: `application-state-ownership` skill
- **Worksheet/tab changes**: `application-worksheet-management` skill
- **Version bumps**: `application-version-bump` skill
- **Test changes**: `application-test` skill (test layers, commands, principles)

Auto-triggered instruction files:
- **Expr function policy**: `.github/instructions/expr-evaluator.instructions.md`
- **State ownership enforcement**: `.github/instructions/frontend-state-ownership.instructions.md`
- **Dead code prevention**: `.github/instructions/dead-code-prevention.instructions.md`
- **Help sync enforcement**: `.github/instructions/site-help-sync.instructions.md`


## Visual Design & Theming

For color tokens, typography, spacing, surfaces, gutter visual states, syntax highlighting, and theme system details (including OpenVSX theme import, TextMate scope mapping, and CSS variable fallback chains), see `frontend/DESIGN.md`.

Key design principles:
- **All colors via CSS custom properties** (never hardcode hex/rgb)
- **Built-in themes**: light, dark, light-high-contrast, dark-high-contrast, system
- **Custom theme support**: Import from OpenVSX with live preview
- **Typography**: Nunito for UI/editor, Courier New for gutter line numbers
- **Gutter visual states**: Error, truncated-zero, stale, AI, marked, variable declaration
- **Syntax highlighting**: Token-based overlay with fallback chains for custom themes

## Repository Structure

```
./              Go root package (module "calc"), flat — all .go files are package main
frontend/       React 19 + Vite + TypeScript 6 (desktop UI)
site/           MPA Vite + React documentation site
scripts/        dev/cert/pack helpers (run from repo root)
build/          Wails build assets (darwin/, windows/installer), bin/ is gitignored
```

## Quality Standards

- **LF line endings enforced** via `.gitattributes` (never introduce CRLF)
- **Indentation**: Go uses tabs (4-wide), everything else uses 2-space indent (`.editorconfig`)
- **Auto-generated files**: `frontend/wailsjs/` (Wails bindings, do not edit manually)
- **Help content**: Keep `site/src/content/helpContent.ts` as single source of truth
- **State ownership**: One owner per persistence domain (use `application-state-ownership` skill)
- **Dead code prevention**: Auto-enforced via `.github/instructions/dead-code-prevention.instructions.md`
