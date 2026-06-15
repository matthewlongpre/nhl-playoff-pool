import poolBoxSlatesRaw from "@/data/pool-box-slates.json";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { poolSkaterDailyPoints, poolTeamDailyPoints } from "@/lib/db/schema";
import {
  buildPlayoffRoundWindows,
  type PlayoffRoundWindows,
  type RoundStatus,
} from "@/lib/nhl/playoff-round-windows";
import {
  poolBoxSlatesFileSchema,
  type PoolBoxSlatesFile,
} from "@/lib/pool/box-slates-schema";
import {
  computePoolStandingsForDateWithStats,
  type PoolStandingsDayRow,
} from "@/lib/pool/compute-standings-for-date";
import { assignRanks, sortStandingsRows } from "@/lib/pool/leaderboard-rank";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import {
  getPoolPlayoffStartDate,
  poolCalendarToday,
  previousCalendarDay,
} from "@/lib/pool/pool-season";
import type { PoolRostersFile } from "@/lib/pool/roster-schema";

/** Per-pool-team daily totals (skater + team-win pts). */
export type TeamDailyRow = {
  teamId: string;
  date: string;
  skaterPoints: number;
  teamWinPoints: number;
};

/** Per-NHL-skater daily stat line for any skater referenced by a pool roster. */
export type SkaterDailyRow = {
  nhlPlayerId: number;
  date: string;
  goals: number;
  assists: number;
  nhlTeamAbbrev: string | null;
};

export type TeamMeta = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
};

export type Owner = TeamMeta & {
  /** Draft round in which this owner picked the player. */
  pickRound: number;
};

/** Scope key: "all" (whole playoffs) or 1..4 (Stanley Cup round). */
export type ScopeKey = "all" | 1 | 2 | 3 | 4;

export type ScopeStatus = "upcoming" | "active" | "complete";

export type TopPoolTeam = TeamMeta & {
  totalPoints: number;
  skaterPoints: number;
  teamWinPoints: number;
};

export type BiggestDay = TeamMeta & {
  date: string;
  totalPoints: number;
  skaterPoints: number;
  teamWinPoints: number;
};

export type DaysAtTopRow = TeamMeta & { days: number };

export type StreakRow = TeamMeta & {
  days: number;
  fromDate: string;
  toDate: string;
};

export type BiggestMoverDay = TeamMeta & {
  date: string;
  fromRank: number;
  toRank: number;
  jump: number;
};

export type MvpSkater = {
  nhlPlayerId: number;
  label: string;
  nhlTeamAbbrev?: string;
  goals: number;
  assists: number;
  points: number;
  owners: Owner[];
};

export type BestSingleGame = {
  nhlPlayerId: number;
  label: string;
  nhlTeamAbbrev?: string;
  date: string;
  goals: number;
  assists: number;
  points: number;
  owners: Owner[];
};

export type BestPickPerRoundEntry = {
  round: number;
  title: string;
  nhlPlayerId: number;
  label: string;
  nhlTeamAbbrev?: string;
  goals: number;
  assists: number;
  points: number;
  ownerCount: number;
  /** Total skater picks across the pool drafting in this draft round. */
  totalRoundPicks: number;
};

/** Unified per-scope summary — same shape for "all" and each Stanley Cup round. */
export type ScopeSummary = {
  scope: ScopeKey;
  label: string;
  status: ScopeStatus;
  startDate: string | null;
  endDate: string | null;
  daysCovered: number;

  /** Teams tied for the top in-window cumulative total (empty when none). */
  topPoolTeams: TopPoolTeam[];
  /** Teams tied for the most in-window points from team-win picks (empty when none). */
  topTeamWinTeams: TopPoolTeam[];
  /** Teams tied for the best single-day total in scope (empty when none). */
  biggestDays: BiggestDay[];
  mvpSkater: MvpSkater | null;
  bestSingleGame: BestSingleGame | null;
  bestPickPerRound: BestPickPerRoundEntry[];

  /** Teams tied for the most in-scope calendar days spent at cumulative #1. */
  daysAtTop: DaysAtTopRow[];
  leadChanges: number;
  /**
   * Pool teams that held a share of #1 on at least one in-scope day, in order of
   * first appearance (for lead-change storytelling / avatars).
   */
  leadChangeLeaders: TeamMeta[];
  /** Teams tied for the longest uninterrupted run at cumulative #1 within scope. */
  longestRunsAtTop: StreakRow[];
  /** Teams tied for the largest single-day rank improvement between in-scope days. */
  biggestMovers: BiggestMoverDay[];
};

export type PoolReviewPayload = {
  asOfDate: string;
  playoffStart: string;
  /** True when per-skater daily data is available (DB-backed and ingested). */
  poolPlayerStatsAvailable: boolean;
  scopes: ScopeSummary[];
};

