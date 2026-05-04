/**
 * Single round-trip for the team detail “daily” block: fantasy scoring row + skaters slate
 * + poll hints — one NHL scoreboard/boxscore pass.
 */
import { NextResponse } from "next/server";
import { fetchNhlPlayerBadges } from "@/lib/nhl/player-landing";
import { buildPoolDaySources } from "@/lib/pool/day-sources";
import { resolvePoolSkaterDisplayNameMap } from "@/lib/pool/pool-skater-display-names";
import {
  groupDaySourcesByPoolTeam,
  type PoolTeamCrewRow,
} from "@/lib/pool/day-sources-by-pool";
import { loadPlayoffDayNhlBundle } from "@/lib/pool/playoff-day-bundle";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import {
  applyBadgesToSkatersSlateTeams,
  buildSkatersSlatePoolTeams,
  collectSkaterSlateBadgePlayerIds,
} from "@/lib/pool/skater-slate";
import type { TeamDayApiResponse } from "@/lib/pool/team-day-api";
import { resolvePoolDateQueryParam } from "@/lib/pool/resolve-pool-date-query";
import { SCOREBOARD_CACHE_CONTROL } from "@/lib/nhl/constants";

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
    return NextResponse.json({ error: "Unknown pool team." }, { status: 404 });
  }

  try {
    const bundle = await loadPlayoffDayNhlBundle(date);
    const poolTeam = rosters.teams.find((t) => t.id === teamId)!;

    const skaterStats = bundle.skaterStats;
    const nhlNames = await resolvePoolSkaterDisplayNameMap(rosters.teams);

    const dayPayload = buildPoolDaySources(
      rosters.teams,
      skaterStats,
      bundle.winsByAbbrev,
      bundle.teamLogos,
      nhlNames,
      bundle.teamStatusByAbbrev,
    );

    const crewRows = groupDaySourcesByPoolTeam(
      dayPayload.skaters,
      dayPayload.teamWins,
    );
    const fantasy: PoolTeamCrewRow | null =
      crewRows.find((r) => r.poolTeamId === teamId) ?? null;

    const slateTeams = buildSkatersSlatePoolTeams(
      [poolTeam],
      bundle.playoffGames,
      bundle.boxByGameId,
      nhlNames,
      bundle.teamStatusByAbbrev,
    );
    const slate = slateTeams[0]!;
    const badgeIds = collectSkaterSlateBadgePlayerIds(slateTeams);
    const badgesByPlayer = await fetchNhlPlayerBadges(badgeIds);
    applyBadgesToSkatersSlateTeams(slateTeams, badgesByPlayer);

    const playoffGamesForPoll = bundle.playoffGames.map((g) => ({
      gameState: g.gameState,
    }));

    const payload: TeamDayApiResponse = {
      date,
      gamesOnSlate: bundle.gamesOnSlate,
      scoreboardMeta: {
        requestedDate: bundle.requestedDate,
        effectiveDate: bundle.effectiveDate,
        fellBack: bundle.fellBack,
      },
      playoffGamesForPoll,
      slate,
      fantasy,
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Team day failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
