---
name: application-state-ownership
description: Use when adding or modifying shared/persisted frontend state, changing context ownership boundaries, or wiring new contexts into App.tsx. Covers which context owns each domain and prevents duplicate persistence writers.
---

# Application State Ownership Skill

## Goal
Maintain clear state ownership boundaries in the React frontend to prevent duplicate persistence, circular dependencies, and state synchronization bugs.

## Core Principle

Each shared or persisted state domain must have **exactly one owner**:
- **Owner**: The context that initializes, mutates, and persists that domain
- **Consumer**: Components that read from the owner and invoke owner-provided actions
- **Rule**: Non-owner components must never duplicate persistence effects for owned domains

## Current Domain Ownership Map

| Domain | Owner Context | Responsibilities |
|---|---|---|
| Worksheet state + persistence | `src/contexts/WorksheetContext.tsx` | Content, variables, marked lines, debounced localStorage updates |
| Display settings persistence | `src/contexts/DisplaySettingsContext.tsx` | Font scale, line numbers visibility, localStorage persistence |
| Window/platform behavior + persistence | `src/contexts/WindowContext.tsx` | Lock state, always-on-top, platform APIs, settings persistence |
| AI settings/session state | `src/contexts/AIContext.tsx` | Provider config, API keys, context mode, streaming state |
| Status text + error state | `src/contexts/StatusContext.tsx` | Status messages, error display, timeout management |

## App Component Boundary

`src/App.tsx` is a **smart orchestrator**, not a state owner. It handles:
- ✅ Editor event handling and keyboard flows
- ✅ DOM/timing-dependent behavior (refs, selection, scroll sync, requestAnimationFrame)
- ✅ Wiring context actions into UI controls and event handlers
- ✅ Layout coordination between editor, panels, and chrome
- ❌ **Must not** re-introduce persistence effects for owned domains listed above
- ❌ **Must not** become a second source of truth for state already owned by contexts

## Adding New Shared State

When introducing new shared or persisted state:

1. **Identify the domain**: Is this worksheet-specific, display-related, window-related, AI-related, or status-related?
2. **Choose the owner**: 
   - If it fits an existing domain → add to that existing owner context
   - If it's a new domain → create a new context and add it to the provider chain in `main.tsx`
3. **Implement ownership**:
   - Initialize state in the owner context
   - Add mutation functions in the owner context
   - Add persistence effects (localStorage, backend calls) in the owner context only
   - Expose state and actions via context value
4. **Update consumers**:
   - Import the context hook in consumer components
   - Read state and invoke actions; never duplicate persistence

## Workflow for State Changes

### Planning Phase
1. Review current ownership map above
2. Determine if change affects an existing domain or creates a new one
3. Identify the single owner context
4. Check if `App.tsx` logic is legitimate orchestration vs. ownership violation

### Implementation Phase
1. Make state/persistence changes in the owner context only
2. Update consumer components to use owner-provided actions
3. Verify no duplicate persistence effects exist
4. Check for circular dependencies in provider nesting order

### Review Phase (PR Checklist)

Before merging frontend state changes:

1. ✅ Does this introduce a second writer for an existing owned domain?
2. ✅ If persistence was added, is it in the owner context only?
3. ✅ If logic moved into `App`, is it DOM/timing-coupled rather than shared-domain ownership?
4. ✅ Do tests still cover transformed helper logic after moves?
5. ✅ Is the provider nesting order in `main.tsx` still correct (no circular dependencies)?

## Common Pitfalls

- **Duplicate persistence**: Adding localStorage effects in both owner and consumer
- **Split ownership**: State in one context, persistence in another or in `App.tsx`
- **Circular deps**: New context depends on a provider that comes after it in nesting order
- **Leaky abstractions**: `App.tsx` reaching into context internals instead of using provided actions

## Related Files

- Auto-triggered enforcement: `.github/instructions/frontend-state-ownership.instructions.md`
- Provider nesting order: `frontend/src/main.tsx`
- App orchestration: `frontend/src/App.tsx`