export const SCOPE_LABELS: Record<string, string> = {
  all: "All playoffs",
  "1": "First Round",
  "2": "Second Round",
  "3": "Conference Finals",
  "4": "Stanley Cup Final",
};

export function scopeLabel(scope: ScopeKey): string {
  return SCOPE_LABELS[String(scope)] ?? `Round ${scope}`;
}

// --------------------------------------------------------------------------
// Roster index helpers
// --------------------------------------------------------------------------

function teamMetaFromRosters(rosters: PoolRostersFile): Map<string, TeamMeta> {
  const out = new Map<string, TeamMeta>();
  for (const t of rosters.teams) {
    out.set(t.id, {
      teamId: t.id,
      name: t.name,
      ownerName: t.ownerName,
      ...(t.ownerAvatar ? { ownerAvatar: t.ownerAvatar } : {}),
    });
  }
  return out;
}

function ownersByPlayerId(
  rosters: PoolRostersFile,
): Map<number, Owner[]> {
  const out = new Map<number, Owner[]>();
  for (const team of rosters.teams) {
    for (const pick of team.picks) {
      if (pick.kind !== "skater") continue;
      if (pick.nhlPlayerId == null) continue;
      const arr = out.get(pick.nhlPlayerId) ?? [];
      arr.push({
        teamId: team.id,
        name: team.name,
        ownerName: team.ownerName,
        ...(team.ownerAvatar ? { ownerAvatar: team.ownerAvatar } : {}),
        pickRound: pick.round,
      });
      out.set(pick.nhlPlayerId, arr);
    }
  }
  return out;
}

/** Best display label for a player among their pool-roster pick labels. */
function labelByPlayerId(rosters: PoolRostersFile): Map<number, string> {
  const out = new Map<number, string>();
  for (const team of rosters.teams) {
    for (const pick of team.picks) {
      if (pick.kind !== "skater") continue;
      if (pick.nhlPlayerId == null) continue;
      if (!out.has(pick.nhlPlayerId)) out.set(pick.nhlPlayerId, pick.label);
    }
  }
  return out;
}

/** Snapshot NHL team abbrev for a player from rosters (first non-empty wins). */
function teamAbbrevByPlayerId(rosters: PoolRostersFile): Map<number, string> {
  const out = new Map<number, string>();
  for (const team of rosters.teams) {
    for (const pick of team.picks) {
      if (pick.kind !== "skater") continue;
      if (pick.nhlPlayerId == null) continue;
      const a = pick.nhlTeamAbbrev?.trim().toUpperCase();
      if (!a) continue;
      if (!out.has(pick.nhlPlayerId)) out.set(pick.nhlPlayerId, a);
    }
  }
  return out;
}

function loadBoxSlatesSafe(): PoolBoxSlatesFile | null {
  const r = poolBoxSlatesFileSchema.safeParse(poolBoxSlatesRaw);
  return r.success ? r.data : null;
}

// --------------------------------------------------------------------------
// Cumulative replay across the whole playoff window
// --------------------------------------------------------------------------

export type CumulativeDay = {
  date: string;
  cumulativeByTeamId: Map<string, number>;
};

/**
 * For each playoff date with a row, return cumulative totals by team through end of that day.
 * Days without a team's row contribute 0 to that team's running sum.
 */
export function replayCumulativeByDay(
  rows: ReadonlyArray<TeamDailyRow>,
  teamIds: ReadonlyArray<string>,
): CumulativeDay[] {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const byDate = new Map<string, Map<string, number>>();
  for (const d of dates) byDate.set(d, new Map());
  for (const r of rows) {
    byDate.get(r.date)!.set(r.teamId, r.skaterPoints + r.teamWinPoints);
  }

  const cum = new Map<string, number>();
  for (const id of teamIds) cum.set(id, 0);

  const out: CumulativeDay[] = [];
  for (const d of dates) {
    const dayMap = byDate.get(d)!;
    for (const id of teamIds) {
      const today = dayMap.get(id) ?? 0;
      cum.set(id, (cum.get(id) ?? 0) + today);
    }
    out.push({ date: d, cumulativeByTeamId: new Map(cum) });
  }
  return out;
}

// --------------------------------------------------------------------------
// Per-scope tile builders
// --------------------------------------------------------------------------

