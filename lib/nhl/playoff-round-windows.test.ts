import { describe, expect, it } from "vitest";
import {
  composePlayoffRoundWindows,
  eachDateInclusive,
} from "@/lib/nhl/playoff-round-windows";
import type {
  PlayoffBracketResponse,
  ScoreboardGame,
  ScoreboardResponse,
} from "@/lib/nhl/schemas";

function game(args: {
  id: number;
  date: string;
  round: number;
  away?: string;
  home?: string;
  state?: string;
}): ScoreboardGame {
  return {
    id: args.id,
    season: 20252026,
    gameType: 3,
    gameDate: args.date,
    gameState: args.state ?? "FINAL",
    startTimeUTC: `${args.date}T23:00:00Z`,
    awayTeam: { id: 1, abbrev: args.away ?? "AAA", score: 2 },
    homeTeam: { id: 2, abbrev: args.home ?? "BBB", score: 3 },
    seriesStatus: {
      round: args.round,
      seriesAbbrev: `R${args.round}`,
      game: 1,
      topSeedTeamAbbrev: args.home ?? "BBB",
      topSeedWins: 0,
      bottomSeedTeamAbbrev: args.away ?? "AAA",
      bottomSeedWins: 0,
    },
  };
}

function scoreboard(
  daysWithGames: ReadonlyArray<{ date: string; games: ScoreboardGame[] }>,
): ScoreboardResponse {
  return {
    gamesByDate: daysWithGames.map((d) => ({ date: d.date, games: d.games })),
  };
}

function bracket(
  series: ReadonlyArray<{
    round: number;
    topWins: number;
    bottomWins: number;
  }>,
): PlayoffBracketResponse {
  return {
    series: series.map((s, i) => ({
      seriesAbbrev: `R${s.round}-${i}`,
      playoffRound: s.round,
      topSeedWins: s.topWins,
      bottomSeedWins: s.bottomWins,
      topSeedTeam: { id: i * 2 + 1, abbrev: `T${i * 2 + 1}` },
      bottomSeedTeam: { id: i * 2 + 2, abbrev: `T${i * 2 + 2}` },
    })),
  };
}

describe("eachDateInclusive", () => {
  it("returns all calendar days from start to end inclusive", () => {
    expect(eachDateInclusive("2026-04-18", "2026-04-21")).toEqual([
      "2026-04-18",
      "2026-04-19",
      "2026-04-20",
      "2026-04-21",
    ]);
  });

  it("returns empty when end < start", () => {
    expect(eachDateInclusive("2026-04-21", "2026-04-18")).toEqual([]);
  });

  it("returns single day for start == end", () => {
    expect(eachDateInclusive("2026-04-18", "2026-04-18")).toEqual(["2026-04-18"]);
  });
});

