import { describe, expect, it } from "vitest";
import {
  getNhlScoreboardRefreshIntervalMs,
  getNhlScoreboardRefreshIntervalMsCapped,
  NHL_REFRESH_MS,
} from "@/lib/nhl/adaptive-interval";

describe("getNhlScoreboardRefreshIntervalMs", () => {
  it("returns IDLE when there are no games", () => {
    expect(getNhlScoreboardRefreshIntervalMs([])).toBe(NHL_REFRESH_MS.IDLE);
  });

  it("returns LIVE interval when any game is LIVE", () => {
    expect(
      getNhlScoreboardRefreshIntervalMs([
        { gameState: "OFF" },
        { gameState: "LIVE" },
      ]),
    ).toBe(NHL_REFRESH_MS.LIVE);
  });

  it("returns LIVE interval for CRIT", () => {
    expect(getNhlScoreboardRefreshIntervalMs([{ gameState: "CRIT" }])).toBe(
      NHL_REFRESH_MS.LIVE,
    );
  });

  it("returns PREGAME interval when no live games but a future game exists", () => {
    expect(
      getNhlScoreboardRefreshIntervalMs([
        { gameState: "OFF" },
        { gameState: "FUT" },
      ]),
    ).toBe(NHL_REFRESH_MS.PREGAME);
  });

  it("returns PREGAME for PRE", () => {
    expect(getNhlScoreboardRefreshIntervalMs([{ gameState: "PRE" }])).toBe(
      NHL_REFRESH_MS.PREGAME,
    );
  });

  it("returns IDLE when all games are final/off", () => {
    expect(
      getNhlScoreboardRefreshIntervalMs([
        { gameState: "OFF" },
        { gameState: "OFF" },
      ]),
    ).toBe(NHL_REFRESH_MS.IDLE);
  });
});

describe("getNhlScoreboardRefreshIntervalMsCapped", () => {
  it("returns false for idle slates so nothing polls overnight", () => {
    expect(getNhlScoreboardRefreshIntervalMsCapped([])).toBe(false);
    expect(
      getNhlScoreboardRefreshIntervalMsCapped([
        { gameState: "OFF" },
        { gameState: "OFF" },
      ]),
    ).toBe(false);
  });

  it("returns LIVE and PREGAME intervals unchanged", () => {
    expect(
      getNhlScoreboardRefreshIntervalMsCapped([{ gameState: "LIVE" }]),
    ).toBe(NHL_REFRESH_MS.LIVE);
    expect(
      getNhlScoreboardRefreshIntervalMsCapped([{ gameState: "FUT" }]),
    ).toBe(NHL_REFRESH_MS.PREGAME);
  });
});
