import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { authorizePoolIngestRequest } from "@/lib/pool/cron-authorize";
import { reconstructHistoricalBracket } from "@/lib/pool/reconstruct-historical-bracket";
import { buildTeamProjectionMaps } from "@/lib/pool/projection";

export const maxDuration = 30;

/**
 * Returns the reconstructed bracket + statusByAbbrev + computed expected games/wins
 * for a given date. For debugging projection-history issues.
 *
 * GET /api/pool/internal/debug-bracket?date=2026-05-02
 */
export async function GET(request: Request) {
  if (!authorizePoolIngestRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "Missing date parameter" }, { status: 400 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { bracket, statusByAbbrev } = await reconstructHistoricalBracket(db, date);
  const maps = buildTeamProjectionMaps(bracket, statusByAbbrev);

  return NextResponse.json({
    date,
    bracket: bracket.series.map((s) => ({
      round: s.playoffRound,
      top: s.topSeedTeam?.abbrev,
      bot: s.bottomSeedTeam?.abbrev,
      topWins: s.topSeedWins,
      botWins: s.bottomSeedWins,
    })),
    statusByAbbrev: Object.fromEntries(statusByAbbrev),
    expectedGames: Object.fromEntries(
      [...maps.expectedGamesByAbbrev.entries()].map(([k, v]) => [k, Number(v.toFixed(3))]),
    ),
    expectedWins: Object.fromEntries(
      [...maps.expectedWinsByAbbrev.entries()].map(([k, v]) => [k, Number(v.toFixed(3))]),
    ),
  });
}
