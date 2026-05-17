---
applyTo: "frontend/src/App.tsx,frontend/src/contexts/**/*.tsx"
description: "Use when changing frontend state ownership, persistence, or context wiring in the app shell or context providers. Keep each shared or persisted state domain owned by one context, keep persistence in that owner, and keep the app shell focused on orchestration and DOM-timing behavior."
---

# Frontend State Ownership Rules

## Scope
- Applies to frontend state ownership, persistence, and context wiring changes in the matched files.
- Treat file names in this document as current examples of ownership boundaries. If responsibilities move, follow the current owner instead of recreating a second writer.

## Ownership model
- Keep one owner for each shared or persisted state domain.
- Keep worksheet state and worksheet persistence in the current worksheet owner context.
- Keep display settings persistence in the current display settings owner context.
- Keep window and platform behavior persistence in the current window owner context.
- Keep AI settings and session state in the current AI owner context.
- Keep status text and error state in the current status owner context.

## App boundary
- Keep the top-level app shell as an orchestrator for editor events, DOM refs, timing-sensitive behavior, layout coordination, and platform event wiring.
- Do not add new persistence effects in the app shell or consumer components for domains already owned by a context.

## Change checks
- Before adding shared state, decide which single context owns initialization, mutation, and persistence.
- If a change adds persistence, keep that effect in the owner context only.
- If logic is moved into the app shell, ensure it is UI orchestration or DOM-timing work rather than shared-domain ownership.