function buildTopPoolTeams(
  rows: ReadonlyArray<TeamDailyRow>,
  meta: ReadonlyMap<string, TeamMeta>,
): TopPoolTeam[] {
  type Acc = { skaterPoints: number; teamWinPoints: number };
  const acc = new Map<string, Acc>();
  for (const r of rows) {
    const cur = acc.get(r.teamId) ?? { skaterPoints: 0, teamWinPoints: 0 };
    cur.skaterPoints += r.skaterPoints;
    cur.teamWinPoints += r.teamWinPoints;
    acc.set(r.teamId, cur);
  }

  const candidates: TopPoolTeam[] = [];
  for (const [teamId, totals] of acc) {
    const total = totals.skaterPoints + totals.teamWinPoints;
    if (total <= 0) continue;
    const m = meta.get(teamId);
    if (!m) continue;
    candidates.push({
      ...m,
      totalPoints: total,
      skaterPoints: totals.skaterPoints,
      teamWinPoints: totals.teamWinPoints,
    });
  }
  if (candidates.length === 0) return [];
  const maxTotal = Math.max(...candidates.map((c) => c.totalPoints));
  return candidates
    .filter((c) => c.totalPoints === maxTotal)
    .sort((a, b) => a.teamId.localeCompare(b.teamId));
}

function buildTopTeamWinTeams(
  rows: ReadonlyArray<TeamDailyRow>,
  meta: ReadonlyMap<string, TeamMeta>,
): TopPoolTeam[] {
  type Acc = { skaterPoints: number; teamWinPoints: number };
  const acc = new Map<string, Acc>();
  for (const r of rows) {
    const cur = acc.get(r.teamId) ?? { skaterPoints: 0, teamWinPoints: 0 };
    cur.skaterPoints += r.skaterPoints;
    cur.teamWinPoints += r.teamWinPoints;
    acc.set(r.teamId, cur);
  }

  const candidates: TopPoolTeam[] = [];
  for (const [teamId, totals] of acc) {
    if (totals.teamWinPoints <= 0) continue;
    const m = meta.get(teamId);
    if (!m) continue;
    candidates.push({
      ...m,
      totalPoints: totals.skaterPoints + totals.teamWinPoints,
      skaterPoints: totals.skaterPoints,
      teamWinPoints: totals.teamWinPoints,
    });
  }
  if (candidates.length === 0) return [];
  const maxTeamWin = Math.max(...candidates.map((c) => c.teamWinPoints));
  return candidates
    .filter((c) => c.teamWinPoints === maxTeamWin)
    .sort((a, b) => a.teamId.localeCompare(b.teamId));
}

function buildBiggestDays(
  rows: ReadonlyArray<TeamDailyRow>,
  meta: ReadonlyMap<string, TeamMeta>,
): BiggestDay[] {
  let maxTotal = 0;
  for (const r of rows) {
    const total = r.skaterPoints + r.teamWinPoints;
    if (total > maxTotal) maxTotal = total;
  }
  if (maxTotal <= 0) return [];

  /** Per team: canonical best day at the global max (earliest date wins). */
  const byTeam = new Map<string, BiggestDay>();
  for (const r of rows) {
    const total = r.skaterPoints + r.teamWinPoints;
    if (total !== maxTotal) continue;
    const m = meta.get(r.teamId);
    if (!m) continue;
    const candidate: BiggestDay = {
      ...m,
      date: r.date,
      totalPoints: total,
      skaterPoints: r.skaterPoints,
      teamWinPoints: r.teamWinPoints,
    };
    const existing = byTeam.get(r.teamId);
    if (!existing) {
      byTeam.set(r.teamId, candidate);
      continue;
    }
    if (r.date < existing.date) {
      byTeam.set(r.teamId, candidate);
    } else if (r.date === existing.date) {
      if (
        r.skaterPoints > existing.skaterPoints ||
        (r.skaterPoints === existing.skaterPoints &&
          r.teamWinPoints > existing.teamWinPoints)
      ) {
        byTeam.set(r.teamId, candidate);
      }
    }
  }
  return [...byTeam.values()].sort((a, b) => a.teamId.localeCompare(b.teamId));
}

type SkaterTotals = { goals: number; assists: number; points: number };

function aggregateSkaterTotals(
  rows: ReadonlyArray<SkaterDailyRow>,
): Map<number, SkaterTotals> {
  const out = new Map<number, SkaterTotals>();
  for (const r of rows) {
    const cur = out.get(r.nhlPlayerId) ?? { goals: 0, assists: 0, points: 0 };
    cur.goals += r.goals;
    cur.assists += r.assists;
    cur.points = cur.goals + cur.assists;
    out.set(r.nhlPlayerId, cur);
  }
  return out;
}

