# Territory Command, DESIGN.md

The architectural overview for Territory Command, a personal sales intelligence and deal management app for an enterprise AE selling Oasis Platform.

## What it is

A local-first daily-use dashboard that consolidates the workflow of a single enterprise AE: tracking accounts, calls, stakeholders, POCs, and deal health in one place, without the cognitive overhead of switching between Salesforce, Gong, Gmail, Slack, and a dozen tabs.

Designed and used by one person (Brendan). Not a team product. Not a commercial product. Anything that adds complexity for the sake of "what if more people used it" is out of scope.

## What it is not

- A Salesforce replacement. Salesforce remains the system of record for compensation and reporting. Territory Command reads from it and writes notes back through manual or automated paths.
- A team collaboration tool.
- A multi-tenant SaaS. Single user, runs on the user's laptop.
- A static reporting tool. The whole point is that it reduces friction in a live workflow.

## Stack

**Backend:**
- Node 20+ / TypeScript
- Hono (HTTP server)
- Drizzle ORM with the libsql driver (`drizzle-orm/libsql`)
- SQLite via `@libsql/client` (local file, `backend/data/tc.sqlite`). Not better-sqlite3; see Technical gotchas in CLAUDE.md for why. The DB layer is fully async: all queries use `await`.
- Anthropic SDK for Claude API calls
- Port 3001 in dev

**Frontend:**
- Vite + React 18
- TypeScript
- Tailwind CSS
- Port 5173 in dev

**Shared:**
- `shared/` workspace for TypeScript types used on both sides

**Why this stack:**
- It's what Brendan knows. Familiarity beats novelty for a single-user productivity app.
- Hono is fast, ergonomic, and matches the simplicity of the project.
- SQLite is enough. Postgres becomes relevant only if Territory Command ever leaves the laptop.
- Drizzle gives us a Postgres-ready escape hatch later.

## Repo structure

```
territory-command/
├── backend/
│   ├── src/
│   │   ├── routes/          # Hono route handlers
│   │   ├── db/              # Drizzle schema, migrations, queries
│   │   ├── ai/              # Anthropic SDK wrappers, system prompts
│   │   ├── lib/             # Utility code (file parsing, JSON repair)
│   │   └── index.ts         # Server entry point
│   ├── data/                # SQLite file lives here (gitignored)
│   ├── .env                 # API key (gitignored)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # Top-level route components
│   │   ├── components/      # Reusable UI pieces
│   │   ├── lib/             # API client, utility hooks
│   │   ├── types/           # Frontend-only types
│   │   └── main.tsx
│   ├── index.html
│   └── package.json
├── shared/
│   ├── src/
│   │   ├── types/           # Cross-cutting types (Account, Stakeholder, etc.)
│   │   └── index.ts
│   └── package.json
├── references/              # Artifact source files for reference only (gitignored)
├── CLAUDE.md                # Agent instructions
├── DESIGN.md                # This file
├── ROADMAP.md               # Phased build plan
└── package.json             # Workspaces config
```

## V1 data model

Three core tables. Everything else (questions, partners, pain points, gameplan) is post-v1.

**accounts**
- id (text, primary key)
- name (text, not null)
- industry (text)
- state (text)
- status (text, default 'Prospect')
- fortune_500 (boolean)
- fortune_1000 (boolean)
- open_opps (integer)
- last_activity (text, date string)
- prior_context (text)
- sf_id (text, nullable)
- website (text)
- linkedin_url (text)
- amount (real)
- archived (boolean, default false)
- created_at (integer, unix ms)
- updated_at (integer, unix ms)

**stakeholders**
- id (text, primary key)
- account_id (text, foreign key to accounts)
- name (text, not null)
- title (text)
- type (text, enum: Economic Buyer, Champion, Technical Evaluator, Influencer, Blocker/Skeptic, Unclassified)
- champion_confirmed (boolean, default false)
- linkedin_url (text)
- email (text, lowercased)
- priorities (text)
- messaging (text)
- notes (text)
- temperature (text, enum: hot, warm, cold, gone_dark)
- last_touched (text, date string)
- source (text, enum: manual, call-attendee, gmail-sync, ai-suggested)
- created_at (integer, unix ms)
- updated_at (integer, unix ms)

**calls**
- id (text, primary key)
- account_id (text, foreign key to accounts)
- title (text)
- date (text, date string)
- summary (text)
- health (text, enum: green, yellow, red, unknown)
- health_reason (text)
- customer_attendees (text, JSON array of {name, title})
- raw_transcript (text)
- source_file (text)
- source_kind (text, enum: transcript, notes)
- created_at (integer, unix ms)
- updated_at (integer, unix ms)

