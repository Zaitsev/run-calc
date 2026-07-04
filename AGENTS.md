# AGENTS.md — Run-Calc (Wails v2.12.0 + React 19)

## Dev commands

| Action | Command |
|---|---|
| Dev server | `wails dev` |
| Multi-session dev (Windows) | `.\scripts\dev-wails.ps1` |
| Release build | `wails build` |
| Windows installer build | `wails build -clean -nsis` |
| Go tests (all) | `go test ./...` (requires `cd frontend && npm run build` first; see Key constraints) |
| Frontend tests | `cd frontend && npm test` |
| Full CI verify (local) | `.\scripts\ci-verify.ps1` |

## Repo structure

```
./              Go root package (module "calc"), flat — all .go files are package main
frontend/       React 19 + Vite + TypeScript 6 (desktop UI)
site/           MPA Vite + React documentation site, deployed to Firebase
scripts/        dev/cert/pack helpers (run from repo root)
build/          Wails build assets (darwin/, windows/installer), bin/ is gitignored
```

## Key constraints

- **LF line endings enforced** via `.gitattributes`. Never introduce CRLF.
- **Go: tabs** (4-wide), **everything else: 2-space indent** (`.editorconfig`)
- `frontend/wailsjs/` — auto-generated bindings, do not edit
- `frontend/dist/` — build output for `go:embed`, must be built before `go test ./...` (frontend build = `cd frontend && npm run build`)
- `build/bin/` — Wails build output, gitignored
- Linux CI requires `xvfb-run` for headless Go tests (`xvfb-run -a go test ./...`)

## Architecture

- **Go backend** (`expr_eval.go`): expression evaluation via `github.com/expr-lang/expr`, custom math functions
- **Frontend** (`frontend/src/main.tsx`): deep provider nesting (Theme, Status, DisplaySettings, WorksheetManager, Worksheet, EditorUI, UIState, Window, AI, ThemeStore → App)
- **State ownership** (`frontend/STATE_OWNERSHIP.md`): each persistence domain has exactly one owner context; `App.tsx` orchestrates only DOM/timing-coupled logic
- **Site** (`site/`): MPA with multi-step build (`tsc && vite build && vite build --ssr && node scripts/build-static-site.mjs`)
- **Frontend path alias** `@site/*` maps to `../site/src/*`

## Design principles
whenever you need to create and/or change design patterns, follow these principles in `frontend/DESIGN.md`

## Testing quirks

- Go tests in root (`*_test.go`) test the expression evaluator and backend logic
- Frontend tests (vitest, `environment: 'node'` in vite.config) test pure editor helper functions — no DOM rendering
- `function_reference_sync_test.go` ensures Go and frontend function reference types stay in sync
- No pre-existing snapshot or integration test suites

## AI assistant

- BYOK only (no built-in keys). Supports OpenAI, Gemini, OpenRouter, Custom (Ollama-compatible endpoints)
- Per-query context modes: Above (default) or Full worksheet

## Expr function policy (README §Contribution Guidelines)

- Numeric intermediate values arrive as `float64` from expr-lang
- Integer-semantic parameters must coerce with explicit error for non-integral floats
- New functions require: literal-arg happy path, float-from-chain happy path, boundary cases, type rejection tests, pipeline + direct-call tests

## Existing instruction files

- `.github/copilot-instructions.md` — general coding rules (minimal code, LF endings, narrow edits)
- When `.github/copilot-instructions.md` conflicts with this file, `AGENTS.md` takes precedence.
- `frontend/STATE_OWNERSHIP.md` — frontend context ownership boundaries
- `frontend/TESTING_ARCHITECTURE.md` — frontend test layer definitions

<!-- context7 -->
Use the `ctx7` CLI to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, specifications, or cloud service -- even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer -- your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.
## IMPORTANT:
run `npx ctx7@latest` command using `cmd` shell.

## Steps

1. Resolve library: `npx ctx7@latest library <name> "<user's question>"` — use the official library name with proper punctuation (e.g., "Next.js" not "nextjs", "Customer.io" not "customerio", "Three.js" not "threejs")
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question)
3. Fetch docs: `npx ctx7@latest docs <libraryId> "<user's question>"`
4. Answer using the fetched documentation

You MUST call `library` first to get a valid ID unless the user provides one directly in `/org/project` format. Use the user's full question as the query -- specific and detailed queries return better results than vague single words. Do not run more than 3 commands per question. Do not include sensitive information (API keys, passwords, credentials) in queries.

For version-specific docs, use `/org/project/version` from the `library` output (e.g., `/vercel/next.js/v14.3.0`).

If a command fails with a quota error, inform the user and suggest `npx ctx7@latest login` or setting `CONTEXT7_API_KEY` env var for higher limits. Do not silently fall back to training data.
<!-- context7 -->
