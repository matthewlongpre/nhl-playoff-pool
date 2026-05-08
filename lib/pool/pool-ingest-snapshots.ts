import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { getDb } from "@/lib/db";
import { poolIngestSnapshots } from "@/lib/db/schema";
import { buildProjectionPayload } from "@/lib/pool/build-projection-payload";
import { buildPoolReview } from "@/lib/pool/scope-summary";

export const POOL_SNAPSHOT_KIND_REVIEW = "review" as const;
export const POOL_SNAPSHOT_KIND_PROJECTION = "projection" as const;

export type PoolSnapshotKind =
  | typeof POOL_SNAPSHOT_KIND_REVIEW
  | typeof POOL_SNAPSHOT_KIND_PROJECTION;

export async function upsertPoolIngestSnapshot(
  db: Db,
  asOfDate: string,
  kind: PoolSnapshotKind,
  payload: Record<string, unknown>,
): Promise<void> {
  await db
    .insert(poolIngestSnapshots)
    .values({
      asOfDate,
      kind,
      payload,
    })
    .onConflictDoUpdate({
      target: [poolIngestSnapshots.asOfDate, poolIngestSnapshots.kind],
      set: {
        payload,
        updatedAt: new Date(),
      },
    });
}

export async function getLatestPoolIngestSnapshot(
  db: Db,
  kind: PoolSnapshotKind,
): Promise<{ asOfDate: string; payload: unknown } | null> {
  const rows = await db
    .select({
      asOfDate: poolIngestSnapshots.asOfDate,
      payload: poolIngestSnapshots.payload,
    })
    .from(poolIngestSnapshots)
    .where(eq(poolIngestSnapshots.kind, kind))
    .orderBy(desc(poolIngestSnapshots.asOfDate))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return { asOfDate: r.asOfDate, payload: r.payload };
}

export async function getPoolIngestSnapshotForDate(
  db: Db,
  kind: PoolSnapshotKind,
  asOfDate: string,
): Promise<unknown | null> {
  const rows = await db
    .select({ payload: poolIngestSnapshots.payload })
    .from(poolIngestSnapshots)
    .where(
      and(
        eq(poolIngestSnapshots.kind, kind),
        eq(poolIngestSnapshots.asOfDate, asOfDate),
      ),
    )
    .limit(1);
  return rows[0]?.payload ?? null;
}

/**
 * After `ingestPoolPointsForCalendarDate(ingestedCalendarDate)` succeeds, persist
 * review + projection JSON for that calendar day (cheap reads until next ingest).
 */
export async function materializePoolIngestSnapshotsForDate(
  ingestedCalendarDate: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) {
    return { ok: false, error: "no_database" };
  }
  try {
    const t0 = performance.now();
    const [reviewPayload, projectionPayload] = await Promise.all([
      buildPoolReview(ingestedCalendarDate),
      buildProjectionPayload(ingestedCalendarDate),
    ]);
    await upsertPoolIngestSnapshot(
      db,
      ingestedCalendarDate,
      POOL_SNAPSHOT_KIND_REVIEW,
      reviewPayload as unknown as Record<string, unknown>,
    );
    await upsertPoolIngestSnapshot(
      db,
      ingestedCalendarDate,
      POOL_SNAPSHOT_KIND_PROJECTION,
      projectionPayload as unknown as Record<string, unknown>,
    );
    const durationMs = Math.round(performance.now() - t0);
    console.log(
      `[pool-materialize] ok date=${ingestedCalendarDate} duration_ms=${durationMs}`,
    );
    return { ok: true };
  } catch (e) {
    console.error("[materialize-pool-ingest-snapshots]", e);
    const message = e instanceof Error ? e.message : "materialize_failed";
    console.log(
      `[pool-materialize] error date=${ingestedCalendarDate} message=${message}`,
    );
    return { ok: false, error: message };
  }
}
