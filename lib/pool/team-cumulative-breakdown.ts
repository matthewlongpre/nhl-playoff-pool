import { eachDayOfInterval, format, parseISO } from "date-fns";
import { and, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { fetchNhlScoreboard } from "@/lib/nhl/upstream";
import type { ScoreboardResponse } from "@/lib/nhl/schemas";
import { getDb } from "@/lib/db";
import { poolSkaterDailyPoints } from "@/lib/db/schema";
import { computePoolStandingsDetailedForDate } from "@/lib/pool/compute-standings-for-date";
import {
  fetchDailyRowsForCutoff,
  ingestDayPresentInFetched,
} from "@/lib/pool/leaderboard-cumulative";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import {
  getPoolPlayoffStartDate,
  poolCalendarToday,
  previousCalendarDay,
} from "@/lib/pool/pool-season";
import type { PoolTeam } from "@/lib/pool/roster-schema";
import type { TeamScoreBreakdown } from "@/lib/pool/scoring";
import {
  countWinsByTeamAbbrev,
  isPlayoffGame,
  scorePoolTeamForDay,
} from "@/lib/pool/scoring";

const SCOREBOARD_FETCH_CONCURRENCY = 8;

async function mapInBatches<T, R>(
  items: readonly T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    out.push(...(await Promise.all(slice.map(fn))));
  }
  return out;
}

function playoffGamesForScoreboardDay(
  sb: ScoreboardResponse,
  date: string,
) {
  const day = sb.gamesByDate.find((d) => d.date === date);
  if (!day) return [];
  return day.games.filter((g) => isPlayoffGame(g));
}

async function aggregateSkaterTotalsFromDb(
  db: NonNullable<ReturnType<typeof getDb>>,
  playerIds: number[],
  start: string,
  cutoffT: string,
  poolToday: string,
): Promise<Map<number, { goals: number; assists: number }>> {
  if (playerIds.length === 0) return new Map();
  const mergeToday = cutoffT === poolToday;
  const rows = mergeToday
    ? await db
        .select({
          nhlPlayerId: poolSkaterDailyPoints.nhlPlayerId,
          goals: sql<number>`coalesce(sum(${poolSkaterDailyPoints.goals}), 0)::int`,
          assists: sql<number>`coalesce(sum(${poolSkaterDailyPoints.assists}), 0)::int`,
        })
        .from(poolSkaterDailyPoints)
        .where(
          and(
            inArray(poolSkaterDailyPoints.nhlPlayerId, playerIds),
            gte(poolSkaterDailyPoints.date, start),
            lt(poolSkaterDailyPoints.date, poolToday),
          ),
        )
        .groupBy(poolSkaterDailyPoints.nhlPlayerId)
    : await db
        .select({
          nhlPlayerId: poolSkaterDailyPoints.nhlPlayerId,
          goals: sql<number>`coalesce(sum(${poolSkaterDailyPoints.goals}), 0)::int`,
          assists: sql<number>`coalesce(sum(${poolSkaterDailyPoints.assists}), 0)::int`,
        })
        .from(poolSkaterDailyPoints)
        .where(
          and(
            inArray(poolSkaterDailyPoints.nhlPlayerId, playerIds),
            gte(poolSkaterDailyPoints.date, start),
            lte(poolSkaterDailyPoints.date, cutoffT),
          ),
        )
        .groupBy(poolSkaterDailyPoints.nhlPlayerId);

  const out = new Map<number, { goals: number; assists: number }>();
  for (const r of rows) {
    out.set(r.nhlPlayerId, {
      goals: Number(r.goals ?? 0),
      assists: Number(r.assists ?? 0),
    });
  }
  return out;
}

function mergeSkaterLinesFromBreakdown(
  acc: TeamScoreBreakdown,
  add: TeamScoreBreakdown,
): void {
  for (let i = 0; i < add.skaterDetail.length; i++) {
    const a = acc.skaterDetail[i];
    const b = add.skaterDetail[i];
    if (a && b) {
      a.goals += b.goals;
      a.assists += b.assists;
      a.points += b.points;
    }
  }
}

function mergeFullBreakdownDay(
  acc: TeamScoreBreakdown,
  add: TeamScoreBreakdown,
): void {
  mergeSkaterLinesFromBreakdown(acc, add);
  for (let i = 0; i < add.teamDetail.length; i++) {
    const a = acc.teamDetail[i];
    const b = add.teamDetail[i];
    if (a && b) {
      a.wins += b.wins;
      a.points += b.points;
    }
  }
}

function recomputeTotals(b: TeamScoreBreakdown): void {
  b.skaterPoints = b.skaterDetail.reduce((s, x) => s + x.points, 0);
  b.teamWinPoints = b.teamDetail.reduce((s, x) => s + x.points, 0);
}

