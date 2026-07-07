# Application

Run-Calc (Wails v2.12.0 + React 19)

Notepad-style expression evaluator with worksheet management, AI integration, and advanced math functions.

**Knowledge Recovery (OpenMemory)**:
- ALWAYS run `openmemory_openmemory_list` or query OpenMemory when catching up, starting a task, or retrieving project/global rules.
- Update OpenMemory regularly with newly established decisions, conventions, or architectural findings so that future agents stay in sync.

#### OpenMemory Tool Guidance
- **`openmemory_openmemory_list`**: Run to inspect the most recent memories for quick catching-up when starting work.
- **`openmemory_openmemory_query`**: Search memories with semantic or factual queries (e.g., search `"frontend tests"`, `"state ownership"`).
- **`openmemory_openmemory_store_project`**: Persist new local conventions, rules, or design decisions (always prefer this for project context).
- **`openmemory_openmemory_store`**: Persist universal programming standards or global guidelines (ask user if unsure).
- **`openmemory_openmemory_get`**: Load the full content and metadata of a specific memory by its ID.
- **`openmemory_openmemory_reinforce`**: Boost the salience of a key memory to keep it prioritized in query results.
- **`openmemory_openmemory_delete`**: Delete obsolete or deprecated memories to prevent stale instructions.

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
