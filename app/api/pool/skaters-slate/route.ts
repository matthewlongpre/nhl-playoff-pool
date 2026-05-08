/**
 * Per pool team: skater and team picks with today’s playoff slate game state and
 * dressed/not-dressed when the boxscore lists skaters.
 */
import { NextResponse } from "next/server";
import { fetchNhlPlayerBadges } from "@/lib/nhl/player-landing";
import { loadPlayoffDayNhlBundleCached } from "@/lib/pool/cached-playoff-day-bundle";
import { SCOREBOARD_CACHE_CONTROL } from "@/lib/nhl/constants";
import { resolvePoolSkaterDisplayNameMap } from "@/lib/pool/pool-skater-display-names";
import {
  applyBadgesToSkatersSlateTeams,
  buildSkatersSlatePoolTeams,
  collectSkaterSlateBadgePlayerIds,
} from "@/lib/pool/skater-slate";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import { resolvePoolDateQueryParam } from "@/lib/pool/resolve-pool-date-query";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resolved = resolvePoolDateQueryParam(searchParams.get("date"));
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 400 });
  }
  const date = resolved.date;
  const teamIdFilter = searchParams.get("teamId")?.trim() || null;

  try {
    const rosters = loadPoolRosters();
    if (teamIdFilter != null) {
      const exists = rosters.teams.some((t) => t.id === teamIdFilter);
      if (!exists) {
        return NextResponse.json({ error: "Unknown pool team." }, { status: 404 });
      }
    }

    const bundle = await loadPlayoffDayNhlBundleCached(date);
    const nhlNames = await resolvePoolSkaterDisplayNameMap(rosters.teams);

    const poolTeamsForPayload =
      teamIdFilter != null
        ? rosters.teams.filter((t) => t.id === teamIdFilter)
        : rosters.teams;

    const teams = buildSkatersSlatePoolTeams(
      poolTeamsForPayload,
      bundle.playoffGames,
      bundle.boxByGameId,
      nhlNames,
      bundle.teamStatusByAbbrev,
    );

    const badgeIds = collectSkaterSlateBadgePlayerIds(teams);
    const badgesByPlayer = await fetchNhlPlayerBadges(badgeIds);
    applyBadgesToSkatersSlateTeams(teams, badgesByPlayer);

    const payload = {
      date,
      gamesOnSlate: bundle.gamesOnSlate,
      scoreboardMeta: {
        requestedDate: bundle.requestedDate,
        effectiveDate: bundle.effectiveDate,
        fellBack: bundle.fellBack,
      },
      teams,
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Skaters slate failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
