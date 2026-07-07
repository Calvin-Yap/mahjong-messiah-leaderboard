# Mahjong Club Web App — Boilerplate

Next.js (App Router) + TypeScript + Tailwind CSS, deployed on Vercel with
Supabase Postgres, per the implementation plan. This scaffold wires up
routing, styling, the database schema, and the exact scoring/ELO math
ported from the original Apps Script (`code.gs` / `elo.gs`) — the
remaining work is marked with `TODO` comments throughout, summarized below.

## Getting started locally

```bash
npm install
cp .env.example .env        # fill in Supabase + DB values (see below)
npm run db:migrate          # creates tables in Postgres via Prisma
psql "$DIRECT_URL" -f prisma/sql/constraints.sql   # one-time: enforce single-active-season
psql "$DIRECT_URL" -f prisma/sql/end_season.sql    # one-time: install close_season()/purge_season_data()
npm run db:seed             # bootstrap Season 1, or POST /api/seasons { "name": "Season 1" }
npm run dev                 # http://localhost:3000
```

### Supabase setup

1. Create a project at supabase.com.
2. Project Settings → API: copy `NEXT_PUBLIC_SUPABASE_URL` and the `anon` key.
3. Project Settings → Database → Connection string: copy the **pooled**
   connection string into `DATABASE_URL` and the **direct** connection into
   `DIRECT_URL` (Prisma Migrate needs the direct one).
4. (Optional, later) Enable Storage for player icon image uploads, and
   Realtime for live session sync — both referenced in TODOs below.

## A note on the `xlsx` dependency

`package.json` points `xlsx` at `https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`
instead of a normal npm version — **this is intentional, not a typo.** The `xlsx`
package published to the npm registry has been frozen at `0.18.5` since 2023 and
still contains two fixed-upstream CVEs (prototype pollution, ReDoS) that SheetJS
has only ever patched in builds distributed through their own CDN. An `overrides`
entry is also set so nothing pulled in transitively can silently downgrade it
back to the vulnerable registry version.

