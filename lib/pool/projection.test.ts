import { describe, expect, it } from "vitest";
import type {
  NhlTeamPlayoffStatus,
  PlayoffBracketResponse,
} from "@/lib/nhl/schemas";
import {
  blendedPpg,
  buildTeamProjectionMaps,
  DEFAULT_PROJECTION_CONFIG,
  detectInSeriesCollisions,
  expectedRemainingGames,
  expectedRemainingWinsTop,
  projectPickEv,
  projectPoolTeam,
  seriesWinProbability,
} from "@/lib/pool/projection";
import type { PoolTeam } from "@/lib/pool/roster-schema";

const APPROX = (a: number, b: number, eps = 1e-9) =>
  expect(Math.abs(a - b)).toBeLessThan(eps);

describe("expectedRemainingGames", () => {
  it("returns 0 once a side has clinched", () => {
    expect(expectedRemainingGames(4, 0, 0.5)).toBe(0);
    expect(expectedRemainingGames(4, 3, 0.6)).toBe(0);
    expect(expectedRemainingGames(0, 4, 0.5)).toBe(0);
  });

  it("matches the closed form 93/16 for a fresh best-of-7 at p=0.5", () => {
    APPROX(expectedRemainingGames(0, 0, 0.5), 93 / 16);
  });

  it("computes 1.875 from a 3-0 lead at p=0.5", () => {
    /**
     * eGames(3,0) = 1 + .5 * 0 + .5 * eGames(3,1)
     * eGames(3,1) = 1 + .5 * 0 + .5 * eGames(3,2) = 1.75
     * eGames(3,2) = 1 + .5 * 0 + .5 * eGames(3,3) = 1.5
     * eGames(3,3) = 1
     * → eGames(3,0) = 1.875
     */
    APPROX(expectedRemainingGames(3, 0, 0.5), 1.875);
  });

  it("monotonically decreases as a side approaches 4", () => {
    const a = expectedRemainingGames(0, 0, 0.5);
    const b = expectedRemainingGames(1, 0, 0.5);
    const c = expectedRemainingGames(3, 0, 0.5);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });
});

describe("expectedRemainingWinsTop", () => {
  it("equals half the expected games at p=0.5 by symmetry", () => {
    const games = expectedRemainingGames(0, 0, 0.5);
    APPROX(expectedRemainingWinsTop(0, 0, 0.5), games / 2);
  });

  it("from 3-0 lead, top wins exactly P(top wins) more games on average", () => {
    /** State (3, 0): top wins exactly one more game iff top wins the series. */
    APPROX(
      expectedRemainingWinsTop(3, 0, 0.5),
      seriesWinProbability(3, 0, 0.5),
    );
  });

  it("returns 0 once a side has clinched", () => {
    expect(expectedRemainingWinsTop(4, 0, 0.5)).toBe(0);
    expect(expectedRemainingWinsTop(0, 4, 0.5)).toBe(0);
  });

  it("for any in-progress state, eWinsTop + eWinsBottom equals eGames", () => {
    for (const [a, b] of [
      [0, 0],
      [1, 0],
      [3, 2],
      [2, 3],
      [3, 3],
    ] as const) {
      const top = expectedRemainingWinsTop(a, b, 0.6);
      /** Bottom wins from top's frame are the symmetric flip. */
      const bottom = expectedRemainingWinsTop(b, a, 0.4);
      const games = expectedRemainingGames(a, b, 0.6);
      APPROX(top + bottom, games);
    }
  });
});

describe("seriesWinProbability", () => {
  it("returns 0.5 from a fresh series at p=0.5", () => {
    APPROX(seriesWinProbability(0, 0, 0.5), 0.5);
  });

  it("returns 15/16 from a 3-0 lead at p=0.5", () => {
    APPROX(seriesWinProbability(3, 0, 0.5), 15 / 16);
  });

  it("returns 1 / 0 at terminal states regardless of p", () => {
    expect(seriesWinProbability(4, 0, 0.5)).toBe(1);
    expect(seriesWinProbability(0, 4, 0.5)).toBe(0);
    expect(seriesWinProbability(4, 2, 0.6)).toBe(1);
  });
});

describe("blendedPpg", () => {
  it("returns regular-season PPG when no playoff sample exists", () => {
    APPROX(
      blendedPpg({ rsGp: 80, rsPts: 96 }),
      96 / 80,
    );
  });

  it("returns 0 when nothing is known", () => {
    expect(blendedPpg({})).toBe(0);
  });

  it("falls back to career playoff PPG when there's no regular-season sample", () => {
    APPROX(
      blendedPpg({ careerPlayoffGp: 50, careerPlayoffPts: 60 }),
      60 / 50,
    );
  });

  it("approaches the playoff sample as it grows past the prior weight", () => {
    const small = blendedPpg({
      rsGp: 80,
      rsPts: 80,
      playoffGp: 1,
      playoffPts: 5,
      priorWeight: 15,
    });
    const big = blendedPpg({
      rsGp: 80,
      rsPts: 80,
      playoffGp: 60,
      playoffPts: 120,
      priorWeight: 15,
    });
    expect(small).toBeLessThan(big);
    expect(big).toBeGreaterThan(1);
    expect(small).toBeLessThan(1.5);
  });

  it("with priorWeight=0 collapses to the playoff sample when present", () => {
    APPROX(
      blendedPpg({
        rsGp: 80,
        rsPts: 160,
        playoffGp: 5,
        playoffPts: 5,
        priorWeight: 0,
      }),
      1,
    );
  });
});

