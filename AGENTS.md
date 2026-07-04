# AGENTS.md — Run-Calc (Wails v2.12.0 + React 19)

**Quick reference for agents working on the Run-Calc codebase.**  
For detailed architecture, workflows, and subsystem guidance, use the specialized `application-*` skills.

## Quick Start

| Action | Command |
|---|---|
| Dev server | `wails dev` |
| Multi-session dev (Windows) | `.\scripts\dev-wails.ps1` |
| Release build | `wails build` |
| Windows installer | `wails build -clean -nsis` |
| Go tests | `go test ./...` (requires `cd frontend && npm run build` first) |
| Frontend tests | `cd frontend && npm test` |
| Site build | `cd site && npm run build` |
| Full CI verify | `.\scripts\ci-verify.ps1` |

## Repository Structure

```
./              Go root package (module "calc"), flat — all .go files are package main
frontend/       React 19 + Vite + TypeScript 6 (desktop UI)
site/           MPA Vite + React documentation site, deployed to Firebase
scripts/        dev/cert/pack helpers (run from repo root)
build/          Wails build assets (darwin/, windows/installer), bin/ is gitignored
```

## Critical Constraints

- **LF line endings enforced** via `.gitattributes`. Never introduce CRLF.
- **Indentation**: Go uses tabs (4-wide), everything else uses 2-space indent (`.editorconfig`)
- **Auto-generated files**: `frontend/wailsjs/` (Wails bindings), `frontend/dist/` (go:embed dependency), `build/bin/` (build output)
- **Go tests require frontend build**: Run `cd frontend && npm run build` before `go test ./...`
- **Linux CI requires xvfb**: Use `xvfb-run -a go test ./...` for headless testing
- **Package manager**: Use `npm install --no-fund` (not `npm ci`) in CI to avoid breaking Go security jobs

## Agent Skills (Specialized Guidance)

Use these skills for detailed workflows and subsystem-specific rules:

- **`application-calculator`** — Architecture overview, core editor behaviors, cross-platform deployment
- **`application-test`** — Test layers, commands, principles for frontend/backend testing
- **`application-state-ownership`** — Frontend context ownership boundaries, persistence rules
- **`application-worksheet-management`** — Worksheet lifecycle, tabs UI, secure file save/load
- **`application-help-content-sync`** — Help content source of truth, site/app synchronization
- **`application-version-bump`** — Release version update workflow across canonical files

## Instruction Files (Scoped Rules)

File-scoped instruction files that auto-trigger during edits:

- **`.github/instructions/expr-evaluator.instructions.md`** — Expr function policy (integer coercion, test coverage)
- **`.github/instructions/frontend-state-ownership.instructions.md`** — Context ownership boundaries enforcement
- **`.github/instructions/dead-code-prevention.instructions.md`** — Dead code detection rules
- **`.github/instructions/site-help-sync.instructions.md`** — Help content sync enforcement
- **`.github/copilot-instructions.md`** — General coding rules (minimal code, LF endings, narrow edits)

Reference documentation files:

- **`frontend/DESIGN.md`** — Visual design system, color tokens, typography

When `.github/copilot-instructions.md` conflicts with this file or specialized skills, **AGENTS.md and skills take precedence**.

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
