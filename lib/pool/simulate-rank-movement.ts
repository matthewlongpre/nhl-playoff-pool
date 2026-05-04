import type { RankedStanding } from "@/lib/pool/leaderboard-rank";

/**
 * UI preview only: fabricates `rankPrev` / `rankDelta` as if standings had moved since
 * the prior day. Enabled via `?simulateRankMovement=1` on GET /api/pool/standings.
 */
export function applySimulatedRankMovement(
  standings: RankedStanding[],
): RankedStanding[] {
  const n = standings.length;
  if (n <= 1) {
    return standings.map((s) => ({
      ...s,
      rankPrev: n === 1 ? s.rank : null,
      rankDelta: null,
    }));
  }

  const offsets = [2, -2, 1, -1, 3, -1, 2, -2, 1, -3];
  return standings.map((row, i) => {
    const r = row.rank;
    let prev = r + (offsets[i % offsets.length] ?? 0);
    prev = Math.max(1, Math.min(n, prev));
    if (prev === r) {
      prev = r >= n ? r - 1 : r + 1;
    }
    return {
      ...row,
      rankPrev: prev,
      rankDelta: prev - r,
    };
  });
}
