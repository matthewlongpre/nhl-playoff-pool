import { NextResponse } from "next/server";
import { SCOREBOARD_CACHE_CONTROL } from "@/lib/nhl/constants";
import { resolvePoolDateQueryParam } from "@/lib/pool/resolve-pool-date-query";
import { getCachedPoolReview } from "@/lib/pool/cached-pool-queries";
import { publicMessageForStandingsFailure } from "@/lib/pool/standings-api-error";

/**
 * Round windows fan out one scoreboard fetch per playoff date plus one bracket fetch,
 * then optionally a live-today merge — give it a generous ceiling.
 */
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resolved = resolvePoolDateQueryParam(searchParams.get("date"));
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 400 });
  }

  try {
    const payload = await getCachedPoolReview(resolved.date);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL },
    });
  } catch (e) {
    console.error("[pool/review]", e);
    const message = publicMessageForStandingsFailure(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
