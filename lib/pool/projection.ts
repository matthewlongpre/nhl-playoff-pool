import {
  conferenceForSeries,
  type BracketConferenceBucket,
} from "@/lib/nhl/playoff-bracket-layout";
import type {
  NhlTeamPlayoffStatus,
  PlayoffBracketResponse,
} from "@/lib/nhl/schemas";
import type { PoolPick, PoolTeam } from "@/lib/pool/roster-schema";

/** Stanley Cup playoff has 4 rounds (R1 → R2 → R3 → R4). */
const STANLEY_CUP_MAX_ROUND = 4;

/** A best-of-7 series ends when one side reaches 4 wins. */
const SERIES_WIN_THRESHOLD = 4;

/**
 * Tunables for the probability-weighted projection. All defaults are
 * intentionally conservative so projections degrade gracefully on poor data.
 */
export type ProjectionConfig = {
  /**
   * Per-game win probability used for in-progress series and future rounds.
   * Default 0.5 — neutral. Override per-series via {@link seriesPerGameProbability}.
   */
  baselineP?: number;
  /**
   * Bayesian shrinkage weight (in playoff games) used by {@link blendedPpg}.
   * `effectiveSampleSize = priorWeight + observedPlayoffGames`. Default 15.
   */
  ppgPriorWeight?: number;
  /** Cap on bracket walk depth. Default 4 (full Stanley Cup playoffs). */
  maxRound?: number;
  /**
   * Bayesian shrinkage weight (in games) for series-lead per-game probability.
   * Higher = smaller adjustment from series score. Default 4.
   */
  seriesLeadPriorGames?: number;
  /**
   * Fraction of `min(evA, evB)` deducted per same-conference pick pair.
   * Default 0.2 (20% of the smaller pick's EV).
   */
  conferencePenaltyFactor?: number;
};

export const DEFAULT_PROJECTION_CONFIG = {
  baselineP: 0.5,
  ppgPriorWeight: 15,
  maxRound: STANLEY_CUP_MAX_ROUND,
  seriesLeadPriorGames: 4,
  conferencePenaltyFactor: 0.2,
} as const;

type SeriesProbabilityTables = {
  /** `expectedRemainingGames(a, b)` — games left in a series at state `(a, b)`. */
  eGames: (a: number, b: number) => number;
  /** `expectedRemainingWinsTop(a, b)` — wins for the “top” side from `(a, b)` until series ends. */
  eWinsTop: (a: number, b: number) => number;
  /** `topWinsSeries(a, b)` — probability the top side eventually wins the series from `(a, b)`. */
  pTopWins: (a: number, b: number) => number;
};

/** Memoized closures keyed by per-game probability (rounded to 1e-6). */
const PROB_TABLE_CACHE = new Map<number, SeriesProbabilityTables>();

function buildSeriesProbabilityTables(p: number): SeriesProbabilityTables {
  const eGamesMemo = new Map<number, number>();
  const eWinsTopMemo = new Map<number, number>();
  const pTopWinsMemo = new Map<number, number>();
  const key = (a: number, b: number) => a * 8 + b;

  function eGames(a: number, b: number): number {
    if (a >= SERIES_WIN_THRESHOLD || b >= SERIES_WIN_THRESHOLD) return 0;
    const k = key(a, b);
    const cached = eGamesMemo.get(k);
    if (cached !== undefined) return cached;
    const v = 1 + p * eGames(a + 1, b) + (1 - p) * eGames(a, b + 1);
    eGamesMemo.set(k, v);
    return v;
  }

  function eWinsTop(a: number, b: number): number {
    if (a >= SERIES_WIN_THRESHOLD || b >= SERIES_WIN_THRESHOLD) return 0;
    const k = key(a, b);
    const cached = eWinsTopMemo.get(k);
    if (cached !== undefined) return cached;
    const v = p * (1 + eWinsTop(a + 1, b)) + (1 - p) * eWinsTop(a, b + 1);
    eWinsTopMemo.set(k, v);
    return v;
  }

  function pTopWins(a: number, b: number): number {
    if (a >= SERIES_WIN_THRESHOLD) return 1;
    if (b >= SERIES_WIN_THRESHOLD) return 0;
    const k = key(a, b);
    const cached = pTopWinsMemo.get(k);
    if (cached !== undefined) return cached;
    const v = p * pTopWins(a + 1, b) + (1 - p) * pTopWins(a, b + 1);
    pTopWinsMemo.set(k, v);
    return v;
  }

  return { eGames, eWinsTop, pTopWins };
}

