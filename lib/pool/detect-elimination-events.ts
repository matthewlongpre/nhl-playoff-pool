import type { Db } from "@/lib/db";
import { poolNhlEliminationEvents } from "@/lib/db/schema";
import { loadCachedScoreboards } from "@/lib/nhl/scoreboard-day-cache";
import { playoffSeasonFromDate } from "@/lib/nhl/playoff-status";
import type { ScoreboardResponse } from "@/lib/nhl/schemas";

export type DetectedElimination = {
  teamAbbrev: string;
  gameDate: string;
};

const SERIES_WIN_THRESHOLD = 4;

/**
 * Scans a scoreboard payload for series-clinching games on `targetDate`.
 * Uses `game.gameDate` (not the scoreboard cache key) so the correct calendar
 * date is recorded regardless of which scoreboard window contains the game.
 */
export function detectEliminationsFromScoreboard(
  scoreboard: ScoreboardResponse,
  targetDate: string,
): DetectedElimination[] {
  const results: DetectedElimination[] = [];
  for (const { games } of scoreboard.gamesByDate) {
    for (const game of games) {
      if (game.gameDate !== targetDate) continue;
      const s = game.seriesStatus;
      if (!s) continue;
      if (
        s.topSeedWins === SERIES_WIN_THRESHOLD &&
        s.bottomSeedTeamAbbrev
      ) {
        results.push({
          teamAbbrev: s.bottomSeedTeamAbbrev.toUpperCase(),
          gameDate: game.gameDate,
        });
      } else if (
        s.bottomSeedWins === SERIES_WIN_THRESHOLD &&
        s.topSeedTeamAbbrev
      ) {
        results.push({
          teamAbbrev: s.topSeedTeamAbbrev.toUpperCase(),
          gameDate: game.gameDate,
        });
      }
    }
  }
  return results;
}

/**
 * Loads the scoreboard for `date` from the cache, detects any series-clinching
 * games on that date, and inserts the eliminated teams into
 * `pool_nhl_elimination_events`. Uses `ON CONFLICT DO NOTHING` so reingesting
 * a later date never overwrites an earlier recorded elimination.
 *
 * Returns the abbrevs of any newly inserted eliminations.
 */
export async function recordEliminationsForDate(
  db: Db,
  date: string,
): Promise<string[]> {
  const scoreboards = await loadCachedScoreboards(db, [date]);
  const playoffSeason = playoffSeasonFromDate(date);
  const key = `${playoffSeason}:${date}`;
  const scoreboard = scoreboards.get(key);
  if (!scoreboard) return [];

  const detected = detectEliminationsFromScoreboard(scoreboard, date);
  if (detected.length === 0) return [];

  const inserted: string[] = [];
  for (const { teamAbbrev, gameDate } of detected) {
    const result = await db
      .insert(poolNhlEliminationEvents)
      .values({ nhlTeamAbbrev: teamAbbrev, eliminatedDate: gameDate, playoffSeason })
      .onConflictDoNothing()
      .returning({ nhlTeamAbbrev: poolNhlEliminationEvents.nhlTeamAbbrev });
    if (result.length > 0) inserted.push(teamAbbrev);
  }
  return inserted;
}
