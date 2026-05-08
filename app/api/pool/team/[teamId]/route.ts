import { and, gte, inArray, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { poolSkaterDailyPoints } from "@/lib/db/schema";
import { computePoolStandingsDetailedForDate } from "@/lib/pool/compute-standings-for-date";
import { getCachedLeaderboardResponse } from "@/lib/pool/cached-pool-queries";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import { computeCumulativeTeamBreakdownThroughDate } from "@/lib/pool/team-cumulative-breakdown";
import type { TeamScoreBreakdown } from "@/lib/pool/scoring";
import { getCachedPlayoffBracket } from "@/lib/nhl/cached-playoff-bracket";
import { getCachedPlayoffTeamStatusByDate } from "@/lib/nhl/cached-playoff-team-status";
import {
  playoffSeasonFromDate,
  teamStatusMapToRecord,
} from "@/lib/nhl/playoff-status";
import { fetchNhlPlayerSeasonRates } from "@/lib/nhl/player-landing";
import type {
  NhlTeamPlayoffStatus,
  PlayoffBracketResponse,
} from "@/lib/nhl/schemas";
import {
  blendedPpg,
  buildTeamProjectionMaps,
  DEFAULT_PROJECTION_CONFIG,
  projectPoolTeam,
  type PoolTeamProjection,
} from "@/lib/pool/projection";
import {
  getPoolPlayoffStartDate,
  poolCalendarToday,
} from "@/lib/pool/pool-season";
import { resolvePoolDateQueryParam } from "@/lib/pool/resolve-pool-date-query";
import type { PoolTeam } from "@/lib/pool/roster-schema";
import { SCOREBOARD_CACHE_CONTROL } from "@/lib/nhl/constants";

/** Cumulative breakdown walks many days; allow time on serverless. */
export const maxDuration = 60;

async function aggregatePlayoffStatsForTeam(
  team: PoolTeam,
  startDate: string,
  asOfDate: string,
): Promise<Map<number, { gp: number; pts: number }>> {
  const ids = team.picks
    .filter(
      (p): p is Extract<PoolTeam["picks"][number], { kind: "skater" }> =>
        p.kind === "skater" && p.nhlPlayerId != null,
    )
    .map((p) => p.nhlPlayerId as number);
  if (ids.length === 0) return new Map();
  const db = getDb();
  if (!db) return new Map();
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
          inArray(poolSkaterDailyPoints.nhlPlayerId, ids),
        ),
      )
      .groupBy(poolSkaterDailyPoints.nhlPlayerId);
    const out = new Map<number, { gp: number; pts: number }>();
    for (const r of rows) {
      out.set(r.nhlPlayerId, {
        gp: Number(r.gp ?? 0),
        pts: Number(r.pts ?? 0),
      });
    }
    return out;
  } catch {
    return new Map();
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await context.params;
  const { searchParams } = new URL(request.url);
  const resolved = resolvePoolDateQueryParam(searchParams.get("date"));
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 400 });
  }
  const date = resolved.date;

  const rosters = loadPoolRosters();
  if (!rosters.teams.some((t) => t.id === teamId)) {
    return NextResponse.json({ error: "Unknown team." }, { status: 404 });
  }

  try {
    const leaderboard = await getCachedLeaderboardResponse(date);
    const row = leaderboard.standings.find((r) => r.teamId === teamId);
    if (!row) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }
    const leaderTotalPoints = leaderboard.standings[0]?.totalPoints ?? row.totalPoints;
    const pointsBehindLeader = Math.max(0, leaderTotalPoints - row.totalPoints);

    let breakdown: TeamScoreBreakdown | null = null;
    if (leaderboard.leaderboardMode === "cumulative") {
      breakdown = await computeCumulativeTeamBreakdownThroughDate(teamId, date);
    } else {
      const { standings } = await computePoolStandingsDetailedForDate(
        rosters,
        date,
        teamId,
      );
      breakdown =
        standings.find((s) => s.teamId === teamId)?.breakdown ?? null;
    }
    const teamStatusByAbbrev = await getCachedPlayoffTeamStatusByDate(date);

    /**
     * Per-pick projection for this team. Uses the same model as `/api/pool/projection`
     * (probability-weighted EV with Bayesian-shrunk PPG); on bracket / NHLE failures
     * we still return the rest of the team detail and set `projection: null`.
     */
    let projection: PoolTeamProjection | null = null;
    const team = rosters.teams.find((t) => t.id === teamId);
    if (team) {
      try {
        const playoffStart = getPoolPlayoffStartDate();
        const today = poolCalendarToday();
        const aggregateThrough = date < today ? date : today;
        const skaterIds = team.picks
          .filter((p) => p.kind === "skater" && p.nhlPlayerId != null)
          .map((p) =>
            p.kind === "skater" ? (p.nhlPlayerId as number) : 0,
          )
          .filter((id) => id > 0);

        let bracket: PlayoffBracketResponse | null = null;
        const statusMap = teamStatusByAbbrev;
        try {
          bracket = await getCachedPlayoffBracket(playoffSeasonFromDate(date));
        } catch {
          bracket = null;
        }

        if (bracket) {
          const [seasonRates, playoffStats] = await Promise.all([
            fetchNhlPlayerSeasonRates(skaterIds),
            aggregatePlayoffStatsForTeam(team, playoffStart, aggregateThrough),
          ]);
          const ppgByPlayerId = new Map<number, number>();
          for (const id of skaterIds) {
            const rates = seasonRates.get(id);
            const playoff = playoffStats.get(id);
            ppgByPlayerId.set(
              id,
              blendedPpg({
                rsGp: rates?.rsGp ?? 0,
                rsPts: rates?.rsPts ?? 0,
                playoffGp: playoff?.gp ?? 0,
                playoffPts: playoff?.pts ?? 0,
                careerPlayoffGp: rates?.careerPlayoffGp ?? 0,
                careerPlayoffPts: rates?.careerPlayoffPts ?? 0,
                priorWeight: DEFAULT_PROJECTION_CONFIG.ppgPriorWeight,
              }),
            );
          }
          const maps = buildTeamProjectionMaps(bracket, statusMap);
          projection = projectPoolTeam(team, {
            totalToDate: row.totalPoints,
            ppgByPlayerId,
            maps,
            bracket,
            statusByAbbrev: statusMap,
          });
        }
      } catch (e) {
        console.error("[pool/team projection]", e);
        projection = null;
      }
    }

    return NextResponse.json(
      {
        asOfDate: leaderboard.asOfDate,
        compareThroughPrevCalendarDay: leaderboard.compareThroughPrevCalendarDay,
        leaderboardMode: leaderboard.leaderboardMode,
        gamesOnSlate: leaderboard.gamesOnSlate,
        team: {
          teamId: row.teamId,
          name: row.name,
          ownerName: row.ownerName,
          ownerAvatar: row.ownerAvatar,
          rank: row.rank,
          rankPrev: row.rankPrev,
          rankDelta: row.rankDelta,
          totalPoints: row.totalPoints,
          skaterPoints: row.skaterPoints,
          teamWinPoints: row.teamWinPoints,
          pointsBehindLeader,
        },
        breakdown,
        projection,
        teamStatusByAbbrev: teamStatusMapToRecord(teamStatusByAbbrev),
      },
      { headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Team detail failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
