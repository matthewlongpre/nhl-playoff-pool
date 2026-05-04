# realtime-api

Next.js app for NHL scoreboard data and a fantasy playoff pool (standings, day scoring, cumulative leaderboard).

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database (optional locally)

Cumulative standings and ingest use **Postgres** via `DATABASE_URL`. Without it, the UI falls back to a single-day standings preview. Two tables are written by ingest:

- `pool_team_daily_points` — per-pool-team daily totals (skater + team-win pts).
- `pool_skater_daily_points` — per-NHL-skater daily G/A for skaters referenced by any pool roster pick. Powers the "Pool in review" highlights (MVP skater, best pick per round, best single game). Backfilled by the same `reingest` POST below.

**Local dev — Docker**

1. Start Postgres:

   ```bash
   docker compose up -d
   ```

2. Copy [`.env.example`](.env.example) to `.env.local` and set:

   ```bash
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/realtime_api
   ```

3. Push the schema (no migration files — schema is applied directly during development):

   ```bash
   npm run db:push
   ```

4. Optionally set `POOL_PLAYOFF_START_DATE`, `CRON_SECRET`, and backfill via `POST /api/pool/internal/ingest-daily` (see `.env.example`).

**Staging / production**

Create a managed Postgres instance on your provider (e.g. Neon, Supabase, RDS), set `DATABASE_URL` in the environment (Vercel project settings, etc.), then run `npm run db:push` from CI or your machine once against that URL, or use the host’s SQL console if you prefer.

### Ingest (cron and manual)

Production runs [`vercel.json`](vercel.json) → daily **GET** `/api/pool/internal/cron-ingest-yesterday`, which writes yesterday’s pool-calendar fantasy totals to Postgres (same behavior as the cron). Trigger it yourself with the same secret Vercel uses:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR_DEPLOYMENT_HOST/api/pool/internal/cron-ingest-yesterday"
```

To **re-ingest a specific calendar day** (for example after fixing roster data), **POST** `/api/pool/internal/ingest-daily` with JSON `{"date":"YYYY-MM-DD"}` and the same `Authorization` header. Optional query `?strictToday=1` blocks ingesting today or future dates.

**Manual route (same auth):** **GET** or **POST** `/api/pool/internal/reingest` — **GET** ingests yesterday; **POST** accepts the same JSON as `ingest-daily` (`date` or `from` / `to`).

**One-time skater backfill** (after deploying the `pool_skater_daily_points` table) — POST a `from`/`to` range covering `POOL_PLAYOFF_START_DATE` through yesterday so historical highlights populate:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"from":"2026-04-18","to":"2026-04-25"}' \
  "https://YOUR_DEPLOYMENT_HOST/api/pool/internal/reingest"
```

**Without a Bearer token:** set `ALLOW_UNAUTHENTICATED_POOL_INGEST=true` in the deployment environment. Then those ingest routes (including `reingest`) accept unauthenticated calls. Only enable if the app is not publicly writable otherwise (e.g. Vercel deployment protection, VPN, or similar); anyone who can reach the URL can trigger DB writes.

## Scripts

| Command        | Purpose                                      |
|----------------|----------------------------------------------|
| `npm run dev`  | Next.js dev server                           |
| `npm run build`| Production build                             |
| `npm test`     | Vitest                                       |
| `npm run db:push` | Sync [`lib/db/schema.ts`](lib/db/schema.ts) to the DB |

## Projected points

The home page renders a "Projected points" panel beneath "Scoring runway" that estimates each pool team's expected end-of-playoffs total. The math lives in [`lib/pool/projection.ts`](lib/pool/projection.ts) and is intentionally simple, transparent, and pluggable:

