---
name: wails-minimal-calculator
description: Build or refactor a Wails (Go + React + TypeScript) app into a minimalist notepad-style calculator where users type expressions and press Enter to evaluate inline.
---

# Wails Minimal Calculator Skill

## Goal
Produce a working desktop calculator app in Wails with this interaction model:
- No input buttons.
- User types math directly into a text area.
- Press Enter to evaluate current line and append result on the same line as `expression = result`.
- If user starts a new empty line with an arithmetic operator, auto-prefix previous line result.
- Arithmetic quality and correctness are a primary project goal.

## Scope
Use this for a standalone Wails app (not intended as a reusable package) with:
- Go backend entry (`main.go`, `app.go`).
- React + TypeScript frontend (typically in `frontend/src`).

Help documentation is mandatory in this scope:
- Maintain in-app Help pages (or equivalent visible Help views) for Operations, Shortcuts, and New.
- ALWAYS update Help content when functionality is added, changed, or removed.
- Keep existing New sections in Help; append entries instead of deleting prior release notes.

Use arithmetic-focused expression support:
- `+`, `-`, `*`, `/`
- Decimal numbers
- Optional parentheses
- No variables, functions, or advanced algebra features.

## Workflow
1. Inspect project layout and identify frontend entry points.
2. Replace template UI with a single editor-like textarea and minimal app shell.
3. Implement line-based Enter handling:
   - Detect current line using caret position.
   - Skip empty lines (insert newline only).
   - Skip recalculation for lines that already contain `=`.
4. Implement expression evaluation logic:
   - Parse expression with operator precedence (`*`/`/` before `+`/`-`).
   - Support unary plus/minus and parentheses.
   - Reject invalid syntax and division by zero.
5. Implement previous-result carryover behavior:
   - On empty line, if first key is an operator and previous result exists, insert `lastResult + operator`.
6. Render results inline:
   - Successful line: `expr = value`.
   - Failed line: `expr = error`.
  - Preserve user-typed expression text on the left side; only normalize spaces around `=`.
7. Implement two-layer error reporting:
  - User layer: unobtrusive, non-blocking message encouraging correction and retry.
  - App/developer layer: bottom status diagnostics, detailed in dev mode.
8. Keep visual style simple and notepad-like:
   - Plain menu strip text.
   - Light background.
   - Large readable editor font.
9. Validate iteratively in `wails dev`; run a frontend build check only before release packaging.
10. Update Help pages whenever behavior, shortcuts, menus, settings, or UX flows change:
  - Reflect the new/updated behavior in Operations and/or Shortcuts.
  - Add an entry to Help: New summarizing the change.
  - Preserve prior New entries unless explicitly asked to prune historical notes.

## Dev Mode Guidance
- During active development, run `wails dev` from the project root.
- `wails dev` already handles frontend rebuild/reload, so you do not need to run `npm run build` after each change.
- Use `npm run build` (frontend) and `wails build` only for release verification/package builds.

## Decision Logic
- If current line is empty on Enter:
  - Insert newline only.
- If current line already has `=` on Enter:
  - Insert newline only.
- If current line starts with operator and previous result is known:
  - Evaluate as `previousResult + typedLine`.
- If evaluation fails:
  - Replace line with `expr = error` and clear previous result.
  - Show user-friendly status text without blocking typing.
  - In dev mode, include parser/debug details in bottom status.
- If evaluation succeeds:
  - Replace line with `expr = result` and store previous result.

## Completion Criteria
- User can type `2+3` then Enter and get `2+3 = 5`.
- User can type `+2` on next line and Enter to get `5+2 = 7` behavior.
- User can keep typing multiple lines in one editor.
- Invalid expression does not crash app and shows `= error`.
- User can keep editing immediately after errors.
- Bottom status area shows concise user messaging and richer diagnostics in dev mode.
- Frontend build succeeds (`npm run build` in `frontend`).
- Help pages are present and accurate for Operations and Shortcuts.
- Help: New exists and includes the latest changes without removing prior New entries.

