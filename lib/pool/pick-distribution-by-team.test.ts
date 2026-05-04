import { describe, expect, it } from "vitest";
import {
  aggregateNhlTeamPickCountsAcrossPool,
  pickCountsByNhlTeamForPoolTeam,
} from "@/lib/pool/pick-distribution-by-team";
import type { PoolTeam } from "@/lib/pool/roster-schema";

describe("pickCountsByNhlTeamForPoolTeam", () => {
  it("merges skater and team picks for the same NHL abbrev", () => {
    const team: PoolTeam = {
      id: "x",
      name: "X",
      ownerName: "O",
      picks: [
        { round: 1, kind: "skater", label: "A", nhlTeamAbbrev: "TBL", nhlPlayerId: 1 },
        { round: 2, kind: "skater", label: "B", nhlTeamAbbrev: "TBL", nhlPlayerId: 2 },
        { round: 3, kind: "team", label: "TB", teamAbbrev: "TBL" },
        { round: 4, kind: "skater", label: "C", nhlTeamAbbrev: "CAR", nhlPlayerId: 3 },
      ],
    };
    expect(pickCountsByNhlTeamForPoolTeam(team)).toEqual([
      { abbrev: "TBL", count: 3 },
      { abbrev: "CAR", count: 1 },
    ]);
  });

  it("skips skaters with no NHL team abbrev", () => {
    const team: PoolTeam = {
      id: "x",
      name: "X",
      ownerName: "O",
      picks: [{ round: 1, kind: "skater", label: "?", nhlPlayerId: null }],
    };
    expect(pickCountsByNhlTeamForPoolTeam(team)).toEqual([]);
  });
});

describe("aggregateNhlTeamPickCountsAcrossPool", () => {
  it("sums counts for the same NHL abbrev across pool teams", () => {
    const a: PoolTeam = {
      id: "a",
      name: "A",
      ownerName: "x",
      picks: [
        { round: 1, kind: "skater", label: "p", nhlTeamAbbrev: "TBL", nhlPlayerId: 1 },
        { round: 2, kind: "team", label: "tb", teamAbbrev: "TBL" },
      ],
    };
    const b: PoolTeam = {
      id: "b",
      name: "B",
      ownerName: "y",
      picks: [
        { round: 1, kind: "skater", label: "q", nhlTeamAbbrev: "TBL", nhlPlayerId: 2 },
        { round: 2, kind: "skater", label: "r", nhlTeamAbbrev: "CAR", nhlPlayerId: 3 },
      ],
    };
    expect(aggregateNhlTeamPickCountsAcrossPool([a, b])).toEqual([
      { abbrev: "TBL", count: 3 },
      { abbrev: "CAR", count: 1 },
    ]);
  });
});