function getSeriesProbabilityTables(p: number): SeriesProbabilityTables {
  const k = Math.round(p * 1e6) / 1e6;
  let tables = PROB_TABLE_CACHE.get(k);
  if (!tables) {
    tables = buildSeriesProbabilityTables(k);
    PROB_TABLE_CACHE.set(k, tables);
  }
  return tables;
}

/** Expected number of games still to be played in a best-of-7 series at `(a, b)`. */
export function expectedRemainingGames(
  aWins: number,
  bWins: number,
  perGameP: number,
): number {
  return getSeriesProbabilityTables(perGameP).eGames(aWins, bWins);
}

/**
 * Expected number of wins the “top” side (the one whose per-game probability is `perGameP`)
 * will earn from state `(a, b)` until the series ends.
 */
export function expectedRemainingWinsTop(
  aWins: number,
  bWins: number,
  perGameP: number,
): number {
  return getSeriesProbabilityTables(perGameP).eWinsTop(aWins, bWins);
}

/** Probability the “top” side eventually wins the series given state `(a, b)`. */
export function seriesWinProbability(
  aWins: number,
  bWins: number,
  perGameP: number,
): number {
  return getSeriesProbabilityTables(perGameP).pTopWins(aWins, bWins);
}

/**
 * Bayesian-shrunk PPG: regular-season PPG is the prior (weighted by `priorWeight` games),
 * current-playoff PPG is the observed signal. Falls back to career playoff PPG when no
 * regular-season sample is available, then to 0 when nothing is known.
 *
 * `effectivePpg = (priorWeight * priorPpg + playoffGp * playoffPpg) / (priorWeight + playoffGp)`
 */
export function blendedPpg(args: {
  rsGp?: number;
  rsPts?: number;
  playoffGp?: number;
  playoffPts?: number;
  careerPlayoffGp?: number;
  careerPlayoffPts?: number;
  priorWeight?: number;
}): number {
  const rsGp = Math.max(0, args.rsGp ?? 0);
  const rsPts = Math.max(0, args.rsPts ?? 0);
  const playoffGp = Math.max(0, args.playoffGp ?? 0);
  const playoffPts = Math.max(0, args.playoffPts ?? 0);
  const cpGp = Math.max(0, args.careerPlayoffGp ?? 0);
  const cpPts = Math.max(0, args.careerPlayoffPts ?? 0);
  const priorWeight = Math.max(
    0,
    args.priorWeight ?? DEFAULT_PROJECTION_CONFIG.ppgPriorWeight,
  );

  let priorPpg: number | null = null;
  if (rsGp > 0) priorPpg = rsPts / rsGp;
  else if (cpGp > 0) priorPpg = cpPts / cpGp;

  if (priorPpg == null && playoffGp <= 0) return 0;
  if (priorPpg == null) return playoffPts / playoffGp;
  if (playoffGp <= 0) return priorPpg;

  const playoffPpg = playoffPts / playoffGp;
  return (
    (priorWeight * priorPpg + playoffGp * playoffPpg) /
    (priorWeight + playoffGp)
  );
}

/**
 * Bayesian-adjusted per-game win probability given current series state.
 * Treats series wins as observations against a neutral (baselineP) prior of
 * `priorGames` games. At 0-0 returns baselineP exactly.
 */
function bayesianSeriesP(
  teamWins: number,
  opponentWins: number,
  baselineP: number,
  priorGames: number,
): number {
  const totalGames = teamWins + opponentWins;
  if (totalGames === 0) return baselineP;
  return (priorGames * baselineP + teamWins) / (priorGames + totalGames);
}

