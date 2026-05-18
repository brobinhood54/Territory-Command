# Territory Command, ROADMAP.md

The phased build plan. Phases ship in order. No phase starts until the previous one is stable in real daily use.

## Guiding rule

Build what causes the most friction each week, not a feature list. This roadmap is the current plan, not a contract. If something in Phase 4 starts hurting more than Phase 2, reorder.

## Phase 0: Scaffolding

**Goal:** A running skeleton. Open the app, see seed accounts, click into one, see an empty detail pane. Backend serves. Frontend renders. Database persists.

**What ships:**
- Monorepo structure (backend, frontend, shared)
- Hono server with one health check route
- Drizzle schema with the three v1 tables (accounts, stakeholders, calls)
- Vite + React + Tailwind frontend with sidebar + detail layout
- Seed script that loads a starter set of accounts into SQLite
- Backend `.env` with `ANTHROPIC_API_KEY`
- npm scripts: `dev:backend`, `dev:frontend`, `dev` (runs both), `db:migrate`, `db:seed`, `db:backup`
- Toast notification system component (no logic yet, just the UI primitive)
- CLAUDE.md, DESIGN.md, ROADMAP.md committed
- GitHub repo `territory-command` created, private, first commit pushed

**Out of scope for Phase 0:**
- AI calls
- File upload
- CSV import
- Anything other than CRUD on accounts

**Done when:** Brendan can run `npm run dev`, open localhost:5173, see seed accounts in the sidebar, click one, and the right pane shows the account name and basic fields.

## Phase 1: V1 must-haves

The six features that unblock daily use.

### 1.1 Account list and detail

- Sidebar shows all accounts, sorted by recency or open opps
- Search by account name
- Filter by industry (multi-select dropdown)
- Filter by "has open opp"
- Click an account to load its detail page
- Detail page shows: name, industry, state, status, F500/F1000 badges, open opps count, last activity, prior context, website, LinkedIn
- Edit any account field inline, save on blur

**Done when:** Brendan can find any of his 54 accounts in under 3 seconds and edit any field without leaving the page.

### 1.2 Stakeholder map

- Tab within the account detail
- List all stakeholders for the account
- Add a stakeholder (name, title, type, champion-confirmed flag, LinkedIn, email, priorities, messaging, notes)
- Edit any stakeholder
- Delete a stakeholder (with confirmation)
- Visual treatment: cards colored by type (Champion green, EB amber, Technical cyan, Influencer purple, Blocker red, Unclassified gray)

**Done when:** Brendan can map a full buying committee on a deal without leaving the page.

### 1.3 Call transcript upload

- Drag-drop or file-picker upload, one or many files
- Supported: .txt, .pdf, .docx, .vtt, .srt
- Each file becomes its own call entry
- Backend extracts text via `mammoth` (docx), `pdf-parse` (pdf), plain read (txt/vtt/srt)
- Sonnet 4.6 parses each transcript into: title, date, summary in fixed format, health (green/yellow/red), customer attendees with names and titles
- Customer attendees auto-seed as Unclassified stakeholders, deduped by fuzzy name match
- Calls list shows most recent first, with date, title, health emoji, attendee count
- Click a call to expand and see the full summary
- Manual edit on the parsed summary

**Done when:** Brendan can drop yesterday's Gong export onto an account and have a clean call entry plus the right attendees on his stakeholder map within 60 seconds.

### 1.4 Toast notifications

- Bottom-right toast stack
- Three types: success (green), warning (amber), error (red)
- Auto-dismiss: success 12s, warning 12s, error 20s
- Manual dismiss via X button
- Toast hook (`useToast`) exported from `frontend/src/lib/toast.ts`
- Every async operation that can fail surfaces a toast on success and on error
- No `alert()` calls anywhere in the codebase

**Done when:** Every user action gives feedback, no silent failures, no alerts.

### 1.5 Real file export/import

**Export:** Sidebar button. Backend serializes all data (accounts, stakeholders, calls) to a JSON blob. Returns it as a file download (Content-Disposition: attachment) named `territory-command-backup-{ISO-date}.json`. No clipboard hacks.

**Import:** Sidebar button. File picker. Backend validates JSON shape. If valid, shows a confirmation modal (this replaces all current data, are you sure). On confirm, replaces SQLite contents and reloads frontend.

**Done when:** Brendan can save a backup to his Drive folder in two clicks and restore from it in three.

### 1.6 Account snapshot view

- The overview tab inside an account detail
- Compact grid showing: status, fortune classification, open opps, calls logged, deal health (from most recent call), opp amount, POV start/end
- Prior engagement context as a card below
- Recent activity (last 3 calls) summarized inline

**Done when:** Opening an account gives Brendan everything he needs to know about its state in a 5 second glance.

## Phase 2: Questions tracking

Per the artifact, questions are the highest-value workflow primitive after calls themselves. Open questions are leading indicators of deal health.

**What ships:**
- Question extraction added to the call parser (Sonnet 4.6)
- Each question stored with: id, account_id, call_id, asked_by (customer attendee name), question text, status (answered, deferred, needs-followup), resolution text, asked_at, resolved_at
- Per-call view: questions captured on this call, with status, with close-the-loop UI (mark answered, add resolution note, mark via channel)
- Per-account view: all open questions across all calls, sorted by age
- Per-stakeholder view: questions this person has asked
- Open-loops view: every unanswered question across all accounts (the "what do I owe people" view)

