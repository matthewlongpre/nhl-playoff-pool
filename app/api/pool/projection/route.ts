import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildProjectionPayload } from "@/lib/pool/build-projection-payload";
import { ensurePoolIngestSnapshotsMaterialized } from "@/lib/pool/ensure-pool-ingest-snapshots";
import {
  getLatestPoolIngestSnapshot,
  getPoolIngestSnapshotForDate,
  POOL_SNAPSHOT_KIND_PROJECTION,
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

/** Bracket walk + DB aggregate is fast; matches `/api/pool/team/[teamId]`. */
export const maxDuration = 60;

/** Live path when snapshots are missing — standings can still move during games. */
const PROJECTION_LIVE_CACHE_CONTROL =
  "public, s-maxage=30, stale-while-revalidate=300";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resolved = resolvePoolDateQueryParam(searchParams.get("date"));
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 400 });
  }
  const date = resolved.date;
  const today = poolCalendarToday();
  const minFreshAsOf = poolCalendarExpectedLatestIngestAsOf(today);
  const db = getDb();

  try {
    if (db) {
      if (date === today) {
        const latest = await getLatestPoolIngestSnapshot(
          db,
          POOL_SNAPSHOT_KIND_PROJECTION,
        );
        if (
          latest?.payload != null &&
          latest.asOfDate >= minFreshAsOf
        ) {
          return NextResponse.json(latest.payload, {
            headers: { "Cache-Control": POOL_INGEST_SNAPSHOT_CACHE_CONTROL },
          });
        }

        await ensurePoolIngestSnapshotsMaterialized(minFreshAsOf);

        const latestAfter = await getLatestPoolIngestSnapshot(
          db,
          POOL_SNAPSHOT_KIND_PROJECTION,
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
          POOL_SNAPSHOT_KIND_PROJECTION,
          minFreshAsOf,
        );
        if (snapY != null) {
          return NextResponse.json(snapY, {
            headers: { "Cache-Control": POOL_INGEST_SNAPSHOT_CACHE_CONTROL },
          });
        }

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
          POOL_SNAPSHOT_KIND_PROJECTION,
          date,
        );
        if (snap != null) {
          return NextResponse.json(snap, {
            headers: { "Cache-Control": POOL_INGEST_SNAPSHOT_CACHE_CONTROL },
          });
        }
      }
    }

    const payload = await buildProjectionPayload(date);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": PROJECTION_LIVE_CACHE_CONTROL },
    });
  } catch (e) {
    console.error("[pool/projection]", e);
    const db = getDb();
    if (db) {
      try {
        const latest = await getLatestPoolIngestSnapshot(
          db,
          POOL_SNAPSHOT_KIND_PROJECTION,
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
          POOL_SNAPSHOT_KIND_PROJECTION,
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
        /* fall through */
      }
    }
    const message = publicMessageForStandingsFailure(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