/**
 * Expected remaining games and wins for every NHL team appearing in the bracket.
 * Eliminated teams map to 0. Teams alive but not yet in any later-round slot
 * still walk forward to round 4 with `baselineP` probability each round.
 */
export type TeamProjectionMaps = {
  expectedGamesByAbbrev: Map<string, number>;
  expectedWinsByAbbrev: Map<string, number>;
  /** Probability each team advances their current in-progress series. */
  advanceProbByAbbrev: Map<string, number>;
};

export function buildTeamProjectionMaps(
  bracket: PlayoffBracketResponse,
  statusByAbbrev: ReadonlyMap<string, NhlTeamPlayoffStatus>,
  config: ProjectionConfig = {},
): TeamProjectionMaps {
  const baselineP = config.baselineP ?? DEFAULT_PROJECTION_CONFIG.baselineP;
  const maxRound = config.maxRound ?? DEFAULT_PROJECTION_CONFIG.maxRound;
  const priorGames =
    config.seriesLeadPriorGames ?? DEFAULT_PROJECTION_CONFIG.seriesLeadPriorGames;

  type Slot = {
    round: number;
    seriesAbbrev: string;
    teamWins: number;
    opponentWins: number;
    perGameP: number;
  };

  /** Highest-round series each team currently appears in. */
  const slotByTeam = new Map<string, Slot>();
  const considerSlot = (
    abbrev: string | undefined,
    slot: Slot,
  ): void => {
    if (!abbrev) return;
    const existing = slotByTeam.get(abbrev);
    if (!existing || slot.round > existing.round) {
      slotByTeam.set(abbrev, slot);
    }
  };

  for (const s of bracket.series) {
    const top = s.topSeedTeam?.abbrev?.trim().toUpperCase();
    const bot = s.bottomSeedTeam?.abbrev?.trim().toUpperCase();
    const adjP = bayesianSeriesP(s.topSeedWins, s.bottomSeedWins, baselineP, priorGames);
    considerSlot(top, {
      round: s.playoffRound,
      seriesAbbrev: s.seriesAbbrev,
      teamWins: s.topSeedWins,
      opponentWins: s.bottomSeedWins,
      perGameP: adjP,
    });
    considerSlot(bot, {
      round: s.playoffRound,
      seriesAbbrev: s.seriesAbbrev,
      teamWins: s.bottomSeedWins,
      opponentWins: s.topSeedWins,
      perGameP: 1 - adjP,
    });
  }

  /** Future rounds assume neutral start (0, 0) at `baselineP`. */
  const eFutureGames = expectedRemainingGames(0, 0, baselineP);
  const eFutureWins = expectedRemainingWinsTop(0, 0, baselineP);
  const pFutureAdvance = seriesWinProbability(0, 0, baselineP);

  const expectedGamesByAbbrev = new Map<string, number>();
  const expectedWinsByAbbrev = new Map<string, number>();
  const advanceProbByAbbrev = new Map<string, number>();

  for (const [abbrev, slot] of slotByTeam) {
    if (statusByAbbrev.get(abbrev) === "eliminated") {
      expectedGamesByAbbrev.set(abbrev, 0);
      expectedWinsByAbbrev.set(abbrev, 0);
      advanceProbByAbbrev.set(abbrev, 0);
      continue;
    }

    const remGamesNow = expectedRemainingGames(
      slot.teamWins,
      slot.opponentWins,
      slot.perGameP,
    );
    const remWinsNow = expectedRemainingWinsTop(
      slot.teamWins,
      slot.opponentWins,
      slot.perGameP,
    );
    const pAdvanceNow = seriesWinProbability(
      slot.teamWins,
      slot.opponentWins,
      slot.perGameP,
    );

    advanceProbByAbbrev.set(abbrev, pAdvanceNow);

    let totalGames = remGamesNow;
    let totalWins = remWinsNow;
    let pReachNextRound = pAdvanceNow;
    for (let r = slot.round + 1; r <= maxRound; r++) {
      totalGames += pReachNextRound * eFutureGames;
      totalWins += pReachNextRound * eFutureWins;
      pReachNextRound *= pFutureAdvance;
    }

    expectedGamesByAbbrev.set(abbrev, totalGames);
    expectedWinsByAbbrev.set(abbrev, totalWins);
  }

  /** Eliminated teams that never appeared in `slotByTeam` still need explicit zeros. */
  for (const [abbrev, status] of statusByAbbrev) {
    if (status === "eliminated" && !expectedGamesByAbbrev.has(abbrev)) {
      expectedGamesByAbbrev.set(abbrev, 0);
      expectedWinsByAbbrev.set(abbrev, 0);
      advanceProbByAbbrev.set(abbrev, 0);
    }
  }

  return { expectedGamesByAbbrev, expectedWinsByAbbrev, advanceProbByAbbrev };
}