function status(map: Record<string, NhlTeamPlayoffStatus>) {
  return new Map<string, NhlTeamPlayoffStatus>(Object.entries(map));
}

describe("buildTeamProjectionMaps", () => {
  const freshR1Bracket: PlayoffBracketResponse = {
    series: [
      {
        seriesAbbrev: "A1",
        playoffRound: 1,
        topSeedWins: 0,
        bottomSeedWins: 0,
        topSeedTeam: { id: 1, abbrev: "TOR" },
        bottomSeedTeam: { id: 2, abbrev: "OTT" },
      },
    ],
  };

  it("computes E[games] across all 4 rounds for a 0-0 R1 series at p=0.5", () => {
    const maps = buildTeamProjectionMaps(
      freshR1Bracket,
      status({ TOR: "active", OTT: "active" }),
    );
    const eFull = expectedRemainingGames(0, 0, 0.5);
    const expected = eFull * (1 + 0.5 + 0.25 + 0.125);
    APPROX(maps.expectedGamesByAbbrev.get("TOR")!, expected);
    APPROX(maps.expectedGamesByAbbrev.get("OTT")!, expected);
  });

  it("zeros out eliminated teams", () => {
    const decided: PlayoffBracketResponse = {
      series: [
        {
          seriesAbbrev: "A1",
          playoffRound: 1,
          topSeedWins: 4,
          bottomSeedWins: 1,
          topSeedTeam: { id: 1, abbrev: "TOR" },
          bottomSeedTeam: { id: 2, abbrev: "OTT" },
        },
      ],
    };
    const maps = buildTeamProjectionMaps(
      decided,
      status({ TOR: "active", OTT: "eliminated" }),
    );
    expect(maps.expectedGamesByAbbrev.get("OTT")).toBe(0);
    expect(maps.expectedWinsByAbbrev.get("OTT")).toBe(0);
    /** Top side has clinched R1; nothing to add for R1 itself, then projects R2..R4. */
    const eFull = expectedRemainingGames(0, 0, 0.5);
    APPROX(
      maps.expectedGamesByAbbrev.get("TOR")!,
      eFull * (1 + 0.5 + 0.25),
    );
  });

  it("uses the highest-round series each team appears in", () => {
    const advancedTop: PlayoffBracketResponse = {
      series: [
        {
          seriesAbbrev: "A1",
          playoffRound: 1,
          topSeedWins: 4,
          bottomSeedWins: 2,
          topSeedTeam: { id: 1, abbrev: "TOR" },
          bottomSeedTeam: { id: 2, abbrev: "OTT" },
        },
        {
          seriesAbbrev: "AS",
          playoffRound: 2,
          topSeedWins: 1,
          bottomSeedWins: 0,
          topSeedTeam: { id: 1, abbrev: "TOR" },
          bottomSeedTeam: { id: 3, abbrev: "FLA" },
        },
      ],
    };
    const maps = buildTeamProjectionMaps(
      advancedTop,
      status({ TOR: "active", OTT: "eliminated", FLA: "active" }),
    );
    /** TOR is in R2 at (1,0); R1 contribution must be ignored. */
    const eRem = expectedRemainingGames(1, 0, 0.5);
    const pAdv = seriesWinProbability(1, 0, 0.5);
    const eFull = expectedRemainingGames(0, 0, 0.5);
    APPROX(
      maps.expectedGamesByAbbrev.get("TOR")!,
      eRem + pAdv * eFull * (1 + 0.5),
    );
  });

  it("with two opponents in a fresh R1 series, sum of remaining games is bounded", () => {
    const maps = buildTeamProjectionMaps(
      freshR1Bracket,
      status({ TOR: "active", OTT: "active" }),
    );
    const tor = maps.expectedGamesByAbbrev.get("TOR")!;
    const ott = maps.expectedGamesByAbbrev.get("OTT")!;
    /**
     * R1 portion is double-counted (each team plays the same games), but R2+ is
     * mutually exclusive (only one advances). Upper bound: 2 * eGames(0,0) + eGames * (R2..R4 once).
     */
    const eFull = expectedRemainingGames(0, 0, 0.5);
    expect(tor + ott).toBeLessThanOrEqual(
      2 * eFull + eFull * (0.5 + 0.25 + 0.125) * 2 + 1e-9,
    );
  });

  it("expected wins by team sum to expected games over an in-progress series at R1", () => {
    /**
     * In a 0-0 best-of-7 the two teams together cover exactly the expected games:
     * each game contributes 1 win to whoever wins it.
     */
    const totalWinsR1 = expectedRemainingWinsTop(0, 0, 0.5) * 2;
    const totalGamesR1 = expectedRemainingGames(0, 0, 0.5);
    APPROX(totalWinsR1, totalGamesR1);
  });
});

