import { describe, expect, it } from "vitest";
import { nhlPlayerHeadshotUrl, nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";
import { buildPoolDaySources } from "@/lib/pool/day-sources";
import type { PoolTeam } from "@/lib/pool/roster-schema";

const teams: PoolTeam[] = [
  {
    id: "a",
    name: "Team A",
    ownerName: "Owner A",
    picks: [
      {
        round: 1,
        kind: "skater",
        label: "McDavid, C",
        nhlPlayerId: 8478402,
        nhlTeamAbbrev: "EDM",
      },
      {
        round: 11,
        kind: "team",
        label: "Edmonton Oilers",
        teamAbbrev: "EDM",
      },
    ],
  },
  {
    id: "b",
    name: "Team B",
    ownerName: "Owner B",
    picks: [
      {
        round: 1,
        kind: "skater",
        label: "McDavid, C",
        nhlPlayerId: 8478402,
        nhlTeamAbbrev: "EDM",
      },
    ],
  },
];

describe("buildPoolDaySources", () => {
  it("lists pool teams under each scoring skater", () => {
    const skaterStats = new Map([
      [8478402, { goals: 2, assists: 1 }],
    ]);
    const wins = new Map<string, number>();

    const nhlNames = new Map([[8478402, "Connor McDavid"]]);

    const { skaters, teamWins } = buildPoolDaySources(
      teams,
      skaterStats,
      wins,
      new Map(),
      nhlNames,
    );

    expect(teamWins).toHaveLength(0);
    expect(skaters).toHaveLength(1);
    expect(skaters[0].label).toBe("McDavid, C");
    expect(skaters[0].nhlDisplayName).toBe("Connor McDavid");
    expect(skaters[0].goals).toBe(2);
    expect(skaters[0].assists).toBe(1);
    expect(skaters[0].headshotUrl).toBe(nhlPlayerHeadshotUrl(8478402));
    expect(skaters[0].beneficiaries).toHaveLength(2);
    expect(skaters[0].beneficiaries.every((b) => b.fantasyPts === 3)).toBe(true);
    const names = skaters[0].beneficiaries.map((b) => b.poolTeamName).sort();
    expect(names).toEqual(["Team A", "Team B"]);
    const edmFallback = nhlTeamLogoLightSvgUrl("EDM");
    expect(skaters[0].beneficiaries[0].nhlTeamAbbrev).toBe("EDM");
    expect(skaters[0].beneficiaries[0].teamLogoUrl).toBe(edmFallback);
    expect(skaters[0].beneficiaries[1].teamLogoUrl).toBe(edmFallback);
  });

  it("uses scoreboard logo URL for skater pick when team played that day", () => {
    const skaterStats = new Map([[8478402, { goals: 1, assists: 0 }]]);
    const wins = new Map<string, number>();
    const fromBoard = "https://assets.nhle.com/logos/nhl/svg/EDM_light.svg?v=1";
    const logoMap = new Map([["EDM", fromBoard]]);
    const { skaters } = buildPoolDaySources(teams, skaterStats, wins, logoMap);
    expect(skaters[0].beneficiaries[0].teamLogoUrl).toBe(fromBoard);
  });

  it("lists pool teams under each winning NHL team pick", () => {
    const skaterStats = new Map<number, { goals: number; assists: number }>();
    const wins = new Map([["EDM", 1]]);

    const logoMap = new Map([["EDM", "https://assets.nhle.com/logos/nhl/svg/EDM_light.svg"]]);

    const { skaters, teamWins } = buildPoolDaySources(
      teams,
      skaterStats,
      wins,
      logoMap,
    );

    expect(skaters).toHaveLength(0);
    expect(teamWins).toHaveLength(1);
    expect(teamWins[0].teamAbbrev).toBe("EDM");
    expect(teamWins[0].logoUrl).toBe("https://assets.nhle.com/logos/nhl/svg/EDM_light.svg");
    expect(teamWins[0].beneficiaries).toHaveLength(1);
    expect(teamWins[0].beneficiaries[0].fantasyPts).toBe(1);
    expect(teamWins[0].beneficiaries[0].poolTeamName).toBe("Team A");
  });

  it("marks skater and team sources as eliminated from team status map", () => {
    const skaterStats = new Map([[8478402, { goals: 1, assists: 0 }]]);
    const wins = new Map([["EDM", 1]]);
    const teamStatus = new Map([["EDM", "eliminated" as const]]);

    const { skaters, teamWins } = buildPoolDaySources(
      teams,
      skaterStats,
      wins,
      new Map(),
      new Map(),
      teamStatus,
    );

    expect(skaters[0].lifecycleStatus).toBe("eliminated");
    expect(teamWins[0].lifecycleStatus).toBe("eliminated");
  });
});
