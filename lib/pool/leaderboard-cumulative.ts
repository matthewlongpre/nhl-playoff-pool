import { and, gte, lt, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { poolTeamDailyPoints } from "@/lib/db/schema";
import type { PoolStandingsDayRow } from "@/lib/pool/compute-standings-for-date";
import { computePoolStandingsForDate } from "@/lib/pool/compute-standings-for-date";
import {
  mergeRankMovement,
  mergeRankMovementWithStaleDayFallback,
  type RankedStanding,
} from "@/lib/pool/leaderboard-rank";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import type { PoolRostersFile } from "@/lib/pool/roster-schema";
import {
  poolCalendarToday,
  getPoolPlayoffStartDate,
  previousCalendarDay,
} from "@/lib/pool/pool-season";

export type LeaderboardFetchedDailyRow = {
  teamId: string;
  date: string;
  sk: number;
  tw: number;
};

function zeroRows(rosters: PoolRostersFile): PoolStandingsDayRow[] {
  return rosters.teams.map((t) => ({
    teamId: t.id,
    name: t.name,
    ownerName: t.ownerName,
    ...(t.ownerAvatar ? { ownerAvatar: t.ownerAvatar } : {}),
    totalPoints: 0,
    skaterPoints: 0,
    teamWinPoints: 0,
  }));
}

/** True if `pool_team_daily_points` has at least one row for calendar day `day`. */
export function ingestDayPresentInFetched(
  rows: ReadonlyArray<Pick<LeaderboardFetchedDailyRow, "date">>,
  day: string,
): boolean {
  return rows.some((r) => r.date === day);
}

/**
 * DB date window for cumulative-from-ingested rows: live-merge "today" uses
 * `[start, poolToday)`; historical cutoffs use `[start, cutoffT]`.
 */
export function rowDateMatchesCumulativeDbWindow(
  rowDate: string,
  start: string,
  cutoffT: string,
  poolToday: string,
): boolean {
  if (rowDate < start) return false;
  if (cutoffT === poolToday) {
    return rowDate < poolToday;
  }
  return rowDate <= cutoffT;
}

export function sumTeamPointsFromDailyRows(
  rows: ReadonlyArray<LeaderboardFetchedDailyRow>,
  teamIds: ReadonlyArray<string>,
  start: string,
  cutoffT: string,
  poolToday: string,
): Map<string, { sk: number; tw: number }> {
  const byId = new Map<string, { sk: number; tw: number }>();
  for (const id of teamIds) {
    byId.set(id, { sk: 0, tw: 0 });
  }
  for (const r of rows) {
    if (
      !rowDateMatchesCumulativeDbWindow(r.date, start, cutoffT, poolToday)
    ) {
      continue;
    }
    const cur = byId.get(r.teamId);
    if (!cur) continue;
    cur.sk += r.sk;
    cur.tw += r.tw;
  }
  return byId;
}

function addLiveDayIntoById(
  byId: Map<string, { sk: number; tw: number }>,
  live: PoolStandingsDayRow[],
): void {
  for (const row of live) {
    const cur = byId.get(row.teamId);
    if (!cur) continue;
    cur.sk += row.skaterPoints;
    cur.tw += row.teamWinPoints;
  }
}

function standingRowsFromById(
  rosters: PoolRostersFile,
  byId: Map<string, { sk: number; tw: number }>,
): PoolStandingsDayRow[] {
  return rosters.teams.map((t) => {
    const v = byId.get(t.id)!;
    return {
      teamId: t.id,
      name: t.name,
      ownerName: t.ownerName,
      ...(t.ownerAvatar ? { ownerAvatar: t.ownerAvatar } : {}),
      skaterPoints: v.sk,
      teamWinPoints: v.tw,
      totalPoints: v.sk + v.tw,
    };
  });
}

async function fetchDailyRowsForCutoff(
  db: NonNullable<ReturnType<typeof getDb>>,
  start: string,
  cutoffT: string,
  poolToday: string,
): Promise<LeaderboardFetchedDailyRow[]> {
  const mergeToday = cutoffT === poolToday;
  const rows = mergeToday
    ? await db
        .select({
          teamId: poolTeamDailyPoints.teamId,
          date: poolTeamDailyPoints.date,
          sk: poolTeamDailyPoints.skaterPoints,
          tw: poolTeamDailyPoints.teamWinPoints,
        })
        .from(poolTeamDailyPoints)
        .where(
          and(
            gte(poolTeamDailyPoints.date, start),
            lt(poolTeamDailyPoints.date, poolToday),
          ),
        )
    : await db
        .select({
          teamId: poolTeamDailyPoints.teamId,
          date: poolTeamDailyPoints.date,
          sk: poolTeamDailyPoints.skaterPoints,
          tw: poolTeamDailyPoints.teamWinPoints,
        })
        .from(poolTeamDailyPoints)
        .where(
          and(
            gte(poolTeamDailyPoints.date, start),
            lte(poolTeamDailyPoints.date, cutoffT),
          ),
        );
  return rows.map((r) => ({
    teamId: r.teamId,
    date: r.date,
    sk: Number(r.sk ?? 0),
    tw: Number(r.tw ?? 0),
  }));
}

/** One `pool_team_daily_points` read for all cutoffs used by `buildLeaderboardResponse`. */
function fetchDailyRowsForLeaderboardBundle(
  db: NonNullable<ReturnType<typeof getDb>>,
  start: string,
  asOfDate: string,
  poolToday: string,
): Promise<LeaderboardFetchedDailyRow[]> {
  return fetchDailyRowsForCutoff(db, start, asOfDate, poolToday);
}

async function cumulativeThroughDateFromFetched(
  rosters: PoolRostersFile,
  T: string,
  liveForT: PoolStandingsDayRow[] | null,
  fetchedRows: ReadonlyArray<LeaderboardFetchedDailyRow>,
  poolToday: string,
): Promise<PoolStandingsDayRow[]> {
  const start = getPoolPlayoffStartDate();
  if (T < start) {
    return zeroRows(rosters);
  }

  const teamIds = rosters.teams.map((t) => t.id);
  const mergeToday = T === poolToday;
  let live = liveForT;
  if (mergeToday && !live) {
    live = (await computePoolStandingsForDate(rosters, T)).rows;
  }

  const byId = sumTeamPointsFromDailyRows(
    fetchedRows,
    teamIds,
    start,
    T,
    poolToday,
  );

  if (mergeToday && live) {
    addLiveDayIntoById(byId, live);
  }

  if (mergeToday) {
    const prior = previousCalendarDay(T);
    if (
      prior >= start &&
      !ingestDayPresentInFetched(fetchedRows, prior)
    ) {
      const { rows } = await computePoolStandingsForDate(rosters, prior);
      addLiveDayIntoById(byId, rows);
    }
  } else if (T >= start && !ingestDayPresentInFetched(fetchedRows, T)) {
    const { rows } = await computePoolStandingsForDate(rosters, T);
    addLiveDayIntoById(byId, rows);
  }

  return standingRowsFromById(rosters, byId);
}

/**
 * Cumulative playoff fantasy points through end of calendar day `T`, merging same-day NHL
 * results when `T` is today so the board stays live before ingest runs.
 *
 * After the pool calendar rolls forward, “yesterday” stops being merged as live “today” and
 * is expected from Postgres; if the nightly ingest has not run yet, we pull NHL results for
 * that calendar day so totals and rank deltas stay correct until cron catches up.
 */
export async function aggregateCumulativeThroughDate(
  rosters: PoolRostersFile,
  T: string,
  liveForT: PoolStandingsDayRow[] | null,
): Promise<PoolStandingsDayRow[]> {
  const start = getPoolPlayoffStartDate();
  if (T < start) {
    return zeroRows(rosters);
  }

  const db = getDb();
  if (!db) {
    if (liveForT) {
      return liveForT;
    }
    const live = await computePoolStandingsForDate(rosters, T);
    return live.rows;
  }

  const poolToday = poolCalendarToday();
  const rows = await fetchDailyRowsForCutoff(db, start, T, poolToday);
  return cumulativeThroughDateFromFetched(rosters, T, liveForT, rows, poolToday);
}

export type LeaderboardMode = "cumulative" | "single_day_fallback";

export async function buildLeaderboardResponse(asOfDate: string): Promise<{
  gamesOnSlate: number;
  standings: RankedStanding[];
  leaderboardMode: LeaderboardMode;
  asOfDate: string;
  compareThroughPrevCalendarDay: string | null;
}> {
  const rosters = loadPoolRosters();
  const livePackage = await computePoolStandingsForDate(rosters, asOfDate);

  const db = getDb();
  if (!db) {
    const standings = mergeRankMovement(livePackage.rows, null);
    return {
      gamesOnSlate: livePackage.gamesOnSlate,
      standings,
      leaderboardMode: "single_day_fallback",
      asOfDate,
      compareThroughPrevCalendarDay: null,
    };
  }

  const start = getPoolPlayoffStartDate();
  const poolToday = poolCalendarToday();
  const bundleRows = await fetchDailyRowsForLeaderboardBundle(
    db,
    start,
    asOfDate,
    poolToday,
  );

  const currentRows = await cumulativeThroughDateFromFetched(
    rosters,
    asOfDate,
    livePackage.rows,
    bundleRows,
    poolToday,
  );

  const prevDay = previousCalendarDay(asOfDate);
  let prevRows: PoolStandingsDayRow[] | null = null;
  let compareThroughPrevCalendarDay: string | null = null;

  let prevPrevRows: PoolStandingsDayRow[] | null = null;
  if (prevDay >= start) {
    prevRows = await cumulativeThroughDateFromFetched(
      rosters,
      prevDay,
      null,
      bundleRows,
      poolToday,
    );
    compareThroughPrevCalendarDay = prevDay;
    const prevPrevDay = previousCalendarDay(prevDay);
    if (prevPrevDay >= start) {
      prevPrevRows = await cumulativeThroughDateFromFetched(
        rosters,
        prevPrevDay,
        null,
        bundleRows,
        poolToday,
      );
    }
  }

  const standings = mergeRankMovementWithStaleDayFallback(
    currentRows,
    prevRows,
    prevPrevRows,
    { asOfDate, poolCalendarToday: poolCalendarToday() },
  );

  return {
    gamesOnSlate: livePackage.gamesOnSlate,
    standings,
    leaderboardMode: "cumulative",
    asOfDate,
    compareThroughPrevCalendarDay,
  };
}
