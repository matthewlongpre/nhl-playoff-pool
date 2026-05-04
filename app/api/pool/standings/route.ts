import { NextResponse } from "next/server";
import type { NhlTeamPlayoffStatus } from "@/lib/nhl/schemas";
import { fetchPlayoffTeamStatusByDate } from "@/lib/nhl/playoff-status";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import { computePoolStandingsDetailedForDate } from "@/lib/pool/compute-standings-for-date";
import { getCachedLeaderboardResponse } from "@/lib/pool/cached-pool-queries";
import { applySimulatedRankMovement } from "@/lib/pool/simulate-rank-movement";
import {
  buildRemainingPicksByTeamId,
  type TeamWinPickStatus,
} from "@/lib/pool/remaining-picks-by-team";
import { resolvePoolDateQueryParam } from "@/lib/pool/resolve-pool-date-query";
import { publicMessageForStandingsFailure } from "@/lib/pool/standings-api-error";
import { SCOREBOARD_CACHE_CONTROL } from "@/lib/nhl/constants";

function withRemainingPicks<T extends { teamId: string }>(
  rows: T[],
  remainingByTeamId: ReturnType<typeof buildRemainingPicksByTeamId>,
): Array<
  T & {
    remainingSkaters: number;
    totalSkaters: number;
    remainingTeams: number;
    totalTeams: number;
    teamWinPicks: TeamWinPickStatus[];
  }
> {
  return rows.map((row) => {
    const r = remainingByTeamId.get(row.teamId);
    return {
      ...row,
      remainingSkaters: r?.remainingSkaters ?? 0,
      totalSkaters: r?.totalSkaters ?? 0,
      remainingTeams: r?.remainingTeams ?? 0,
      totalTeams: r?.totalTeams ?? 0,
      teamWinPicks: r?.teamWinPicks ?? [],
    };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resolved = resolvePoolDateQueryParam(searchParams.get("date"));
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 400 });
  }
  const date = resolved.date;

  const includeBreakdown = searchParams.get("details") === "1";
  const teamIdFilter = searchParams.get("teamId");
  const simulateRankMovement = searchParams.get("simulateRankMovement") === "1";

  try {
    const rosters = loadPoolRosters();
    let statusByAbbrev = new Map<string, NhlTeamPlayoffStatus>();
    try {
      statusByAbbrev = await fetchPlayoffTeamStatusByDate(date);
    } catch {
      /* Bracket unavailable — picks without a match stay “active”. */
    }
    const remainingByTeamId = buildRemainingPicksByTeamId(rosters, statusByAbbrev);

    if (includeBreakdown) {
      const { gamesOnSlate, standings } = await computePoolStandingsDetailedForDate(
        rosters,
        date,
        teamIdFilter,
      );
      return NextResponse.json(
        {
          date,
          gamesOnSlate,
          standings: withRemainingPicks(standings, remainingByTeamId),
          leaderboardMode: "single_day_breakdown" as const,
        },
        { headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL } },
      );
    }

    const payload = await getCachedLeaderboardResponse(date);
    const standings =
      simulateRankMovement && !includeBreakdown
        ? applySimulatedRankMovement(payload.standings)
        : payload.standings;

    return NextResponse.json(
      {
        date: payload.asOfDate,
        gamesOnSlate: payload.gamesOnSlate,
        standings: withRemainingPicks(standings, remainingByTeamId),
        leaderboardMode: payload.leaderboardMode,
        compareThroughPrevCalendarDay: payload.compareThroughPrevCalendarDay,
      },
      { headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL } },
    );
  } catch (e) {
    console.error("[pool/standings]", e);
    const message = publicMessageForStandingsFailure(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
