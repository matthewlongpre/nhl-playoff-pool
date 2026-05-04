import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { poolSkaterDailyPoints, poolTeamDailyPoints } from "@/lib/db/schema";
import { computePoolStandingsForDateWithStats } from "@/lib/pool/compute-standings-for-date";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import { poolCalendarToday } from "@/lib/pool/pool-season";
import type { PoolRostersFile } from "@/lib/pool/roster-schema";
import { poolSkaterNhlPlayerIds } from "@/lib/pool/skater-slate";

/** First `nhlTeamAbbrev` snapshot we see for `playerId` across pool rosters (display only). */
function rosterTeamAbbrevByPlayerId(
  rosters: PoolRostersFile,
): Map<number, string> {
  const out = new Map<number, string>();
  for (const team of rosters.teams) {
    for (const pick of team.picks) {
      if (pick.kind !== "skater") continue;
      if (pick.nhlPlayerId == null) continue;
      if (out.has(pick.nhlPlayerId)) continue;
      const abbrev = pick.nhlTeamAbbrev?.trim().toUpperCase();
      if (abbrev) out.set(pick.nhlPlayerId, abbrev);
    }
  }
  return out;
}

export async function ingestPoolPointsForCalendarDate(date: string): Promise<{
  gamesOnSlate: number;
  teamsWritten: number;
  skatersWritten: number;
}> {
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_URL or POSTGRES_URL is not configured");
  }

  const rosters = loadPoolRosters();
  const { rows, gamesOnSlate, skaterStats } =
    await computePoolStandingsForDateWithStats(rosters, date);

  for (const row of rows) {
    await db
      .insert(poolTeamDailyPoints)
      .values({
        teamId: row.teamId,
        date,
        skaterPoints: row.skaterPoints,
        teamWinPoints: row.teamWinPoints,
      })
      .onConflictDoUpdate({
        target: [poolTeamDailyPoints.teamId, poolTeamDailyPoints.date],
        set: {
          skaterPoints: row.skaterPoints,
          teamWinPoints: row.teamWinPoints,
          updatedAt: sql`now()`,
        },
      });
  }

  /**
   * Persist per-skater stats only for skaters referenced by at least one pool roster pick,
   * and only when they recorded a non-zero stat (keeps the table sparse). On re-ingest we
   * still want previously-written rows to land on zero if a boxscore correction wipes their
   * stat line, so we upsert zero for known pool-relevant ids that produced no stat today.
   */
  const poolPlayerIds = poolSkaterNhlPlayerIds(rosters.teams);
  const teamAbbrevByPlayerId = rosterTeamAbbrevByPlayerId(rosters);
  let skatersWritten = 0;
  for (const playerId of poolPlayerIds) {
    const stat = skaterStats.get(playerId) ?? { goals: 0, assists: 0 };
    if (stat.goals === 0 && stat.assists === 0) continue;
    const teamAbbrev = teamAbbrevByPlayerId.get(playerId) ?? null;
    await db
      .insert(poolSkaterDailyPoints)
      .values({
        nhlPlayerId: playerId,
        date,
        goals: stat.goals,
        assists: stat.assists,
        nhlTeamAbbrev: teamAbbrev,
      })
      .onConflictDoUpdate({
        target: [poolSkaterDailyPoints.nhlPlayerId, poolSkaterDailyPoints.date],
        set: {
          goals: stat.goals,
          assists: stat.assists,
          nhlTeamAbbrev: teamAbbrev,
          updatedAt: sql`now()`,
        },
      });
    skatersWritten += 1;
  }

  return { gamesOnSlate, teamsWritten: rows.length, skatersWritten };
}

/** Optional guard: refuse ingesting “today” so live merge remains the source of truth for the current slate. */
export function assertIngestDateNotTodayIfStrict(date: string, strict: boolean): void {
  if (!strict) return;
  const today = poolCalendarToday();
  if (date >= today) {
    throw new Error(
      "Ingest date must be before today when strict mode is on (today uses live NHL data in the API).",
    );
  }
}
