import { NextResponse } from "next/server";
import { ingestPoolPointsForCalendarDate } from "@/lib/pool/ingest-daily-points";
import { materializePoolIngestSnapshotsForDate } from "@/lib/pool/pool-ingest-snapshots";
import {
  poolCalendarToday,
  getPoolPlayoffStartDate,
  previousCalendarDay,
} from "@/lib/pool/pool-season";

function yesterdayIngestWindow():
  | { skipped: true; body: Record<string, unknown> }
  | { skipped: false; yesterday: string } {
  const today = poolCalendarToday();
  const yesterday = previousCalendarDay(today);
  const start = getPoolPlayoffStartDate();

  if (yesterday < start) {
    return {
      skipped: true,
      body: {
        ok: true,
        skipped: true,
        reason: "before_pool_playoff_start",
        yesterday,
        poolPlayoffStartDate: start,
      },
    };
  }
  return { skipped: false, yesterday };
}

/** NHL ingest only — finishes under tight serverless limits; pair with `runPoolYesterdaySnapshotOnly`. */
export async function runPoolYesterdayIngestOnly(): Promise<NextResponse> {
  const w = yesterdayIngestWindow();
  if (w.skipped) {
    return NextResponse.json(w.body);
  }

  try {
    const t0 = performance.now();
    const r = await ingestPoolPointsForCalendarDate(w.yesterday);
    const durationMs = Math.round(performance.now() - t0);
    console.log(
      `[pool-ingest] ok date=${w.yesterday} duration_ms=${durationMs} teamsWritten=${r.teamsWritten}`,
    );
    return NextResponse.json({
      ok: true,
      phase: "ingest",
      date: w.yesterday,
      ...r,
      durationMs,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Snapshot materialization only for pool-calendar yesterday (after ingest rows exist). */
export async function runPoolYesterdaySnapshotOnly(): Promise<NextResponse> {
  const w = yesterdayIngestWindow();
  if (w.skipped) {
    return NextResponse.json(w.body);
  }

  const snapshot = await materializePoolIngestSnapshotsForDate(w.yesterday);
  return NextResponse.json({
    ok: true,
    phase: "materialize",
    date: w.yesterday,
    snapshot,
  });
}

/** Ingest then materialize in one invocation (local / backfill); can exceed 60s on Vercel — prefer split cron routes in production. */
export async function runPoolYesterdayCalendarIngest(): Promise<NextResponse> {
  const w = yesterdayIngestWindow();
  if (w.skipped) {
    return NextResponse.json(w.body);
  }

  try {
    const r = await ingestPoolPointsForCalendarDate(w.yesterday);
    const snapshot = await materializePoolIngestSnapshotsForDate(w.yesterday);
    return NextResponse.json({
      ok: true,
      date: w.yesterday,
      ...r,
      snapshot,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
