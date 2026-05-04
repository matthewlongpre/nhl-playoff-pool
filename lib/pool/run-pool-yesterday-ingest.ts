import { NextResponse } from "next/server";
import { ingestPoolPointsForCalendarDate } from "@/lib/pool/ingest-daily-points";
import {
  poolCalendarToday,
  getPoolPlayoffStartDate,
  previousCalendarDay,
} from "@/lib/pool/pool-season";

/** Ingest pool-calendar yesterday into `pool_team_daily_points` (same logic as cron GET). */
export async function runPoolYesterdayCalendarIngest(): Promise<NextResponse> {
  const today = poolCalendarToday();
  const yesterday = previousCalendarDay(today);
  const start = getPoolPlayoffStartDate();

  if (yesterday < start) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "before_pool_playoff_start",
      yesterday,
      poolPlayoffStartDate: start,
    });
  }

  try {
    const r = await ingestPoolPointsForCalendarDate(yesterday);
    return NextResponse.json({
      ok: true,
      date: yesterday,
      ...r,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
