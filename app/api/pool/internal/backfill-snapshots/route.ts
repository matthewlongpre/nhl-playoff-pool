import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { poolIngestSnapshots } from "@/lib/db/schema";
import { authorizePoolIngestRequest } from "@/lib/pool/cron-authorize";
import { buildProjectionPayload } from "@/lib/pool/build-projection-payload";
import { reconstructHistoricalBracket } from "@/lib/pool/reconstruct-historical-bracket";
import {
  upsertPoolIngestSnapshot,
  POOL_SNAPSHOT_KIND_PROJECTION,
} from "@/lib/pool/pool-ingest-snapshots";

export const maxDuration = 300;

/**
 * Re-materializes projection snapshots for all historical dates using historically-
 * accurate bracket states reconstructed from `nhl_scoreboard_day_cache` and
 * elimination dates from `pool_nhl_elimination_events`.
 *
 * Safe to rerun — uses ON CONFLICT DO UPDATE for snapshot upserts.
 * Does NOT touch the nightly ingest rows or elimination events.
 */
export async function POST(request: Request) {
  if (!authorizePoolIngestRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const rows = await db
    .select({ asOfDate: poolIngestSnapshots.asOfDate })
    .from(poolIngestSnapshots)
    .where(eq(poolIngestSnapshots.kind, POOL_SNAPSHOT_KIND_PROJECTION))
    .orderBy(asc(poolIngestSnapshots.asOfDate));

  const dates = rows.map((r) => r.asOfDate);
  const results: Array<{ date: string; ok: boolean; error?: string }> = [];

  for (const date of dates) {
    try {
      const { bracket, statusByAbbrev } = await reconstructHistoricalBracket(db, date);
      const payload = await buildProjectionPayload(date, { bracket, statusByAbbrev });
      await upsertPoolIngestSnapshot(
        db,
        date,
        POOL_SNAPSHOT_KIND_PROJECTION,
        payload as unknown as Record<string, unknown>,
      );
      results.push({ date, ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown";
      results.push({ date, ok: false, error: message });
    }
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    total: dates.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: failed.length,
    results,
  });
}
