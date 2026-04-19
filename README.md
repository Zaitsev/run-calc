# Run-Calc

Minimal notepad-style desktop calculator built with Wails + React + TypeScript.

## Basic Operations

- Type an expression directly in the editor (example: `2+3*4`).
- Press `Enter` to evaluate the current line.
- Results are written inline as `expression = result`.
- Start an empty new line with `+`, `-`, `*`, or `/` to continue from the previous result.
- Configure decimal delimiter in Settings -> Calculation as dot (`1.23`), comma (`1,23`), or system default.
- Scientific notation is supported, for example `1e6 / 1e4 = 100` (also works with uppercase `E`, such as `2.5E-3`).
- As you type, each non-empty line is validated. Invalid lines are shown in red and marked with a `!` icon in the gutter.
- Type `@` on any line to open a one-character variable input in that line's gutter, then type a single letter (A-Z) to assign it.
- The worksheet is restored on app restart, including your latest calculations and carry-over result.
- In Settings -> Window, choose close behavior: minimize to tray on close (default) or normal system close behavior.
- In Settings -> Window, you can enable/disable the restore shortcut for hidden/minimized windows.

## Keyboard Shortcuts

- `Enter`: Evaluate current line
- `Ctrl/Cmd + Enter`: Insert a new line below without evaluating
- `Ctrl/Cmd + N`: New worksheet
- `Ctrl/Cmd + =`: Increase font size
- `Ctrl/Cmd + -`: Decrease font size
- `Ctrl/Cmd + 0`: Reset font size
- `Ctrl/Cmd + R`: Reload app window
- `Ctrl/Cmd + Q`: Quit app
- `@`: Open focused one-character variable input in the current line gutter
- `Ctrl + NumLock` (Windows/Linux): Restore hidden/minimized app window
- `Cmd + Clear` (macOS): Restore hidden/minimized app window
- `Esc`, then `Esc` quickly: Hide app window

## In-App Help Pages

Open Settings (`⚙`) to access Help pages:

- Help: Operations
- Help: Shortcuts
- Help: New

The `Help: New` section should be appended on each functional change and preserved across updates.

### Help: New (latest)

- Added `Ctrl/Cmd + Enter` to insert a new line below the current line without running evaluation.
- Added a quick double-Escape shortcut (`Esc` twice quickly) to hide the app window while keeping it running.
- Added Settings -> Window switches for close button behavior (minimize to tray by default vs normal close) and restore shortcut enablement.
- Added a global restore shortcut for hidden/minimized windows: `Ctrl + NumLock` on Windows/Linux and `Cmd + Clear` on macOS.
- Replaced `Ctrl/Cmd + Letter` variable assignment with `@` to open a focused one-character variable input directly in the current line gutter.
- Added worksheet persistence so the latest calculations are automatically restored after app restart.
- Added on-type line validation with red error lines and a gutter `!` marker for invalid expressions.
- Added scientific notation support in expressions (examples: `1e6`, `1.2e-3`, `1,2E+3` depending on decimal delimiter mode).
- Added decimal delimiter setting in Settings -> Calculation with `dot`, `comma`, and `system` modes.

## Development

Run live development mode:

```bash
wails dev
```

## Build

Build a redistributable package:

```bash
wails build
```