**Done when:** Brendan never forgets a follow-up question again.

## Phase 3: Partners

Per the design conversation in this Project. Reseller, GSI, MSSP, Tech Alliance, Referral, Other. Per-account stance. Influence channels. Partner stakeholders linked to partners.

**What ships:**
- New tables: `partners` (global), `account_partners` (per-account stance, influence channels, motivation), partner stakeholders as `stakeholders` rows with a new `side` enum (customer / partner / oasis)
- Migration: add `side` column to stakeholders, default 'customer' for backward compat
- Partners tab on account detail
- Procurement-of-record fields at account level (reseller_of_record, procurement_notes)
- Partner roster, partner stakeholders, partner signals placeholder (signals deferred to 3.1)
- Account snapshot shows a one-line "Partners: SHI (Allied, reselling), Optiv (Allied, implementing)" with click-to-jump
- Co-sell health indicator per partner

**Phase 3.1 (followup): partner-aware Gmail sync**
- Search by partner domains
- Search by partner stakeholder emails
- Filter results to threads with at least one customer-context confirming signal (customer email in participants, customer name in subject, reply chain to known customer thread)
- Attribute results to partner stakeholders, not customer stakeholders

**Done when:** Brendan can answer "who are the partners on Lennar and how is each helping or hurting" without thinking.

## Phase 4: Pain & Fit with provenance

The artifact's structured pain-points view, with stakeholder attribution and source-call quote evidence.

**What ships:**
- Pain extraction added to deal extraction (Opus 4.7)
- Each pain stored with: id, account_id, summary, category (NHI, Agentic, Compliance, Operational, Strategic), stakeholders (array of names who voiced it), sources (array of {call_id, call_date, quote}), confidence (high/medium/low), first_heard, last_heard, mention_count
- Pain & Fit tab on account detail
- Three views: by category, by stakeholder, signals to watch (open questions correlated)
- Capability map: pain → Oasis Platform capability → proof point

**Done when:** Brendan can hand a VP a one-page brief on "here's what's hurting at this account and who voiced each one" in 30 seconds.

## Phase 5: Gameplan dashboard

The artifact's strategic dashboard view. The thing Brendan opens first thing Monday morning.

**What ships:**
- Gameplan extraction (Opus 4.7) with structured JSON output: headline, trajectory, trajectoryReason, risks (with severity, evidence, action), story, currentState, pathToClose (P0/P1/P2 actions with owner and date), stakeholderPosture (per-stakeholder stance and watchFor)
- Gameplan tab on account detail
- Vital signs strip: last touch, health, stage, open loops, champion, EB
- Copy-to-markdown button for sharing
- Stale indicator when new calls or notes have arrived since the last generation

**Done when:** Brendan can prepare for a VP one-on-one by opening Gameplan on his top 5 accounts and pasting the headlines into Slack.

## Phase 6: Deep Research

External intelligence via web_search. Strategic priorities from filings, executive quotes, hiring signals, breach intel, competitor signals, all mapped to existing internal context.

**What ships:**
- Deep Research extraction (Opus 4.7 with web_search tool, 8-12 max_uses)
- Structured output: companyOverview, strategicPriorities, executiveQuotes, hiringSignals, breachIntel, discoveredExecs, riskFactors, competitorSignals, contextMappings, outreachAngles
- Research tab on account detail
- Auto-add discovered execs to stakeholder map as Unclassified, with research source link in notes
- Context mappings: each external signal tied back to internal stakeholders, open questions, pain points, or MEDDPICC gaps
- Outreach drafts with quoted public signal as hook

**Done when:** Brendan can run Deep Research on a stalled account and get 5 specific, sourced outreach angles he can send tomorrow.

## Phase 7+: Things on the horizon

Order is provisional, reorder based on what hurts most:

- **Success Criteria tracking**: POC criteria upload, parse-to-structured, coverage mapping against calls, customer-ready status reports
- **Account scoring**: engagement, coverage, momentum, demand, risk (the artifact's 0-100 score with tier badging)
- **Pre-call plan generation**: GOAL / PRESENTER / TALKING POINTS / CUSTOMER CONTEXT / DESIRED OUTCOME
- **Slack sync**: internal Oasis discussions about an account
- **Salesforce read sync**: bring in CSV-style account updates from SFDC weekly export, no write yet
- **Gong MCP integration**: stop manually downloading .txt transcripts
- **Morning brief**: a daily one-screen overview of what to do today across all accounts
- **Calendar awareness**: see upcoming meetings on each account, surface them in pre-call plans
- **Multi-user**: only if Territory Command ever escapes the laptop. Probably never. Out of scope unless explicitly revisited.

## What success looks like at end of Phase 1

You open Territory Command on Monday morning. The sidebar lists your 54 accounts. You click into Intuit (your active POC). The Overview shows the deal is in POC stage, last call was Friday and was green, you have a Champion (Adam O knows who) and an Economic Buyer. You scroll to Calls, drop in this morning's Gong transcript, watch the toast confirm the attendees were extracted. You close the laptop. The data lived in SQLite the whole time. No artifact storage. No silent alert drops. No 4-minute MCP hangs. No transcript wipes.

That's the bar.