describe("composePlayoffRoundWindows", () => {
  it("maps each date to the dominant round (most games that day)", () => {
    const sb = scoreboard([
      {
        date: "2026-04-18",
        games: [
          game({ id: 1, date: "2026-04-18", round: 1 }),
          game({ id: 2, date: "2026-04-18", round: 1 }),
          game({ id: 3, date: "2026-04-18", round: 1 }),
        ],
      },
      {
        date: "2026-05-04",
        games: [
          game({ id: 4, date: "2026-05-04", round: 1 }),
          game({ id: 5, date: "2026-05-04", round: 2 }),
          game({ id: 6, date: "2026-05-04", round: 2 }),
        ],
      },
    ]);
    const out = composePlayoffRoundWindows({ scoreboards: [sb], bracket: null });
    expect(out.dateToDominantRound.get("2026-04-18")).toBe(1);
    expect(out.dateToDominantRound.get("2026-05-04")).toBe(2);
  });

  it("breaks ties by lower round number (earlier round wins ties)", () => {
    const sb = scoreboard([
      {
        date: "2026-05-01",
        games: [
          game({ id: 1, date: "2026-05-01", round: 1 }),
          game({ id: 2, date: "2026-05-01", round: 2 }),
        ],
      },
    ]);
    const out = composePlayoffRoundWindows({ scoreboards: [sb], bracket: null });
    expect(out.dateToDominantRound.get("2026-05-01")).toBe(1);
  });

  it("ignores non-playoff games (gameType !== 3) and games without seriesStatus", () => {
    const noSeries = game({ id: 99, date: "2026-04-19", round: 1 });
    delete (noSeries as { seriesStatus?: unknown }).seriesStatus;
    const regSeason = { ...game({ id: 100, date: "2026-04-19", round: 1 }), gameType: 2 };
    const sb = scoreboard([
      { date: "2026-04-19", games: [noSeries, regSeason] },
    ]);
    const out = composePlayoffRoundWindows({ scoreboards: [sb], bracket: null });
    expect(out.dateToDominantRound.has("2026-04-19")).toBe(false);
  });

  it("computes per-round date windows from scoreboard data", () => {
    const sb = scoreboard([
      { date: "2026-04-18", games: [game({ id: 1, date: "2026-04-18", round: 1 })] },
      { date: "2026-04-25", games: [game({ id: 2, date: "2026-04-25", round: 1 })] },
      { date: "2026-05-04", games: [game({ id: 3, date: "2026-05-04", round: 2 })] },
    ]);
    const out = composePlayoffRoundWindows({ scoreboards: [sb], bracket: null });
    expect(out.roundsByNumber.get(1)).toMatchObject({
      round: 1,
      startDate: "2026-04-18",
      endDate: "2026-04-25",
      dates: ["2026-04-18", "2026-04-25"],
    });
    expect(out.roundsByNumber.get(2)).toMatchObject({
      round: 2,
      startDate: "2026-05-04",
      endDate: "2026-05-04",
    });
  });

  it("status is 'upcoming' when a round has no games", () => {
    const out = composePlayoffRoundWindows({
      scoreboards: [scoreboard([])],
      bracket: null,
    });
    expect(out.roundsByNumber.get(1)?.status).toBe("upcoming");
    expect(out.roundsByNumber.get(2)?.status).toBe("upcoming");
    expect(out.roundsByNumber.get(3)?.status).toBe("upcoming");
    expect(out.roundsByNumber.get(4)?.status).toBe("upcoming");
  });

  it("status is 'active' when round has games but bracket isn't fully decided", () => {
    const sb = scoreboard([
      { date: "2026-04-18", games: [game({ id: 1, date: "2026-04-18", round: 1 })] },
    ]);
    /** All 8 round-1 series in flight, none decided yet. */
    const br = bracket(Array.from({ length: 8 }, () => ({ round: 1, topWins: 1, bottomWins: 0 })));
    const out = composePlayoffRoundWindows({ scoreboards: [sb], bracket: br });
    expect(out.roundsByNumber.get(1)?.status).toBe("active");
  });

  it("status is 'complete' when all expected series for the round are decided", () => {
    const sb = scoreboard([
      { date: "2026-04-18", games: [game({ id: 1, date: "2026-04-18", round: 1 })] },
    ]);
    const br = bracket(
      Array.from({ length: 8 }, () => ({ round: 1, topWins: 4, bottomWins: 2 })),
    );
    const out = composePlayoffRoundWindows({ scoreboards: [sb], bracket: br });
    expect(out.roundsByNumber.get(1)?.status).toBe("complete");
  });

  it("respects windowStart / windowEnd to clamp dates outside the query range", () => {
    const sb = scoreboard([
      { date: "2026-04-15", games: [game({ id: 1, date: "2026-04-15", round: 1 })] },
      { date: "2026-04-19", games: [game({ id: 2, date: "2026-04-19", round: 1 })] },
      { date: "2026-04-22", games: [game({ id: 3, date: "2026-04-22", round: 1 })] },
    ]);
    const out = composePlayoffRoundWindows({
      scoreboards: [sb],
      bracket: null,
      windowStart: "2026-04-18",
      windowEnd: "2026-04-20",
    });
    expect(out.dateToDominantRound.has("2026-04-15")).toBe(false);
    expect(out.dateToDominantRound.has("2026-04-19")).toBe(true);
    expect(out.dateToDominantRound.has("2026-04-22")).toBe(false);
  });
});
