import { NextResponse } from "next/server";
import { authorizePoolIngestRequest } from "@/lib/pool/cron-authorize";
import { handleIngestDailyPost } from "@/lib/pool/handle-ingest-daily-post";
import { poolCalendarToday } from "@/lib/pool/pool-season";

/**
 * Secured endpoint to upsert per-team daily fantasy points (for backfill and cron).
 *
 * POST JSON body:
 * - `{ "date": "YYYY-MM-DD" }` — ingest a single day
 * - `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }` — inclusive range, sequential
 *
 * Query: `strictToday=1` rejects ingesting today or future dates (recommended for cron).
 *
 * Auth: `Authorization: Bearer CRON_SECRET`, **or** set `ALLOW_UNAUTHENTICATED_POOL_INGEST=true`
 * (see `.env.example`) to allow requests without a Bearer token (use with care).
 */
export async function POST(request: Request) {
  if (!authorizePoolIngestRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return handleIngestDailyPost(request);
}

/** GET health: confirms route exists (no secrets). */
export async function GET() {
  const hasSecret = Boolean(process.env.CRON_SECRET?.length);
  const hasDb = Boolean(
    process.env.DATABASE_URL?.length || process.env.POSTGRES_URL?.length,
  );
  const openIngest = Boolean(
    process.env.ALLOW_UNAUTHENTICATED_POOL_INGEST === "true" ||
      process.env.ALLOW_UNAUTHENTICATED_POOL_INGEST === "1",
  );
  return NextResponse.json({
    ok: true,
    cronSecretConfigured: hasSecret,
    databaseUrlConfigured: hasDb,
    unauthenticatedPoolIngestEnabled: openIngest,
    today: poolCalendarToday(),
  });
}