/**
 * Derives a conference assignment for every team appearing in the bracket.
 * Uses the earliest-round series for each team so teams keep their East/West
 * classification even after they advance to the Conference Final or SCF.
 */
export function buildTeamConferenceMap(
  bracket: PlayoffBracketResponse,
): Map<string, BracketConferenceBucket> {
  const map = new Map<string, BracketConferenceBucket>();
  const sorted = [...bracket.series].sort((a, b) => a.playoffRound - b.playoffRound);
  for (const s of sorted) {
    const conf = conferenceForSeries(s);
    const top = s.topSeedTeam?.abbrev?.trim().toUpperCase();
    const bot = s.bottomSeedTeam?.abbrev?.trim().toUpperCase();
    if (top && !map.has(top)) map.set(top, conf);
    if (bot && !map.has(bot)) map.set(bot, conf);
  }
  return map;
}

export type ProjectedPickEv = {
  round: number;
  label: string;
  kind: "skater" | "team";
  teamAbbrev?: string;
  nhlPlayerId?: number;
  position?: "F" | "D";
  /** Expected fantasy points contributed by this pick over the rest of the playoffs. */
  ev: number;
  /** Skater picks only — blended PPG used as the rate. */
  ppg?: number;
  /** Skater picks only — expected remaining games for the player's NHL team. */
  expectedGames?: number;
  /** Team picks only — expected remaining wins for the picked NHL club. */
  expectedWins?: number;
};

export function projectPickEv(
  pick: PoolPick,
  ppgByPlayerId: ReadonlyMap<number, number>,
  maps: TeamProjectionMaps,
): ProjectedPickEv {
  if (pick.kind === "skater") {
    const id = pick.nhlPlayerId ?? null;
    const teamAbbrev = pick.nhlTeamAbbrev;
    const abbrevUp = teamAbbrev?.trim().toUpperCase();
    const expectedGames = abbrevUp
      ? maps.expectedGamesByAbbrev.get(abbrevUp) ?? 0
      : 0;
    const ppg = id != null ? ppgByPlayerId.get(id) ?? 0 : 0;
    const ev = ppg * expectedGames;
    return {
      round: pick.round,
      label: pick.label,
      kind: "skater",
      ...(teamAbbrev ? { teamAbbrev } : {}),
      ...(id != null ? { nhlPlayerId: id } : {}),
      ...(pick.position ? { position: pick.position } : {}),
      ev,
      ppg,
      expectedGames,
    };
  }

  const abbrevUp = pick.teamAbbrev.trim().toUpperCase();
  const expectedWins = maps.expectedWinsByAbbrev.get(abbrevUp) ?? 0;
  return {
    round: pick.round,
    label: pick.label,
    kind: "team",
    teamAbbrev: pick.teamAbbrev,
    ev: expectedWins,
    expectedWins,
  };
}

export type ProjectedCollision = {
  seriesAbbrev: string;
  round: number;
  /** [topSeedAbbrev, bottomSeedAbbrev], uppercased. */
  teamAbbrevs: [string, string];
  /** Pick labels from this pool team that sit on either side of the series. */
  pickLabels: string[];
};

