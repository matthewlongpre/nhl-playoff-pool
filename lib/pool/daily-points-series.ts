import { and, gte, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { poolTeamDailyPoints } from "@/lib/db/schema";
import { computePoolStandingsForDate } from "@/lib/pool/compute-standings-for-date";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import type { PoolRostersFile } from "@/lib/pool/roster-schema";
import {
  getPoolPlayoffStartDate,
  poolCalendarToday,
} from "@/lib/pool/pool-season";

export type DailyPointsTeamMeta = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
  chartColor: string;
};

export type DailyPointsSeriesRow = {
  date: string;
  byTeamId: Record<string, number>;
};

export type DailyPointsSeriesPayload = {
  asOfDate: string;
  playoffStart: string;
  leaderboardMode: "cumulative" | "single_day_fallback";
  dates: string[];
  teams: DailyPointsTeamMeta[];
  series: DailyPointsSeriesRow[];
};

function chartColorForIndex(i: number, n: number): string {
  const h = ((i * 360) / Math.max(n, 1)) % 360;
  return `hsl(${Math.round(h)} 62% 52%)`;
}

function teamMeta(rosters: PoolRostersFile): DailyPointsTeamMeta[] {
  const n = rosters.teams.length;
  return rosters.teams.map((t, i) => ({
    teamId: t.id,
    name: t.name,
    ownerName: t.ownerName,
    ...(t.ownerAvatar ? { ownerAvatar: t.ownerAvatar } : {}),
    chartColor: chartColorForIndex(i, n),
  }));
}

/**
 * Per-pool-team fantasy points earned on each calendar day through `asOfDate`
 * (playoff days with scoring). Merges live NHL results for pool “today” when
 * that day is the effective end date, matching cumulative leaderboard behavior.
 */
export async function buildDailyPointsSeries(
  asOfDate: string,
): Promise<DailyPointsSeriesPayload> {
  const rosters = loadPoolRosters();
  const start = getPoolPlayoffStartDate();
  const today = poolCalendarToday();
  const effectiveEnd = asOfDate > today ? today : asOfDate;
  const teams = teamMeta(rosters);

  if (effectiveEnd < start) {
    return {
      asOfDate,
      playoffStart: start,
      leaderboardMode: "cumulative",
      dates: [],
      teams,
      series: [],
    };
  }

  const db = getDb();

  const nested = new Map<string, Map<string, number>>();
  for (const t of rosters.teams) {
    nested.set(t.id, new Map());
  }

  if (!db) {
    const live = await computePoolStandingsForDate(rosters, effectiveEnd);
    if (live.gamesOnSlate === 0) {
      return {
        asOfDate,
        playoffStart: start,
        leaderboardMode: "single_day_fallback",
        dates: [],
        teams,
        series: [],
      };
    }
    const byTeamId: Record<string, number> = {};
    for (const r of live.rows) {
      byTeamId[r.teamId] = r.totalPoints;
    }
    return {
      asOfDate,
      playoffStart: start,
      leaderboardMode: "single_day_fallback",
      dates: [effectiveEnd],
      teams,
      series: [{ date: effectiveEnd, byTeamId }],
    };
  }

  const rows = await db
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
        lte(poolTeamDailyPoints.date, effectiveEnd),
      ),
    );

  for (const r of rows) {
    const m = nested.get(r.teamId);
    if (!m) continue;
    m.set(r.date, r.sk + r.tw);
  }

  let liveToday: Awaited<
    ReturnType<typeof computePoolStandingsForDate>
  > | null = null;
  if (effectiveEnd === today) {
    liveToday = await computePoolStandingsForDate(rosters, today);
    if (liveToday.gamesOnSlate > 0) {
      for (const r of liveToday.rows) {
        nested.get(r.teamId)!.set(today, r.skaterPoints + r.teamWinPoints);
      }
    }
  }

  const dateSet = new Set<string>();
  for (const r of rows) {
    dateSet.add(r.date);
  }
  if (liveToday && liveToday.gamesOnSlate > 0) {
    dateSet.add(today);
  }

  const dates = [...dateSet].sort();

  /** Days where the pool had any fantasy points (playoff game days with scoring). */
  const gameDays = dates.filter((d) => {
    let sum = 0;
    for (const t of rosters.teams) {
      sum += nested.get(t.id)!.get(d) ?? 0;
    }
    return sum > 0;
  });

  const useDates = gameDays.length > 0 ? gameDays : dates;

  const series: DailyPointsSeriesRow[] = useDates.map((date) => {
    const byTeamId: Record<string, number> = {};
    for (const t of rosters.teams) {
      byTeamId[t.id] = nested.get(t.id)!.get(date) ?? 0;
    }
    return { date, byTeamId };
  });

  return {
    asOfDate,
    playoffStart: start,
    leaderboardMode: "cumulative",
    dates: useDates,
    teams,
    series,
  };
}
