/**
 * Single-calendar-day fantasy sources (who scored / which teams won) for the pool.
 * Not cumulative — cumulative playoff totals live in GET /api/pool/standings.
 */
import { NextResponse } from "next/server";
import {
  buildPoolDaySources,
} from "@/lib/pool/day-sources";
import { resolvePoolSkaterDisplayNameMap } from "@/lib/pool/pool-skater-display-names";
import { loadPlayoffDayNhlBundleCached } from "@/lib/pool/cached-playoff-day-bundle";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import { resolvePoolDateQueryParam } from "@/lib/pool/resolve-pool-date-query";
import { SCOREBOARD_CACHE_CONTROL } from "@/lib/nhl/constants";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resolved = resolvePoolDateQueryParam(searchParams.get("date"));
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 400 });
  }
  const date = resolved.date;

  try {
    const rosters = loadPoolRosters();
    const bundle = await loadPlayoffDayNhlBundleCached(date);

    const skaterStats = bundle.skaterStats;
    const nhlNames = await resolvePoolSkaterDisplayNameMap(rosters.teams);

    const payload = buildPoolDaySources(
      rosters.teams,
      skaterStats,
      bundle.winsByAbbrev,
      bundle.teamLogos,
      nhlNames,
      bundle.teamStatusByAbbrev,
    );

    return NextResponse.json(
      {
        date,
        gamesOnSlate: bundle.gamesOnSlate,
        scoreboardMeta: {
          requestedDate: bundle.requestedDate,
          effectiveDate: bundle.effectiveDate,
          fellBack: bundle.fellBack,
        },
        ...payload,
      },
      { headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Day sources failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
