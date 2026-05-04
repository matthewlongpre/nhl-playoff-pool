import { and, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { poolSkaterDailyPoints } from "@/lib/db/schema";
import {
  fetchNhlPlayerSeasonRates,
  type NhlPlayerSeasonRates,
} from "@/lib/nhl/player-landing";
import {
  fetchPlayoffTeamStatusByDate,
  playoffSeasonFromDate,
} from "@/lib/nhl/playoff-status";
import type {
  NhlTeamPlayoffStatus,
  PlayoffBracketResponse,
} from "@/lib/nhl/schemas";
import { fetchNhlPlayoffBracket } from "@/lib/nhl/upstream";
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
import { resolvePoolDateQueryParam } from "@/lib/pool/resolve-pool-date-query";
import type { PoolRostersFile, PoolTeam } from "@/lib/pool/roster-schema";
import { publicMessageForStandingsFailure } from "@/lib/pool/standings-api-error";

/** Bracket walk + DB aggregate is fast; matches `/api/pool/team/[teamId]`. */
export const maxDuration = 60;

/** Small Cache-Control: bracket and PPG are slow-moving but standings drift live. */
const PROJECTION_CACHE_CONTROL =
  "public, s-maxage=30, stale-while-revalidate=300";

type RowOut = {
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
  /**
   * Alive vs. total roster slots — drives the "Roster outlook" view's pick-survival bar
   * and powers `/outlook`. Identical to the values used by `PoolScoringRunway`.
   */
  remainingSkaters: number;
  totalSkaters: number;
  remainingTeams: number;
  totalTeams: number;
  teamWinPicks: TeamWinPickStatus[];
};

type ProjectionResponse = {
  asOfDate: string;
  rows: RowOut[];
  meta: {
    perGameProbModel: "baseline-v1";
    baselineP: number;
    ppgPriorWeight: number;
    /** True when the bracket and team-status calls all succeeded. */
    bracketAvailable: boolean;
    /** True when the DB is reachable and current-playoff PPG was joined in. */
    playoffSampleJoined: boolean;
  };
};

function poolSkaterNhlPlayerIds(
  teams: ReadonlyArray<PoolTeam>,
): number[] {
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

/**
 * Sum goals + assists per skater from `pool_skater_daily_points` over the playoff window.
 * Empty result (no DB / no rows / errors) returns an empty map — `blendedPpg` falls back
 * to regular-season prior in that case.
 */
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
    /** Missing tables / Neon outage: degrade to prior-only PPG. */
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resolved = resolvePoolDateQueryParam(searchParams.get("date"));
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 400 });
  }
  const date = resolved.date;
  const today = poolCalendarToday();
  const playoffStart = getPoolPlayoffStartDate();
  /** Clamp the DB window to playoff dates that have actually elapsed. */
  const aggregateThrough = date < today ? date : today;

  const baselineP = DEFAULT_PROJECTION_CONFIG.baselineP;
  const priorWeight = DEFAULT_PROJECTION_CONFIG.ppgPriorWeight;

  try {
    const rosters = loadPoolRosters();
    const playerIds = poolSkaterNhlPlayerIds(rosters.teams);

    /** Standings (totalToDate per pool team) is the single most expensive call here. */
    const leaderboardPromise = getCachedLeaderboardResponse(date);

    let bracket: PlayoffBracketResponse | null = null;
    let statusByAbbrev: Map<string, NhlTeamPlayoffStatus> = new Map();
    let bracketAvailable = false;
    try {
      const [b, s] = await Promise.all([
        fetchNhlPlayoffBracket(playoffSeasonFromDate(date)),
        fetchPlayoffTeamStatusByDate(date),
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

    /** Without a bracket, every team's expected games/wins is 0 — projections collapse to totalToDate. */
    const maps = bracket
      ? buildTeamProjectionMaps(bracket, statusByAbbrev)
      : { expectedGamesByAbbrev: new Map(), expectedWinsByAbbrev: new Map() };

    /**
     * Pick-survival counts mirror `PoolScoringRunway`. Without a bracket every NHL club
     * is treated as still active (status map is empty), so all picks count as alive — the
     * UI degrades gracefully to "no eliminations yet".
     */
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

    /** Rank for display — ties broken by projectedFinal desc, then totalToDate desc, then name. */
    const sortedProjections = [...projections].sort((a, b) => {
      if (b.projectedFinal !== a.projectedFinal) {
        return b.projectedFinal - a.projectedFinal;
      }
      if (b.totalToDate !== a.totalToDate) {
        return b.totalToDate - a.totalToDate;
      }
      return a.teamId.localeCompare(b.teamId);
    });

    const rows: RowOut[] = sortedProjections.map((p, i) => {
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

    const payload: ProjectionResponse = {
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

    return NextResponse.json(payload, {
      headers: { "Cache-Control": PROJECTION_CACHE_CONTROL },
    });
  } catch (e) {
    console.error("[pool/projection]", e);
    const message = publicMessageForStandingsFailure(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
