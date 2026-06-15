import { describe, expect, it } from "vitest";
import type {
  PlayoffRoundWindows,
  RoundStatus,
} from "@/lib/nhl/playoff-round-windows";
import {
  composePoolReview,
  replayCumulativeByDay,
  scopeLabel,
  type ScopeSummary,
  type SkaterDailyRow,
  type TeamDailyRow,
} from "@/lib/pool/scope-summary";
import type { PoolRostersFile } from "@/lib/pool/roster-schema";

function rosters(): PoolRostersFile {
  return {
    version: 1,
    teams: [
      {
        id: "alpha",
        name: "Alpha",
        ownerName: "Alice",
        picks: [
          {
            round: 1,
            kind: "skater",
            label: "McDavid, C",
            position: "F",
            nhlTeamAbbrev: "EDM",
            nhlPlayerId: 100,
          },
          {
            round: 2,
            kind: "skater",
            label: "Kucherov, N",
            position: "F",
            nhlTeamAbbrev: "TBL",
            nhlPlayerId: 200,
          },
          {
            round: 11,
            kind: "team",
            label: "Edmonton",
            teamAbbrev: "EDM",
          },
        ],
      },
      {
        id: "beta",
        name: "Beta",
        ownerName: "Bob",
        picks: [
          {
            round: 1,
            kind: "skater",
            label: "McDavid, C",
            position: "F",
            nhlTeamAbbrev: "EDM",
            nhlPlayerId: 100,
          },
          {
            round: 2,
            kind: "skater",
            label: "Pastrnak, D",
            position: "F",
            nhlTeamAbbrev: "BOS",
            nhlPlayerId: 300,
          },
          {
            round: 11,
            kind: "team",
            label: "Boston",
            teamAbbrev: "BOS",
          },
        ],
      },
      {
        id: "gamma",
        name: "Gamma",
        ownerName: "Carol",
        picks: [
          {
            round: 1,
            kind: "skater",
            label: "Crosby, S",
            position: "F",
            nhlTeamAbbrev: "PIT",
            nhlPlayerId: 400,
          },
          {
            round: 2,
            kind: "skater",
            label: "Pastrnak, D",
            position: "F",
            nhlTeamAbbrev: "BOS",
            nhlPlayerId: 300,
          },
          {
            round: 11,
            kind: "team",
            label: "Pittsburgh",
            teamAbbrev: "PIT",
          },
        ],
      },
    ],
  };
}

function team(
  teamId: string,
  date: string,
  skater: number,
  teamWin = 0,
): TeamDailyRow {
  return { teamId, date, skaterPoints: skater, teamWinPoints: teamWin };
}

function sk(
  pid: number,
  date: string,
  goals: number,
  assists: number,
  abbrev: string | null = null,
): SkaterDailyRow {
  return {
    nhlPlayerId: pid,
    date,
    goals,
    assists,
    nhlTeamAbbrev: abbrev,
  };
}

function windowsFixture(
  dateToRound: Record<string, number>,
  statusByRound: Partial<Record<number, RoundStatus>> = {},
): PlayoffRoundWindows {
  const dateToDominantRound = new Map<string, number>(Object.entries(dateToRound));
  const dateGroups = new Map<number, string[]>();
  for (const [date, r] of dateToDominantRound) {
    const arr = dateGroups.get(r) ?? [];
    arr.push(date);
    dateGroups.set(r, arr);
  }
  const roundsByNumber = new Map();
  for (const round of [1, 2, 3, 4]) {
    const dates = (dateGroups.get(round) ?? []).slice().sort();
    const status =
      statusByRound[round] ??
      (dates.length === 0 ? "upcoming" : "active");
    roundsByNumber.set(round, {
      round,
      status,
      startDate: dates[0] ?? null,
      endDate: dates[dates.length - 1] ?? null,
      dates,
    });
  }
  return { dateToDominantRound, roundsByNumber };
}