Tradeoff worth knowing: `xlsx-latest.tgz` always resolves to whatever SheetJS's
newest build is _at install time_ — convenient, but not perfectly reproducible
across machines/times. If you want a pinned, reproducible version instead, swap
both occurrences above for a specific release, e.g.
`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (check
[cdn.sheetjs.com](https://cdn.sheetjs.com) for the current latest).

### Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel → set the same environment variables from `.env`
   in Project Settings → Environment Variables.
3. Vercel runs `npm run build`, which does **not** run migrations —
   run `npm run db:migrate` locally (or via a CI step) against the
   production `DATABASE_URL` before/while deploying schema changes.

## Project structure

```
prisma/schema.prisma       Database schema (Section 2 of the implementation plan)
prisma/seed.ts             One-time import script skeleton (Section 4 of the plan)
src/lib/elo.ts             ELO engine, ported 1:1 from elo.gs
src/lib/scoring.ts         Fan-based scoring math, ported from code.gs
src/lib/titles.ts          Leaderboard title-tier logic
src/lib/types.ts           Shared DTOs between API routes and pages
src/lib/prisma.ts          Prisma client singleton
src/lib/supabase/          Supabase browser/server clients (Realtime + Storage only)
src/app/api/               Route handlers (players, games, sessions, leaderboard, dashboard, elo, network)
src/app/{session,leaderboard,dashboard,network}/page.tsx   The 4 main pages
src/components/            UI primitives + per-page components
```

## Seasons & Hall of Fame

Free-tier storage math: at ~15 games/night, ~45 nights/year, the 9-rows-per-game
write pattern (1 `games` + 4 `game_scores` + 4 `elo_history`) works out to
roughly **100+ years of runway** before hitting Supabase's 500MB free-tier
cap. Seasons are therefore built as a **product feature** (fresh competitive
periods + a permanent Hall of Fame), not an emergency storage fix — which is
why the design deliberately separates two concerns that are easy to conflate:

1. **`close_season()`** (`prisma/sql/end_season.sql`) — snapshots every
   player's final rank/score/ELO/W-L into `season_history` (a small,
   **permanent, never-truncated** table), closes the old season, optionally
   resets ELO to 1500 (toggle via the "End Season" modal), and starts the
   next season. **Raw game data is left untouched.**
2. **`purge_season_data(season_id)`** — the literal "delete rows to reclaim
   space" operation. Kept as a separate, manual, rarely-run function that
   refuses to run on the active season or on any season without a
   `season_history` snapshot already in place — you'd invoke this yourself,
   once, if you ever actually approach the storage cap.

`games.season_id` tags every game with the season it was played in, so the
leaderboard/dashboard can filter to "this season only" (or be pointed at
`gameScores: true` for an all-time view) regardless of whether old seasons'
raw data has been purged.

### Still worth deciding

- [ ] **ELO across seasons**: the "End Season" modal defaults to a full
      reset to 1500. If you'd rather carry ratings forward, uncheck the box
      per-close, or change the default in `EndSeasonButton.tsx`.
- [ ] **Backup before closing**: `POST /api/seasons/:id/close` has a
      `TODO(backup)` — wire up an export of the season's raw rows to
      Supabase Storage before the snapshot runs, since `purge_season_data()`
      (if you ever use it) is irreversible.
- [ ] **Dashboard/Network season scoping**: currently still all-time; add
      a `?seasonId=` query param if you want those pages to default to the
      current season too.

## Master TODO list by page

Every file also has inline `TODO` comments — this is the same list gathered
in one place so you can track progress.

### `/session` — Session Manager

- [ ] Load the active session from `GET /api/sessions?active=true` on mount
- [ ] Wrap the board in `@dnd-kit/core`'s `<DndContext>`; persist drops via
      `PATCH /api/sessions/:id/layout`
- [ ] Supabase Realtime subscription so multiple devices stay in sync
- [ ] Wind Drawing (shuffle seat order) endpoint + button
- [ ] Search bar filtering (client-side)
- [ ] Close Session action
- [ ] Add/remove table controls

### Add New Player (modal, used from `/session`)

- [ ] Wire image-upload tab to Supabase Storage instead of storing a
      base64 data URL directly (swap before launch — fine for local dev)
- [ ] Decide whether duplicate-icon prevention still matters at web scale

### `/leaderboard`

- [ ] Move the aggregation query into a Postgres view/materialized view
      once games volume grows (see `api/leaderboard/route.ts` TODO)
- [ ] Sortable columns, search/filter input
- [ ] Mobile card layout for narrow screens

### `/dashboard`

- [ ] Fetch real data from `/api/dashboard/scores` and `/api/elo/history`
- [ ] Real dual-range date slider (currently two plain date inputs)
- [ ] "Session Players" quick filter wired to the active session
- [ ] Rank-over-time bump chart (data shape already returned by the API)
- [ ] Average ELO per game played bar chart

### `/network`

- [ ] Fetch real data from `/api/network`
- [ ] Instantiate `vis-network` on the client (dynamic import, see
      `NetworkGraph.tsx` TODO — left as a comment to avoid SSR issues)
- [ ] Date-range filter (default: April 25 2026 onward, matching the original)
- [ ] Multi-select "compare mode" alongside the existing ego-graph mode

### `/hall-of-fame`

- [ ] Highlight top 3 / bottom finisher more visually (medals exist, styling is plain)
- [ ] Add a per-season "MVP" callout card
- [ ] Add a cross-season "all-time" aggregate view

### `/leaderboard` — End Season

- [ ] Wire the backup export mentioned above before `close_season()` runs
- [ ] Consider a "preview standings" step before the confirm modal, so
      the club can sanity-check ranks before committing

### Data import (one-time, before launch)

- [x] `prisma/seed.ts` is a real, working import — reads `prisma/import/scoresheet.xlsx`
      directly and backfills players, `elo_state`, games/`game_scores`, and
      `elo_history`, ending with a reconciliation report. See the script's
      header comment for exactly what it does and doesn't capture.
- [x] Drop your workbook in as `prisma/import/scoresheet.xlsx` and run
      `npm run db:seed` against a freshly migrated (empty) database
- [ x] Read the reconciliation report it prints — it diffs computed
  `total_score` per player against the Leaderboard sheet's Total Points
- [ x] Decide whether to extend it for the "Old Game Scores" sheet (a
  different, older manual-entry format, intentionally skipped for now)
