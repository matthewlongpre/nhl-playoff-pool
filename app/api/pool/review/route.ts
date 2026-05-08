import { NextResponse } from "next/server";
import { SCOREBOARD_CACHE_CONTROL } from "@/lib/nhl/constants";
import { getDb } from "@/lib/db";
import { getCachedPoolReview } from "@/lib/pool/cached-pool-queries";
import { ensurePoolIngestSnapshotsMaterialized } from "@/lib/pool/ensure-pool-ingest-snapshots";
import {
  getLatestPoolIngestSnapshot,
  getPoolIngestSnapshotForDate,
  POOL_SNAPSHOT_KIND_REVIEW,
} from "@/lib/pool/pool-ingest-snapshots";
import {
  POOL_INGEST_SNAPSHOT_CACHE_CONTROL,
  POOL_STALE_INGEST_SNAPSHOT_CACHE_CONTROL,
} from "@/lib/pool/pool-snapshot-http";
import {
  poolCalendarExpectedLatestIngestAsOf,
  poolCalendarToday,
  previousCalendarDay,
} from "@/lib/pool/pool-season";
import { resolvePoolDateQueryParam } from "@/lib/pool/resolve-pool-date-query";
import { publicMessageForStandingsFailure } from "@/lib/pool/standings-api-error";

/**
 * Round windows fan out one scoreboard fetch per playoff date plus one bracket fetch,
 * then optionally a live-today merge — give it a generous ceiling.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resolved = resolvePoolDateQueryParam(searchParams.get("date"));
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 400 });
  }

  try {
    const today = poolCalendarToday();
    const minFreshAsOf = poolCalendarExpectedLatestIngestAsOf(today);
    const db = getDb();
    if (db) {
      if (resolved.date === today) {
        const latest = await getLatestPoolIngestSnapshot(
          db,
          POOL_SNAPSHOT_KIND_REVIEW,
        );
        if (
          latest?.payload != null &&
          latest.asOfDate >= minFreshAsOf
        ) {
          return NextResponse.json(latest.payload, {
            headers: { "Cache-Control": POOL_INGEST_SNAPSHOT_CACHE_CONTROL },
          });
        }

        /**
         * Snapshot row missing but nightly team totals exist — materialize once and
         * persist (shared for all users). Does not run when ingest is absent (cron gap).
         */
        await ensurePoolIngestSnapshotsMaterialized(minFreshAsOf);

        const latestAfter = await getLatestPoolIngestSnapshot(
          db,
          POOL_SNAPSHOT_KIND_REVIEW,
        );
        if (
          latestAfter?.payload != null &&
          latestAfter.asOfDate >= minFreshAsOf
        ) {
          return NextResponse.json(latestAfter.payload, {
            headers: { "Cache-Control": POOL_INGEST_SNAPSHOT_CACHE_CONTROL },
          });
        }

        const snapY = await getPoolIngestSnapshotForDate(
          db,
          POOL_SNAPSHOT_KIND_REVIEW,
          minFreshAsOf,
        );
        if (snapY != null) {
          return NextResponse.json(snapY, {
            headers: { "Cache-Control": POOL_INGEST_SNAPSHOT_CACHE_CONTROL },
          });
        }

        /** Ingest missing for pool yesterday — avoid live NHL fan-out; serve last good snapshot. */
        if (latest?.payload != null) {
          return NextResponse.json(latest.payload, {
            headers: {
              "Cache-Control": POOL_STALE_INGEST_SNAPSHOT_CACHE_CONTROL,
              "X-Pool-Snapshot-Stale-Ingest": "1",
            },
          });
        }
      } else {
        const snap = await getPoolIngestSnapshotForDate(
          db,
          POOL_SNAPSHOT_KIND_REVIEW,
          resolved.date,
        );
        if (snap != null) {
          return NextResponse.json(snap, {
            headers: { "Cache-Control": POOL_INGEST_SNAPSHOT_CACHE_CONTROL },
          });
        }
      }
    }

    const payload = await getCachedPoolReview(resolved.date);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL },
    });
  } catch (e) {
    console.error("[pool/review]", e);
    const db = getDb();
    if (db) {
      try {
        const latest = await getLatestPoolIngestSnapshot(
          db,
          POOL_SNAPSHOT_KIND_REVIEW,
        );
        if (
          latest?.payload != null &&
          latest.asOfDate >= poolCalendarExpectedLatestIngestAsOf(poolCalendarToday())
        ) {
          return NextResponse.json(latest.payload, {
            headers: {
              "Cache-Control":
                "public, s-maxage=120, stale-while-revalidate=3600",
            },
          });
        }
        const y = previousCalendarDay(poolCalendarToday());
        const stale = await getPoolIngestSnapshotForDate(
          db,
          POOL_SNAPSHOT_KIND_REVIEW,
          y,
        );
        if (stale != null) {
          return NextResponse.json(stale, {
            headers: {
              "Cache-Control":
                "public, s-maxage=120, stale-while-revalidate=3600",
            },
          });
        }
      } catch {
        /* fall through to 502 */
      }
    }
    const message = publicMessageForStandingsFailure(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