function buildMvpSkater(
  totals: ReadonlyMap<number, SkaterTotals>,
  rosters: PoolRostersFile,
): MvpSkater | null {
  const owners = ownersByPlayerId(rosters);
  const labels = labelByPlayerId(rosters);
  const teamAbbrevs = teamAbbrevByPlayerId(rosters);

  let best: MvpSkater | null = null;
  for (const [pid, t] of totals) {
    if (t.points <= 0) continue;
    const ownerList = owners.get(pid);
    if (!ownerList || ownerList.length === 0) continue;
    const label = labels.get(pid) ?? `Player #${pid}`;
    const teamAbbrev = teamAbbrevs.get(pid);
    const candidate: MvpSkater = {
      nhlPlayerId: pid,
      label,
      ...(teamAbbrev ? { nhlTeamAbbrev: teamAbbrev } : {}),
      goals: t.goals,
      assists: t.assists,
      points: t.points,
      owners: [...ownerList].sort((a, b) => a.name.localeCompare(b.name)),
    };
    if (
      !best ||
      candidate.points > best.points ||
      (candidate.points === best.points && candidate.goals > best.goals) ||
      (candidate.points === best.points &&
        candidate.goals === best.goals &&
        candidate.label.localeCompare(best.label) < 0)
    ) {
      best = candidate;
    }
  }
  return best;
}

function buildBestSingleGame(
  rows: ReadonlyArray<SkaterDailyRow>,
  rosters: PoolRostersFile,
): BestSingleGame | null {
  const owners = ownersByPlayerId(rosters);
  const labels = labelByPlayerId(rosters);
  const teamAbbrevs = teamAbbrevByPlayerId(rosters);

  let best: BestSingleGame | null = null;
  for (const r of rows) {
    const points = r.goals + r.assists;
    if (points <= 0) continue;
    const ownerList = owners.get(r.nhlPlayerId);
    if (!ownerList || ownerList.length === 0) continue;
    const label = labels.get(r.nhlPlayerId) ?? `Player #${r.nhlPlayerId}`;
    const teamAbbrev =
      r.nhlTeamAbbrev ?? teamAbbrevs.get(r.nhlPlayerId) ?? undefined;
    const candidate: BestSingleGame = {
      nhlPlayerId: r.nhlPlayerId,
      label,
      ...(teamAbbrev ? { nhlTeamAbbrev: teamAbbrev } : {}),
      date: r.date,
      goals: r.goals,
      assists: r.assists,
      points,
      owners: [...ownerList].sort((a, b) => a.name.localeCompare(b.name)),
    };
    if (
      !best ||
      candidate.points > best.points ||
      (candidate.points === best.points && candidate.goals > best.goals) ||
      (candidate.points === best.points &&
        candidate.goals === best.goals &&
        candidate.date < best.date) ||
      (candidate.points === best.points &&
        candidate.goals === best.goals &&
        candidate.date === best.date &&
        candidate.label.localeCompare(best.label) < 0)
    ) {
      best = candidate;
    }
  }
  return best;
}

function buildBestPickPerRound(
  totals: ReadonlyMap<number, SkaterTotals>,
  rosters: PoolRostersFile,
): BestPickPerRoundEntry[] {
  const slates = loadBoxSlatesSafe();
  const titleByRound = new Map<number, string>();
  if (slates) {
    for (const r of slates.rounds) titleByRound.set(r.round, r.title);
  }

  /** draft-round -> playerId -> pickerCount */
  const roundPicks = new Map<number, Map<number, number>>();
  /** draft-round -> total skater roster picks */
  const roundTotalPicks = new Map<number, number>();

  for (const team of rosters.teams) {
    for (const pick of team.picks) {
      if (pick.kind !== "skater") continue;
      roundTotalPicks.set(pick.round, (roundTotalPicks.get(pick.round) ?? 0) + 1);
      if (pick.nhlPlayerId == null) continue;
      const m = roundPicks.get(pick.round) ?? new Map<number, number>();
      m.set(pick.nhlPlayerId, (m.get(pick.nhlPlayerId) ?? 0) + 1);
      roundPicks.set(pick.round, m);
    }
  }

  const labels = labelByPlayerId(rosters);
  const teamAbbrevs = teamAbbrevByPlayerId(rosters);

  const out: BestPickPerRoundEntry[] = [];
  for (const [round, perPlayer] of roundPicks) {
    let best: BestPickPerRoundEntry | null = null;
    for (const [pid, ownerCount] of perPlayer) {
      const t = totals.get(pid) ?? { goals: 0, assists: 0, points: 0 };
      const label = labels.get(pid) ?? `Player #${pid}`;
      const teamAbbrev = teamAbbrevs.get(pid);
      const candidate: BestPickPerRoundEntry = {
        round,
        title: titleByRound.get(round) ?? `Round ${round}`,
        nhlPlayerId: pid,
        label,
        ...(teamAbbrev ? { nhlTeamAbbrev: teamAbbrev } : {}),
        goals: t.goals,
        assists: t.assists,
        points: t.points,
        ownerCount,
        totalRoundPicks: roundTotalPicks.get(round) ?? 0,
      };
      if (
        !best ||
        candidate.points > best.points ||
        (candidate.points === best.points && candidate.ownerCount > best.ownerCount) ||
        (candidate.points === best.points &&
          candidate.ownerCount === best.ownerCount &&
          candidate.label.localeCompare(best.label) < 0)
      ) {
        best = candidate;
      }
    }
    if (best) out.push(best);
  }
  out.sort((a, b) => a.round - b.round);
  return out;
}

