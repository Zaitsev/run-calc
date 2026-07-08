# Build & Dev Commands

## Quick Start

| Action | Command |
|---|---|
| Dev server | `wails dev` |
| Multi-session dev (Windows) | `.\scripts\dev-wails.ps1` |
| Release build | `wails build` |
| Windows installer | `wails build -clean -nsis` |
| Go tests | `go test ./...` (run `cd frontend && npm run build` first) |
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

## CI Notes

- **Go tests require frontend build**: Run `cd frontend && npm run build` before `go test ./...`
- **Linux CI requires xvfb**: Use `xvfb-run -a go test ./...` for headless testing
- **Package manager**: Use `npm install --no-fund` (not `npm ci`) in CI to avoid breaking Go security jobs
