import { and, eq, lte } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { nhlScoreboardDayCache, poolNhlEliminationEvents } from "@/lib/db/schema";
import { playoffSeasonFromDate } from "@/lib/nhl/playoff-status";
import { scoreboardResponseSchema } from "@/lib/nhl/schemas";
import type { NhlTeamPlayoffStatus, PlayoffBracketResponse } from "@/lib/nhl/schemas";

type SeriesState = {
  seriesAbbrev: string;
  round: number;
  topSeedTeamAbbrev: string;
  bottomSeedTeamAbbrev: string;
  topSeedWins: number;
  bottomSeedWins: number;
  totalWins: number;
};

/**
 * Reconstructs a historically-accurate bracket and team status for a past date by:
 *  - Scanning all `nhl_scoreboard_day_cache` entries up to `date` and taking the
 *    latest known series state (highest total wins) per series.
 *  - Deriving `statusByAbbrev` from `pool_nhl_elimination_events` (teams eliminated
 *    on or before `date` are "eliminated"; all others seen in the bracket are "active").
 *
 * The resulting bracket is a synthetic `PlayoffBracketResponse` containing only the
 * series that had already started by `date`. `buildTeamProjectionMaps` handles future
 * rounds automatically via its recurrence walk, so no forward slots are needed.
 */
export async function reconstructHistoricalBracket(
  db: Db,
  date: string,
): Promise<{
  bracket: PlayoffBracketResponse;
  statusByAbbrev: Map<string, NhlTeamPlayoffStatus>;
}> {
  const playoffSeason = playoffSeasonFromDate(date);

  const scoreboardRows = await db
    .select({
      calendarDate: nhlScoreboardDayCache.calendarDate,
      payload: nhlScoreboardDayCache.payload,
    })
    .from(nhlScoreboardDayCache)
    .where(
      and(
        eq(nhlScoreboardDayCache.playoffSeason, playoffSeason),
        lte(nhlScoreboardDayCache.calendarDate, date),
      ),
    );

  const seriesMap = new Map<string, SeriesState>();
  for (const row of scoreboardRows) {
    const parsed = scoreboardResponseSchema.safeParse(row.payload);
    if (!parsed.success) continue;
    for (const { games } of parsed.data.gamesByDate) {
      for (const game of games) {
        const s = game.seriesStatus;
        if (!s || !s.topSeedTeamAbbrev || !s.bottomSeedTeamAbbrev) continue;
        const totalWins = s.topSeedWins + s.bottomSeedWins;
        // Key by team pair — seriesAbbrev is non-unique (all R1 series share "R1", etc.)
        const key = `${s.topSeedTeamAbbrev.toUpperCase()}:${s.bottomSeedTeamAbbrev.toUpperCase()}`;
        const existing = seriesMap.get(key);
        if (!existing || totalWins > existing.totalWins) {
          seriesMap.set(key, {
            seriesAbbrev: s.seriesAbbrev,
            round: s.round,
            topSeedTeamAbbrev: s.topSeedTeamAbbrev.toUpperCase(),
            bottomSeedTeamAbbrev: s.bottomSeedTeamAbbrev.toUpperCase(),
            topSeedWins: s.topSeedWins,
            bottomSeedWins: s.bottomSeedWins,
            totalWins,
          });
        }
      }
    }
  }

  const bracket: PlayoffBracketResponse = {
    series: [...seriesMap.values()].map((s) => ({
      seriesAbbrev: s.seriesAbbrev,
      playoffRound: s.round,
      topSeedWins: s.topSeedWins,
      bottomSeedWins: s.bottomSeedWins,
      topSeedTeam: { id: 0, abbrev: s.topSeedTeamAbbrev },
      bottomSeedTeam: { id: 0, abbrev: s.bottomSeedTeamAbbrev },
    })),
  };

  const elimRows = await db
    .select({ nhlTeamAbbrev: poolNhlEliminationEvents.nhlTeamAbbrev })
    .from(poolNhlEliminationEvents)
    .where(
      and(
        eq(poolNhlEliminationEvents.playoffSeason, playoffSeason),
        lte(poolNhlEliminationEvents.eliminatedDate, date),
      ),
    );

  const statusByAbbrev = new Map<string, NhlTeamPlayoffStatus>();
  for (const { nhlTeamAbbrev } of elimRows) {
    statusByAbbrev.set(nhlTeamAbbrev.toUpperCase(), "eliminated");
  }
  for (const s of bracket.series) {
    const top = s.topSeedTeam?.abbrev;
    const bot = s.bottomSeedTeam?.abbrev;
    if (top && !statusByAbbrev.has(top)) statusByAbbrev.set(top, "active");
    if (bot && !statusByAbbrev.has(bot)) statusByAbbrev.set(bot, "active");
  }

  return { bracket, statusByAbbrev };
}
