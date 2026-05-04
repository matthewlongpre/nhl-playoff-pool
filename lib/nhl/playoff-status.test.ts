import { describe, expect, it } from "vitest";
import {
  applyForcedEliminatedOverrides,
  buildTeamStatusFromPlayoffBracket,
  playoffSeasonFromDate,
} from "@/lib/nhl/playoff-status";
import type { PlayoffBracketResponse } from "@/lib/nhl/schemas";

function mockBracket(): PlayoffBracketResponse {
  return {
    series: [
      {
        seriesAbbrev: "R1",
        playoffRound: 1,
        topSeedWins: 4,
        bottomSeedWins: 2,
        topSeedTeam: { id: 1, abbrev: "EDM" },
        bottomSeedTeam: { id: 2, abbrev: "LAK" },
      },
      {
        seriesAbbrev: "R2",
        playoffRound: 2,
        topSeedWins: 1,
        bottomSeedWins: 0,
        topSeedTeam: { id: 1, abbrev: "EDM" },
        bottomSeedTeam: { id: 3, abbrev: "DAL" },
      },
      {
        seriesAbbrev: "R1",
        playoffRound: 1,
        topSeedWins: 4,
        bottomSeedWins: 0,
        topSeedTeam: { id: 4, abbrev: "FLA" },
        bottomSeedTeam: { id: 5, abbrev: "TOR" },
      },
    ],
  };
}

describe("playoffSeasonFromDate", () => {
  it("maps spring dates to the same season-end year", () => {
    expect(playoffSeasonFromDate("2026-04-24")).toBe(2026);
  });

  it("maps fall dates to next season-end year", () => {
    expect(playoffSeasonFromDate("2025-10-01")).toBe(2026);
  });
});

describe("buildTeamStatusFromPlayoffBracket", () => {
  it("marks series losers as eliminated and remaining teams as active", () => {
    const map = buildTeamStatusFromPlayoffBracket(mockBracket());
    expect(map.get("LAK")).toBe("eliminated");
    expect(map.get("TOR")).toBe("eliminated");
    expect(map.get("EDM")).toBe("active");
    expect(map.get("DAL")).toBe("active");
  });

  it("ignores placeholder future series without team payloads", () => {
    const map = buildTeamStatusFromPlayoffBracket({
      series: [
        {
          seriesAbbrev: "R1",
          playoffRound: 1,
          topSeedWins: 4,
          bottomSeedWins: 2,
          topSeedTeam: { id: 1, abbrev: "EDM" },
          bottomSeedTeam: { id: 2, abbrev: "LAK" },
        },
        {
          seriesAbbrev: "CF",
          playoffRound: 3,
          topSeedWins: 0,
          bottomSeedWins: 0,
        },
      ],
    });
    expect(map.get("LAK")).toBe("eliminated");
    expect(map.get("EDM")).toBe("active");
  });
});

describe("applyForcedEliminatedOverrides", () => {
  it("forces selected teams to eliminated for temporary UI testing", () => {
    const map = buildTeamStatusFromPlayoffBracket(mockBracket());
    expect(map.get("DAL")).toBe("active");
    applyForcedEliminatedOverrides(map, ["DAL"]);
    expect(map.get("DAL")).toBe("eliminated");
  });
});
