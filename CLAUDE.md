@AGENTS.md

# LK Ops — Latino Kings internal operations platform

> ⚠️ **Next.js note (see AGENTS.md):** this project runs Next.js 16 (App Router, Turbopack). APIs/conventions may differ from older Next.js — check `node_modules/next/dist/docs/` before changing framework-level code. `middleware` is renamed to `proxy` here (see `src/proxy.ts`).

A deployed, multi-tenant-ready event operations app for **Latino Kings**, a baile-funk / Latin-electronic event series in Vilnius. It replaces a pile of Google Sheets with one tool: events, lineup/timetable, budget, hospitality, guest list, logistics, planner, proposals, marketing, insights — with an AI layer (the "Playbook" + chat) threaded through.

- **Live:** https://lk-ops-dusky.vercel.app
- **Hosting:** Vercel (team `latinokings`)
- **Backend:** Supabase project `csjltossxfzyynqhspzb` (eu-west-1) — Postgres + Auth
- **Admin user:** m.galdikas07@gmail.com (role `admin`)

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Server Components + Route Handlers |
| Language | TypeScript, React 19 | |
| Auth + DB | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | Email+password auth, Postgres, Row-Level Security |
| AI | `@anthropic-ai/sdk` | claude-sonnet-4-6 (vision/reasoning), claude-haiku-4-5 (fast extraction) |
| Styling | Inline styles + CSS variables in `globals.css` (Tailwind v4 present but barely used) | Fonts: Inter (UI), Fraunces (display serif) |
| Icons | `lucide-react` | |
| DB migrations | `pg` via `scripts/run-migration.mjs` | Direct connection, no Supabase CLI |
| Deploy | Vercel CLI (`vercel deploy --prod`) | env vars set in Vercel project |

---

## Architecture decisions