/**
 * Pool-team-level "collisions": picks on opposing NHL clubs that are still both alive
 * and currently locked in the same series. Surfaces only series the bracket already
 * pairs up — TBD slots are skipped.
 */
export function detectInSeriesCollisions(
  team: PoolTeam,
  bracket: PlayoffBracketResponse,
  statusByAbbrev: ReadonlyMap<string, NhlTeamPlayoffStatus>,
): ProjectedCollision[] {
  const labelsByAbbrev = new Map<string, string[]>();
  for (const p of team.picks) {
    const raw = p.kind === "skater" ? p.nhlTeamAbbrev : p.teamAbbrev;
    const a = raw?.trim().toUpperCase();
    if (!a) continue;
    const arr = labelsByAbbrev.get(a) ?? [];
    arr.push(p.label);
    labelsByAbbrev.set(a, arr);
  }

  const out: ProjectedCollision[] = [];
  for (const s of bracket.series) {
    const top = s.topSeedTeam?.abbrev?.trim().toUpperCase();
    const bot = s.bottomSeedTeam?.abbrev?.trim().toUpperCase();
    if (!top || !bot) continue;
    if (
      statusByAbbrev.get(top) === "eliminated" ||
      statusByAbbrev.get(bot) === "eliminated"
    ) {
      continue;
    }
    const topLabels = labelsByAbbrev.get(top);
    const botLabels = labelsByAbbrev.get(bot);
    if (!topLabels?.length || !botLabels?.length) continue;
    out.push({
      seriesAbbrev: s.seriesAbbrev,
      round: s.playoffRound,
      teamAbbrevs: [top, bot],
      pickLabels: [...topLabels, ...botLabels],
    });
  }
  return out;
}

export type ProjectedFutureCollision = {
  /** "east" | "west" for same-conference pairs; "final" for cross-conference pairs. */
  conference: BracketConferenceBucket;
  /** The two team abbreviations involved. */
  teamAbbrevs: [string, string];
  /** Pick labels from this pool team on both clubs. */
  pickLabels: string[];
  /** Points subtracted from `projectedRemaining` to account for mutual elimination risk. */
  penalty: number;
};

/**
 * Detects pairs of alive picks from the same pool team that will inevitably
 * meet before the Stanley Cup Final (same conference) or at the Final (cross-
 * conference). Excludes pairs already flagged by `detectInSeriesCollisions`.
 * Returns the collision list and the total penalty to deduct from projectedRemaining.
 */
