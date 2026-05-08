import { describe, expect, it } from "vitest";
import {
  fingerprintVisibleScoreboardGames,
  getPoolNeonBackedRefreshIntervalMs,
  POOL_NEON_REFRESH_MS,
} from "@/lib/nhl/pool-neon-refresh-interval";
import type { ScoreboardGame } from "@/lib/nhl/schemas";

describe("getPoolNeonBackedRefreshIntervalMs", () => {
  it("returns false when there are no games", () => {
    expect(getPoolNeonBackedRefreshIntervalMs([])).toBe(false);
  });

  it("returns LIVE interval when any game is LIVE or CRIT", () => {
    expect(
      getPoolNeonBackedRefreshIntervalMs([
        { gameState: "OFF" },
        { gameState: "LIVE" },
      ]),
    ).toBe(POOL_NEON_REFRESH_MS.LIVE);
    expect(getPoolNeonBackedRefreshIntervalMs([{ gameState: "CRIT" }])).toBe(
      POOL_NEON_REFRESH_MS.LIVE,
    );
  });

  it("returns PREGAME when a FUT or PRE game exists and none are live", () => {
    expect(
      getPoolNeonBackedRefreshIntervalMs([
        { gameState: "OFF" },
        { gameState: "FUT" },
      ]),
    ).toBe(POOL_NEON_REFRESH_MS.PREGAME);
    expect(getPoolNeonBackedRefreshIntervalMs([{ gameState: "PRE" }])).toBe(
      POOL_NEON_REFRESH_MS.PREGAME,
    );
  });

  it("returns false when all games are final/off", () => {
    expect(
      getPoolNeonBackedRefreshIntervalMs([
        { gameState: "OFF" },
        { gameState: "OFF" },
      ]),
    ).toBe(false);
  });

  it("uses 15 minutes for live and pregame (Neon-backed pool APIs)", () => {
    expect(POOL_NEON_REFRESH_MS.LIVE).toBe(900_000);
    expect(POOL_NEON_REFRESH_MS.PREGAME).toBe(900_000);
  });
});

describe("fingerprintVisibleScoreboardGames", () => {
  it("returns empty string for no games", () => {
    expect(fingerprintVisibleScoreboardGames([])).toBe("");
  });

  it("changes when score or state changes", () => {
    const g = (scoreA: number, scoreH: number, state: string): ScoreboardGame =>
      ({
        id: 1,
        season: 20242025,
        gameType: 3,
        gameDate: "2026-04-20",
        gameState: state,
        awayTeam: { id: 1, abbrev: "TOR", score: scoreA },
        homeTeam: { id: 2, abbrev: "BOS", score: scoreH },
      }) as ScoreboardGame;

    const a = fingerprintVisibleScoreboardGames([g(0, 0, "LIVE")]);
    const b = fingerprintVisibleScoreboardGames([g(1, 0, "LIVE")]);
    const c = fingerprintVisibleScoreboardGames([g(0, 0, "OFF")]);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("is stable under reordering by game id", () => {
    const mk = (id: number): ScoreboardGame =>
      ({
        id,
        season: 1,
        gameType: 3,
        gameDate: "2026-04-20",
        gameState: "LIVE",
        awayTeam: { id: 1, abbrev: "A", score: 0 },
        homeTeam: { id: 2, abbrev: "B", score: 0 },
      }) as ScoreboardGame;
    expect(fingerprintVisibleScoreboardGames([mk(2), mk(1)])).toBe(
      fingerprintVisibleScoreboardGames([mk(1), mk(2)]),
    );
  });
});
