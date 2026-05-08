import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  poolCalendarExpectedLatestIngestAsOf,
  poolCalendarToday,
} from "@/lib/pool/pool-season";

describe("poolCalendarToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses America/Los_Angeles calendar date (not raw UTC)", () => {
    // 2026-04-20 06:59:59.999Z = still 2026-04-19 evening in Pacific
    vi.setSystemTime(new Date("2026-04-20T06:59:59.999Z"));
    expect(poolCalendarToday()).toBe("2026-04-19");
  });

  it("rolls to next pool day after Pacific midnight", () => {
    vi.setSystemTime(new Date("2026-04-20T07:00:00.000Z"));
    expect(poolCalendarToday()).toBe("2026-04-20");
  });
});

describe("poolCalendarExpectedLatestIngestAsOf", () => {
  it("is pool calendar yesterday", () => {
    expect(poolCalendarExpectedLatestIngestAsOf("2026-05-05")).toBe("2026-05-04");
  });
});
