---
name: application-state-ownership
description: Use when adding or modifying shared/persisted frontend state, changing context ownership boundaries, or wiring new contexts into App.tsx. Covers which context owns each domain and prevents duplicate persistence writers.
---

# Application State Ownership Skill

## Core Rule

Each shared or persisted state domain must have **one owner**:
- **Owner:** the context that initializes, mutates, and persists that domain
- **Consumer:** components that read and invoke owner actions
- Non-owner components must not duplicate persistence effects for the same domain

## Current Owners

| Domain | Owner context |
|---|---|
| Worksheet state + persistence | `src/contexts/WorksheetContext.tsx` |
| Display settings persistence | `src/contexts/DisplaySettingsContext.tsx` |
| Window/platform behavior + persistence | `src/contexts/WindowContext.tsx` |
| AI settings/session state | `src/contexts/AIContext.tsx` |
| Status text + error state | `src/contexts/StatusContext.tsx` |

## App Component Scope

`src/App.tsx` is a **smart orchestrator** for:
- editor event handling and keyboard flows
- DOM/timing-dependent behavior (refs, selection, scroll sync, requestAnimationFrame)
- wiring context actions into UI controls

`App` must not re-introduce persistence effects for owned domains listed above.

## PR Checklist

Before merging frontend state changes:

1. Does this introduce a second writer for an existing owned domain?
2. If persistence was added, is it in the owner context only?
3. If logic moved into `App`, is it DOM/timing-coupled rather than shared-domain ownership?
4. Do tests still cover transformed helper logic after moves?
