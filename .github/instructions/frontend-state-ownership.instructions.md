---
applyTo: "frontend/src/App.tsx,frontend/src/contexts/**/*.tsx"
description: "Use when changing frontend state ownership, persistence, or context wiring in the app shell or context providers. Keep each shared or persisted state domain owned by one context, keep persistence in that owner, and keep the app shell focused on orchestration and DOM-timing behavior."
---

# Frontend State Ownership Rules

## Scope
- Applies only to the frontend files matched by `applyTo`.
- For architecture planning and detailed domain mapping, use the `application-state-ownership` skill.

## Core Enforcement Rules

### Single Owner Principle
- Keep **one owner** for each shared or persisted state domain
- **Owner**: the context that initializes, mutates, and persists that domain
- **Consumer**: components that read and invoke owner actions

### Current Domain Owners
- Worksheet state + persistence → **WorksheetContext**
- Display settings persistence → **DisplaySettingsContext**
- Window/platform behavior + persistence → **WindowContext**
- AI settings/session state → **AIContext**
- Status text + error state → **StatusContext**

### App Component Boundary
- `App.tsx` is a **smart orchestrator** for editor events, DOM refs, timing-sensitive behavior, layout coordination, and platform event wiring
- Do **not** add new persistence effects in `App.tsx` or consumer components for domains already owned by a context

## Pre-Edit Checks
Before editing matched files, verify:
1. If adding shared state → decide which single context owns it
2. If adding persistence → keep that effect in the owner context only
3. If moving logic into `App.tsx` → ensure it is UI orchestration or DOM-timing work, not shared-domain ownership