describe("projectPickEv + projectPoolTeam", () => {
  const bracket: PlayoffBracketResponse = {
    series: [
      {
        seriesAbbrev: "A1",
        playoffRound: 1,
        topSeedWins: 2,
        bottomSeedWins: 1,
        topSeedTeam: { id: 1, abbrev: "TOR" },
        bottomSeedTeam: { id: 2, abbrev: "OTT" },
      },
      {
        seriesAbbrev: "M1",
        playoffRound: 1,
        topSeedWins: 4,
        bottomSeedWins: 3,
        topSeedTeam: { id: 3, abbrev: "FLA" },
        bottomSeedTeam: { id: 4, abbrev: "TBL" },
      },
    ],
  };
  const statusMap = status({
    TOR: "active",
    OTT: "active",
    FLA: "active",
    TBL: "eliminated",
  });

  const team: PoolTeam = {
    id: "alpha",
    name: "Alpha",
    ownerName: "AO",
    picks: [
      {
        round: 1,
        kind: "skater",
        label: "TopStar",
        position: "F",
        nhlTeamAbbrev: "TOR",
        nhlPlayerId: 100,
      },
      {
        round: 2,
        kind: "skater",
        label: "OttStar",
        position: "F",
        nhlTeamAbbrev: "OTT",
        nhlPlayerId: 200,
      },
      {
        round: 3,
        kind: "skater",
        label: "DeadStar",
        position: "F",
        nhlTeamAbbrev: "TBL",
        nhlPlayerId: 300,
      },
      { round: 11, kind: "team", label: "Toronto", teamAbbrev: "TOR" },
    ],
  };

  it("eliminated picks contribute 0", () => {
    const maps = buildTeamProjectionMaps(bracket, statusMap);
    const ppg = new Map<number, number>([
      [100, 1.2],
      [200, 1.0],
      [300, 1.5],
    ]);
    const projection = projectPoolTeam(team, {
      totalToDate: 30,
      ppgByPlayerId: ppg,
      maps,
      bracket,
      statusByAbbrev: statusMap,
    });
    const dead = projection.perPickEv.find((p) => p.label === "DeadStar")!;
    expect(dead.ev).toBe(0);
  });

  it("totalToDate + sum(perPickEv) equals projectedFinal", () => {
    const maps = buildTeamProjectionMaps(bracket, statusMap);
    const ppg = new Map<number, number>([
      [100, 1.2],
      [200, 1.0],
      [300, 1.5],
    ]);
    const projection = projectPoolTeam(team, {
      totalToDate: 30,
      ppgByPlayerId: ppg,
      maps,
      bracket,
      statusByAbbrev: statusMap,
    });
    const sum = projection.perPickEv.reduce((s, p) => s + p.ev, 0);
    APPROX(projection.projectedRemaining, sum);
    APPROX(projection.projectedFinal, 30 + sum);
  });

  it("flags the in-series collision between TOR and OTT picks", () => {
    const collisions = detectInSeriesCollisions(team, bracket, statusMap);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]?.teamAbbrevs.sort()).toEqual(["OTT", "TOR"]);
    expect(collisions[0]?.pickLabels).toEqual(
      expect.arrayContaining(["TopStar", "Toronto", "OttStar"]),
    );
  });

  it("does not flag a series where one side is eliminated", () => {
    /** TBL is eliminated, so no collision even if pool team had a pick on FLA. */
    const teamWithFla: PoolTeam = {
      ...team,
      picks: [
        ...team.picks,
        {
          round: 4,
          kind: "skater",
          label: "FlaStar",
          position: "F",
          nhlTeamAbbrev: "FLA",
          nhlPlayerId: 400,
        },
      ],
    };
    const collisions = detectInSeriesCollisions(
      teamWithFla,
      bracket,
      statusMap,
    );
    expect(
      collisions.some((c) => c.seriesAbbrev === "M1"),
    ).toBe(false);
  });

  it("respects DEFAULT_PROJECTION_CONFIG defaults", () => {
    expect(DEFAULT_PROJECTION_CONFIG.baselineP).toBe(0.5);
    expect(DEFAULT_PROJECTION_CONFIG.maxRound).toBe(4);
    expect(DEFAULT_PROJECTION_CONFIG.ppgPriorWeight).toBe(15);
  });

  it("projectPickEv exposes the inputs that drove EV (for explainability)", () => {
    const maps = buildTeamProjectionMaps(bracket, statusMap);
    const ppg = new Map<number, number>([[100, 1.2]]);
    const result = projectPickEv(team.picks[0]!, ppg, maps);
    expect(result.kind).toBe("skater");
    expect(result.ppg).toBe(1.2);
    expect(result.expectedGames).toBe(maps.expectedGamesByAbbrev.get("TOR"));
    APPROX(result.ev, 1.2 * (maps.expectedGamesByAbbrev.get("TOR") ?? 0));
  });
});
