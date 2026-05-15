# Worksheet Management Agent Dev Guide

This guide is for coding agents working on worksheet management in the frontend.

## Scope

Worksheet management includes:
- tab lifecycle: create, switch, rename, delete
- per-worksheet isolation of content and evaluation state
- persistence to localStorage via manager context
- tab UI behavior (including context menu and close button)
- integration with backend worksheet file save/load actions

## Source Of Truth

Use these ownership rules:
- Worksheet list + active worksheet id are owned by src/contexts/WorksheetManagerContext.tsx.
- Active worksheet editor state is exposed by src/contexts/WorksheetContext.tsx.
- Tab UI interaction is handled in src/components/WorksheetTabs.tsx.
- Tab styling is in src/App.css.

Do not add duplicate persistence writers outside the owner context.

## File Map

- src/contexts/WorksheetManagerContext.tsx
  - list state: worksheets
  - active worksheet pointer: activeId
  - mutations: createWorksheet, deleteWorksheet, renameWorksheet, switchWorksheet, updateActiveWorksheet
  - localStorage migration from legacy single-worksheet keys
  - debounced persistence for worksheet list

- src/contexts/WorksheetContext.tsx
  - reads active worksheet from manager
  - exposes content and evaluation/session state to editor consumers
  - syncs local state on active worksheet change
  - debounced updateActiveWorksheet for lastResult, markedLines, variableValues

- src/components/WorksheetTabs.tsx
  - renders tabs and add button
  - supports rename by double click and context menu
  - supports close button (x) when more than one worksheet exists
  - opens custom context menu on right click
  - save/load via Wails bindings

- src/App.css
  - chrome-like tab visuals
  - dynamic tab width behavior
  - tab rename input style
  - context menu and close button visuals

## Data Contract

Worksheet snapshot shape (from src/types/app.ts):
- id: string
- name: string
- content: string
- lastResult: number | null
- markedLines: number[]
- variableValues: Record<string, unknown>

## Security Flow (Implemented)

This is the implemented secure worksheet file flow across frontend and backend.

### Save flow

1. User action starts in src/components/WorksheetTabs.tsx via Save to file.
2. Frontend sends JSON payload to Go binding SaveWorksheetToFile in frontend/wailsjs/go/main/App.js.
3. Backend validates payload in app.go.
4. Backend generates a random 32-byte key and encrypts payload with AES-256-GCM.
5. Backend generates a random GCM nonce.
6. Backend stores the key using OS-specific secure storage (service: run-calc-worksheets).
7. Backend writes encrypted JSON file with:
- version
- ciphertext (base64)
- nonce (base64)
- keyId
8. Backend writes with restricted permissions:
- directory mode 0700
- file mode 0600

### Load flow

1. User action starts in src/components/WorksheetTabs.tsx via Load from file.
2. Frontend calls Go binding LoadWorksheetFromFile.
3. Backend reads encrypted file and parses metadata.
4. Backend retrieves key from OS secure storage by keyId.
5. Backend decrypts ciphertext via AES-256-GCM.
6. Backend validates decrypted JSON payload and returns plaintext worksheet data.
7. Frontend applies payload to the selected worksheet through updateWorksheet.

### Platform key storage

- Windows: Credential Manager via DPAPI (secure_worksheet_windows.go)
- macOS: Keychain (secure_worksheet_darwin.go)
- Linux: Secret Service (libsecret) only; worksheet save/load fails with a clear error if secure storage is unavailable (secure_worksheet_linux.go)

### Agent boundaries for security work

- Do not implement encryption in frontend TypeScript.
- Do not bypass OS key storage from frontend.
- Keep frontend limited to invoking bound methods and handling success/failure UI.
- If file format fields change, update both save and load paths together and preserve backward compatibility.
- Be careful with keyId behavior (currently a generated random identifier stored in the encrypted file). Any keyId strategy change needs explicit migration planning.

### Security regression checks

1. Save worksheet, confirm file on disk is encrypted JSON (not plaintext content).
2. Load same file, confirm payload restores content and values.
3. Rename file and verify expected behavior around key lookup still works.
4. On Linux, confirm clear error is returned when Secret Service is unavailable.
5. Confirm clear error is returned when key retrieval fails or file is corrupt.

## Safe Edit Rules

1. Keep worksheet isolation strict.
- Never leak variableValues or markedLines across worksheets.
- On switch, WorksheetContext must reset session-only maps (versions and dependencies).

2. Keep one persistence owner.
- Manager persists worksheets and activeId to localStorage.
- WorksheetContext may call updateActiveWorksheet, but should not directly write localStorage.

3. Avoid render loops.
- Do not include unstable manager objects in effect dependency arrays.
- Use narrow dependencies and debounced updates for state that feeds back into manager.

4. Preserve delete guard.
- Last worksheet cannot be deleted.

5. Preserve rename guard.
- Trim input and reject empty names.

## Known Pitfalls

1. Immediate context-menu close on right click.
- If you register a global contextmenu close listener in the same tick, the opening click can close it immediately.
- Current fix uses setTimeout(0) before attaching close listeners.

2. Max update depth errors.
- Circular flows can happen when persist effects depend on broad context objects.
- Keep debounced manager updates and narrow dependencies.

3. Empty initial render.
- Manager initialization must provide at least one worksheet synchronously.

4. Rename input clipping.
- Tab has overflow behavior for ellipsis. During rename use worksheet-tab--renaming to allow visible input.

## Typical Change Patterns

### Add a new tab action

- Add action UI in src/components/WorksheetTabs.tsx.
- Keep state mutation in manager methods.
- Add/adjust CSS in src/App.css.
- Add tests where logic is extracted to helper modules.

### Change worksheet persistence behavior

- Update src/contexts/WorksheetManagerContext.tsx only.
- Preserve migration logic and backward compatibility with legacy keys.

### Change active worksheet evaluation sync

- Update src/contexts/WorksheetContext.tsx.
- Verify no feedback loops to manager.

## Validation Checklist

From frontend directory:
- npm run build
- npm run test

Manual checks in app:
1. Create multiple worksheets.
2. Enter distinct variables/content in each worksheet.
3. Switch tabs and verify content isolation.
4. Rename from double click and from context menu.
5. Delete tab with x and with context menu.
6. Confirm last worksheet cannot be deleted.
7. Right click menu opens and stays visible until click-away.
8. Save to file and load from file on a worksheet.

## Non-goals For This Guide

- Deep cryptography design changes (algorithm swaps, KMS integration, or new key hierarchy design).
- Theme system internals unrelated to worksheet behavior.

## Notes For Agent PRs

In PR summary, include:
- affected worksheet owner file(s)
- persistence impact
- isolation impact
- regression checks performed