- **Two-level structure.** **Brand HQ** (org-level: Overview, Team, Playbook, Settings) sits above the **event series** (per-event tabs). Reached by clicking the brand logo. `scope: "events" | "hq"` state in `Dashboard.tsx`.
- **Everything is event-scoped except the Playbook + org_settings + profiles**, which are global. The currently selected event id (`eventId`) drives every event tab; persisted in `localStorage` (`lk-event`).
- **The Playbook is the AI spine.** Global wiki of formulas/rules/patterns. Every AI route (`ask`, `brain`, `proposal`, `autoplan`, `insights`, `marketing`) injects it so answers come out "the Latino Kings way", grounded in real data, never invented numbers.
- **AI as propose-then-confirm, never silent autosave.** Imports/extractions return proposals; the user taps to commit.
- **RLS roles:** `admin` (everything incl. budget, team, settings), `core` (edit most, read budget), `sponsor`/`artist` (schema stubs for future scoped portals). Helper SQL fns `is_core_plus()` / `is_admin()` gate policies. Canonical policy state lives in `scripts/fix.sql`.
- **Auth is email+password, not magic-link** — Supabase's built-in email is unreliable, so magic-link was abandoned.
- **Migrations run directly via `pg`** (connection string in `.env.local` as `DATABASE_URL`). The user never pastes SQL. Each schema change is a `scripts/*.sql` file applied with `node scripts/run-migration.mjs scripts/<file>.sql`.
- **Auth flow:** `src/proxy.ts` (Next 16's renamed middleware) refreshes the Supabase session and redirects unauthenticated `/dashboard` → `/auth`.

---

## Directory map

### App shell & routing (`src/app/`)
- `layout.tsx` — root layout, loads Inter + Fraunces fonts, sets `--font-*` vars.
- `globals.css` — the design system: warm/light tokens (`--bg`, `--accent` coral `#C5613D`, etc.), resets, focus rings, `lk-spin`/`lk-fade-up` keyframes.
- `page.tsx` — `/` → redirects to `/dashboard`.
- `dashboard/page.tsx` — **server component**: gets user, profile, all events, org brand name → renders `<Dashboard>`. Redirects to `/auth` if not signed in.
- `auth/page.tsx` — email+password sign-in / create-account screen (client).
- `auth/callback/route.ts` — OAuth/magic-link code exchange (legacy; password auth doesn't use it).

### API routes (`src/app/api/*/route.ts`) — all server-side, hold the Anthropic key
- `ask` — Q&A chat grounded in event data + Playbook.
- `brain` — **multimodal master chat**: takes text + image/CSV, answers AND extracts hosp/lineup/budget rows as a proposal.
- `import` — screenshot/CSV → structured rows (used by the Import tab).
- `proposal` — generates a sponsor/partner pitch from event data + Playbook.
- `autoplan` — generates a phased task plan with deadlines counted back from the event date (the Planner "master brain").
- `insights` — cross-event analysis & forecasting from history + Playbook.
- `marketing` — ad-spend advice / spend-to-earn tips.
- `rider` — reads an artist **rider PDF or photo**, extracts hospitality + technical requirements.
- `event-import` — pulls event details from a link. **RA (ra.co) via their public GraphQL API**; generic pages via OG/JSON-LD scrape. (Facebook is blocked by Meta.)
- `event-build` — a sentence of context → a full event **blueprint** (event details, stages, phased tasks, budget lines, hospitality roster, draft timetable), grounded in Playbook + past events. Powers the autonomous event-builder. Never invents numbers (budget defaults to 0, attendance grounded in history) or artist names (placeholder slots only).

### Lib (`src/lib/`)
- `types.ts` — all shared TypeScript types (Profile, EventRow, HospPerson, LineupEntry+RiderItem, BudgetItem+BudgetSubItem, Task, Proposal, PlaybookEntry, Guest, InventoryItem, CrewContact, MarketingSpend, TabKey).
- `supabase/client.ts` — browser Supabase client (`createBrowserClient`).
- `supabase/server.ts` — server Supabase client (cookie-based).

### Components (`src/components/`)
- `Dashboard.tsx` — **the shell**. Top bar (brand→HQ, refresh, sign-out, avatar), event switcher + info bar, event tab nav, renders the active tab. Holds `scope`, `tab`, `hqTab`, selected event, event-list state, edit/bulk-import modals. Contains the inner `HqView` (Brand HQ) and `LinkChip` helpers.
- `EventSwitcher.tsx` — event dropdown grouped Upcoming / History (date-sorted), New event, Import-from-links, per-event edit.
- `EventEditor.tsx` — create/edit event modal: name, dates, doors time, attendance, poster, description, ticket/Drive/FB links; "paste a link → autofill"; uses org defaults on create.
- `BulkImportModal.tsx` — paste many event links → create multiple events.
- `EventBuilder.tsx` — **autonomous event-builder** modal: a sentence of context → AI blueprint → review step with a per-section include toggle (stages/tasks/budget/hospitality/timetable) → one-tap create. Calls `/api/event-build`; commits via the browser client (event → `hosp_settings` → budget → tasks → hosp roster + days → lineup), mirroring `EventEditor`/`PlannerTab`. Reached from `EventSwitcher`'s "Build with AI".
- `HomeTab.tsx` — per-event home: hero, status cards, "what needs you" nudges, **master chat with file upload** (calls `/api/brain`, ingests screenshots, proposes & saves rows).
- `HospTab.tsx` — hospitality roster, day-by-day attendance board, drink/food multipliers; renders `RiderRollup`.
- `LineupTab.tsx` — **the timetable**: multi-stage × multi-day drag-drop grid, night-aware time sort, music acts + activities, Edit/View toggle, hide-days, "↓ From RA" lineup import, per-act rider button.
- `RiderModal.tsx` — per-artist rider: upload PDF/photo → extract → editable hospitality/technical checklist with fulfilled toggles.
- `RiderRollup.tsx` — aggregates **outstanding** rider items across all artists (shown in Hosp).
- `BudgetTab.tsx` — revenue/cost lines, per-line breakdown (artist fee + rider + cash/invoice + VAT), net cards, live Projections (break-even, scenarios).
- `GuestsTab.tsx` — door list: name, who-added, ticket type, +1s, attended check-in, door mode, search, headcount stats.
- `LogisticsTab.tsx` — Crew contacts directory (Call/Mail) + Gear/inventory list (item, qty, where to get, got-it check).
- `PlannerTab.tsx` — phased tasks (prep/week/day/post) with owner/due/status, progress bar, AI Auto-plan.
- `ProposalTab.tsx` — generate/save/edit/copy AI sponsor proposals.
- `PlaybookTab.tsx` — the global wiki (formula/rule/pattern/vendor/note entries).
- `InsightsTab.tsx` — cross-event summary, per-event net comparison, AI forecast.
- `MarketingTab.tsx` — ad-spend log, cost-per-ticket, spend-to-earn calculator, AI tips.
- `ImportTab.tsx` — screenshot/CSV → reviewable rows → save into hosp/lineup/budget.
- `AskTab.tsx` — standalone grounded chat (largely superseded by HomeTab's chat).
- `GlobalOverview.tsx` — Brand HQ "Overview": all events at a glance, open/overdue tasks across events, click to jump in.
- `TeamTab.tsx` — admin team panel: list users, change roles, role legend.
- `SettingsHQ.tsx` — editable brand settings (name, tagline, default stages, default multipliers, ticket types) → `org_settings`.

### Scripts (`scripts/`)
- `run-migration.mjs` — applies a `.sql` file via `pg` using `DATABASE_URL` from `.env.local`. **This is how all schema changes are made.**
- `fix.sql` — **canonical RLS + helper-function state** for every table (re-runnable, idempotent).
- `*.sql` (activities, add-attendance, excluded-days, guests, logistics, marketing, orgsettings, rider, team) — incremental migrations, each adding a table/column + policies.
- `diagnose.mjs` / `diagnose2.mjs` — read-only DB inspection (tables, columns, row counts) via service-role key.
- `seed-roster.mjs` / `seed-history.mjs` / `set-user.mjs` — one-off data ops (seed Carnaval roster, seed past events, set a user's password/role) via service-role key.
- All scripts take secrets from env (`SR` = service-role key, `DATABASE_URL`) — **none hardcode secrets**.

### Root docs / SQL
- `AGENTS.md` — the Next.js-version warning (imported at top of this file).
- `SETUP.md` — original Supabase + Vercel setup walkthrough.
- `supabase_schema.sql` / `supabase_migration_2.sql` / `supabase_all.sql` — historical full-schema snapshots (superseded by the incremental `scripts/*.sql` + `fix.sql`).

---

## Database tables (Postgres / Supabase, all RLS-protected)

`profiles` (id→auth.users, email, display_name, role) · `events` (name, venue, dates, start_time, attendance, poster/description/ticket/drive/fb urls, stages[], excluded_days[]) · `hosp_settings` · `hosp_people` · `hosp_person_days` · `lineup_entries` (+ stage, day_date, kind, rider jsonb) · `budget_items` (+ breakdown jsonb) · `tasks` · `proposals` · `playbook_entries` · `guests` · `inventory_items` · `crew_contacts` · `marketing_spend` · `org_settings` (singleton). RLS helpers: `is_core_plus()`, `is_admin()`. Profile auto-created on signup via `handle_new_user()` trigger.

---

## Local dev / deploy

```bash
npm run dev        # local dev (needs .env.local)
npm run build      # production build (must pass before deploy)
vercel deploy --prod --yes   # deploy (env vars live in the Vercel project)
node scripts/run-migration.mjs scripts/<file>.sql   # apply a schema change
```

`.env.local` (git-ignored) holds: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL` (session-pooler connection string). The first three are also set in the Vercel project.

---

## Current state

**Shipped & live.** Auth, Brand HQ (Overview/Team/Playbook/Settings), full per-event suite (Home+master-chat, Lineup/timetable+activities+riders, Budget+projections, Hosp+rider-rollup, Guests/door list, Logistics/crew+gear, Planner+auto-plan, Pitch, Insights, Marketing, Import), event import from RA, editable org settings. Three real past events seeded into History for forecasting. Every Excel sheet the team used is now covered in-app. **Autonomous event-builder** is live — build a fully-scaffolded event (stages, phased tasks, budget, hospitality, draft timetable) from one sentence, review, and commit.

## What's still to do (roadmap, rough priority)

1. **Real-time sync** — Supabase realtime so edits appear live for the team (currently fetch-on-load + focus refresh).
2. **Sponsor & artist portals** — scoped read-only logins (artist sees only their booking + rider; sponsor sees only their deliverables). Roles already exist in the data model.
3. **Google Drive connect** — OAuth + Drive API to read sheets/files directly.
4. **Wire Guests into `/api/brain`** so a screenshot of a door list bulk-adds guests (brain currently handles hosp/lineup/budget only).
5. **Generalize the Hosp board off the hardcoded 13–19 week** — `HospTab` renders a fixed Mon–Sun (days 13–19) and `hosp_person_days.day` stores a day-of-month int, so the board doesn't track each event's real dates. The event-builder maps day-offsets onto this window as a workaround; the fix is to key hospitality days off the event's actual `start_date`/`end_date`.
6. Housekeeping: `AskTab.tsx` is superseded by HomeTab's chat (candidate for removal); consolidate the historical root `supabase_*.sql` snapshots.
