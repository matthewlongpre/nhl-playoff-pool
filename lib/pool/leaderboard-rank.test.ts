import { describe, expect, it } from "vitest";
import {
  assignRanks,
  mergeRankMovement,
  mergeRankMovementWithStaleDayFallback,
  sameCumulativeTotalsByTeam,
  sortStandingsRows,
} from "@/lib/pool/leaderboard-rank";
import { applySimulatedRankMovement } from "@/lib/pool/simulate-rank-movement";
import type { PoolStandingsDayRow } from "@/lib/pool/compute-standings-for-date";

function row(
  teamId: string,
  name: string,
  total: number,
  sk = 0,
  tw = 0,
): PoolStandingsDayRow {
  return {
    teamId,
    name,
    ownerName: "O",
    totalPoints: total,
    skaterPoints: sk,
    teamWinPoints: tw,
  };
}

describe("assignRanks", () => {
  it("uses competition ranking for ties", () => {
    const sorted = sortStandingsRows([
      row("a", "A", 10),
      row("b", "B", 10),
      row("c", "C", 5),
    ]);
    const r = assignRanks(sorted);
    expect(r.get("a")).toBe(1);
    expect(r.get("b")).toBe(1);
    expect(r.get("c")).toBe(3);
  });
});

describe("sortStandingsRows tiebreakers", () => {
  it("breaks total-point ties by skater points (desc)", () => {
    const sorted = sortStandingsRows([
      row("a", "A", 10, 4, 6),
      row("b", "B", 10, 8, 2),
    ]);
    expect(sorted.map((r) => r.teamId)).toEqual(["b", "a"]);
  });

  it("falls through to team-win points when skater points are also tied", () => {
    const sorted = sortStandingsRows([
      row("a", "A", 10, 6, 4),
      row("b", "B", 10, 6, 6),
    ]);
    expect(sorted.map((r) => r.teamId)).toEqual(["b", "a"]);
  });

  it("falls through to team name when every points component is tied", () => {
    const sorted = sortStandingsRows([
      row("h", "Hughsey", 79, 50, 29),
      row("c", "Cdn4Life", 79, 50, 29),
    ]);
    expect(sorted.map((r) => r.teamId)).toEqual(["c", "h"]);
  });

  it("keeps ranks tied even when display order is broken by skater points", () => {
    const sorted = sortStandingsRows([
      row("a", "A", 10, 4, 6),
      row("b", "B", 10, 8, 2),
      row("c", "C", 5),
    ]);
    const r = assignRanks(sorted);
    expect(sorted.map((x) => x.teamId)).toEqual(["b", "a", "c"]);
    expect(r.get("a")).toBe(1);
    expect(r.get("b")).toBe(1);
    expect(r.get("c")).toBe(3);
  });
});

describe("mergeRankMovement", () => {
  it("computes positive delta when rank improves", () => {
    const prev = [row("a", "A", 5), row("b", "B", 3)];
    const cur = [row("b", "B", 8), row("a", "A", 5)];
    const out = mergeRankMovement(cur, prev);
    const b = out.find((x) => x.teamId === "b");
    expect(b?.rank).toBe(1);
    expect(b?.rankPrev).toBe(2);
    expect(b?.rankDelta).toBe(1);
  });

  it("uses null delta when no previous snapshot", () => {
    const out = mergeRankMovement([row("a", "A", 1)], null);
    expect(out[0]?.rankDelta).toBeNull();
    expect(out[0]?.rankPrev).toBeNull();
  });
});

describe("mergeRankMovementWithStaleDayFallback", () => {
  const today = "2026-04-22";
  const yesterday = "2026-04-21";

  it("when today matches yesterday totals, shows prior day movement vs day before", () => {
    const dayBefore = [row("a", "A", 5), row("b", "B", 3)];
    const yEnd = [row("b", "B", 8), row("a", "A", 5)];
    const tMorning = yEnd;
    const out = mergeRankMovementWithStaleDayFallback(tMorning, yEnd, dayBefore, {
      asOfDate: today,
      poolCalendarToday: today,
    });
    const b = out.find((x) => x.teamId === "b");
    expect(b?.rank).toBe(1);
    expect(b?.rankPrev).toBe(2);
    expect(b?.rankDelta).toBe(1);
  });

  it("when totals changed since yesterday, uses normal today-vs-yesterday delta", () => {
    const dayBefore = [row("a", "A", 5), row("b", "B", 3)];
    const yEnd = [row("b", "B", 8), row("a", "A", 5)];
    const tNow = [row("b", "B", 10), row("a", "A", 5)];
    const out = mergeRankMovementWithStaleDayFallback(tNow, yEnd, dayBefore, {
      asOfDate: today,
      poolCalendarToday: today,
    });
    const b = out.find((x) => x.teamId === "b");
    expect(b?.rank).toBe(1);
    expect(b?.rankPrev).toBe(1);
    expect(b?.rankDelta).toBe(0);
  });

  it("does not apply stale path when viewing a past date", () => {
    const dayBefore = [row("a", "A", 5), row("b", "B", 3)];
    const yEnd = [row("b", "B", 8), row("a", "A", 5)];
    const out = mergeRankMovementWithStaleDayFallback(yEnd, dayBefore, null, {
      asOfDate: yesterday,
      poolCalendarToday: today,
    });
    const b = out.find((x) => x.teamId === "b");
    expect(b?.rank).toBe(1);
    expect(b?.rankPrev).toBe(2);
    expect(b?.rankDelta).toBe(1);
  });
});

describe("sameCumulativeTotalsByTeam", () => {
  it("detects identical totals per team", () => {
    const a = [row("a", "A", 5), row("b", "B", 3)];
    const b = [row("b", "B", 3), row("a", "A", 5)];
    expect(sameCumulativeTotalsByTeam(a, b)).toBe(true);
  });

  it("detects differing totals", () => {
    const a = [row("a", "A", 5), row("b", "B", 3)];
    const b = [row("a", "A", 6), row("b", "B", 3)];
    expect(sameCumulativeTotalsByTeam(a, b)).toBe(false);
  });
});

describe("applySimulatedRankMovement", () => {
  it("assigns non-zero deltas when several teams exist", () => {
    const base = mergeRankMovement(
      [row("a", "A", 10), row("b", "B", 8), row("c", "C", 6)],
      null,
    );
    const sim = applySimulatedRankMovement(base);
    expect(sim.every((s) => s.rankDelta != null && s.rankDelta !== 0)).toBe(true);
  });
});
