import { and, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { poolSkaterDailyPoints } from "@/lib/db/schema";
import {
  fetchNhlPlayerSeasonRates,
  type NhlPlayerSeasonRates,
} from "@/lib/nhl/player-landing";
import { getCachedPlayoffBracket } from "@/lib/nhl/cached-playoff-bracket";
import { getCachedPlayoffTeamStatusByDate } from "@/lib/nhl/cached-playoff-team-status";
import { playoffSeasonFromDate } from "@/lib/nhl/playoff-status";
import type {
  NhlTeamPlayoffStatus,
  PlayoffBracketResponse,
} from "@/lib/nhl/schemas";
import { getCachedLeaderboardResponse } from "@/lib/pool/cached-pool-queries";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import {
  getPoolPlayoffStartDate,
  poolCalendarToday,
} from "@/lib/pool/pool-season";
import {
  blendedPpg,
  buildTeamProjectionMaps,
  DEFAULT_PROJECTION_CONFIG,
  projectPoolTeam,
  type PoolTeamProjection,
} from "@/lib/pool/projection";
import {
  buildRemainingPicksByTeamId,
  type TeamWinPickStatus,
} from "@/lib/pool/remaining-picks-by-team";
import type { PoolRostersFile, PoolTeam } from "@/lib/pool/roster-schema";

export type ProjectionRowOut = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
  rank: number;
  totalToDate: number;
  projectedRemaining: number;
  projectedFinal: number;
  bestPick: PoolTeamProjection["bestPick"];
  collisions: PoolTeamProjection["collisions"];
  remainingSkaters: number;
  totalSkaters: number;
  remainingTeams: number;
  totalTeams: number;
  teamWinPicks: TeamWinPickStatus[];
};

export type ProjectionResponsePayload = {
  asOfDate: string;
  rows: ProjectionRowOut[];
  meta: {
    perGameProbModel: "baseline-v1";
    baselineP: number;
    ppgPriorWeight: number;
    bracketAvailable: boolean;
    playoffSampleJoined: boolean;
  };
};

function poolSkaterNhlPlayerIds(teams: ReadonlyArray<PoolTeam>): number[] {
  const ids = new Set<number>();
  for (const team of teams) {
    for (const pick of team.picks) {
      if (pick.kind !== "skater") continue;
      if (pick.nhlPlayerId == null) continue;
      ids.add(pick.nhlPlayerId);
    }
  }
  return [...ids];
}

async function aggregatePlayoffSkaterStats(
  startDate: string,
  asOfDate: string,
): Promise<{
  joined: boolean;
  byPlayerId: Map<number, { gp: number; pts: number }>;
}> {
  const db = getDb();
  if (!db) return { joined: false, byPlayerId: new Map() };
  try {
    const rows = await db
      .select({
        nhlPlayerId: poolSkaterDailyPoints.nhlPlayerId,
        gp: sql<number>`count(*)::int`,
        pts: sql<number>`sum(${poolSkaterDailyPoints.goals} + ${poolSkaterDailyPoints.assists})::int`,
      })
      .from(poolSkaterDailyPoints)
      .where(
        and(
          gte(poolSkaterDailyPoints.date, startDate),
          lte(poolSkaterDailyPoints.date, asOfDate),
        ),
      )
      .groupBy(poolSkaterDailyPoints.nhlPlayerId);
    const byPlayerId = new Map<number, { gp: number; pts: number }>();
    for (const r of rows) {
      const gp = Number(r.gp ?? 0);
      const pts = Number(r.pts ?? 0);
      byPlayerId.set(r.nhlPlayerId, { gp, pts });
    }
    return { joined: true, byPlayerId };
  } catch {
    return { joined: false, byPlayerId: new Map() };
  }
}

function buildPpgByPlayerId(args: {
  rosters: PoolRostersFile;
  seasonRates: ReadonlyMap<number, NhlPlayerSeasonRates>;
  playoffStats: ReadonlyMap<number, { gp: number; pts: number }>;
  priorWeight: number;
}): Map<number, number> {
  const ppg = new Map<number, number>();
  for (const team of args.rosters.teams) {
    for (const pick of team.picks) {
      if (pick.kind !== "skater") continue;
      const id = pick.nhlPlayerId;
      if (id == null) continue;
      if (ppg.has(id)) continue;
      const rates = args.seasonRates.get(id);
      const playoff = args.playoffStats.get(id);
      ppg.set(
        id,
        blendedPpg({
          rsGp: rates?.rsGp ?? 0,
          rsPts: rates?.rsPts ?? 0,
          playoffGp: playoff?.gp ?? 0,
          playoffPts: playoff?.pts ?? 0,
          careerPlayoffGp: rates?.careerPlayoffGp ?? 0,
          careerPlayoffPts: rates?.careerPlayoffPts ?? 0,
          priorWeight: args.priorWeight,
        }),
      );
    }
  }
  return ppg;
}

