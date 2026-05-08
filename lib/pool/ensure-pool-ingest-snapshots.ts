import { eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { getDb } from "@/lib/db";
import { poolTeamDailyPoints } from "@/lib/db/schema";
import {
  getPoolIngestSnapshotForDate,
  materializePoolIngestSnapshotsForDate,
  POOL_SNAPSHOT_KIND_PROJECTION,
  POOL_SNAPSHOT_KIND_REVIEW,
} from "@/lib/pool/pool-ingest-snapshots";

export async function poolTeamDailyIngestPresent(
  db: Db,
  day: string,
): Promise<boolean> {
  const r = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(poolTeamDailyPoints)
    .where(eq(poolTeamDailyPoints.date, day));
  return (r[0]?.c ?? 0) > 0;
}

const inflightMaterialize = new Map<string, Promise<void>>();

/**
 * If `pool_team_daily_points` has rows for `ingestedCalendarDate` but either snapshot
 * row is missing, runs `materializePoolIngestSnapshotsForDate` once. Concurrent callers
 * for the same date share one in-flight materialization (per server instance).
 */
export async function ensurePoolIngestSnapshotsMaterialized(
  ingestedCalendarDate: string,
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const hasIngest = await poolTeamDailyIngestPresent(db, ingestedCalendarDate);
  if (!hasIngest) return;

  const [rev, proj] = await Promise.all([
    getPoolIngestSnapshotForDate(
      db,
      POOL_SNAPSHOT_KIND_REVIEW,
      ingestedCalendarDate,
    ),
    getPoolIngestSnapshotForDate(
      db,
      POOL_SNAPSHOT_KIND_PROJECTION,
      ingestedCalendarDate,
    ),
  ]);
  if (rev != null && proj != null) return;

  let p = inflightMaterialize.get(ingestedCalendarDate);
  if (!p) {
    p = (async () => {
      const r = await materializePoolIngestSnapshotsForDate(ingestedCalendarDate);
      if (!r.ok) {
        console.error(
          "[ensurePoolIngestSnapshotsMaterialized]",
          ingestedCalendarDate,
          r.error,
        );
      }
    })().finally(() => {
      inflightMaterialize.delete(ingestedCalendarDate);
    });
    inflightMaterialize.set(ingestedCalendarDate, p);
  }
  await p;
}