/** Set of teamIds tied for the cumulative lead on this day. */
function topTeamIdsForDay(cumByTeam: ReadonlyMap<string, number>): Set<string> {
  let max = -Infinity;
  for (const v of cumByTeam.values()) if (v > max) max = v;
  const out = new Set<string>();
  if (max <= 0) return out;
  for (const [id, v] of cumByTeam) if (v === max) out.add(id);
  return out;
}

function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function buildDaysAtTop(
  cumDays: ReadonlyArray<CumulativeDay>,
  dateSet: ReadonlySet<string>,
  meta: ReadonlyMap<string, TeamMeta>,
): DaysAtTopRow[] {
  const counts = new Map<string, number>();
  for (const day of cumDays) {
    if (!dateSet.has(day.date)) continue;
    const top = topTeamIdsForDay(day.cumulativeByTeamId);
    for (const id of top) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const candidates: DaysAtTopRow[] = [];
  for (const [id, days] of counts) {
    if (days <= 0) continue;
    const m = meta.get(id);
    if (!m) continue;
    candidates.push({ ...m, days });
  }
  if (candidates.length === 0) return [];
  const maxDays = Math.max(...candidates.map((c) => c.days));
  return candidates
    .filter((c) => c.days === maxDays)
    .sort((a, b) => a.teamId.localeCompare(b.teamId));
}

function buildLeadChanges(
  cumDays: ReadonlyArray<CumulativeDay>,
  dateSet: ReadonlySet<string>,
): number {
  let changes = 0;
  let prev: Set<string> | null = null;
  for (const day of cumDays) {
    if (!dateSet.has(day.date)) continue;
    const top = topTeamIdsForDay(day.cumulativeByTeamId);
    if (top.size === 0) {
      prev = null;
      continue;
    }
    if (prev != null && !setsEqual(prev, top)) changes += 1;
    prev = top;
  }
  return changes;
}

function buildLeadChangeLeaders(
  cumDays: ReadonlyArray<CumulativeDay>,
  dateSet: ReadonlySet<string>,
  meta: ReadonlyMap<string, TeamMeta>,
): TeamMeta[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const day of cumDays) {
    if (!dateSet.has(day.date)) continue;
    const top = topTeamIdsForDay(day.cumulativeByTeamId);
    if (top.size === 0) continue;
    const ids = [...top].sort((a, b) => a.localeCompare(b));
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    }
  }
  const out: TeamMeta[] = [];
  for (const id of order) {
    const m = meta.get(id);
    if (m) out.push(m);
  }
  return out;
}

function buildLongestRunsAtTop(
  cumDays: ReadonlyArray<CumulativeDay>,
  dateSet: ReadonlySet<string>,
  meta: ReadonlyMap<string, TeamMeta>,
): StreakRow[] {
  type Run = { teamId: string; days: number; fromDate: string; toDate: string };
  const active = new Map<string, Run>();
  const completed: Run[] = [];
  /** Walk only in-scope days; gaps don't break a run, but a non-top in-scope day does. */
  for (const day of cumDays) {
    if (!dateSet.has(day.date)) continue;
    const top = topTeamIdsForDay(day.cumulativeByTeamId);
    for (const id of top) {
      const cur = active.get(id);
      if (cur) {
        cur.days += 1;
        cur.toDate = day.date;
      } else {
        active.set(id, { teamId: id, days: 1, fromDate: day.date, toDate: day.date });
      }
    }
    for (const [id, run] of active) {
      if (!top.has(id)) {
        completed.push(run);
        active.delete(id);
      }
    }
  }
  for (const run of active.values()) completed.push(run);

  if (completed.length === 0) return [];
  const maxDays = Math.max(...completed.map((r) => r.days));
  if (maxDays <= 0) return [];
  const atMax = completed.filter((r) => r.days === maxDays);
  /** One display row per team: prefer earliest spanning window. */
  const byTeam = new Map<string, Run>();
  for (const run of atMax.sort((a, b) => a.teamId.localeCompare(b.teamId))) {
    const prev = byTeam.get(run.teamId);
    if (!prev) {
      byTeam.set(run.teamId, run);
      continue;
    }
    if (
      run.fromDate < prev.fromDate ||
      (run.fromDate === prev.fromDate && run.toDate < prev.toDate)
    ) {
      byTeam.set(run.teamId, run);
    }
  }
  const out: StreakRow[] = [];
  for (const run of [...byTeam.values()].sort((a, b) =>
    a.teamId.localeCompare(b.teamId),
  )) {
    const m = meta.get(run.teamId);
    if (!m) continue;
    out.push({
      ...m,
      days: run.days,
      fromDate: run.fromDate,
      toDate: run.toDate,
    });
  }
  return out;
}