/** Shared by `/api/pool/projection` and nightly ingest snapshot materialization. */
export async function buildProjectionPayload(
  date: string,
): Promise<ProjectionResponsePayload> {
  const today = poolCalendarToday();
  const playoffStart = getPoolPlayoffStartDate();
  const aggregateThrough = date < today ? date : today;

  const baselineP = DEFAULT_PROJECTION_CONFIG.baselineP;
  const priorWeight = DEFAULT_PROJECTION_CONFIG.ppgPriorWeight;

  const rosters = loadPoolRosters();
  const playerIds = poolSkaterNhlPlayerIds(rosters.teams);

  const leaderboardPromise = getCachedLeaderboardResponse(date);

  let bracket: PlayoffBracketResponse | null = null;
  let statusByAbbrev: Map<string, NhlTeamPlayoffStatus> = new Map();
  let bracketAvailable = false;
  try {
    const [b, s] = await Promise.all([
      getCachedPlayoffBracket(playoffSeasonFromDate(date)),
      getCachedPlayoffTeamStatusByDate(date),
    ]);
    bracket = b;
    statusByAbbrev = s;
    bracketAvailable = true;
  } catch {
    bracket = null;
    statusByAbbrev = new Map();
    bracketAvailable = false;
  }

  const [seasonRates, playoffAgg, leaderboard] = await Promise.all([
    fetchNhlPlayerSeasonRates(playerIds),
    aggregatePlayoffSkaterStats(playoffStart, aggregateThrough),
    leaderboardPromise,
  ]);

  const ppgByPlayerId = buildPpgByPlayerId({
    rosters,
    seasonRates,
    playoffStats: playoffAgg.byPlayerId,
    priorWeight,
  });

  const maps = bracket
    ? buildTeamProjectionMaps(bracket, statusByAbbrev)
    : { expectedGamesByAbbrev: new Map(), expectedWinsByAbbrev: new Map() };

  const remainingByTeamId = buildRemainingPicksByTeamId(rosters, statusByAbbrev);

  const totalToDateByTeamId = new Map<string, number>();
  const standingsRowByTeamId = new Map<
    string,
    (typeof leaderboard.standings)[number]
  >();
  for (const r of leaderboard.standings) {
    totalToDateByTeamId.set(r.teamId, r.totalPoints);
    standingsRowByTeamId.set(r.teamId, r);
  }

  const projections = rosters.teams.map((team) =>
    projectPoolTeam(team, {
      totalToDate: totalToDateByTeamId.get(team.id) ?? 0,
      ppgByPlayerId,
      maps,
      bracket: bracket ?? { series: [] },
      statusByAbbrev,
    }),
  );

  const sortedProjections = [...projections].sort((a, b) => {
    if (b.projectedFinal !== a.projectedFinal) {
      return b.projectedFinal - a.projectedFinal;
    }
    if (b.totalToDate !== a.totalToDate) {
      return b.totalToDate - a.totalToDate;
    }
    return a.teamId.localeCompare(b.teamId);
  });

  const rows: ProjectionRowOut[] = sortedProjections.map((p, i) => {
    const team = rosters.teams.find((t) => t.id === p.teamId);
    const standingsRow = standingsRowByTeamId.get(p.teamId);
    const remaining = remainingByTeamId.get(p.teamId);
    return {
      teamId: p.teamId,
      name: team?.name ?? p.teamId,
      ownerName: team?.ownerName ?? "",
      ...(standingsRow?.ownerAvatar
        ? { ownerAvatar: standingsRow.ownerAvatar }
        : team?.ownerAvatar
          ? { ownerAvatar: team.ownerAvatar }
          : {}),
      rank: i + 1,
      totalToDate: p.totalToDate,
      projectedRemaining: p.projectedRemaining,
      projectedFinal: p.projectedFinal,
      bestPick: p.bestPick,
      collisions: p.collisions,
      remainingSkaters: remaining?.remainingSkaters ?? 0,
      totalSkaters: remaining?.totalSkaters ?? 0,
      remainingTeams: remaining?.remainingTeams ?? 0,
      totalTeams: remaining?.totalTeams ?? 0,
      teamWinPicks: remaining?.teamWinPicks ?? [],
    };
  });

  return {
    asOfDate: leaderboard.asOfDate,
    rows,
    meta: {
      perGameProbModel: "baseline-v1",
      baselineP,
      ppgPriorWeight: priorWeight,
      bracketAvailable,
      playoffSampleJoined: playoffAgg.joined,
    },
  };
}