## Implementation Notes
- Prefer putting parser/evaluator in `frontend/src/App.tsx` for small apps.
- Use deterministic number formatting to avoid noisy floating artifacts.
- Preserve caret position after line replacement.
- Avoid backend calls for basic arithmetic unless explicitly needed.

## Example Prompts
- Build a minimal notepad-style calculator in this Wails app using this skill.
- Refactor my current Wails template into a line-by-line Enter calculator with previous-result carryover.
- Add simple arithmetic parsing and inline `= result` behavior to the existing React textarea.

## Gutter Architecture

The editor uses a three-panel layout inside `.editor-container` (flex row):

```
.editor-container (flex row, flex: 1)
  ├── .gutter             (28 px fixed column, scrolled in sync)
  │     └── .gutter-lines (paddingTop matches editor padding, one .gutter-line per text line)
  └── .editor-area        (flex: 1, position: relative)
        ├── textarea.editor    (position: absolute, inset: 0; color: transparent; caret-color: var(--editor-color); z-index: 1)
        └── div.editor-overlay (position: absolute, inset: 0; pointer-events: none; z-index: 0; renders styled spans)
```

### Key rules

- The `textarea` uses `color: transparent` so only the overlay text is visible; the caret stays visible via `caret-color`.
- The overlay has identical `font-size`, `line-height`, `padding`, and `font-family` as the textarea so spans line up exactly.
- On `textarea` scroll, sync both `gutterRef.current.scrollTop` and `overlayRef.current.scrollTop / scrollLeft`.
- `lineHeightPx` is read from `getComputedStyle(editorRef.current).lineHeight` inside a `useEffect([fontScale])` and stored in state; each `.gutter-line` uses `style={{ height: lineHeightPx }}` to stay aligned with text rows.
- The gutter's top padding must match the textarea's top padding exactly (currently `18`).

### State owned by the gutter

| State | Type | Storage key | Cleared on |
|---|---|---|---|
| `markedLines` | `ReadonlySet<number>` | `calc.editor.markedLines` (JSON array) | File → New |
| `lineHeightPx` | `number` | — (derived, not persisted) | fontScale change |

### Adding a new icon to the gutter

1. Compute the per-line flag in a `useMemo` or derived value (e.g. `lineErrors: Map<number, string>`).
2. Inside `.gutter-line`, render a `<span className="gutter-XYZ-icon" aria-hidden="true">…</span>` conditionally.
3. Add `.gutter-line--XYZ` modifier class to the `.gutter-line` div when the flag is active.
4. Style in `App.css` following the `.gutter-error-icon` / `.gutter-mark` pattern — typically an 8-10 px symbol, centered via flex.
5. Add `--gutter-XYZ-color` CSS variable to both themes in `style.css`.
6. Priority: error icon takes precedence over mark icon when both are present (render error first in JSX so it appears on top).

### CSS variables required

Add all four pairs to the `html` (light) and `html[data-theme="dark"]` blocks in `style.css`:

```css
--gutter-bg: …;           /* gutter panel background */
--gutter-border: …;       /* 1 px right border between gutter and editor */
--gutter-mark-color: …;   /* color of the ◆ mark icon */
--marked-result-color: …; /* bold color applied to " = value" span on marked lines */
```

### Existing icon classes

| Class | Trigger | Symbol |
|---|---|---|
| `.gutter-mark` | `markedLines.has(i)` | `◆` (`&#9670;`) |
| `.gutter-error-icon` | `lineErrors.has(i)` | `!` |

### Overlay line classes

| Class | Applied when |
|---|---|
| `.line-error` | `lineErrors.has(i)` — colors the whole line text in `--line-error-color` |
| `.marked-result` | `markedLines.has(i)` AND line contains ` = ` — bolds the ` = value` portion |

## Related Next Skills
- Add memory and history controls (clear, undo, persist session).
- Add unit tests for parser and line-evaluation behavior.
- Add locale-aware number formatting and configurable precision.
