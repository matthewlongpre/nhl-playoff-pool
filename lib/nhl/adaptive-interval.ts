import type { ScoreboardGame } from "@/lib/nhl/schemas";

export const NHL_REFRESH_MS = {
  /** Active play */
  LIVE: 120_000,
  /** Scheduled / pregame */
  PREGAME: 60_000,
  /** Final, off days, or no games */
  IDLE: 600_000,
} as const;

const LIVE_STATES = new Set(["LIVE", "CRIT"]);
const PREGAME_STATES = new Set(["FUT", "PRE"]);

/**
 * Faster polling while any game is live; slower for upcoming games; slowest when idle/final.
 */
export function getNhlScoreboardRefreshIntervalMs(
  games: ReadonlyArray<Pick<ScoreboardGame, "gameState">>,
): number {
  if (games.length === 0) {
    return NHL_REFRESH_MS.IDLE;
  }
  for (const g of games) {
    if (LIVE_STATES.has(g.gameState)) {
      return NHL_REFRESH_MS.LIVE;
    }
  }
  for (const g of games) {
    if (PREGAME_STATES.has(g.gameState)) {
      return NHL_REFRESH_MS.PREGAME;
    }
  }
  return NHL_REFRESH_MS.IDLE;
}

/**
 * Returns `false` when the slate is idle (no games or all final) so React Query does
 * not refetch in the background overnight. Live and pregame return their ms interval.
 */
export function getNhlScoreboardRefreshIntervalMsCapped(
  games: ReadonlyArray<Pick<ScoreboardGame, "gameState">>,
): number | false {
  const raw = getNhlScoreboardRefreshIntervalMs(games);
  if (raw >= NHL_REFRESH_MS.IDLE) {
    return false;
  }
  return raw;
}