function compose(args: {
  teamRows: TeamDailyRow[];
  skaterRows: SkaterDailyRow[];
  windows: PlayoffRoundWindows;
  poolPlayerStatsAvailable?: boolean;
  asOfDate?: string;
}) {
  return composePoolReview({
    rosters: rosters(),
    teamRows: args.teamRows,
    skaterRows: args.skaterRows,
    windows: args.windows,
    asOfDate: args.asOfDate ?? "2026-05-10",
    playoffStart: "2026-04-18",
    poolPlayerStatsAvailable: args.poolPlayerStatsAvailable ?? true,
  });
}

function pickScope(payload: { scopes: ScopeSummary[] }, scope: "all" | number) {
  const found = payload.scopes.find((s) => s.scope === scope);
  if (!found) throw new Error(`Scope ${scope} missing`);
  return found;
}

describe("scope summary — payload shape", () => {
  it("emits exactly five scopes in canonical order: all, R1, R2, R3, R4", () => {
    const out = compose({
      teamRows: [],
      skaterRows: [],
      windows: windowsFixture({}),
    });
    expect(out.scopes.map((s) => s.scope)).toEqual(["all", 1, 2, 3, 4]);
    expect(out.scopes.map((s) => s.label)).toEqual([
      scopeLabel("all"),
      scopeLabel(1),
      scopeLabel(2),
      scopeLabel(3),
      scopeLabel(4),
    ]);
  });

  it("with empty data, all scopes are upcoming and tile fields are null/empty", () => {
    const out = compose({
      teamRows: [],
      skaterRows: [],
      windows: windowsFixture({}),
    });
    for (const s of out.scopes) {
      expect(s.status).toBe("upcoming");
      expect(s.daysCovered).toBe(0);
      expect(s.topPoolTeams).toEqual([]);
      expect(s.biggestDays).toEqual([]);
      expect(s.mvpSkater).toBeNull();
      expect(s.bestSingleGame).toBeNull();
      /** bestPickPerRound returns one entry per drafted round (zero-pts placeholders pre-playoffs). */
      expect(s.bestPickPerRound.every((e) => e.points === 0)).toBe(true);
      expect(s.daysAtTop).toEqual([]);
      expect(s.leadChanges).toBe(0);
      expect(s.leadChangeLeaders).toEqual([]);
      expect(s.longestRunsAtTop).toEqual([]);
      expect(s.biggestMovers).toEqual([]);
    }
  });
});

describe("scope summary — All scope status", () => {
  it("'all' status is 'upcoming' until any round has games", () => {
    const out = compose({
      teamRows: [],
      skaterRows: [],
      windows: windowsFixture({}),
    });
    expect(pickScope(out, "all").status).toBe("upcoming");
  });

  it("'all' status is 'active' when at least one round has games and not all are complete", () => {
    const out = compose({
      teamRows: [team("alpha", "2026-04-18", 3)],
      skaterRows: [],
      windows: windowsFixture({ "2026-04-18": 1 }, { 1: "active" }),
    });
    expect(pickScope(out, "all").status).toBe("active");
  });

  it("'all' status is 'complete' when all four rounds are complete", () => {
    const out = compose({
      teamRows: [
        team("alpha", "2026-04-18", 1),
        team("alpha", "2026-05-04", 1),
        team("alpha", "2026-05-25", 1),
        team("alpha", "2026-06-15", 1),
      ],
      skaterRows: [],
      windows: windowsFixture(
        {
          "2026-04-18": 1,
          "2026-05-04": 2,
          "2026-05-25": 3,
          "2026-06-15": 4,
        },
        { 1: "complete", 2: "complete", 3: "complete", 4: "complete" },
      ),
    });
    expect(pickScope(out, "all").status).toBe("complete");
  });
});

