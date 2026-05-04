import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ScoreboardResponse } from "@/lib/nhl/schemas";
import * as upstream from "@/lib/nhl/upstream";
import { fetchPlayoffScoreboardWithCalendarFallback } from "@/lib/nhl/playoff-scoreboard-fallback";

vi.mock("@/lib/pool/pool-season", () => ({
  getPoolPlayoffStartDate: () => "2026-04-01",
}));

function dayGames(
  date: string,
  gameType: number,
): ScoreboardResponse {
  return {
    gamesByDate: [
      {
        date,
        games: [
          {
            id: 1,
            season: 20252026,
            gameType,
            gameDate: date,
            gameState: "OFF",
            startTimeUTC: `${date}T23:00:00Z`,
            awayTeam: {
              id: 1,
              abbrev: "AWY",
              score: 1,
              commonName: { default: "Away" },
            },
            homeTeam: {
              id: 2,
              abbrev: "HOM",
              score: 2,
              commonName: { default: "Home" },
            },
          },
        ],
      },
    ],
  };
}

describe("fetchPlayoffScoreboardWithCalendarFallback", () => {
  beforeEach(() => {
    vi.spyOn(upstream, "fetchNhlScoreboard").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses requested day when it has playoff games", async () => {
    vi.spyOn(upstream, "fetchNhlScoreboard").mockResolvedValue(
      dayGames("2026-04-18", 3),
    );
    const r = await fetchPlayoffScoreboardWithCalendarFallback("2026-04-18");
    expect(r.effectiveDate).toBe("2026-04-18");
    expect(r.fellBack).toBe(false);
    expect(upstream.fetchNhlScoreboard).toHaveBeenCalledTimes(1);
  });

  it("walks back to the previous day with playoff games", async () => {
    vi.spyOn(upstream, "fetchNhlScoreboard").mockImplementation(async (d) => {
      if (d === "2026-04-19") return dayGames("2026-04-19", 2);
      if (d === "2026-04-18") return dayGames("2026-04-18", 3);
      return { gamesByDate: [] };
    });
    const r = await fetchPlayoffScoreboardWithCalendarFallback("2026-04-19");
    expect(r.effectiveDate).toBe("2026-04-18");
    expect(r.fellBack).toBe(true);
  });
});
