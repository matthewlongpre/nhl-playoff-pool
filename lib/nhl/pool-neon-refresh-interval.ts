import type { ScoreboardGame } from "@/lib/nhl/schemas";

/** Neon-backed `/api/pool/*` poll cadence when slate is live or pregame (15m). Idle uses `false`. */
export const POOL_NEON_REFRESH_MS = {
  LIVE: 900_000,
  PREGAME: 900_000,
} as const;

const LIVE_STATES = new Set(["LIVE", "CRIT"]);
const PREGAME_STATES = new Set(["FUT", "PRE"]);

/**
 * Interval for Postgres-backed pool APIs (`false` = no background refetch).
 * Live/pregame slates still poll slowly; idle slates do not poll (avoids overnight traffic).
 */
export function getPoolNeonBackedRefreshIntervalMs(
  games: ReadonlyArray<Pick<ScoreboardGame, "gameState">>,
): number | false {
  if (games.length === 0) {
    return false;
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
  return false;
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