function buildBiggestMovers(
  cumDays: ReadonlyArray<CumulativeDay>,
  dateSet: ReadonlySet<string>,
  meta: ReadonlyMap<string, TeamMeta>,
): BiggestMoverDay[] {
  const candidates: BiggestMoverDay[] = [];
  let prevRanks: Map<string, number> | null = null;
  let prevInScope = false;

  for (const day of cumDays) {
    const sortedRows = sortStandingsRows(
      [...day.cumulativeByTeamId.entries()].map(([teamId, totalPoints]) => ({
        teamId,
        name: meta.get(teamId)?.name ?? teamId,
        ownerName: meta.get(teamId)?.ownerName ?? "",
        totalPoints,
        skaterPoints: 0,
        teamWinPoints: 0,
      })),
    );
    const ranks = assignRanks(sortedRows);
    const inScope = dateSet.has(day.date);

    if (prevRanks != null && inScope && prevInScope) {
      for (const [id, currRank] of ranks) {
        const prevRank = prevRanks.get(id);
        if (prevRank == null) continue;
        const jump = prevRank - currRank;
        if (jump <= 0) continue;
        const m = meta.get(id);
        if (!m) continue;
        candidates.push({
          ...m,
          date: day.date,
          fromRank: prevRank,
          toRank: currRank,
          jump,
        });
      }
    }
    prevRanks = ranks;
    prevInScope = inScope;
  }
  if (candidates.length === 0) return [];
  const maxJump = Math.max(...candidates.map((c) => c.jump));
  const atMax = candidates.filter((c) => c.jump === maxJump);
  /** One row per team (earliest qualifying day wins). */
  const byTeam = new Map<string, BiggestMoverDay>();
  for (const c of atMax.sort((a, b) => a.teamId.localeCompare(b.teamId))) {
    const ex = byTeam.get(c.teamId);
    if (!ex || c.date < ex.date) byTeam.set(c.teamId, c);
  }
  return [...byTeam.values()].sort((a, b) => a.teamId.localeCompare(b.teamId));
}

// --------------------------------------------------------------------------
// Scope composition
// --------------------------------------------------------------------------

function statusForAll(
  windows: PlayoffRoundWindows,
  anyDates: boolean,
): ScopeStatus {
  const rounds = [1, 2, 3, 4].map((n) => windows.roundsByNumber.get(n));
  if (!anyDates) return "upcoming";
  if (rounds.length > 0 && rounds.every((r) => r && r.status === "complete")) {
    return "complete";
  }
  return "active";
}

type ComposeScopeArgs = {
  scope: ScopeKey;
  label: string;
  status: ScopeStatus;
  startDate: string | null;
  endDate: string | null;
  dateSet: Set<string>;
  teamRows: ReadonlyArray<TeamDailyRow>;
  skaterRows: ReadonlyArray<SkaterDailyRow>;
  rosters: PoolRostersFile;
  meta: ReadonlyMap<string, TeamMeta>;
  cumDays: ReadonlyArray<CumulativeDay>;
  poolPlayerStatsAvailable: boolean;
};

function composeScope(args: ComposeScopeArgs): ScopeSummary {
  const teamRowsInScope = args.teamRows.filter((r) => args.dateSet.has(r.date));
  const skaterRowsInScope = args.skaterRows.filter((r) => args.dateSet.has(r.date));
  const totalsInScope = aggregateSkaterTotals(skaterRowsInScope);

  return {
    scope: args.scope,
    label: args.label,
    status: args.status,
    startDate: args.startDate,
    endDate: args.endDate,
    daysCovered: args.dateSet.size,
    topPoolTeams: buildTopPoolTeams(teamRowsInScope, args.meta),
    topTeamWinTeams: buildTopTeamWinTeams(teamRowsInScope, args.meta),
    biggestDays: buildBiggestDays(teamRowsInScope, args.meta),
    mvpSkater: args.poolPlayerStatsAvailable
      ? buildMvpSkater(totalsInScope, args.rosters)
      : null,
    bestSingleGame: args.poolPlayerStatsAvailable
      ? buildBestSingleGame(skaterRowsInScope, args.rosters)
      : null,
    bestPickPerRound: args.poolPlayerStatsAvailable
      ? buildBestPickPerRound(totalsInScope, args.rosters)
      : [],
    daysAtTop: buildDaysAtTop(args.cumDays, args.dateSet, args.meta),
    leadChanges: buildLeadChanges(args.cumDays, args.dateSet),
    leadChangeLeaders: buildLeadChangeLeaders(
      args.cumDays,
      args.dateSet,
      args.meta,
    ),
    longestRunsAtTop: buildLongestRunsAtTop(args.cumDays, args.dateSet, args.meta),
    biggestMovers: buildBiggestMovers(args.cumDays, args.dateSet, args.meta),
  };
}

