import { describe, expect, it } from "vitest";
import type { NhlTeamPlayoffStatus } from "@/lib/nhl/schemas";
import {
  buildRemainingPicksByTeamId,
  isPickTeamStillActive,
} from "@/lib/pool/remaining-picks-by-team";
import type { PoolRostersFile } from "@/lib/pool/roster-schema";

describe("remaining-picks-by-team", () => {
  const rosters: PoolRostersFile = {
    version: 1,
    teams: [
      {
        id: "a",
        name: "A",
        ownerName: "OA",
        picks: [
          { round: 1, kind: "skater", label: "S1", nhlTeamAbbrev: "TOR" },
          { round: 1, kind: "skater", label: "S2", nhlTeamAbbrev: "BOS" },
          { round: 1, kind: "team", label: "T1", teamAbbrev: "EDM" },
        ],
      },
    ],
  };

  it("counts remaining skaters and teams from playoff status", () => {
    const status = new Map<string, NhlTeamPlayoffStatus>([
      ["TOR", "active"],
      ["BOS", "eliminated"],
      ["EDM", "active"],
    ]);
    const m = buildRemainingPicksByTeamId(rosters, status);
    expect(m.get("a")).toEqual({
      remainingSkaters: 1,
      totalSkaters: 2,
      remainingTeams: 1,
      totalTeams: 1,
      teamWinPicks: [{ teamAbbrev: "EDM", eliminated: false }],
    });
  });

  it("treats missing abbrev as active", () => {
    const eliminated = new Map<string, NhlTeamPlayoffStatus>([["X", "eliminated"]]);
    expect(isPickTeamStillActive(undefined, eliminated)).toBe(true);
  });
});