function applyCumulativeTeamWinsFromScoreboards(
  team: PoolTeam,
  breakdown: TeamScoreBreakdown,
  calendarDays: string[],
  scoreboards: ScoreboardResponse[],
): void {
  let teamPickIdx = 0;
  for (const pick of team.picks) {
    if (pick.kind !== "team") continue;
    let wins = 0;
    let points = 0;
    for (let d = 0; d < calendarDays.length; d++) {
      const date = calendarDays[d]!;
      const sb = scoreboards[d]!;
      const games = playoffGamesForScoreboardDay(sb, date);
      const winsByAbbrev = countWinsByTeamAbbrev(games);
      const w = winsByAbbrev.get(pick.teamAbbrev) ?? 0;
      wins += w;
      points += w >= 1 ? 1 : 0;
    }
    const row = breakdown.teamDetail[teamPickIdx];
    if (row) {
      row.wins = wins;
      row.points = points;
    }
    teamPickIdx += 1;
  }
}

async function computeCumulativeTeamBreakdownNhlPerDay(
  teamId: string,
  throughDate: string,
): Promise<TeamScoreBreakdown | null> {
  const rosters = loadPoolRosters();
  const team = rosters.teams.find((t) => t.id === teamId);
  if (!team) return null;

  const start = getPoolPlayoffStartDate();
  if (throughDate < start) {
    return scorePoolTeamForDay(team, new Map(), new Map());
  }

  const days = eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(throughDate),
  });

  let merged: TeamScoreBreakdown | null = null;

  for (const day of days) {
    const d = format(day, "yyyy-MM-dd");
    const { standings } = await computePoolStandingsDetailedForDate(
      rosters,
      d,
      teamId,
    );
    const row = standings.find((r) => r.teamId === teamId);
    const b = row?.breakdown;
    if (!b) continue;

    if (merged === null) {
      merged = {
        skaterPoints: 0,
        teamWinPoints: 0,
        skaterDetail: b.skaterDetail.map((s) => ({ ...s })),
        teamDetail: b.teamDetail.map((t) => ({ ...t })),
      };
    } else {
      mergeFullBreakdownDay(merged, b);
    }
  }

  if (merged === null) {
    return scorePoolTeamForDay(team, new Map(), new Map());
  }

  recomputeTotals(merged);
  return merged;
}

/**
 * Sums single-day {@link TeamScoreBreakdown} rows from each playoff day through `throughDate`
 * (inclusive) so pick lines show season-to-date goals, assists, wins, and fantasy points.
 *
 * When Postgres is configured, skater lines come from `pool_skater_daily_points` plus the same
 * live / missing-ingest NHL passes the cumulative leaderboard uses; team-win lines use one NHL
 * scoreboard fetch per calendar day (no per-game boxscores), so this stays within serverless
 * timeouts. Without a DB, falls back to the legacy NHL-per-day path.
 */
export async function computeCumulativeTeamBreakdownThroughDate(
  teamId: string,
  throughDate: string,
): Promise<TeamScoreBreakdown | null> {
  const rosters = loadPoolRosters();
  const team = rosters.teams.find((t) => t.id === teamId);
  if (!team) return null;

  const start = getPoolPlayoffStartDate();
  if (throughDate < start) {
    return scorePoolTeamForDay(team, new Map(), new Map());
  }

  const db = getDb();
  if (!db) {
    return computeCumulativeTeamBreakdownNhlPerDay(teamId, throughDate);
  }

  const poolToday = poolCalendarToday();
  const calendarDays = eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(throughDate),
  }).map((d) => format(d, "yyyy-MM-dd"));

  const skaterIds = team.picks
    .filter(
      (p): p is Extract<PoolTeam["picks"][number], { kind: "skater" }> =>
        p.kind === "skater" && p.nhlPlayerId != null,
    )
    .map((p) => p.nhlPlayerId as number);

  const [dbSkaterTotals, fetchedRows, scoreboards] = await Promise.all([
    aggregateSkaterTotalsFromDb(db, skaterIds, start, throughDate, poolToday),
    fetchDailyRowsForCutoff(db, start, throughDate, poolToday),
    mapInBatches(
      calendarDays,
      SCOREBOARD_FETCH_CONCURRENCY,
      (d) => fetchNhlScoreboard(d),
    ),
  ]);

  const breakdown = scorePoolTeamForDay(team, dbSkaterTotals, new Map());
  applyCumulativeTeamWinsFromScoreboards(
    team,
    breakdown,
    calendarDays,
    scoreboards,
  );

  const nhlSkaterOverlayDays = new Set<string>();
  if (throughDate === poolToday) {
    nhlSkaterOverlayDays.add(poolToday);
    const prior = previousCalendarDay(poolToday);
    if (prior >= start && !ingestDayPresentInFetched(fetchedRows, prior)) {
      nhlSkaterOverlayDays.add(prior);
    }
  } else if (
    throughDate >= start &&
    !ingestDayPresentInFetched(fetchedRows, throughDate)
  ) {
    nhlSkaterOverlayDays.add(throughDate);
  }

  for (const d of nhlSkaterOverlayDays) {
    const { standings } = await computePoolStandingsDetailedForDate(
      rosters,
      d,
      teamId,
    );
    const row = standings.find((r) => r.teamId === teamId);
    const b = row?.breakdown;
    if (b) {
      mergeSkaterLinesFromBreakdown(breakdown, b);
    }
  }

  recomputeTotals(breakdown);
  return breakdown;
}
