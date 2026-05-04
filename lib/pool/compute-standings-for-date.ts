import { fetchNhlBoxscore, fetchNhlScoreboard } from "@/lib/nhl/upstream";
import type { BoxscoreResponse } from "@/lib/nhl/schemas";
import type { ScoreboardGame } from "@/lib/nhl/schemas";
import type { PoolRostersFile } from "@/lib/pool/roster-schema";
import type { TeamScoreBreakdown } from "@/lib/pool/scoring";
import {
  aggregateSkaterGoalsAssists,
  countWinsByTeamAbbrev,
  isPlayoffGame,
  scorePoolTeamForDay,
  totalFantasyPoints,
} from "@/lib/pool/scoring";

function playoffGamesForDate(
  gamesByDate: { date: string; games: ScoreboardGame[] }[],
  date: string,
): ScoreboardGame[] {
  const day = gamesByDate.find((d) => d.date === date);
  if (!day) return [];
  return day.games.filter((g) => isPlayoffGame(g));
}

export type PoolStandingsDayRow = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
  totalPoints: number;
  skaterPoints: number;
  teamWinPoints: number;
};

/**
 * Live fantasy standings for a single calendar day (playoff games on that date only).
 */
export async function computePoolStandingsForDate(
  rosters: PoolRostersFile,
  date: string,
): Promise<{ gamesOnSlate: number; rows: PoolStandingsDayRow[] }> {
  const { gamesOnSlate, rows } = await computePoolStandingsForDateWithStats(
    rosters,
    date,
  );
  return { gamesOnSlate, rows };
}

/**
 * Same as {@link computePoolStandingsForDate} but also exposes the raw skater goals/assists
 * map for the day. Used by ingest to persist per-skater rows alongside the per-team totals
 * without re-fetching boxscores.
 */
export async function computePoolStandingsForDateWithStats(
  rosters: PoolRostersFile,
  date: string,
): Promise<{
  gamesOnSlate: number;
  rows: PoolStandingsDayRow[];
  skaterStats: Map<number, { goals: number; assists: number }>;
}> {
  const scoreboard = await fetchNhlScoreboard(date);
  const playoffGames = playoffGamesForDate(scoreboard.gamesByDate, date);
  const gameIds = [...new Set(playoffGames.map((g) => g.id))];

  const boxResults = await Promise.allSettled(
    gameIds.map((id) => fetchNhlBoxscore(id)),
  );
  const boxscores: BoxscoreResponse[] = [];
  for (const r of boxResults) {
    if (r.status === "fulfilled") {
      boxscores.push(r.value);
    }
  }

  const skaterStats = aggregateSkaterGoalsAssists(boxscores);
  const winsByAbbrev = countWinsByTeamAbbrev(playoffGames);

  const rows = rosters.teams.map((team) => {
    const breakdown = scorePoolTeamForDay(team, skaterStats, winsByAbbrev);
    const totalPoints = totalFantasyPoints(breakdown);
    return {
      teamId: team.id,
      name: team.name,
      ownerName: team.ownerName,
      ...(team.ownerAvatar ? { ownerAvatar: team.ownerAvatar } : {}),
      totalPoints,
      skaterPoints: breakdown.skaterPoints,
      teamWinPoints: breakdown.teamWinPoints,
    };
  });

  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.name.localeCompare(b.name);
  });

  return { gamesOnSlate: playoffGames.length, rows, skaterStats };
}

export type PoolStandingsDayRowWithBreakdown = PoolStandingsDayRow & {
  breakdown?: TeamScoreBreakdown;
};

/**
 * Same as single-day standings, optionally attaching full `breakdown` for one team (smaller payload).
 */
export async function computePoolStandingsDetailedForDate(
  rosters: PoolRostersFile,
  date: string,
  teamIdForBreakdown: string | null,
): Promise<{ gamesOnSlate: number; standings: PoolStandingsDayRowWithBreakdown[] }> {
  const scoreboard = await fetchNhlScoreboard(date);
  const playoffGames = playoffGamesForDate(scoreboard.gamesByDate, date);
  const gameIds = [...new Set(playoffGames.map((g) => g.id))];

  const boxResults = await Promise.allSettled(
    gameIds.map((id) => fetchNhlBoxscore(id)),
  );
  const boxscores: BoxscoreResponse[] = [];
  for (const r of boxResults) {
    if (r.status === "fulfilled") {
      boxscores.push(r.value);
    }
  }

  const skaterStats = aggregateSkaterGoalsAssists(boxscores);
  const winsByAbbrev = countWinsByTeamAbbrev(playoffGames);

  const standings = rosters.teams.map((team) => {
    const breakdown = scorePoolTeamForDay(team, skaterStats, winsByAbbrev);
    const totalPoints = totalFantasyPoints(breakdown);
    const includeBreakdown =
      teamIdForBreakdown != null && team.id === teamIdForBreakdown;
    return {
      teamId: team.id,
      name: team.name,
      ownerName: team.ownerName,
      ...(team.ownerAvatar ? { ownerAvatar: team.ownerAvatar } : {}),
      totalPoints,
      skaterPoints: breakdown.skaterPoints,
      teamWinPoints: breakdown.teamWinPoints,
      ...(includeBreakdown ? { breakdown } : {}),
    };
  });

  standings.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.name.localeCompare(b.name);
  });

  return { gamesOnSlate: playoffGames.length, standings };
}
