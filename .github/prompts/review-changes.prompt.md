---
description: "Review latest git changes and suggest improvements, simplifications, and dead-code eliminations"
agent: "agent"
tools: [get_changed_files, read_file, semantic_search, execute, agent]
argument-hint: "Optional focus area (e.g. 'frontend', 'Go backend', or leave blank for all changes)"
---

Gather all unpushed work in two steps:

1. **Uncommitted changes** — use `#tool:get_changed_files` (staged + unstaged).
2. **Unpushed commits** — run `git log @{u}.. --name-only --pretty=format:"%h %s"` in a terminal to list commits and files not yet pushed to the remote tracking branch. If there is no upstream (`@{u}` fails), fall back to `git log origin/HEAD.. --name-only --pretty=format:"%h %s"`. Read the diff for each unpushed commit with `git show <hash> --unified=5`.

Combine both sets of changed files, deduplicate, and read the relevant sections.

Review the changes and produce a concise report with three sections:

## Improvements
List concrete improvements to correctness, readability, or robustness. For each item, cite the file and line, state the problem, and show a short before/after if the fix is non-obvious. Skip items that are style-only preferences.

## Simplifications
Identify logic that can be expressed more simply — redundant conditions, unnecessary intermediate variables, overly complex control flow, or abstractions that add indirection without benefit. Show the simpler form.

## Dead Code
List unused variables, unreachable branches, exports with no callers in the workspace, and commented-out blocks that are no longer relevant. For each, confirm via `#tool:semantic_search` or `#tool:get_changed_files` context that there is no active caller before flagging.

If any dead code is found, immediately invoke the `dead-code-cleanup` subagent to remove it, passing the list of affected files and symbols as context. Wait for the subagent to finish, then append a **Cleanup Applied** section summarising what was removed.

---
**Rules:**
- Only report on code that is part of the current changes or directly touched by them.
- Do not suggest refactors outside the changed scope.
- Do not flag intentional stubs, platform-specific guards, or test helpers as dead code without checking.
- Keep each item actionable: a dev should be able to act on it in under five minutes.
