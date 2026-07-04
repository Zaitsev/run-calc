# ctx7 Documentation Lookup

Use the `ctx7` CLI to fetch current documentation when the user asks about a library, framework, SDK, API, CLI tool, specifications, or cloud service — even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, debugging, setup, and CLI usage. Use even when you think you know the answer — training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## Usage

Run `npx ctx7@latest` commands using `cmd` shell.

1. **Resolve library**: `npx ctx7@latest library <name> "<question>"` — use the official library name (e.g. "Next.js" not "nextjs")
2. **Pick best match** (format `/org/project`): exact name match, description relevance, source reputation (High/Medium preferred), benchmark score
3. **Fetch docs**: `npx ctx7@latest docs <libraryId> "<question>"`
4. **Answer** using the fetched documentation

## Rules

- Call `library` first unless the user provides an ID directly in `/org/project` format.
- Use the user's full question as the query. Max 3 commands per question.
- Version-specific docs: use `/org/project/version` from the `library` output.
- No sensitive info (keys, passwords) in queries.
- Quota errors: suggest `npx ctx7@latest login` or `CONTEXT7_API_KEY` env var.
