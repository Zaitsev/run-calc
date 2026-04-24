# Run-Calc

[![Security Checks](https://github.com/Zaitsev/run-calc/actions/workflows/security-checks.yml/badge.svg)](https://github.com/Zaitsev/run-calc/actions/workflows/security-checks.yml)

A minimal, notepad-style desktop calculator designed for speed, persistence, and inline AI assistance. 

**Performance Stats:**
- **App size:** ~16MB (includes Go runtime, no installer required)
- **Memory consumption:** ~140MB

---

## 📖 User Guide

### Basic Operations
Run-Calc works like a smart text editor. Type your math, and it solves it inline.

**Syntax & Calculations**
- Type an expression directly in the editor (e.g., `2+3*4`) and press `Enter` to evaluate. Results appear inline as `expression = result`.
- Start a new line with `+`, `-`, `*`, or `/` to chain operations from the previous result.
- Use single quotes (`'text'`) or backticks (`` `text` ``) for text values.
- **Scientific notation** is fully supported (e.g., `1e6 / 1e4 = 100` or `2.5E-3`).
- **Validation:** Non-empty lines are validated as you type. Invalid lines turn red and display a `!` icon in the gutter.
- **Generators:** Use `uniform()` for values in `[0,1)` and `normal()` for standard normal values (mean `0`, stddev `1`). *Note: Do not pass parameters to these.*

**Variables & Comments**
- **Variables:** Type `@` on any line to open a one-character variable input in the gutter. Type a single letter (A-Z) to assign the line's result to that variable.
- **Comments:** Use `"` to start an end-of-line comment (e.g., `total = price * qty " monthly subtotal`). 
- Comment-only lines (e.g., `"todo`) are treated as notes, feature theme-aware styling, and will not throw errors when pressing `Enter`. *(Note: Double quotes are reserved strictly for comments).*

**State & Window Behavior**
- **Persistence:** Your worksheet (including latest calculations and carry-over results) is automatically restored when you restart the app.
- **Settings (⚙):** 
  - **Calculation:** Choose your preferred decimal delimiter: dot (`1.23`), comma (`1,23`), or system default.
  - **Window:** Configure close behavior (minimize to tray vs. normal close) and toggle the restore shortcuts.

---

### 🤖 AI Assistant

Run-Calc includes an optional AI assistant to answer questions, generate expressions, and perform look-ups directly in your worksheet. 

> **⚠️ Important: Bring Your Own Key (BYOK)**
> The AI assistant operates strictly on a BYOK basis. Run-Calc does not include built-in API keys or AI subscriptions. To use this feature, you must provide your own API key from a supported provider or connect to a local/self-hosted model (like Ollama).

#### Setup
Configure your provider in **Settings -> AI**:
1. Choose a preset: **OpenAI**, **Gemini**, **OpenRouter**, **Anthropic**, or **Custom** (for self-hosted/Ollama).
2. Enter your personal **API key** for the selected provider. *(For local models, this can usually be left blank or set to a dummy value).*
3. Adjust the model ID, timeout, and context modes as needed.
4. Click **Test & Save** to verify the connection before using it in the worksheet.

#### Usage
| Command | Action | Example |
| :--- | :--- | :--- |
| `?` | **Ask a Question:** Sends the prompt to the AI. The response (numeric, code, or comment) is inserted below the line. | `? compound interest formula for 5000 at 3% over 10 years` |
| `??` | **Explain Mode:** Requests a step-by-step calculation. The AI adds plain-English comments before every generated line of code. | `?? how does compound interest work on 5000 at 3% over 10 years` |

#### Context Modes
Control how much of your worksheet the AI can "see" (configurable in Settings or per-query):
- **Above** (Default): Sends only the lines above the current line.
- **Full**: Sends the entire worksheet content.

#### Supported Providers
| Preset | Default model |
|---|---|
| **OpenAI** | `gpt-4o-mini` |
| **Gemini** | `gemini-3.1-flash-lite-preview` |
| **OpenRouter** | `openai/gpt-4o-mini` |
| **Anthropic** (via OpenRouter) | `anthropic/claude-3.5-sonnet` |
| **Custom** | *Configurable* (Accepts any OpenAI-compatible endpoint, e.g., `http://localhost:11434/v1/chat/completions` for Ollama) |
---

### ⌨️ Keyboard Shortcuts

**Evaluation & Navigation**
- `Enter`: Evaluate current line
- `Ctrl/Cmd + Enter`: Insert a new line below without evaluating
- `Ctrl/Cmd + N`: New worksheet
- `@`: Open focused one-character variable input in the current line gutter

**Window Management**
- `Ctrl/Cmd + R`: Reload app window
- `Ctrl/Cmd + Q`: Quit app
- `Esc`, then `Esc` quickly: Hide app window
- `Ctrl + NumLock` (Windows/Linux): Restore hidden/minimized window
- `Cmd + Clear` (macOS): Restore hidden/minimized window

**Formatting**
- `Ctrl/Cmd + =`: Increase font size
- `Ctrl/Cmd + -`: Decrease font size
- `Ctrl/Cmd + 0`: Reset font size

---

## ⚙️ Installation & Downloads

Check the [GitHub Releases](https://github.com/Zaitsev/run-calc/releases) page for the latest binaries.

**Linux Users (Currently Untested):**
Releases include two Linux artifacts:
- `*.AppImage`: A portable, self-contained package for most distributions (Recommended).
- `*.tar.gz`: A raw binary package (may require manual installation of system runtime libraries).

---

## 🛠 For Developers

Run-Calc is built using [Wails](https://wails.io/).

### Development Environment

Run live development mode:
```bash
wails dev
```

**Windows Developers:**
For multiple concurrent dev sessions, use the dynamic-port launcher to prevent `127.0.0.1:34115` collisions:
```powershell
.\scripts\dev-wails.ps1
```
To pass extra `wails dev` flags through the script:
```powershell
.\scripts\dev-wails.ps1 -WailsArgs "-loglevel","Debug"
```

### Build Instructions

Build a redistributable package:
```bash
wails build
```

### Contribution Guidelines: Expr Function Coercion Policy

When adding or exposing expression functions in the evaluator backend, please adhere to the following rules:

1. **Assume Floats:** Numeric intermediate values can arrive as `float64` from expr-lang.
2. **Explicit Coercion:** If a function semantically expects an integer argument (e.g., count, index, limit), add explicit coercion that:
   - Accepts integral float values (e.g., `2.0`).
   - Rejects non-integral floats (e.g., `1.5`).
   - Returns a clear, user-facing error.
3. **Keep it Local:** Keep coercion local to the function wrapper (or a shared helper) so behavior is explicit and testable.
4. **Required Tests for New Functions:**
   - Happy path with literal arguments.
   - Happy path with arguments produced by prior expressions (especially float outputs like `floor(...)` or arithmetic chains).
   - Boundary behavior (zero, negatives, oversized counts where applicable).
   - Rejection cases for wrong types and non-integral numeric values when integer semantics are required.
   - Pipeline form and direct-call form (when both are supported).

---

## 📅 What's New (Latest Updates)

*Full historical updates can be found in the in-app `Settings -> Help: New` menu.*

- `Ctrl/Cmd + Enter` inserts a new line below without running evaluation.
- Double-Escape shortcut (`Esc` twice quickly) hides the app window while keeping it running.
- Window close behavior settings (minimize to tray vs. normal close) and global restore shortcuts (`Ctrl+NumLock` / `Cmd+Clear`).
- Improved variable assignment: `@` opens a focused variable input directly in the gutter.
- Worksheet persistence restores calculations after app restarts.
- On-type line validation with red error lines and gutter `!` markers.
- Support for scientific notation (`1e6`, `1.2e-3`) and configurable decimal delimiters (dot, comma, system).
- Comment-only lines now behave as non-evaluating notes with theme-aware styling, using `"` as the comment starter.

---

## ⚖️ Legal

- **Privacy Policy:** See `PRIVACY_POLICY.md`
- **License:** See `LICENSE` (MIT)

> **⚠️ License Note:** Run-Calc is **source-available, not open-source**. You are highly encouraged to read the code, compile it locally, and submit Pull Requests to fix bugs or add features! However, you are not permitted to clone, redistribute, or monetize the app. See the `LICENSE` file for full details.