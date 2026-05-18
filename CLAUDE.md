# CLAUDE.md, Territory Command

Instructions for AI assistants (Claude Code, Claude Desktop, Claude in claude.ai) working on this repo. Read this before any change.

## Who you're talking to

Brendan, an enterprise Account Executive at Oasis Security, building Territory Command for his own daily use. He is not a professional engineer. He understands code at a useful level but expects plain-English explanations of what you're changing and why.

## Communication conventions

1. **No em dashes anywhere.** Not in code comments, not in UI strings, not in chat responses, not in commit messages, not in this file. Use commas, semicolons, parentheses, or just rewrite the sentence. This rule has zero exceptions.
2. **Plain-English explanations for every code change.** Before showing a diff or making an edit, say what you're changing and why in one to three sentences. Engineering jargon is fine when it adds precision; never when it adds opacity.
3. **Sign off with "Cheers, Brendan" when delivering a substantive response in chat.** Not on every micro-message. On real deliverables.
4. **Don't fabricate.** If you don't know, say "I don't know" or "I'd have to check." Don't fill silence with confident-sounding wrong answers.

## Scope discipline

1. **Only touch what's asked.** Before any change, state explicitly which files and which sections you're going to modify, and which related files you're choosing NOT to modify. If a change you're about to make would expand scope ("while I'm here, I should also fix..."), STOP, surface the choice in chat, let Brendan decide.
2. **No silent refactors.** If something needs refactoring to support the requested change, name it, get approval, then do it. Otherwise leave the surrounding code alone.
3. **No unrelated dependency additions.** If you need a new npm package, explain why and wait for the green light. Don't introduce them mid-feature.
4. **No reordering imports, no reformatting unrelated code, no "while I'm in this file" cleanups.** Even if the linter complains. Make a separate task for it.

## Design before build

For any feature larger than a small CRUD addition, do this in order:

1. **Design conversation in claude.ai (the Project chat).** Trade off options, name unknowns, name what's in scope and what's not.
2. **Interactive mockup in chat.** HTML or React mockup, rendered as an artifact in claude.ai, that Brendan clicks through. Iterate on shape before code.
3. **Build prompt for Claude Code.** Pasted into a fresh Claude Code session. The prompt invokes this CLAUDE.md, names scope, names what NOT to touch, includes verification steps.
4. **Code review in Claude Code.** Brendan tests locally, hits the friction, comes back to the design conversation in claude.ai if anything is off.

Skip the mockup step only for trivial work (bug fixes, copy edits, small CRUD additions to an existing pattern).

## Destructive actions require confirmation

Anything that destroys data or is hard to reverse requires explicit confirmation from Brendan in the same session:

- Deleting accounts, stakeholders, calls
- Replacing local SQLite contents on import
- Dropping or altering tables in migrations
- Force-pushing to git
- Deleting feature branches
- Wiping a directory

You may not assume "Brendan asked for this in a previous session" gives you permission today. Confirm in the current conversation.

## Backup discipline

Before any operation that touches the SQLite database or runs a migration: confirm a recent backup exists, OR run `npm run db:backup` (which copies `backend/data/tc.sqlite` to a timestamped file in `backend/data/backups/`), OR get Brendan to run Export from the UI.

The artifact predecessor lost data because backups were optional and the storage layer was unreliable. SQLite is more durable but the discipline is the same: never delete what you haven't backed up.

## Stack constraints

- Node 20+, TypeScript strict mode
- Hono for backend HTTP, Drizzle ORM for SQLite via `@libsql/client` (libsql driver, fully async)
- Vite + React 18 + Tailwind CSS for frontend
- Anthropic SDK for AI calls. System prompt caching via `cache_control` whenever the prompt is more than a few hundred tokens.
- No state management libraries beyond React's built-in (useState, useReducer, Context). No Redux, no Zustand, no Jotai until proven necessary.
- No CSS-in-JS libraries. Inline `style` for one-offs, Tailwind for everything else.
- No component libraries (no Material UI, no Chakra, no shadcn auto-install). Build the few components we need by hand. The artifact taught us we want full control over the visual language.

## Technical gotchas (learned the hard way)

These are real bugs we've already hit. Don't re-hit them.

