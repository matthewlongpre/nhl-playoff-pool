import { fetchPlayoffScoreboardWithCalendarFallback } from "@/lib/nhl/playoff-scoreboard-fallback";
import { getCachedPlayoffTeamStatusByDate } from "@/lib/nhl/cached-playoff-team-status";
import { fetchNhlBoxscore } from "@/lib/nhl/upstream";
import type {
  BoxscoreResponse,
  NhlTeamPlayoffStatus,
  ScoreboardGame,
} from "@/lib/nhl/schemas";
import {
  aggregateSkaterGoalsAssists,
  countWinsByTeamAbbrev,
  isPlayoffGame,
} from "@/lib/pool/scoring";

function playoffGamesForDate(
  gamesByDate: { date: string; games: ScoreboardGame[] }[],
  date: string,
): ScoreboardGame[] {
  const day = gamesByDate.find((d) => d.date === date);
  if (!day) return [];
  return day.games.filter((g) => isPlayoffGame(g));
}

/** Logos from the scoreboard (same CDN URLs the NHL app uses). */
export function teamLogoUrlByAbbrev(
  games: ReadonlyArray<ScoreboardGame>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of games) {
    const awayLogo = g.awayTeam.logo;
    const homeLogo = g.homeTeam.logo;
    if (awayLogo) m.set(g.awayTeam.abbrev, awayLogo);
    if (homeLogo) m.set(g.homeTeam.abbrev, homeLogo);
  }
  return m;
}

export type PlayoffDayNhlBundle = {
  /** Requested calendar date query param. */
  requestedCalendarDate: string;
  requestedDate: string;
  effectiveDate: string;
  fellBack: boolean;
  gamesOnSlate: number;
  playoffGames: ScoreboardGame[];
  boxByGameId: Map<number, BoxscoreResponse>;
  boxscores: BoxscoreResponse[];
  skaterStats: ReturnType<typeof aggregateSkaterGoalsAssists>;
  winsByAbbrev: ReturnType<typeof countWinsByTeamAbbrev>;
  teamLogos: Map<string, string>;
  teamStatusByAbbrev: Map<string, NhlTeamPlayoffStatus>;
};

/** Scoreboard slice only — no boxscores (for cache keys / deduped fan-out). */
export type PlayoffDayScoreboardPhase = {
  requestedCalendarDate: string;
  requestedDate: string;
  effectiveDate: string;
  fellBack: boolean;
  playoffGames: ScoreboardGame[];
};

export async function fetchPlayoffDayScoreboardPhase(
  requestedCalendarDate: string,
): Promise<PlayoffDayScoreboardPhase> {
  const { scoreboard, effectiveDate, fellBack, requestedDate } =
    await fetchPlayoffScoreboardWithCalendarFallback(requestedCalendarDate);
  const playoffGames = playoffGamesForDate(scoreboard.gamesByDate, effectiveDate);
  return {
    requestedCalendarDate,
    requestedDate,
    effectiveDate,
    fellBack,
    playoffGames,
  };
}

export async function finalizePlayoffDayNhlBundle(
  phase: PlayoffDayScoreboardPhase,
): Promise<PlayoffDayNhlBundle> {
  const { playoffGames, requestedCalendarDate, requestedDate, effectiveDate, fellBack } =
    phase;
  const gameIds = [...new Set(playoffGames.map((g) => g.id))];

  const boxResults = await Promise.allSettled(
    gameIds.map((id) => fetchNhlBoxscore(id)),
  );
  const boxscores: BoxscoreResponse[] = [];
  const boxByGameId = new Map<number, BoxscoreResponse>();
  for (let i = 0; i < boxResults.length; i++) {
    const r = boxResults[i]!;
    const id = gameIds[i]!;
    if (r.status === "fulfilled") {
      boxscores.push(r.value);
      boxByGameId.set(id, r.value);
    }
  }

  const skaterStats = aggregateSkaterGoalsAssists(boxscores);
  const winsByAbbrev = countWinsByTeamAbbrev(playoffGames);
  const teamLogos = teamLogoUrlByAbbrev(playoffGames);
  const teamStatusByAbbrev =
    await getCachedPlayoffTeamStatusByDate(requestedCalendarDate);

  return {
    requestedCalendarDate,
    requestedDate,
    effectiveDate,
    fellBack,
    gamesOnSlate: playoffGames.length,
    playoffGames,
    boxByGameId,
    boxscores,
    skaterStats,
    winsByAbbrev,
    teamLogos,
    teamStatusByAbbrev,
  };
}

/**
 * One scoreboard + boxscore pass for a pool calendar day (playoff games only).
 * Prefer `loadPlayoffDayNhlBundleCached` from server routes to dedupe concurrent work.
 */
export async function loadPlayoffDayNhlBundle(
  requestedCalendarDate: string,
): Promise<PlayoffDayNhlBundle> {
  const phase = await fetchPlayoffDayScoreboardPhase(requestedCalendarDate);
  return finalizePlayoffDayNhlBundle(phase);
}
