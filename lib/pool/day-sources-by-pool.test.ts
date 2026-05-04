import { describe, expect, it } from "vitest";
import { nhlPlayerHeadshotUrl } from "@/lib/nhl/media";
import type {
  SkaterDaySource,
  TeamWinDaySource,
} from "@/lib/pool/day-sources";
import { groupDaySourcesByPoolTeam } from "@/lib/pool/day-sources-by-pool";

const skaters: SkaterDaySource[] = [
  {
    nhlPlayerId: 1,
    label: "Player A",
    goals: 1,
    assists: 0,
    headshotUrl: nhlPlayerHeadshotUrl(1),
    beneficiaries: [
      {
        poolTeamId: "x",
        poolTeamName: "Team X",
        ownerName: "Ox",
        fantasyPts: 1,
        pickRound: 1,
      },
      {
        poolTeamId: "y",
        poolTeamName: "Team Y",
        ownerName: "Oy",
        fantasyPts: 1,
        pickRound: 1,
      },
    ],
  },
  {
    nhlPlayerId: 2,
    label: "Player B",
    goals: 0,
    assists: 2,
    headshotUrl: nhlPlayerHeadshotUrl(2),
    beneficiaries: [
      {
        poolTeamId: "x",
        poolTeamName: "Team X",
        ownerName: "Ox",
        fantasyPts: 2,
        pickRound: 2,
      },
    ],
  },
];

const teamWins: TeamWinDaySource[] = [
  {
    teamAbbrev: "TBL",
    label: "Lightning",
    wins: 1,
    logoUrl: "https://example.com/tbl.svg",
    beneficiaries: [
      {
        poolTeamId: "y",
        poolTeamName: "Team Y",
        ownerName: "Oy",
        fantasyPts: 1,
        pickRound: 11,
      },
    ],
  },
];

describe("groupDaySourcesByPoolTeam", () => {
  it("groups by pool team and sorts by total points", () => {
    const rows = groupDaySourcesByPoolTeam(skaters, teamWins);
    expect(rows).toHaveLength(2);
    expect(rows[0].poolTeamId).toBe("x");
    expect(rows[0].totalFantasyPts).toBe(3);
    expect(rows[0].skaters).toHaveLength(2);
    expect(rows[0].teamPicks).toHaveLength(0);

    expect(rows[1].poolTeamId).toBe("y");
    expect(rows[1].totalFantasyPts).toBe(2);
    expect(rows[1].skaters).toHaveLength(1);
    expect(rows[1].teamPicks).toHaveLength(1);
  });

  it("when points tie, sorts by standings rank before name", () => {
    const tied: SkaterDaySource[] = [
      {
        nhlPlayerId: 10,
        label: "Player Z",
        goals: 1,
        assists: 0,
        headshotUrl: nhlPlayerHeadshotUrl(10),
        beneficiaries: [
          {
            poolTeamId: "alpha",
            poolTeamName: "Alpha",
            ownerName: "A",
            fantasyPts: 2,
            pickRound: 1,
          },
          {
            poolTeamId: "beta",
            poolTeamName: "Beta",
            ownerName: "B",
            fantasyPts: 2,
            pickRound: 1,
          },
        ],
      },
    ];
    const ranks = new Map<string, number>([
      ["alpha", 5],
      ["beta", 2],
    ]);
    const rows = groupDaySourcesByPoolTeam(tied, [], ranks);
    expect(rows).toHaveLength(2);
    expect(rows[0].poolTeamId).toBe("beta");
    expect(rows[1].poolTeamId).toBe("alpha");
  });
});
