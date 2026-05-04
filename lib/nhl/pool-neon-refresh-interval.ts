import type { ScoreboardGame } from "@/lib/nhl/schemas";

/** Neon-backed `/api/pool/*` poll cadence — 15m for hobby/small pools (NHL scoreboard stays faster). */
export const POOL_NEON_REFRESH_MS = {
  LIVE: 900_000,
  PREGAME: 900_000,
  IDLE: 900_000,
} as const;

const LIVE_STATES = new Set(["LIVE", "CRIT"]);
const PREGAME_STATES = new Set(["FUT", "PRE"]);

/**
 * Adaptive interval for Postgres-backed pool APIs: live games still refresh
 * reasonably often; idle slates avoid the former 60s cap that hammered Neon.
 */
export function getPoolNeonBackedRefreshIntervalMs(
  games: ReadonlyArray<Pick<ScoreboardGame, "gameState">>,
): number {
  if (games.length === 0) {
    return POOL_NEON_REFRESH_MS.IDLE;
  }
  for (const g of games) {
    if (LIVE_STATES.has(g.gameState)) {
      return POOL_NEON_REFRESH_MS.LIVE;
    }
  }
  for (const g of games) {
    if (PREGAME_STATES.has(g.gameState)) {
      return POOL_NEON_REFRESH_MS.PREGAME;
    }
  }
  return POOL_NEON_REFRESH_MS.IDLE;
}

/**
 * Compact fingerprint of visible games for invalidating Neon-backed queries when
 * scores or state change, without polling those routes on the NHL clock.
 */
export function fingerprintVisibleScoreboardGames(
  games: ReadonlyArray<ScoreboardGame>,
): string {
  if (games.length === 0) return "";
  const sorted = [...games].sort((a, b) => a.id - b.id);
  return sorted
    .map((g) => {
      const as = g.awayTeam?.score ?? "";
      const hs = g.homeTeam?.score ?? "";
      const period = g.period ?? "";
      return `${g.id}:${g.gameState}:${as}-${hs}:${period}`;
    })
    .join("|");
}
