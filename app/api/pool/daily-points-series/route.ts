import { NextResponse } from "next/server";
import { getCachedDailyPointsSeries } from "@/lib/pool/cached-pool-queries";
import { resolvePoolDateQueryParam } from "@/lib/pool/resolve-pool-date-query";
import { publicMessageForStandingsFailure } from "@/lib/pool/standings-api-error";
import { SCOREBOARD_CACHE_CONTROL } from "@/lib/nhl/constants";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resolved = resolvePoolDateQueryParam(searchParams.get("date"));
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 400 });
  }

  try {
    const payload = await getCachedDailyPointsSeries(resolved.date);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL },
    });
  } catch (e) {
    console.error("[pool/daily-points-series]", e);
    const message = publicMessageForStandingsFailure(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
