import { NextResponse } from "next/server";
import { playoffSeasonFromDate } from "@/lib/nhl/playoff-status";
import { fetchNhlPlayoffBracket } from "@/lib/nhl/upstream";
import { poolCalendarToday } from "@/lib/pool/pool-season";

/** Bracket updates slowly; align with pool projection route. */
const BRACKET_CACHE_CONTROL =
  "public, s-maxage=30, stale-while-revalidate=300";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seasonRaw = searchParams.get("season");

  let season: number;
  if (seasonRaw == null || seasonRaw === "") {
    season = playoffSeasonFromDate(poolCalendarToday());
  } else {
    season = Number.parseInt(seasonRaw, 10);
    if (!Number.isFinite(season) || season < 2000 || season > 2100) {
      return NextResponse.json(
        { error: "Query parameter `season` must be a year between 2000 and 2100." },
        { status: 400 },
      );
    }
  }

  try {
    const bracket = await fetchNhlPlayoffBracket(season);
    return NextResponse.json(
      { ...bracket, meta: { season } },
      { headers: { "Cache-Control": BRACKET_CACHE_CONTROL } },
    );
  } catch {
    return NextResponse.json(
      { error: "NHL playoff bracket request failed." },
      { status: 502 },
    );
  }
}
