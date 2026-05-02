---
name: help-content-sync
description: Keep Run-Calc help content synchronized between the site and in-app Help panel using site/src/content/helpContent.ts as the single source of truth.
---

# Help Content Sync Skill

## Goal
Maintain one canonical help content source and ensure both outputs stay aligned:
- Website help pages under `site/src/pages`.
- In-app help panel in `frontend/src/HelpPanel.tsx`.

In-app help UX policy:
- Keep in-app help concise and beginner-friendly.
- Keep advanced/deep-dive explanations on the site pages.

## Canonical source
- Shared content file: `site/src/content/helpContent.ts`.
- Shared type contract: `site/src/types/help.ts`.

## Required rules
1. Update Operations/Shortcuts/New text only in `site/src/content/helpContent.ts`.
2. Keep `frontend/src/HelpPanel.tsx` rendering via imported arrays from `@site/content/helpContent`.
3. Keep site pages rendering via `HelpList` + shared content imports.
4. Do not reintroduce hardcoded duplicated lists in app or site pages.
5. Keep app-help wording simple and non-experienced-user friendly; move deep-dive content to site pages.
6. Use `VITE_HELP_SITE_URL` for opening the full help site when set; otherwise default to:
   - Dev mode: `http://localhost:3000`
   - Production: `https://run-calc.taalgem.nl/help`

## Workflow
1. Edit shared content and type definitions if needed.
2. Verify references in:
   - `frontend/src/HelpPanel.tsx`
   - `site/src/pages/OperationsPage.tsx`
   - `site/src/pages/ShortcutsPage.tsx`
   - `site/src/pages/WhatsNewPage.tsx`
3. Confirm toolchain wiring remains intact:
   - `frontend/tsconfig.json` alias for `@site/*`.
   - `frontend/vite.config.ts` alias + fs allow for workspace root.
4. Run validation builds when possible:
   - `cd site && npm run build`
   - `cd frontend && npm run build`

## Completion criteria
- Shared content compiles in both projects.
- Both site and frontend build successfully.
- No duplicated Operations/Shortcuts/New content appears outside shared content file.
