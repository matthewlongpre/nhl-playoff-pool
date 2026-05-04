import { describe, expect, it } from "vitest";
import {
  ingestDayPresentInFetched,
  rowDateMatchesCumulativeDbWindow,
  sumTeamPointsFromDailyRows,
  type LeaderboardFetchedDailyRow,
} from "@/lib/pool/leaderboard-cumulative";

describe("ingestDayPresentInFetched", () => {
  it("is false when no rows for that day", () => {
    const rows: LeaderboardFetchedDailyRow[] = [
      { teamId: "a", date: "2026-04-10", sk: 1, tw: 0 },
    ];
    expect(ingestDayPresentInFetched(rows, "2026-04-11")).toBe(false);
  });

  it("is true when any row exists for that day", () => {
    const rows: LeaderboardFetchedDailyRow[] = [
      { teamId: "a", date: "2026-04-10", sk: 1, tw: 0 },
      { teamId: "b", date: "2026-04-10", sk: 0, tw: 1 },
    ];
    expect(ingestDayPresentInFetched(rows, "2026-04-10")).toBe(true);
  });
});

describe("rowDateMatchesCumulativeDbWindow", () => {
  const start = "2026-04-15";
  const poolToday = "2026-04-20";

  it("excludes poolToday when cutoff is poolToday (merge-live path)", () => {
    expect(
      rowDateMatchesCumulativeDbWindow("2026-04-19", start, poolToday, poolToday),
    ).toBe(true);
    expect(
      rowDateMatchesCumulativeDbWindow("2026-04-20", start, poolToday, poolToday),
    ).toBe(false);
    expect(
      rowDateMatchesCumulativeDbWindow("2026-04-14", start, poolToday, poolToday),
    ).toBe(false);
  });

  it("includes cutoff day when cutoff is before poolToday", () => {
    const cutoff = "2026-04-18";
    expect(
      rowDateMatchesCumulativeDbWindow("2026-04-18", start, cutoff, poolToday),
    ).toBe(true);
    expect(
      rowDateMatchesCumulativeDbWindow("2026-04-19", start, cutoff, poolToday),
    ).toBe(false);
  });
});

describe("sumTeamPointsFromDailyRows", () => {
  const teamIds = ["a", "b"];
  const start = "2026-04-15";
  const poolToday = "2026-04-20";
  const rows: LeaderboardFetchedDailyRow[] = [
    { teamId: "a", date: "2026-04-18", sk: 2, tw: 1 },
    { teamId: "a", date: "2026-04-19", sk: 1, tw: 0 },
    { teamId: "b", date: "2026-04-19", sk: 0, tw: 2 },
    /** Same calendar day as poolToday — must not count toward merge-today DB slice */
    { teamId: "a", date: "2026-04-20", sk: 99, tw: 0 },
  ];

  it("sums through yesterday when cutoff is poolToday", () => {
    const m = sumTeamPointsFromDailyRows(
      rows,
      teamIds,
      start,
      poolToday,
      poolToday,
    );
    expect(m.get("a")).toEqual({ sk: 3, tw: 1 });
    expect(m.get("b")).toEqual({ sk: 0, tw: 2 });
  });

  it("sums inclusively through historical cutoff", () => {
    const m = sumTeamPointsFromDailyRows(
      rows,
      teamIds,
      start,
      "2026-04-19",
      poolToday,
    );
    expect(m.get("a")).toEqual({ sk: 3, tw: 1 });
    expect(m.get("b")).toEqual({ sk: 0, tw: 2 });
  });
});
