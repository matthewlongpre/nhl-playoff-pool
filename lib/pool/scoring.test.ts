import { describe, expect, it } from "vitest";
import type { BoxscoreResponse } from "@/lib/nhl/schemas";
import type { ScoreboardGame } from "@/lib/nhl/schemas";
import {
  aggregateSkaterGoalsAssists,
  countWinsByTeamAbbrev,
  isFinalScoreboardGame,
  isPlayoffGame,
  scorePoolTeamForDay,
  totalFantasyPoints,
} from "@/lib/pool/scoring";
import type { PoolTeam } from "@/lib/pool/roster-schema";

function game(
  overrides: Partial<ScoreboardGame> & {
    id: number;
    awayAbbrev: string;
    homeAbbrev: string;
    awayScore: number;
    homeScore: number;
  },
): ScoreboardGame {
  const {
    id,
    awayAbbrev,
    homeAbbrev,
    awayScore,
    homeScore,
    ...rest
  } = overrides;
  return {
    id,
    season: 20252026,
    gameType: 3,
    gameDate: "2026-04-18",
    gameState: "OFF",
    startTimeUTC: "2026-04-18T19:00:00Z",
    awayTeam: {
      id: 1,
      abbrev: awayAbbrev,
      score: awayScore,
    },
    homeTeam: {
      id: 2,
      abbrev: homeAbbrev,
      score: homeScore,
    },
    ...rest,
  } as ScoreboardGame;
}

describe("countWinsByTeamAbbrev", () => {
  it("counts a single home win", () => {
    const wins = countWinsByTeamAbbrev([
      game({
        id: 1,
        awayAbbrev: "OTT",
        homeAbbrev: "CAR",
        awayScore: 0,
        homeScore: 2,
      }),
    ]);
    expect(wins.get("CAR")).toBe(1);
    expect(wins.get("OTT")).toBeUndefined();
  });

  it("ignores non-playoff games", () => {
    const g = game({
      id: 1,
      awayAbbrev: "OTT",
      homeAbbrev: "CAR",
      awayScore: 0,
      homeScore: 2,
    });
    (g as { gameType: number }).gameType = 2;
    const wins = countWinsByTeamAbbrev([g]);
    expect(wins.size).toBe(0);
  });

  it("ignores games that are not final", () => {
    const g = game({
      id: 1,
      awayAbbrev: "OTT",
      homeAbbrev: "CAR",
      awayScore: 0,
      homeScore: 2,
    });
    g.gameState = "LIVE";
    const wins = countWinsByTeamAbbrev([g]);
    expect(wins.size).toBe(0);
  });
});

describe("aggregateSkaterGoalsAssists", () => {
  it("sums goals and assists across skaters", () => {
    const bx = {
      playerByGameStats: {
        awayTeam: {
          forwards: [
            {
              playerId: 100,
              name: { default: "A" },
              position: "C",
              goals: 1,
              assists: 1,
            },
          ],
          defense: [],
          goalies: [],
        },
        homeTeam: {
          forwards: [],
          defense: [
            {
              playerId: 200,
              name: { default: "B" },
              position: "D",
              goals: 0,
              assists: 2,
            },
          ],
          goalies: [],
        },
      },
    } as unknown as BoxscoreResponse;

    const map = aggregateSkaterGoalsAssists([bx]);
    expect(map.get(100)).toEqual({ goals: 1, assists: 1 });
    expect(map.get(200)).toEqual({ goals: 0, assists: 2 });
  });
});

describe("scorePoolTeamForDay", () => {
  const team: PoolTeam = {
    id: "t1",
    name: "Test",
    ownerName: "Test Owner",
    picks: [
      {
        round: 1,
        kind: "skater",
        label: "Player",
        nhlPlayerId: 100,
      },
      {
        round: 2,
        kind: "team",
        label: "CAR",
        teamAbbrev: "CAR",
      },
    ],
  };

  it("scores skaters and team wins", () => {
    const skaterStats = new Map([
      [100, { goals: 1, assists: 2 }],
    ]);
    const wins = new Map([["CAR", 1]]);
    const b = scorePoolTeamForDay(team, skaterStats, wins);
    expect(b.skaterPoints).toBe(3);
    expect(b.teamWinPoints).toBe(1);
    expect(totalFantasyPoints(b)).toBe(4);
  });

  it("treats missing skater id as zero", () => {
    const t2: PoolTeam = {
      ...team,
      picks: [{ round: 1, kind: "skater", label: "X", nhlPlayerId: null }],
    };
    const b = scorePoolTeamForDay(t2, new Map(), new Map());
    expect(b.skaterPoints).toBe(0);
  });
});

describe("isPlayoffGame / isFinalScoreboardGame", () => {
  it("detects playoff games", () => {
    const g = game({
      id: 1,
      awayAbbrev: "A",
      homeAbbrev: "B",
      awayScore: 1,
      homeScore: 0,
    });
    expect(isPlayoffGame(g)).toBe(true);
    expect(isFinalScoreboardGame(g)).toBe(true);
  });
});
