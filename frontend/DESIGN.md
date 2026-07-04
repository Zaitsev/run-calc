# Frontend Design & Visual Identity Guide

This document describes the visual identity of the Run-Calc frontend: the color system, typography, spacing, surfaces, and component styling used by the app. It is for agents adding or changing UI.  

## Core rule

All colors are expressed through CSS custom properties (`var(--token-name)`). Never hardcode hex/rgb values in components or CSS. The active theme can be a built-in theme, a saved custom theme, or a live OpenVSX preview, so hardcoded colors will break under some themes.

## Themes

The app ships with four built-in themes:

- `light` (default)
- `dark`
- `light-high-contrast`
- `dark-high-contrast`

The `system` option resolves to `light` or `dark` based on `prefers-color-scheme`.

Custom themes imported from OpenVSX are applied by writing inline `--*` CSS variables on `<html>` and setting `data-theme` to the theme's base (`dark` or `light`). Because custom themes only override the variables they define, every color token consumed by the UI must have a static definition in `src/style.css` for each built-in theme.

## Color tokens

`src/style.css` defines the full token set in four matching blocks. The tokens fall into two naming families.

### VS Code–mirrored tokens

Dotted VS Code color keys become kebab-case CSS variables:

- `--editor-background`
- `--editor-foreground`
- `--statusBar-background`
- `--statusBar-border`
- `--statusBar-foreground`
- `--sideBar-background`
- `--sideBarSectionHeader-background`
- `--sideBar-border`
- `--sideBarTitle-foreground`
- `--editorGutter-background`
- `--editorGroup-border`
- `--editorLineNumber-activeForeground`
- `--editorError-foreground`
- `--textLink-foreground`

### App-specific semantic tokens

- `--html-bg`, `--body-color`
- `--window-bg`
- `--radio-accent`, `--btn-hover-bg`, `--stepper-track`
- `--scrollbar-track`, `--scrollbar-thumb`, `--scrollbar-thumb-hover`, `--scrollbar-thumb-active`
- `--result-marked-color`, `--result-variable-color`
- `--syntax-function`, `--syntax-variable`, `--syntax-operator`, `--syntax-number`, `--syntax-constant`, `--syntax-punctuation`, `--syntax-comment`, `--syntax-variable-declaration`
- `--gutter-var-color`, `--gutter-var-bg`, `--gutter-stale-color`, `--gutter-stale-bg`, `--gutter-ai-color`, `--gutter-ai-bg`
- `--ai-line-color`, `--ai-line-bg`, `--ai-progress-bg`, `--ai-progress-border`
- `--button-primary-foreground`
- `--overlay-scrim`, `--panel-shadow`, `--drawer-shadow`
- `--switch-thumb-bg`
- `--logo-shadow-top`, `--logo-shadow-bottom`
- `--truncated-zero-gutter-bg`, `--truncated-zero-icon-color`
- `--line-error-gutter-bg`, `--line-error-explainer-color`, `--line-error-explainer-bg`, `--line-error-explainer-border`
- `--editor-intelligence-bg`, `--editor-intelligence-border`, `--editor-intelligence-shadow`, `--editor-intelligence-active-bg`, `--editor-intelligence-hint`

When a new UI element needs a color, reuse an existing token if possible. If a new token is required, add it to all four theme blocks in `src/style.css`. Prefer `color-mix(in srgb, var(--x) N%, var(--y))` for derived shades instead of adding new hardcoded colors.

## Custom-theme color mapping

Imported OpenVSX themes provide a subset of the tokens above. The frontend maps those values to app-specific variables using fallback chains. Key explicit mappings:

- `editor.background` → `--html-bg`
- `sideBar.background` → `--window-bg`
- `textLink.foreground` → `--gutter-mark-color`
- `symbolIcon.functionForeground` → `--result-marked-color`
- `symbolIcon.variableForeground` → `--result-variable-color`, `--gutter-var-color`

Syntax token variables follow these fallback chains:

| CSS variable | Fallback chain |
|---|---|
| `--syntax-function` | `tokenColor.function` → `symbolIcon.functionForeground` → `textLink.foreground` → `currentColor` |
| `--syntax-variable` | `tokenColor.variable` → `symbolIcon.variableForeground` → `textLink.foreground` → `tokenColor.function` → `symbolIcon.functionForeground` → `currentColor` |
| `--syntax-variable-declaration` | `tokenColor.variable` → `symbolIcon.variableForeground` → `tokenColor.function` → `symbolIcon.functionForeground` → `textLink.foreground` → `currentColor` |
| `--syntax-operator` | `tokenColor.operator` → `symbolIcon.operatorForeground` → `textLink.foreground` → `tokenColor.function` → `symbolIcon.functionForeground` → `currentColor` |
| `--syntax-number` | `tokenColor.number` → `symbolIcon.numberForeground` → `tokenColor.function` → `symbolIcon.functionForeground` → `tokenColor.variable` → `symbolIcon.variableForeground` → `currentColor` |
| `--syntax-constant` | `tokenColor.constant` → `symbolIcon.constantForeground` → `tokenColor.function` → `symbolIcon.functionForeground` → `textLink.foreground` → `currentColor` |
| `--syntax-punctuation` | `tokenColor.punctuation` → `editor.foreground` → `currentColor` |
| `--syntax-comment` | `tokenColor.comment` → `descriptionForeground` → `tokenColor.punctuation` → `editor.foreground` → `currentColor` |

