import { describe, expect, it } from "vitest";
import type { BoxscoreResponse } from "@/lib/nhl/schemas";
import type { ScoreboardGame } from "@/lib/nhl/schemas";
import {
  boxscoreHasPostedSkaterLines,
  filterSkatersSlateTeamsOffNights,
  findPlayoffGameForTeamAbbrev,
  resolveSkaterLineupStatus,
  skaterIdInBoxscore,
  type SkaterSlateGameSnapshot,
} from "@/lib/pool/skater-slate";

function mockGame(
  away: string,
  home: string,
  id: number,
): ScoreboardGame {
  return {
    id,
    season: 20252026,
    gameType: 3,
    gameDate: "2026-04-18",
    gameState: "FUT",
    startTimeUTC: "2026-04-18T23:00:00Z",
    awayTeam: { id: 1, abbrev: away, score: 0 },
    homeTeam: { id: 2, abbrev: home, score: 0 },
  } as ScoreboardGame;
}

function mockBox(
  awayIds: number[],
  homeIds: number[],
): BoxscoreResponse {
  const sk = (ids: number[]) =>
    ids.map((playerId) => ({
      playerId,
      name: { default: "X" },
      position: "C",
      goals: 0,
      assists: 0,
    }));
  return {
    id: 1,
    season: 20252026,
    gameType: 3,
    gameDate: "2026-04-18",
    gameState: "OFF",
    startTimeUTC: "2026-04-18T23:00:00Z",
    awayTeam: { id: 1, abbrev: "OTT" },
    homeTeam: { id: 2, abbrev: "CAR" },
    playerByGameStats: {
      awayTeam: { forwards: sk(awayIds), defense: [], goalies: [] },
      homeTeam: { forwards: sk(homeIds), defense: [], goalies: [] },
    },
  } as BoxscoreResponse;
}

describe("findPlayoffGameForTeamAbbrev", () => {
  it("finds game when team is away", () => {
    const games = [mockGame("OTT", "CAR", 101)];
    expect(findPlayoffGameForTeamAbbrev(games, "ott")?.id).toBe(101);
  });

  it("finds game when team is home", () => {
    const games = [mockGame("OTT", "CAR", 102)];
    expect(findPlayoffGameForTeamAbbrev(games, "CAR")?.id).toBe(102);
  });

  it("returns undefined when abbrev missing", () => {
    expect(findPlayoffGameForTeamAbbrev([], "TBL")).toBeUndefined();
  });
});

describe("skaterIdInBoxscore", () => {
  it("detects skater in forwards", () => {
    const bx = mockBox([8478402], []);
    expect(skaterIdInBoxscore(bx, 8478402)).toBe(true);
    expect(skaterIdInBoxscore(bx, 999)).toBe(false);
  });
});

describe("filterSkatersSlateTeamsOffNights", () => {
  it("removes skaters with no game and drops teams with nothing left", () => {
    const teams = filterSkatersSlateTeamsOffNights([
      {
        poolTeamId: "a",
        poolTeamName: "A",
        ownerName: "OA",
        skaters: [
          {
            round: 1,
            label: "On slate",
            nhlPlayerId: 1,
            game: {
              gameId: 1,
              gameState: "PRE",
              gameDate: "",
              startTimeUTC: "",
              awayAbbrev: "OTT",
              homeAbbrev: "CAR",
            } as SkaterSlateGameSnapshot,
            lineupStatus: "unknown",
          },
          {
            round: 2,
            label: "Off",
            nhlPlayerId: 2,
            game: null,
            lineupStatus: "unknown",
          },
        ],
        teamPicks: [{ round: 11, label: "T", teamAbbrev: "TBL", game: null }],
      },
    ]);
    expect(teams).toHaveLength(1);
    expect(teams[0]!.skaters).toHaveLength(1);
    expect(teams[0]!.teamPicks).toHaveLength(0);
  });

  it("keeps eliminated picks even when they are off-night", () => {
    const teams = filterSkatersSlateTeamsOffNights([
      {
        poolTeamId: "a",
        poolTeamName: "A",
        ownerName: "OA",
        skaters: [
          {
            round: 1,
            label: "Eliminated skater",
            nhlPlayerId: 1,
            game: null,
            lineupStatus: "unknown",
            lifecycleStatus: "eliminated",
          },
        ],
        teamPicks: [
          {
            round: 11,
            label: "Eliminated team",
            teamAbbrev: "LAK",
            game: null,
            lifecycleStatus: "eliminated",
          },
        ],
      },
    ]);
    expect(teams).toHaveLength(1);
    expect(teams[0]!.skaters).toHaveLength(1);
    expect(teams[0]!.teamPicks).toHaveLength(1);
  });
});

describe("resolveSkaterLineupStatus", () => {
  it("unknown when no boxscore", () => {
    expect(resolveSkaterLineupStatus(undefined, 1)).toBe("unknown");
  });

  it("unknown when no skater lines posted", () => {
    const empty = mockBox([], []);
    expect(boxscoreHasPostedSkaterLines(empty)).toBe(false);
    expect(resolveSkaterLineupStatus(empty, 1)).toBe("unknown");
  });

  it("dressed vs not_dressed when lines exist", () => {
    const bx = mockBox([1, 2], [3]);
    expect(resolveSkaterLineupStatus(bx, 2)).toBe("dressed");
    expect(resolveSkaterLineupStatus(bx, 99)).toBe("not_dressed");
  });
});