/**
 * Pure: compose the unified pool review payload from already-loaded daily data and round windows.
 * Produces 5 scopes in order: [all, R1, R2, R3, R4].
 */
export function composePoolReview(args: {
  rosters: PoolRostersFile;
  teamRows: ReadonlyArray<TeamDailyRow>;
  skaterRows: ReadonlyArray<SkaterDailyRow>;
  windows: PlayoffRoundWindows;
  asOfDate: string;
  playoffStart: string;
  poolPlayerStatsAvailable: boolean;
}): PoolReviewPayload {
  const meta = teamMetaFromRosters(args.rosters);
  const teamIds = [...meta.keys()];
  /** Cumulative state across the whole playoff window — windowed metrics use snapshots from this. */
  const cumDays = replayCumulativeByDay(args.teamRows, teamIds);

  /** "All" date set: every date that has either a teamRow or appears in the round windows. */
  const allDateSet = new Set<string>();
  for (const d of args.windows.dateToDominantRound.keys()) allDateSet.add(d);
  for (const r of args.teamRows) allDateSet.add(r.date);
  const allDatesSorted = [...allDateSet].sort();

  const allScope = composeScope({
    scope: "all",
    label: scopeLabel("all"),
    status: statusForAll(args.windows, allDateSet.size > 0),
    startDate: allDatesSorted[0] ?? null,
    endDate: allDatesSorted[allDatesSorted.length - 1] ?? null,
    dateSet: allDateSet,
    teamRows: args.teamRows,
    skaterRows: args.skaterRows,
    rosters: args.rosters,
    meta,
    cumDays,
    poolPlayerStatsAvailable: args.poolPlayerStatsAvailable,
  });

  const roundScopes: ScopeSummary[] = [];
  for (const round of [1, 2, 3, 4] as const) {
    const window = args.windows.roundsByNumber.get(round) ?? {
      round,
      status: "upcoming" as RoundStatus,
      startDate: null,
      endDate: null,
      dates: [],
    };
    const dateSet = new Set<string>(window.dates);
    roundScopes.push(
      composeScope({
        scope: round,
        label: scopeLabel(round),
        status: window.status,
        startDate: window.startDate,
        endDate: window.endDate,
        dateSet,
        teamRows: args.teamRows,
        skaterRows: args.skaterRows,
        rosters: args.rosters,
        meta,
        cumDays,
        poolPlayerStatsAvailable: args.poolPlayerStatsAvailable,
      }),
    );
  }

  return {
    asOfDate: args.asOfDate,
    playoffStart: args.playoffStart,
    poolPlayerStatsAvailable: args.poolPlayerStatsAvailable,
    scopes: [allScope, ...roundScopes],
  };
}

// --------------------------------------------------------------------------
// I/O wrapper
// --------------------------------------------------------------------------

/**
 * Load persisted daily rows (and merge today's live results) plus the playoff round windows,
 * then compose the unified pool review payload.
 *
 * Without a DB: returns a single-day fallback shape (player-level tiles suppressed).
 */