export function detectFutureConferenceCollisions(
  team: PoolTeam,
  perPickEv: ProjectedPickEv[],
  bracket: PlayoffBracketResponse,
  statusByAbbrev: ReadonlyMap<string, NhlTeamPlayoffStatus>,
  advanceProbByAbbrev: ReadonlyMap<string, number>,
  penaltyFactor: number,
): { futureCollisions: ProjectedFutureCollision[]; totalPenalty: number } {
  if (bracket.series.length === 0) {
    return { futureCollisions: [], totalPenalty: 0 };
  }

  const conferenceMap = buildTeamConferenceMap(bracket);

  const currentOpponentPairs = new Set<string>();
  for (const s of bracket.series) {
    const top = s.topSeedTeam?.abbrev?.trim().toUpperCase();
    const bot = s.bottomSeedTeam?.abbrev?.trim().toUpperCase();
    if (!top || !bot) continue;
    if (
      statusByAbbrev.get(top) === "eliminated" ||
      statusByAbbrev.get(bot) === "eliminated"
    ) continue;
    currentOpponentPairs.add(`${top}:${bot}`);
    currentOpponentPairs.add(`${bot}:${top}`);
  }

  const evByAbbrev = new Map<string, number>();
  const labelsByAbbrev = new Map<string, string[]>();
  for (const p of perPickEv) {
    const abbrev = p.teamAbbrev?.trim().toUpperCase();
    if (!abbrev) continue;
    if (statusByAbbrev.get(abbrev) === "eliminated") continue;
    evByAbbrev.set(abbrev, (evByAbbrev.get(abbrev) ?? 0) + p.ev);
    const arr = labelsByAbbrev.get(abbrev) ?? [];
    arr.push(p.label);
    labelsByAbbrev.set(abbrev, arr);
  }

  const aliveAbbrevs = [...evByAbbrev.keys()];
  const futureCollisions: ProjectedFutureCollision[] = [];
  let totalPenalty = 0;

  for (let i = 0; i < aliveAbbrevs.length; i++) {
    for (let j = i + 1; j < aliveAbbrevs.length; j++) {
      const abbrevA = aliveAbbrevs[i];
      const abbrevB = aliveAbbrevs[j];

      const confA = conferenceMap.get(abbrevA);
      const confB = conferenceMap.get(abbrevB);
      if (!confA || !confB) continue;

      if (currentOpponentPairs.has(`${abbrevA}:${abbrevB}`)) continue;

      const evA = evByAbbrev.get(abbrevA) ?? 0;
      const evB = evByAbbrev.get(abbrevB) ?? 0;
      const pA = advanceProbByAbbrev.get(abbrevA) ?? 0.5;
      const pB = advanceProbByAbbrev.get(abbrevB) ?? 0.5;
      const penalty = pA * pB * Math.min(evA, evB) * penaltyFactor;

      if (penalty <= 0) continue;

      futureCollisions.push({
        conference: confA === confB ? confA : "final",
        teamAbbrevs: [abbrevA, abbrevB],
        pickLabels: [
          ...(labelsByAbbrev.get(abbrevA) ?? []),
          ...(labelsByAbbrev.get(abbrevB) ?? []),
        ],
        penalty,
      });
      totalPenalty += penalty;
    }
  }

  return { futureCollisions, totalPenalty };
}

export type PoolTeamProjection = {
  teamId: string;
  totalToDate: number;
  projectedRemaining: number;
  projectedFinal: number;
  perPickEv: ProjectedPickEv[];
  bestPick: {
    round: number;
    label: string;
    teamAbbrev?: string;
    ev: number;
  } | null;
  collisions: ProjectedCollision[];
  futureCollisions: ProjectedFutureCollision[];
};

export function projectPoolTeam(
  team: PoolTeam,
  args: {
    totalToDate: number;
    ppgByPlayerId: ReadonlyMap<number, number>;
    maps: TeamProjectionMaps;
    bracket: PlayoffBracketResponse;
    statusByAbbrev: ReadonlyMap<string, NhlTeamPlayoffStatus>;
    config?: ProjectionConfig;
  },
): PoolTeamProjection {
  const penaltyFactor =
    args.config?.conferencePenaltyFactor ??
    DEFAULT_PROJECTION_CONFIG.conferencePenaltyFactor;

  const perPickEv = team.picks.map((p) =>
    projectPickEv(p, args.ppgByPlayerId, args.maps),
  );
  const rawProjectedRemaining = perPickEv.reduce((s, p) => s + p.ev, 0);

  const collisions = detectInSeriesCollisions(
    team,
    args.bracket,
    args.statusByAbbrev,
  );

  const { futureCollisions, totalPenalty } = detectFutureConferenceCollisions(
    team,
    perPickEv,
    args.bracket,
    args.statusByAbbrev,
    args.maps.advanceProbByAbbrev,
    penaltyFactor,
  );

  const projectedRemaining = rawProjectedRemaining - totalPenalty;
  const projectedFinal = args.totalToDate + projectedRemaining;

  let bestPick: PoolTeamProjection["bestPick"] = null;
  for (const p of perPickEv) {
    if (p.ev <= 0) continue;
    if (!bestPick || p.ev > bestPick.ev) {
      bestPick = {
        round: p.round,
        label: p.label,
        ev: p.ev,
        ...(p.teamAbbrev ? { teamAbbrev: p.teamAbbrev } : {}),
      };
    }
  }

  return {
    teamId: team.id,
    totalToDate: args.totalToDate,
    projectedRemaining,
    projectedFinal,
    perPickEv,
    bestPick,
    collisions,
    futureCollisions,
  };
}