## Typography

- UI font: `"Nunito", "Segoe UI", Tahoma, sans-serif`
- Editor font: `"Nunito", "Segoe UI", Tahoma, sans-serif`
- Gutter line numbers: `"Courier New", monospace`, 13px, weight 600, tabular-nums
- Editor line-height: `1.8`
- Editor font-size: controlled by `fontScale` (localStorage key `calc.editor.fontScale`), range `0.7–2.2`, default `1.0`, applied as `${fontScale}em`
- UI font scale: controlled by `--ui-font-scale` on `.window`, default `1.0`

## Spacing, sizing, and radii

Layout variables defined on `.window`:

- `--status-bar-height: 34px`
- `--help-panel-side-size: min(320px, calc(100vw - 16px))`
- `--help-panel-bottom-size: min(48vh, 420px)`
- `--ui-font-scale: 1`
- `--ui-size-scale: var(--ui-font-scale)`

Common sizing:

- Gutter width: 44px
- Gutter indicator area: 14px
- Status bar height: 34px
- Worksheet tab min-height: 34px
- Settings drawer width: 320px (main variant 420px)

Common border-radius values:

- 4px, 6px, 7px, 8px, 10px, 18px, 999px (pill)

## Surfaces and elevation

- App background: `var(--html-bg)` plus a multi-layer `var(--window-bg)` gradient
- Editor surface: `var(--editor-background)`
- Sidebars and settings panels: `var(--sideBar-background)`
- Status bar: `var(--statusBar-background)`
- Shadows:
  - `--panel-shadow: 0 8px 32px ...`
  - `--drawer-shadow: -4px 0 18px ...`
  - `--editor-intelligence-shadow: 0 10px 24px ...`
- Overlay scrim: `var(--overlay-scrim)`
- Backdrop blur is used for modals, the lock screen, the stale banner, and the autocomplete panel

## Gutter visual states

Each gutter line shows one indicator. The color for each state is driven by a token:

- Error: `var(--problemsErrorIcon-foreground)` on `var(--line-error-gutter-bg)`
- Truncated-to-zero: `var(--truncated-zero-icon-color)` on `var(--truncated-zero-gutter-bg)`
- Stale: `var(--gutter-stale-color)` on `var(--gutter-stale-bg)`
- AI: `var(--gutter-ai-color)` on `var(--gutter-ai-bg)`
- Marked: `var(--result-marked-color)`
- Variable declaration: `var(--gutter-var-color)` on `var(--gutter-var-bg)`

## Editor line visual states

- Error: `var(--editorError-foreground)`
- Stale: gutter shows the stale indicator
- AI trigger: `var(--ai-line-bg)` background, `var(--ai-line-color)` foreground
- AI waiting: animated gradient based on `var(--radio-accent)` mixed with `var(--ai-line-bg)`

## Syntax highlighting

Overlay tokens and their color variables:

| Token class | Variable |
|---|---|
| `.syntax-token--variable-decl` | `--syntax-variable-declaration` |
| `.syntax-token--variable` | `--syntax-variable` |
| `.syntax-token--function` | `--syntax-function` |
| `.syntax-token--operator` | `--syntax-operator` |
| `.syntax-token--number` | `--syntax-number` |
| `.syntax-token--constant` | `--syntax-constant` |
| `.syntax-token--punctuation` | `--syntax-punctuation` |
| `.syntax-token--comment` | `--syntax-comment` |

## Settings and theme UI

The settings drawer is rendered from `var(--sideBar-background)` with a `var(--sideBar-border)` separator and `var(--drawer-shadow)`. The built-in theme picker shows the five options as radio rows, and the OpenVSX theme browser renders preview cards using the same token set.

## Visual change checklist

When changing UI visuals:

1. Reuse an existing color token before adding a new one.
2. Add any new token to all four built-in theme blocks in `src/style.css`.
3. Derive from existing tokens with `color-mix` where possible.
4. For OpenVSX-derived tokens, add a fallback chain in `src/useTheme.ts` and extend the backend allow-list in `theme.go` if a new external key is needed.
5. Test in `light`, `dark`, and a previewed custom theme.