export async function buildPoolReview(
  asOfDate: string,
): Promise<PoolReviewPayload> {
  const rosters = loadPoolRosters();
  const playoffStart = getPoolPlayoffStartDate();
  const today = poolCalendarToday();
  const effectiveEnd = asOfDate > today ? today : asOfDate;
  const db = getDb();

  if (effectiveEnd < playoffStart) {
    return composePoolReview({
      rosters,
      teamRows: [],
      skaterRows: [],
      windows: { dateToDominantRound: new Map(), roundsByNumber: new Map() },
      asOfDate,
      playoffStart,
      poolPlayerStatsAvailable: Boolean(db),
    });
  }

  const windows = await buildPlayoffRoundWindows(playoffStart, effectiveEnd, db);

  if (!db) {
    /** Live-today only; player-level tiles suppressed because we have no historical skater data. */
    const live = await computePoolStandingsForDateWithStats(rosters, effectiveEnd);
    const teamRows: TeamDailyRow[] = live.rows.map((r) => ({
      teamId: r.teamId,
      date: effectiveEnd,
      skaterPoints: r.skaterPoints,
      teamWinPoints: r.teamWinPoints,
    }));
    return composePoolReview({
      rosters,
      teamRows,
      skaterRows: [],
      windows,
      asOfDate,
      playoffStart,
      poolPlayerStatsAvailable: false,
    });
  }

  const isToday = effectiveEnd === today;
  /**
   * When `effectiveEnd` is today we always merge live for today, so we EXCLUDE today from
   * the DB query — same approach `aggregateCumulativeThroughDate` takes for the standings,
   * which keeps these two views agreeing to the dollar.
   */
  const teamDateRange = isToday
    ? sql`(${poolTeamDailyPoints.date} >= ${playoffStart} AND ${poolTeamDailyPoints.date} < ${effectiveEnd})`
    : sql`(${poolTeamDailyPoints.date} >= ${playoffStart} AND ${poolTeamDailyPoints.date} <= ${effectiveEnd})`;
  const skaterDateRange = isToday
    ? sql`(${poolSkaterDailyPoints.date} >= ${playoffStart} AND ${poolSkaterDailyPoints.date} < ${effectiveEnd})`
    : sql`(${poolSkaterDailyPoints.date} >= ${playoffStart} AND ${poolSkaterDailyPoints.date} <= ${effectiveEnd})`;

  const teamRowsDb = await db
    .select({
      teamId: poolTeamDailyPoints.teamId,
      date: poolTeamDailyPoints.date,
      sk: poolTeamDailyPoints.skaterPoints,
      tw: poolTeamDailyPoints.teamWinPoints,
    })
    .from(poolTeamDailyPoints)
    .where(teamDateRange);

  const skaterRowsDb = await db
    .select({
      nhlPlayerId: poolSkaterDailyPoints.nhlPlayerId,
      date: poolSkaterDailyPoints.date,
      goals: poolSkaterDailyPoints.goals,
      assists: poolSkaterDailyPoints.assists,
      nhlTeamAbbrev: poolSkaterDailyPoints.nhlTeamAbbrev,
    })
    .from(poolSkaterDailyPoints)
    .where(skaterDateRange);

  const teamRows: TeamDailyRow[] = teamRowsDb.map((r) => ({
    teamId: r.teamId,
    date: r.date,
    skaterPoints: r.sk,
    teamWinPoints: r.tw,
  }));
  const skaterRows: SkaterDailyRow[] = skaterRowsDb.map((r) => ({
    nhlPlayerId: r.nhlPlayerId,
    date: r.date,
    goals: r.goals,
    assists: r.assists,
    nhlTeamAbbrev: r.nhlTeamAbbrev,
  }));

  const teamAbbrevByPid = teamAbbrevByPlayerId(rosters);
  const appendLive = (
    date: string,
    live: {
      rows: PoolStandingsDayRow[];
      skaterStats: Map<number, { goals: number; assists: number }>;
    },
  ): void => {
    for (const r of live.rows) {
      teamRows.push({
        teamId: r.teamId,
        date,
        skaterPoints: r.skaterPoints,
        teamWinPoints: r.teamWinPoints,
      });
    }
    for (const [pid, stat] of live.skaterStats) {
      if (stat.goals === 0 && stat.assists === 0) continue;
      skaterRows.push({
        nhlPlayerId: pid,
        date,
        goals: stat.goals,
        assists: stat.assists,
        nhlTeamAbbrev: teamAbbrevByPid.get(pid) ?? null,
      });
    }
  };

  if (isToday) {
    /** Always merge live for today — matches `aggregateCumulativeThroughDate`. */
    const liveToday = await computePoolStandingsForDateWithStats(rosters, today);
    appendLive(today, liveToday);

    /** Cron-gap fill: if yesterday's nightly ingest hasn't run yet, pull live for it. */
    const prior = previousCalendarDay(today);
    if (prior >= playoffStart && (await teamDailyIngestAbsent(db, prior))) {
      const livePrior = await computePoolStandingsForDateWithStats(rosters, prior);
      appendLive(prior, livePrior);
    }
  } else if (await teamDailyIngestAbsent(db, effectiveEnd)) {
    /** Backfill `effectiveEnd` itself if its ingest is missing (mirrors standings). */
    const liveEnd = await computePoolStandingsForDateWithStats(rosters, effectiveEnd);
    appendLive(effectiveEnd, liveEnd);
  }

  return composePoolReview({
    rosters,
    teamRows,
    skaterRows,
    windows,
    asOfDate,
    playoffStart,
    poolPlayerStatsAvailable: true,
  });
}

/** True when `pool_team_daily_points` has no rows yet for `day` (cron gap signal). */
async function teamDailyIngestAbsent(
  db: NonNullable<ReturnType<typeof getDb>>,
  day: string,
): Promise<boolean> {
  const r = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(poolTeamDailyPoints)
    .where(eq(poolTeamDailyPoints.date, day));
  return (r[0]?.c ?? 0) === 0;
}
