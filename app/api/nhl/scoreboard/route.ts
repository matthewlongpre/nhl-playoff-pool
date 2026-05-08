import { NextResponse } from "next/server";
import { fetchPlayoffScoreboardWithCalendarFallback } from "@/lib/nhl/playoff-scoreboard-fallback";
import { getCachedPlayoffTeamStatusByDate } from "@/lib/nhl/cached-playoff-team-status";
import { teamStatusMapToRecord } from "@/lib/nhl/playoff-status";
import { fetchNhlScoreboard } from "@/lib/nhl/upstream";
import { SCOREBOARD_CACHE_CONTROL } from "@/lib/nhl/constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "Query parameter `date` (YYYY-MM-DD) is required." },
      { status: 400 },
    );
  }

  const playoffFallback = searchParams.get("playoffFallback") !== "0";

  try {
    if (playoffFallback) {
      const { scoreboard, effectiveDate, requestedDate, fellBack } =
        await fetchPlayoffScoreboardWithCalendarFallback(date);
      const teamStatusByAbbrev =
        await getCachedPlayoffTeamStatusByDate(effectiveDate);
      return NextResponse.json(
        {
          ...scoreboard,
          teamStatusByAbbrev: teamStatusMapToRecord(teamStatusByAbbrev),
          meta: {
            requestedDate,
            effectiveDate,
            fellBack,
          },
        },
        {
          headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL },
        },
      );
    }

    const data = await fetchNhlScoreboard(date);
    return NextResponse.json(data, {
      headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL },
    });
  } catch {
    return NextResponse.json(
      { error: "NHL scoreboard request failed." },
      { status: 502 },
    );
  }
}
