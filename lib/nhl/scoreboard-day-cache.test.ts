import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  computeDatesNeedingFetch,
  getScoreboardCacheTailDays,
  tailDatesToRefresh,
} from "@/lib/nhl/scoreboard-day-cache";
import { playoffSeasonFromDate } from "@/lib/nhl/playoff-status";

function key(d: string): string {
  return `${playoffSeasonFromDate(d)}:${d}`;
}

describe("tailDatesToRefresh", () => {
  const dates = ["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04"];

  it("returns the last N dates when tailDays < length", () => {
    expect([...tailDatesToRefresh(dates, 2)].sort()).toEqual([
      "2026-05-03",
      "2026-05-04",
    ]);
  });

  it("caps at full length when tailDays exceeds window", () => {
    expect(tailDatesToRefresh(dates, 99).size).toBe(4);
  });

  it("returns empty when tailDays is 0", () => {
    expect(tailDatesToRefresh(dates, 0).size).toBe(0);
  });
});

describe("computeDatesNeedingFetch", () => {
  const dates = ["2026-05-01", "2026-05-02", "2026-05-03"];

  it("requests all dates when cache is empty and tail is 0", () => {
    expect(
      computeDatesNeedingFetch({
        datesAscending: dates,
        cachedValidByKey: new Map(),
        tailDays: 0,
      }),
    ).toEqual(dates);
  });

  it("requests nothing when every date is cached and tail is 0", () => {
    const cached = new Map([
      [key("2026-05-01"), {} as never],
      [key("2026-05-02"), {} as never],
      [key("2026-05-03"), {} as never],
    ]);
    expect(
      computeDatesNeedingFetch({
        datesAscending: dates,
        cachedValidByKey: cached,
        tailDays: 0,
      }),
    ).toEqual([]);
  });

  it("always includes tail dates even when cached", () => {
    const cached = new Map([
      [key("2026-05-01"), {} as never],
      [key("2026-05-02"), {} as never],
      [key("2026-05-03"), {} as never],
    ]);
    expect(
      computeDatesNeedingFetch({
        datesAscending: dates,
        cachedValidByKey: cached,
        tailDays: 2,
      }),
    ).toEqual(["2026-05-02", "2026-05-03"]);
  });

  it("requests missing middle dates when tail is 0", () => {
    const cached = new Map([[key("2026-05-02"), {} as never]]);
    expect(
      computeDatesNeedingFetch({
        datesAscending: dates,
        cachedValidByKey: cached,
        tailDays: 0,
      }),
    ).toEqual(["2026-05-01", "2026-05-03"]);
  });
});

describe("getScoreboardCacheTailDays", () => {
  beforeEach(() => {
    vi.stubEnv("POOL_SCOREBOARD_CACHE_TAIL_DAYS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to 2 when unset", () => {
    delete process.env.POOL_SCOREBOARD_CACHE_TAIL_DAYS;
    expect(getScoreboardCacheTailDays()).toBe(2);
  });

  it("honors POOL_SCOREBOARD_CACHE_TAIL_DAYS", () => {
    vi.stubEnv("POOL_SCOREBOARD_CACHE_TAIL_DAYS", "5");
    expect(getScoreboardCacheTailDays()).toBe(5);
  });
});
