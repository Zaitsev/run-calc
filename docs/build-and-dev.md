# Build & Dev Commands

## Quick Start

| Action | Command |
|---|---|
| Dev server | `wails3 dev` |
| Multi-session dev (Windows) | `.\scripts\dev-wails.ps1` |
| Generate bindings | `wails3 generate bindings -ts` |
| Release build | `wails3 task build` |
| Windows build | `wails3 task windows:build` |
| Windows installer | `wails3 task windows:package` |
| Go tests | `go test ./...` (run `cd frontend && npm run build` first) |
| Frontend tests | `cd frontend && npm test` |
| Site build | `cd site && npm run build` |
| Full CI verify | `.\scripts\ci-verify.ps1` |

## Repository Structure

```
./              Go root package (module "calc"), flat — all .go files are package main
frontend/       React 19 + Vite + TypeScript (desktop UI, bindings in frontend/bindings/)
site/           MPA Vite + React documentation site, deployed to Firebase
scripts/        dev/cert/pack helpers (run from repo root)
build/          Wails v3 build configs and assets (config.yml, darwin/, windows/, linux/), bin/ is gitignored
```

## CI Notes

- **Go tests require frontend build**: Run `cd frontend && npm run build` before `go test ./...`
- **Linux CI requires xvfb**: Use `xvfb-run -a go test ./...` for headless testing
- **Package manager**: Use `npm install --no-fund` (not `npm ci`) in CI to avoid breaking Go security jobs