1. **`drizzle-kit push` fails when adding tables with foreign key references to existing tables.** Workaround: write the `CREATE TABLE` SQL directly in a migration file or run it manually via the SQLite CLI, then mark the migration as applied.
2. **`dotenv` will not pick up `ANTHROPIC_API_KEY` if the shell has it set to an empty string.** Fix: `dotenv.config({ override: true })`.
3. **`window.alert()` is silently dropped in sandboxed iframes** (e.g., the claude.ai artifact runtime). Use the toast system in `frontend/src/components/Toast` instead. Always. Even in dev.
4. **`AbortController.abort()` does not reliably terminate hung MCP-mediated `fetch` calls.** Use `Promise.race` against a watchdog timer that rejects regardless of whether the underlying fetch ever settles. The watchdog is your real timeout.
5. **React form components defined inside another component's render function lose focus on every keystroke.** Inline form JSX directly, or hoist form components to module scope with props. Never define `function MyForm(...)` inside `function App(...)`.
6. **Client-side CSV parsing uses `papaparse`.** Don't roll our own splitter; the edge cases (quoted commas, embedded newlines, BOMs) are not worth it.
7. **`alert()` calls anywhere will be replaced by a toast wrapper in the frontend.** If you're adding new error surfaces, use the toast hook, not the native alert.
8. **`better-sqlite3` v9 has no prebuilt binaries for Node 25+ and fails to compile from source because Node 25's V8 headers require C++20.** We use `@libsql/client` with Drizzle's libsql driver instead. This makes the DB layer async, so all queries use `await`. Do not attempt to swap back to `better-sqlite3` unless prebuilds exist for the runtime Node version.

## AI integration patterns

1. **All Anthropic API calls go through `backend/src/ai/client.ts`.** Frontend never talks to Anthropic directly. The API key never leaves the backend.
2. **System prompts live in `backend/src/ai/prompts/`**, one file per prompt (`extractDeal.ts`, `summarizeCall.ts`, etc.). Each exports the system prompt as a tagged template literal and is cache-controlled when called.
3. **Model selection per task:**
   - Opus 4.7 for deep analysis (deal extraction, gameplan).
   - Sonnet 4.6 for routine synthesis and MCP-driven workflows. Sonnet handles MCP tool use noticeably better than Haiku.
   - Haiku 4.5 for metadata extraction and simple parsing.
4. **Timeouts use `Promise.race` against a watchdog**, never `AbortController` alone. The watchdog is the real timeout.
5. **Streaming**: not used in v1. Wait for full response, then update UI. Simpler error handling, simpler UX, fine for our latencies.
6. **MCP calls (Gmail, Slack, Drive)**: always provide a Cancel button in the UI. Always surface errors as toasts. Always log MCP raw responses to the console for debugging.

## File modification etiquette

Before any edit:

1. **State the files you will touch and the files you will NOT touch.**
2. **Read the relevant files first.** Never edit blind. Never assume the structure from memory.
3. **Show the user what you're changing in plain English** before the diff hits.

After any edit:

1. **Verify your change parses.** Run `tsc --noEmit` or `npm run typecheck` if available.
2. **Confirm in chat what changed**, in plain English, before declaring done.
3. **Note any cleanups you considered but did not do**, so they can become future tasks.

## Things you should NOT do without explicit permission

- Refactor anything that wasn't part of the asked change.
- Update or pin dependency versions.
- Run database migrations.
- Push to git.
- Delete files, even files you think are unused.
- Replace inline styles with Tailwind utility classes or vice versa.
- "Improve" types in shared/.
- Add comments that aren't either documenting an unusual decision or explaining a gotcha.
- Rename anything.

## Reference materials

The artifact predecessor (`territory_command.jsx`) is available in `references/` for design inspiration. **Do not copy code from it verbatim.** Its patterns are useful (data shapes, UI metaphors, system prompts), but it was a single-file prototype with no backend separation, no schema migrations, and no test discipline. Use it as a design reference, build the real implementation from scratch using this repo's patterns.

## Sign-off

"Cheers, Brendan." Don't end with "Best," or "Thanks!" or "Let me know!". His sign-off is the close. Use it.