describe("scope summary — pool-team tiles", () => {
  it("topPoolTeams picks the highest in-window cumulative total across attributed dates only", () => {
    const out = compose({
      teamRows: [
        /** R1 totals: alpha 5+1+0+1=7, beta 2, gamma 6 → alpha wins. */
        team("alpha", "2026-04-18", 5, 1),
        team("beta", "2026-04-18", 2, 0),
        team("gamma", "2026-04-19", 6, 0),
        team("alpha", "2026-04-19", 0, 1),
        /** R2 totals: beta 9+1=10, alpha 0 → beta wins. */
        team("beta", "2026-05-04", 9, 1),
        team("alpha", "2026-05-04", 0, 0),
      ],
      skaterRows: [],
      windows: windowsFixture(
        {
          "2026-04-18": 1,
          "2026-04-19": 1,
          "2026-05-04": 2,
        },
        { 1: "complete", 2: "active" },
      ),
      poolPlayerStatsAvailable: false,
    });
    expect(pickScope(out, 1).topPoolTeams).toEqual([
      expect.objectContaining({
        teamId: "alpha",
        totalPoints: 7,
        skaterPoints: 5,
        teamWinPoints: 2,
      }),
    ]);
    expect(pickScope(out, 2).topPoolTeams).toEqual([
      expect.objectContaining({
        teamId: "beta",
        totalPoints: 10,
      }),
    ]);
    /** "all" scope sums everything: alpha 7, beta 12, gamma 6 → beta wins. */
    expect(pickScope(out, "all").topPoolTeams).toEqual([
      expect.objectContaining({
        teamId: "beta",
        totalPoints: 12,
      }),
    ]);

    /** topTeamWinTeams: R1 team-win totals alpha 2, beta 0, gamma 0 → alpha leads. */
    expect(pickScope(out, 1).topTeamWinTeams).toEqual([
      expect.objectContaining({
        teamId: "alpha",
        teamWinPoints: 2,
      }),
    ]);
    /** R2 team-win totals: beta 1, alpha 0 → beta leads. */
    expect(pickScope(out, 2).topTeamWinTeams).toEqual([
      expect.objectContaining({
        teamId: "beta",
        teamWinPoints: 1,
      }),
    ]);
  });

  it("topPoolTeams returns every team tied for the in-window cumulative lead", () => {
    const out = compose({
      teamRows: [
        team("alpha", "2026-04-18", 5),
        team("beta", "2026-04-18", 5),
        team("gamma", "2026-04-18", 1),
      ],
      skaterRows: [],
      windows: windowsFixture({ "2026-04-18": 1 }, { 1: "active" }),
      poolPlayerStatsAvailable: false,
    });
    const ids = pickScope(out, 1).topPoolTeams.map((t) => t.teamId);
    expect(ids.sort()).toEqual(["alpha", "beta"]);
    expect(pickScope(out, 1).topPoolTeams[0].totalPoints).toBe(5);
  });

  it("biggestDays picks the highest single-day total in the scope window", () => {
    const out = compose({
      teamRows: [
        team("alpha", "2026-04-18", 4, 1),
        team("beta", "2026-04-18", 2, 0),
        team("gamma", "2026-04-19", 7, 1),
        team("beta", "2026-05-04", 5, 0),
      ],
      skaterRows: [],
      windows: windowsFixture(
        {
          "2026-04-18": 1,
          "2026-04-19": 1,
          "2026-05-04": 2,
        },
        { 1: "complete", 2: "active" },
      ),
      poolPlayerStatsAvailable: false,
    });
    expect(pickScope(out, 1).biggestDays).toEqual([
      expect.objectContaining({
        teamId: "gamma",
        date: "2026-04-19",
        totalPoints: 8,
      }),
    ]);
    expect(pickScope(out, 2).biggestDays).toEqual([
      expect.objectContaining({
        teamId: "beta",
        date: "2026-05-04",
        totalPoints: 5,
      }),
    ]);
    /** "all" picks across all dates: gamma still wins with 8. */
    expect(pickScope(out, "all").biggestDays).toEqual([
      expect.objectContaining({
        teamId: "gamma",
        totalPoints: 8,
      }),
    ]);
  });

  it("biggestDays lists every pool team tied for the best single-day total", () => {
    const out = compose({
      teamRows: [
        team("alpha", "2026-04-18", 4, 1),
        team("beta", "2026-04-19", 3, 0),
        team("gamma", "2026-04-20", 3, 2),
      ],
      skaterRows: [],
      windows: windowsFixture(
        { "2026-04-18": 1, "2026-04-19": 1, "2026-04-20": 1 },
        { 1: "active" },
      ),
      poolPlayerStatsAvailable: false,
    });
    const s = pickScope(out, 1);
    expect(s.biggestDays.map((d) => d.teamId).sort()).toEqual(["alpha", "gamma"]);
    expect(s.biggestDays.every((d) => d.totalPoints === 5)).toBe(true);
  });

  it("daysAtTop returns every team tied for most in-scope days at cumulative #1", () => {
    const out = compose({
      teamRows: [
        team("alpha", "2026-04-18", 5),
        team("beta", "2026-04-18", 5),
        team("gamma", "2026-04-18", 1),
        team("alpha", "2026-04-19", 0),
        team("beta", "2026-04-19", 1),
        team("gamma", "2026-04-19", 0),
      ],
      skaterRows: [],
      windows: windowsFixture(
        { "2026-04-18": 1, "2026-04-19": 1 },
        { 1: "active" },
      ),
      poolPlayerStatsAvailable: false,
    });
    /** Day1: alpha=beta=5 (tie → both count); Day2: alpha=5, beta=6 → beta sole top.
     * alpha days=1, beta days=2 → beta wins. */
    expect(pickScope(out, 1).daysAtTop).toEqual([
      expect.objectContaining({
        teamId: "beta",
        days: 2,
      }),
    ]);
  });

  it("daysAtTop lists teams tied for the lead in days-at-#1 count", () => {
    /** Two in-scope days where alpha and beta share cumulative #1 both days → 2 days each. */
    const out2 = compose({
      teamRows: [
        team("alpha", "2026-04-18", 5),
        team("beta", "2026-04-18", 5),
        team("alpha", "2026-04-19", 3),
        team("beta", "2026-04-19", 3),
      ],
      skaterRows: [],
      windows: windowsFixture(
        { "2026-04-18": 1, "2026-04-19": 1 },
        { 1: "active" },
      ),
      poolPlayerStatsAvailable: false,
    });
    const ids = pickScope(out2, 1).daysAtTop.map((r) => r.teamId).sort();
    expect(ids).toEqual(["alpha", "beta"]);
    expect(pickScope(out2, 1).daysAtTop[0].days).toBe(2);
  });

  it("leadChanges counts changes in the lead set across consecutive in-scope days", () => {
    const out = compose({
      teamRows: [
        team("alpha", "2026-04-18", 5),
        team("beta", "2026-04-18", 2),
        team("alpha", "2026-04-19", 0),
        team("beta", "2026-04-19", 3),
        team("alpha", "2026-04-20", 0),
        team("beta", "2026-04-20", 4),
        team("gamma", "2026-04-21", 9),
      ],
      skaterRows: [],
      windows: windowsFixture(
        {
          "2026-04-18": 1,
          "2026-04-19": 1,
          "2026-04-20": 1,
          "2026-04-21": 1,
        },
        { 1: "active" },
      ),
      poolPlayerStatsAvailable: false,
    });
    /** {alpha} -> {alpha,beta} -> {beta} -> {beta,gamma} = 3 changes */
    const s = pickScope(out, 1);
    expect(s.leadChanges).toBe(3);
    expect(s.leadChangeLeaders.map((t) => t.teamId)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  it("longestRunsAtTop tracks the longest run across in-scope days", () => {
    const out = compose({
      teamRows: [
        team("alpha", "2026-04-18", 5),
        team("alpha", "2026-04-19", 1),
        team("alpha", "2026-04-20", 0),
        team("beta", "2026-04-20", 10),
        team("alpha", "2026-04-21", 4),
        team("beta", "2026-04-21", 0),
        team("alpha", "2026-04-22", 4),
        team("beta", "2026-04-22", 0),
      ],
      skaterRows: [],
      windows: windowsFixture(
        {
          "2026-04-18": 1,
          "2026-04-19": 1,
          "2026-04-20": 1,
          "2026-04-21": 1,
          "2026-04-22": 1,
        },
        { 1: "active" },
      ),
      poolPlayerStatsAvailable: false,
    });
    /** alpha leads days 1,2 → broken on day 3 by beta; alpha leads days 4,5 again → length 2. */
    /** alpha leads Apr 18–19; beta leads Apr 20–21 — both runs length 2. */
    expect(pickScope(out, 1).longestRunsAtTop).toEqual([
      expect.objectContaining({
        teamId: "alpha",
        days: 2,
        fromDate: "2026-04-18",
        toDate: "2026-04-19",
      }),
      expect.objectContaining({
        teamId: "beta",
        days: 2,
        fromDate: "2026-04-20",
        toDate: "2026-04-21",
      }),
    ]);
  });

  it("biggestMovers reports the largest single-day rank jump across consecutive in-scope days", () => {
    const out = compose({
      teamRows: [
        team("alpha", "2026-04-18", 5),
        team("beta", "2026-04-18", 4),
        team("gamma", "2026-04-19", 10),
      ],
      skaterRows: [],
      windows: windowsFixture(
        { "2026-04-18": 1, "2026-04-19": 1 },
        { 1: "active" },
      ),
      poolPlayerStatsAvailable: false,
    });
    expect(pickScope(out, 1).biggestMovers).toEqual([
      expect.objectContaining({
        teamId: "gamma",
        date: "2026-04-19",
        jump: 2,
        fromRank: 3,
        toRank: 1,
      }),
    ]);
  });

});

describe("scope summary — player tiles", () => {
  it("mvpSkater picks the highest-points rostered skater within the scope window", () => {
    const out = compose({
      teamRows: [],
      skaterRows: [
        sk(100, "2026-04-18", 1, 0, "EDM"), // McDavid R1 = 1
        sk(100, "2026-04-19", 0, 1, "EDM"), // McDavid R1 = 2
        sk(300, "2026-04-19", 2, 1, "BOS"), // Pastrnak R1 = 3 (highest)
        sk(200, "2026-05-04", 4, 0, "TBL"), // Kucherov R2 = 4
      ],
      windows: windowsFixture(
        {
          "2026-04-18": 1,
          "2026-04-19": 1,
          "2026-05-04": 2,
        },
        { 1: "active", 2: "active" },
      ),
    });
    expect(pickScope(out, 1).mvpSkater).toMatchObject({
      nhlPlayerId: 300,
      points: 3,
    });
    expect(pickScope(out, 2).mvpSkater).toMatchObject({
      nhlPlayerId: 200,
      points: 4,
    });
    /** "all" sums R1+R2: Kucherov 4 wins overall. */
    expect(pickScope(out, "all").mvpSkater).toMatchObject({
      nhlPlayerId: 200,
      points: 4,
    });
  });

  it("bestPickPerRound returns scope-windowed list of (draft-round, top-player) entries", () => {
    const out = compose({
      teamRows: [],
      skaterRows: [
        sk(100, "2026-04-18", 2, 1), // McDavid round 1 = 3 (alpha+beta)
        sk(400, "2026-04-18", 0, 1), // Crosby round 1 = 1 (gamma)
        sk(200, "2026-04-18", 4, 0), // Kucherov round 2 = 4 (alpha)
        sk(300, "2026-04-18", 1, 1), // Pastrnak round 2 = 2 (beta+gamma)
        /** Round 2 (Stanley Cup): only McDavid + Kucherov score. */
        sk(100, "2026-05-04", 1, 0),
        sk(200, "2026-05-04", 1, 0),
      ],
      windows: windowsFixture(
        { "2026-04-18": 1, "2026-05-04": 2 },
        { 1: "complete", 2: "active" },
      ),
    });
    const r1 = pickScope(out, 1).bestPickPerRound;
    const r1ByRound = new Map(r1.map((e) => [e.round, e]));
    expect(r1ByRound.get(1)).toMatchObject({ nhlPlayerId: 100, points: 3 });
    expect(r1ByRound.get(2)).toMatchObject({ nhlPlayerId: 200, points: 4 });
    expect(r1ByRound.has(11)).toBe(false);
    /** R2 scope: only McDavid (R1 box) and Kucherov (R2 box) scored. */
    const r2 = pickScope(out, 2).bestPickPerRound;
    const r2ByRound = new Map(r2.map((e) => [e.round, e]));
    expect(r2ByRound.get(1)).toMatchObject({ nhlPlayerId: 100, points: 1 });
    expect(r2ByRound.get(2)).toMatchObject({ nhlPlayerId: 200, points: 1 });
  });

  it("bestSingleGame picks the highest single-day stat line within the scope window", () => {
    const out = compose({
      teamRows: [],
      skaterRows: [
        sk(100, "2026-04-18", 1, 1, "EDM"),
        sk(300, "2026-04-19", 2, 2, "BOS"),
        sk(200, "2026-05-04", 1, 2, "TBL"),
      ],
      windows: windowsFixture(
        { "2026-04-18": 1, "2026-04-19": 1, "2026-05-04": 2 },
        { 1: "active", 2: "active" },
      ),
    });
    expect(pickScope(out, 1).bestSingleGame).toMatchObject({
      nhlPlayerId: 300,
      date: "2026-04-19",
      points: 4,
    });
    expect(pickScope(out, 2).bestSingleGame).toMatchObject({
      nhlPlayerId: 200,
      date: "2026-05-04",
      points: 3,
    });
  });

  it("suppresses player tiles when poolPlayerStatsAvailable=false", () => {
    const out = compose({
      teamRows: [team("alpha", "2026-04-18", 3)],
      skaterRows: [],
      windows: windowsFixture({ "2026-04-18": 1 }, { 1: "active" }),
      poolPlayerStatsAvailable: false,
    });
    for (const s of out.scopes) {
      expect(s.mvpSkater).toBeNull();
      expect(s.bestSingleGame).toBeNull();
      expect(s.bestPickPerRound).toEqual([]);
    }
    /** Pool-team tile still populated. */
    expect(pickScope(out, "all").topPoolTeams).toEqual([
      expect.objectContaining({ teamId: "alpha" }),
    ]);
  });
});

describe("scope summary — scope isolation", () => {
  it("does not bleed scoring across rounds (R2 stats exclude R1 dates)", () => {
    const out = compose({
      teamRows: [
        team("alpha", "2026-04-18", 9),
        team("alpha", "2026-05-04", 0),
        team("beta", "2026-05-04", 4),
      ],
      skaterRows: [
        sk(100, "2026-04-18", 3, 0, "EDM"),
        sk(200, "2026-05-04", 1, 1, "TBL"),
      ],
      windows: windowsFixture(
        { "2026-04-18": 1, "2026-05-04": 2 },
        { 1: "complete", 2: "active" },
      ),
    });
    expect(pickScope(out, 2).topPoolTeams).toEqual([
      expect.objectContaining({
        teamId: "beta",
        totalPoints: 4,
      }),
    ]);
    expect(pickScope(out, 2).mvpSkater).toMatchObject({
      nhlPlayerId: 200,
      points: 2,
    });
  });

  it("propagates round window status, startDate, endDate, daysCovered", () => {
    const out = compose({
      teamRows: [],
      skaterRows: [],
      windows: windowsFixture(
        { "2026-04-18": 1, "2026-04-25": 1, "2026-05-04": 2 },
        { 1: "complete", 2: "active" },
      ),
    });
    expect(pickScope(out, 1)).toMatchObject({
      status: "complete",
      startDate: "2026-04-18",
      endDate: "2026-04-25",
      daysCovered: 2,
    });
    expect(pickScope(out, 2)).toMatchObject({
      status: "active",
      startDate: "2026-05-04",
      endDate: "2026-05-04",
      daysCovered: 1,
    });
    expect(pickScope(out, 3).status).toBe("upcoming");
  });
});

describe("replayCumulativeByDay (re-export sanity)", () => {
  it("accumulates running totals across days", () => {
    const cum = replayCumulativeByDay(
      [
        team("a", "2026-04-18", 3),
        team("b", "2026-04-18", 1),
        team("a", "2026-04-19", 2),
        team("b", "2026-04-19", 5),
      ],
      ["a", "b"],
    );
    expect(cum).toHaveLength(2);
    expect(cum[0]!.cumulativeByTeamId.get("a")).toBe(3);
    expect(cum[0]!.cumulativeByTeamId.get("b")).toBe(1);
    expect(cum[1]!.cumulativeByTeamId.get("a")).toBe(5);
    expect(cum[1]!.cumulativeByTeamId.get("b")).toBe(6);
  });
});
