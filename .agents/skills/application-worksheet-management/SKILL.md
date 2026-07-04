---
name: application-worksheet-management
description: Use when editing worksheet tab lifecycle, per-worksheet isolation, localStorage persistence, tab UI (context menu, close button, rename), or secure file save/load. Covers WorksheetManagerContext, WorksheetContext, WorksheetTabs, and the encrypted file security flow.
---

# Application Worksheet Management Skill

## Scope

Worksheet management includes:
- tab lifecycle: create, switch, rename, delete
- per-worksheet isolation of content and evaluation state
- persistence to localStorage via manager context
- tab UI behavior (including context menu and close button)
- integration with backend worksheet file save/load actions

## Source Of Truth

- Worksheet list + active worksheet id — `src/contexts/WorksheetManagerContext.tsx`
- Active worksheet editor state — `src/contexts/WorksheetContext.tsx`
- Tab UI interaction — `src/components/WorksheetTabs.tsx`
- Tab styling — `src/App.css`

Do not add duplicate persistence writers outside the owner context.

## File Map

- `src/contexts/WorksheetManagerContext.tsx` — list state, activeId, mutations (create/delete/rename/switch/updateActiveWorksheet), localStorage migration, debounced persistence
- `src/contexts/WorksheetContext.tsx` — reads active worksheet from manager, exposes content and evaluation/session state, syncs on active change, debounced updateActiveWorksheet
- `src/components/WorksheetTabs.tsx` — renders tabs and add button, rename by double click, context menu, close button, save/load via Wails bindings
- `src/App.css` — chrome-like tab visuals, dynamic width, rename input style, context menu and close button

## Data Contract

Worksheet snapshot (`src/types/app.ts`):
- `id: string`, `name: string`, `content: string`, `lastResult: number | null`, `markedLines: number[]`, `variableValues: Record<string, unknown>`

## Security Flow

### Save flow
1. User action in `WorksheetTabs.tsx` → Save to file
2. Frontend sends JSON to Go binding `SaveWorksheetToFile`
3. Backend validates, generates random 32-byte key, encrypts with AES-256-GCM
4. Key stored in OS secure storage (service: run-calc-worksheets)
5. Encrypted file written: version, ciphertext (base64), nonce (base64), keyId
6. Directory mode 0700, file mode 0600

### Load flow
1. User action in `WorksheetTabs.tsx` → Load from file
2. Frontend calls `LoadWorksheetFromFile`
3. Backend reads encrypted file, retrieves key by keyId from secure storage, decrypts
4. Returns plaintext worksheet data

### Platform key storage
- Windows: Credential Manager via DPAPI (`secure_worksheet_windows.go`)
- macOS: Keychain (`secure_worksheet_darwin.go`)
- Linux: Secret Service / libsecret (`secure_worksheet_linux.go`)

### Agent boundaries
- No encryption in frontend TypeScript
- No bypassing OS key storage from frontend
- Frontend only invokes bound methods and handles success/failure UI
- KeyId changes need explicit migration planning

## Safe Edit Rules

1. **Worksheet isolation** — Never leak variableValues or markedLines across worksheets. On switch, WorksheetContext resets session-only maps.
2. **One persistence owner** — Manager persists worksheets and activeId; WorksheetContext calls updateActiveWorksheet but does not write localStorage directly.
3. **Avoid render loops** — Narrow dependencies and debounced updates.
4. **Delete guard** — Last worksheet cannot be deleted.
5. **Rename guard** — Trim input, reject empty names.

## Known Pitfalls

- Immediate context-menu close: use setTimeout(0) before attaching close listeners
- Max update depth errors: debounced manager updates with narrow dependencies
- Empty initial render: manager must provide one worksheet synchronously
- Rename input clipping: use worksheet-tab--renaming class during rename

## Typical Change Patterns

| Goal | File to edit |
|---|---|
| New tab action | `WorksheetTabs.tsx` + `App.css` + tests |
| Persistence change | `WorksheetManagerContext.tsx` only |
| Evaluation sync | `WorksheetContext.tsx`, verify no feedback loops |

## Validation Checklist

```bash
cd frontend
npm run build
npm run test
```

Manual checks in app:
1. Create multiple worksheets
2. Enter distinct content in each, switch tabs, verify isolation
3. Rename via double click and context menu
4. Delete via x and context menu
5. Confirm last worksheet cannot be deleted
6. Right click menu stays visible until click-away
7. Save to file and load from file

## Agent PR notes

In PR summary, include:
- affected worksheet owner file(s)
- persistence impact
- isolation impact
- regression checks performed