- **Per-pick EV** — `skater EV = blendedPpg × E[remaining games for the player's NHL team]` and `team-pick EV = E[remaining wins for the picked NHL club]` (the existing pool rule is "1 point per day a picked team gets a win", which is just expected wins in playoffs since each team plays at most one game per day).
- **Blended PPG** — Bayesian shrinkage toward regular-season PPG: `(priorWeight × rsPpg + playoffGp × playoffPpg) / (priorWeight + playoffGp)`. The prior weight defaults to `15` games (≈ a quarter of the NHL regular season), so a player needs roughly `15` playoff games before the in-playoff sample dominates. Falls back to career playoff PPG when there's no regular-season data, and to `0` when nothing is known.
- **Expected remaining games / wins per NHL team** — DP over best-of-7 series state from each team's highest-round bracket slot, then walked forward through Stanley Cup rounds 2 → 4 with `P(advance) = baselineP` per round (`0.5` by default). Eliminated teams contribute `0`.
- **Per-game probability** — defaults to `0.5` (`baselineP`). Override `seriesPerGameProbability` on `ProjectionConfig` (or the route-level `DEFAULT_PROJECTION_CONFIG`) to swap in seed-based, Pythagorean (regular-season GF/GA), or stat-driven probabilities later. The DP is generic in `p`; only the input changes.
- **Collisions** — when two of a pool team's picks sit on opposing NHL clubs in the same in-progress series, the panel surfaces a chip ("2 picks face off · R1") and the team detail page lists the affected pick labels. The model itself is correlation-aware *for expectations* (advancement of `team1` and `team2` in a head-to-head series are mutually exclusive, so summing per-pick EVs already accounts for it).
- **Data inputs** — regular-season + career-playoff stats come from NHLE `/player/{id}/landing` via [`fetchNhlPlayerSeasonRates`](lib/nhl/player-landing.ts) (cached 24h). Current playoff PPG is aggregated from `pool_skater_daily_points` in Postgres. Bracket and team-elimination state come from the existing [`fetchNhlPlayoffBracket`](lib/nhl/upstream.ts) (cached 5m).

The route is at [`/api/pool/projection`](app/api/pool/projection/route.ts) (`Cache-Control: s-maxage=30, stale-while-revalidate=300`). Suggested next iterations (deliberately out of scope for the current panel):

1. Monte Carlo bracket simulation for `p10 / p90` confidence bands and per-pool-team win probabilities.
2. Recent-form weighting on current-playoff PPG (last-5-games × 1.5 weight) — additive change inside `blendedPpg`.
3. Strength-of-schedule for next-round opponents, power-play / line role multipliers, and goalie matchup adjustments.
4. Health flags via the existing `scratched` boxscore field to dampen projections during scratch streaks.

## Roster outlook (combined view)

The home page's leaderboard slot is a tabbed control ([`PoolLeaderboardTabs`](components/pool-leaderboard-tabs.tsx)) with three views — **Roster outlook** (default), **Scoring runway**, and **Projected points**. All three panels stay mounted (toggled with `hidden`) so React Query caches and per-panel UI state — e.g. the Outlook sort selection — survive tab switches without refetching.

[`PoolRosterOutlook`](components/pool-roster-outlook.tsx) fuses the runway and projected views on a single screen. It builds on the same [`/api/pool/projection`](app/api/pool/projection/route.ts) response (now also carrying `remainingSkaters/totalSkaters/remainingTeams/totalTeams/teamWinPicks` for each row) and renders, per pool team:

- **League summary tiles** — total scored, total projected, average locked-in %, average alive picks %.
- **Movement chips** — projected leader, biggest projected riser, biggest projected faller (using `scoredRank → projectedRank` deltas).
- **Two parallel bars** — points trajectory (`scored | projected | gap-to-leader`, normalized to the league's max projected total) stacked above pick survival (`skaters alive | teams alive | eliminated`, normalized to that team's roster size).
- **Sortable rows** — Projected (default) / Scored / Locked-in % / Alive picks. The current and projected ranks are computed once across the unsorted set so the ↑↓ chip is stable regardless of which sort is active.
- **Roster context** — alive pick counts (`P n/N sk · T n/N tm`), team-win club logos (greyed if eliminated), the top remaining pick (`best pick label + EV`), and the same in-series collision chip from the Projected points panel.

The component is a thin client view on top of the existing route — no new server logic was needed beyond extending each row with the runway counts. Tap a row to open the team detail page (which already surfaces per-pick projected EV chips and a projected total).

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