Schema is intentionally small. Migration friction is real, and the artifact taught us we don't know enough yet about how questions, partners, and pain points should fit. Those land in their own phase with proper schema design.

## UX conventions

**Layout:** Sidebar with account list (search + filter), main pane with selected account detail. Tab navigation within the detail pane (Overview, Stakeholders, Calls). Future tabs slot in.

**Theme:** Dark theme, matching the artifact's visual language. Background `#080e1a`, text `#dde6ee`, accent green `#00e5a0`, accent cyan `#00c2d4`, warning amber `#f0a500`, danger red `#e06050`. No light mode in v1.

**Notifications:** Toast system, bottom-right. Never `alert()`. The artifact taught us that sandbox environments silently drop alerts; even outside that, alerts are jarring. Toasts auto-dismiss after 12s for success/warning, 20s for errors. Errors also go to `console.error` for paper trail.

**Forms:** Native `<input>` and `<textarea>` elements, not wrapper components. The artifact taught us that wrapping inputs in custom components risks focus loss on re-render.

**Confirmations:** Destructive actions (delete a call, delete a stakeholder, replace data on import) require a confirm prompt or an undo affordance. Per CLAUDE.md.

**Loading states:** Show elapsed time for any operation expected to take >2 seconds. Spinner with a counter, not just a spinner.

## AI integration

**Models, with prompt caching:**
- Opus 4.7 for deep analysis (deal extraction, gameplan generation). Cache the system prompt.
- Sonnet 4.6 for routine synthesis, MCP-tool-driven workflows.
- Haiku 4.5 for metadata extraction, simple parsing tasks.

**Anthropic SDK lives in backend.** Frontend never holds the API key. Frontend calls backend routes, backend calls Anthropic. Backend caches system prompts via the SDK's `cache_control` option.

**Timeouts:** Use `Promise.race` against a watchdog timer, not `AbortController` alone. The artifact taught us that AbortController doesn't reliably terminate hung MCP-mediated fetches. The watchdog rejects regardless of whether the underlying fetch ever settles.

**MCP servers:** Treat as unreliable. Always provide a manual Cancel button on any UI that triggers MCP calls. Always surface errors as toasts, never silently. Always log MCP responses (parsed or raw) to the console for debugging.

## Backup and export

**Export:** A real file download (HTTP response with `Content-Disposition: attachment`), not a clipboard hack. JSON format. Triggered manually from the sidebar.

**Import:** Drag-drop or file-picker, replaces local SQLite contents after confirmation. Used for restore from backup.

**No automatic cloud sync in v1.** The user is responsible for hitting Export periodically. Drive auto-sync, S3 sync, etc. are future concerns. Local SQLite + manual export = good enough for v1, and infinitely more reliable than what the artifact was doing.

## Out of scope for v1

These are real product ideas, validated in the artifact, that we're explicitly deferring:

- Pain & Fit dashboard with stakeholder-attributed provenance
- Questions tracking (per-call extraction, close-the-loop flow)
- Partners tab (resellers, GSIs, MSSPs, Tech Alliances, with stance and influence channels per account)
- Gameplan dashboard (JSON-structured headline, risks, path to close)
- Deep Research (web_search-driven external intelligence with context mappings)
- Success Criteria tracking (POC coverage mapping)
- Account scoring (engagement, coverage, momentum, demand, risk)
- Gmail sync (partner-aware, customer-aware, with confidence signals)
- Slack sync
- Pre-call plan generation
- Salesforce read sync
- Gong MCP integration

See ROADMAP.md for the order and rationale.

## Principles

1. **Build what causes the most friction each week.** Not a module catalog. Not a feature list. The thing that hurt last Tuesday.
2. **Design review before build.** Interactive mockups in chat (this Project) before any implementation prompt.
3. **Scope discipline.** Per CLAUDE.md, only touch what's asked. State files touched and not touched before any change.
4. **Local-first.** Data lives in SQLite on the laptop. Cloud is a backup destination, not a system of record.
5. **AI is a feature, not a foundation.** The app must remain useful even if the Anthropic API is down. Manual editing is always available; AI suggests, the user accepts.
6. **No commitments to features that haven't earned their keep.** Every artifact feature was a hypothesis. Some passed (calls tracking, stakeholders, exec summaries). Some didn't earn their keep yet (Deep Research). The ones that didn't are deferred until they prove themselves.
