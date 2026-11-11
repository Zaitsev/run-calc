---
name: application-version-bump
description: Use this ONLY when user asks to bump the application release version
---

# Application Version Bump Skill

## Goal
Update the application release version consistently across canonical source files and packaging metadata.

## Required rules
1. Do not manually edit `build/windows/nsis/wails_tools.nsh` without updating `build/config.yml` (or running `wails3 task common:update:build-assets`).
2. Do not bump the What\'s New history entries in help content/pages unless explicitly requested.
3. Do not edit generated outputs (`frontend/dist`, `site/dist`, installer temp files).
4. Keep edits minimal and version-only.

## Files to update for a standard app release bump
- `build/config.yml` -> `info.version` (x.y.z), then run `wails3 task common:update:build-assets` (updates `build/darwin/Info.plist`, `build/darwin/Info.dev.plist`, `build/windows/info.json`, `build/windows/wails.exe.manifest`, `build/windows/nsis/wails_tools.nsh`, `build/linux/nfpm/nfpm.yaml`)
- `frontend/package.json` -> `version` (x.y.z)
- `frontend/package-lock.json` -> top-level `version` and `packages[""].version` (x.y.z)
- `frontend/src/constants.ts` -> `APP_VERSION` (x.y.z)
- `build/windows/AppxManifest.xml` -> `Identity Version` (x.y.z.0)
- `build/windows/msix/app_manifest.xml` -> `Identity Version` (x.y.z.0)
- `build/windows/msix/template.xml` -> `PackageInformation Version` (x.y.z.0)
- `scripts/pack-msix.ps1` -> usage example and default `-Version` (x.y.z.0)
- `scripts/README.md` -> MSIX version examples (x.y.z.0)

## Files to avoid for this task
- `site/src/content/helpContent.ts` What\'s New version history entries
- `site/src/pages/WhatsNewPage.tsx` historical release text
- Any `dist/` or installer `tmp/` artifacts

## Workflow
1. Choose target semantic version `x.y.z`.
2. Apply updates only to canonical files listed above.
3. Keep Windows/MSIX quad version as `x.y.z.0`.
4. Search for stale old version references in source files and review each hit before editing.
5. Validate builds:
   - `cd frontend && npm run build`
   - `cd site && npm run build`
   - `go build ./...`

## Completion criteria
- Canonical version files are aligned on `x.y.z` (and `x.y.z.0` for MSIX).
- No manual edits were made to generated installer stub `wails_tools.nsh`.
- What\'s New historical help entries were not bumped.
- Frontend, site, and Go build checks pass.
