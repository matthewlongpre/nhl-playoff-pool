import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { nhlScoreboardDayCache } from "@/lib/db/schema";
import { authorizePoolIngestRequest } from "@/lib/pool/cron-authorize";
import { recordEliminationsForDate } from "@/lib/pool/detect-elimination-events";
import { playoffSeasonFromDate } from "@/lib/nhl/playoff-status";
import { poolCalendarToday } from "@/lib/pool/pool-season";

export const maxDuration = 120;

/**
 * Scans all cached scoreboard entries for the current playoff season and records
 * any series-clinching games into `pool_nhl_elimination_events`.
 * Uses ON CONFLICT DO NOTHING so rerunning is safe and preserves earliest dates.
 * Does NOT touch pool_ingest_snapshots.
 */
export async function GET(request: Request) {
  if (!authorizePoolIngestRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const playoffSeason = playoffSeasonFromDate(poolCalendarToday());

  const rows = await db
    .select({ calendarDate: nhlScoreboardDayCache.calendarDate })
    .from(nhlScoreboardDayCache)
    .where(eq(nhlScoreboardDayCache.playoffSeason, playoffSeason))
    .orderBy(asc(nhlScoreboardDayCache.calendarDate));

  const allNew: string[] = [];
  for (const { calendarDate } of rows) {
    const inserted = await recordEliminationsForDate(db, calendarDate);
    allNew.push(...inserted);
  }

  return NextResponse.json({
    ok: true,
    playoffSeason,
    datesScanned: rows.length,
    newEliminations: allNew,
  });
}
