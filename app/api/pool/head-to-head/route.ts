import { NextResponse } from "next/server";
import { computeCumulativeTeamBreakdownThroughDate } from "@/lib/pool/team-cumulative-breakdown";
import { computePoolStandingsDetailedForDate } from "@/lib/pool/compute-standings-for-date";
import { getCachedLeaderboardResponse } from "@/lib/pool/cached-pool-queries";
import { getCachedPlayoffTeamStatusByDate } from "@/lib/nhl/cached-playoff-team-status";
import { teamStatusMapToRecord } from "@/lib/nhl/playoff-status";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import { resolvePoolDateQueryParam } from "@/lib/pool/resolve-pool-date-query";
import { SCOREBOARD_CACHE_CONTROL } from "@/lib/nhl/constants";
import type { TeamScoreBreakdown } from "@/lib/pool/scoring";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamAId = searchParams.get("teamA");
  const teamBId = searchParams.get("teamB");

  if (!teamAId || !teamBId) {
    return NextResponse.json(
      { error: "teamA and teamB are required." },
      { status: 400 },
    );
  }
  if (teamAId === teamBId) {
    return NextResponse.json(
      { error: "Cannot compare a team against itself." },
      { status: 400 },
    );
  }

  const resolved = resolvePoolDateQueryParam(searchParams.get("date"));
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 400 });
  }
  const date = resolved.date;

  const rosters = loadPoolRosters();
  if (!rosters.teams.some((t) => t.id === teamAId)) {
    return NextResponse.json({ error: "Unknown teamA." }, { status: 404 });
  }
  if (!rosters.teams.some((t) => t.id === teamBId)) {
    return NextResponse.json({ error: "Unknown teamB." }, { status: 404 });
  }

  try {
    const [leaderboard, teamStatusByAbbrev] = await Promise.all([
      getCachedLeaderboardResponse(date),
      getCachedPlayoffTeamStatusByDate(date).catch(() => new Map()),
    ]);

    const rowA = leaderboard.standings.find((r) => r.teamId === teamAId);
    const rowB = leaderboard.standings.find((r) => r.teamId === teamBId);

    if (!rowA || !rowB) {
      return NextResponse.json(
        { error: "One or both teams not found in standings." },
        { status: 404 },
      );
    }

    const leaderTotalPoints = leaderboard.standings[0]?.totalPoints ?? 0;

    let breakdownA: TeamScoreBreakdown | null = null;
    let breakdownB: TeamScoreBreakdown | null = null;

    if (leaderboard.leaderboardMode === "cumulative") {
      [breakdownA, breakdownB] = await Promise.all([
        computeCumulativeTeamBreakdownThroughDate(teamAId, date),
        computeCumulativeTeamBreakdownThroughDate(teamBId, date),
      ]);
    } else {
      const [resultA, resultB] = await Promise.all([
        computePoolStandingsDetailedForDate(rosters, date, teamAId),
        computePoolStandingsDetailedForDate(rosters, date, teamBId),
      ]);
      breakdownA =
        resultA.standings.find((s) => s.teamId === teamAId)?.breakdown ?? null;
      breakdownB =
        resultB.standings.find((s) => s.teamId === teamBId)?.breakdown ?? null;
    }

    function buildPayload(
      row: NonNullable<typeof rowA>,
      breakdown: TeamScoreBreakdown | null,
    ) {
      return {
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
        pointsBehindLeader: Math.max(0, leaderTotalPoints - row.totalPoints),
        breakdown,
      };
    }

    return NextResponse.json(
      {
        asOfDate: leaderboard.asOfDate,
        compareThroughPrevCalendarDay:
          leaderboard.compareThroughPrevCalendarDay,
        leaderboardMode: leaderboard.leaderboardMode,
        teamA: buildPayload(rowA, breakdownA),
        teamB: buildPayload(rowB, breakdownB),
        teamStatusByAbbrev: teamStatusMapToRecord(teamStatusByAbbrev),
      },
      { headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Head to head failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
