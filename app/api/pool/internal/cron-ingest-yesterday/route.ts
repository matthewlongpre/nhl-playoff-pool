import { NextResponse } from "next/server";
import { authorizePoolIngestRequest } from "@/lib/pool/cron-authorize";
import { runPoolYesterdayCalendarIngest } from "@/lib/pool/run-pool-yesterday-ingest";

/** NHL boxscores + DB writes can exceed default 10s on busy slates. */
export const maxDuration = 60;

/**
 * Vercel Cron calls this route daily (GET). Ingests **pool calendar yesterday**
 * into `pool_team_daily_points` so cumulative standings stay backed by Postgres
 * after each night. Requires `CRON_SECRET` (Bearer) — Vercel injects it when
 * the env var is set — **unless** `ALLOW_UNAUTHENTICATED_POOL_INGEST` is enabled.
 * Schedule: `vercel.json` → `crons`.
 */
export async function GET(request: Request) {
  if (!authorizePoolIngestRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runPoolYesterdayCalendarIngest();
}
