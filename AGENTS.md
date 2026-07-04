# Application

Run-Calc (Wails v2.12.0 + React 19)

Notepad-style expression evaluator with worksheet management, AI integration, and advanced math functions.

**Package manager**: 
 - npm (use `npm install --no-fund` in frontend)
 - use gol-lang tools for wails go files.

| Action | Command |
|---|---|
| Dev server | `wails dev` |
| Tests | `go test ./...` (build frontend first), `cd frontend && npm test` |
| Build | `wails build` / `wails build -clean -nsis` |

- Full commands, repo structure, CI: [`docs/build-and-dev.md`](docs/build-and-dev.md)\
- Library/framework/API/Specifications docs lookups (`context7`,`ctx7`): [`docs/ctx7-workflow.md`](docs/ctx7-workflow.md)\
- Coding conventions & instruction file map: [`docs/constraints.md`](docs/constraints.md)

Load a skill from `<available_skills>` for domain-specific guidance (e.g. `application-calculator`, `application-test`).

When `docs/*` or skills conflict with `.github/copilot-instructions.md`, `docs/*` and skills take precedence.
