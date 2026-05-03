---
applyTo: "frontend/src/HelpPanel.tsx,site/src/content/helpContent.ts,site/src/pages/**/*.tsx,site/src/components/**/*.tsx,site/src/types/help.ts"
description: "Use when changing help text or help UI. Keep site/src/content/helpContent.ts as the single source of truth for Operations/Shortcuts/New and render from it in both site and app help."
---

# Site-Based Help Sync Rules

## Scope
- Applies only to the site and in-app help files matched by `applyTo`.

## Source of truth
- Keep shared help text in `site/src/content/helpContent.ts`.
- Do not duplicate Operations/Shortcuts/New arrays in `frontend/src/HelpPanel.tsx`.
- Keep in-app help concise, simple, and friendly for non-experienced users.
- Put deep-dive and advanced explanations on the site help pages.

## Help URL policy
- Open full help site via frontend env var `VITE_HELP_SITE_URL` when set.
- Default URL behavior:
  - Dev mode: `http://localhost:3001`
  - Production: `https://run-calc.taalgem.nl/help`

## Update workflow
1. Edit `site/src/content/helpContent.ts` first.
2. Ensure site pages still render lists from shared content.
3. Ensure `frontend/src/HelpPanel.tsx` still imports and maps shared content.

## Quality checks
- Preserve key names and type compatibility with `site/src/types/help.ts`.
- For behavioral changes, update relevant New entries in shared content.
- If feasible, run both builds before finalizing:
  - `cd site && npm run build`
  - `cd frontend && npm run build`
