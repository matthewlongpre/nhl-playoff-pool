import type { PoolStandingsDayRow } from "@/lib/pool/compute-standings-for-date";

export type RankedStanding = PoolStandingsDayRow & {
  rank: number;
  rankPrev: number | null;
  rankDelta: number | null;
};

/**
 * Sort standings rows for display.
 *
 * Ranks themselves are still based purely on `totalPoints` (competition ranking
 * via {@link assignRanks}), but when totals are tied we order display rows by:
 *   1. skater points (more is better)
 *   2. team-win points (more is better)
 *   3. team name (A→Z) as a final stable tie-breaker
 *
 * This keeps the rank badge honest ("T-1, T-1") while listing the team with
 * the stronger underlying breakdown on top.
 */
export function sortStandingsRows(rows: PoolStandingsDayRow[]): PoolStandingsDayRow[] {
  return [...rows].sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      b.skaterPoints - a.skaterPoints ||
      b.teamWinPoints - a.teamWinPoints ||
      a.name.localeCompare(b.name),
  );
}

export function assignRanks(
  sortedRows: PoolStandingsDayRow[],
): Map<string, number> {
  const rankByTeam = new Map<string, number>();
  let rank = 0;
  let prevPoints: number | undefined;
  for (let i = 0; i < sortedRows.length; i++) {
    const row = sortedRows[i]!;
    if (prevPoints === undefined || row.totalPoints !== prevPoints) {
      rank = i + 1;
      prevPoints = row.totalPoints;
    }
    rankByTeam.set(row.teamId, rank);
  }
  return rankByTeam;
}

export function mergeRankMovement(
  current: PoolStandingsDayRow[],
  previous: PoolStandingsDayRow[] | null,
): RankedStanding[] {
  const sorted = sortStandingsRows(current);
  const rankNow = assignRanks(sorted);
  const rankBefore =
    previous == null ? null : assignRanks(sortStandingsRows(previous));

  return sorted.map((row) => {
    const r = rankNow.get(row.teamId) ?? 0;
    const prev = rankBefore?.get(row.teamId);
    const rankPrev = prev ?? null;
    const rankDelta =
      rankBefore == null || prev == null ? null : prev - r;
    return {
      ...row,
      rank: r,
      rankPrev,
      rankDelta,
    };
  });
}

/** True when every team has the same cumulative total in both snapshots (same roster order not required). */
export function sameCumulativeTotalsByTeam(
  a: PoolStandingsDayRow[],
  b: PoolStandingsDayRow[],
): boolean {
  if (a.length !== b.length) return false;
  const mb = new Map(b.map((r) => [r.teamId, r.totalPoints]));
  for (const r of a) {
    if (mb.get(r.teamId) !== r.totalPoints) return false;
  }
  return true;
}

/**
 * When `asOfDate` is pool “today” but nobody has scored yet, cumulative totals match
 * yesterday — so `mergeRankMovement(today, yesterday)` yields all-zero deltas. In that
 * case keep today’s ranks/points but show **yesterday’s** movement vs the day before.
 */
export function mergeRankMovementWithStaleDayFallback(
  currentRows: PoolStandingsDayRow[],
  prevRows: PoolStandingsDayRow[] | null,
  prevPrevRows: PoolStandingsDayRow[] | null,
  opts: { asOfDate: string; poolCalendarToday: string },
): RankedStanding[] {
  const standings = mergeRankMovement(currentRows, prevRows);
  const unchangedSincePrevDay =
    opts.asOfDate === opts.poolCalendarToday &&
    prevRows != null &&
    prevPrevRows != null &&
    sameCumulativeTotalsByTeam(currentRows, prevRows);

  if (!unchangedSincePrevDay) {
    return standings;
  }

  const priorDayMovement = mergeRankMovement(prevRows, prevPrevRows);
  const byTeam = new Map(priorDayMovement.map((r) => [r.teamId, r]));
  return standings.map((row) => {
    const y = byTeam.get(row.teamId);
    if (!y || y.rankDelta == null) return row;
    return { ...row, rankPrev: y.rankPrev, rankDelta: y.rankDelta };
  });
}
