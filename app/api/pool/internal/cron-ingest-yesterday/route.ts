import { NextResponse } from "next/server";
import { authorizePoolIngestRequest } from "@/lib/pool/cron-authorize";
import { runPoolYesterdayIngestOnly } from "@/lib/pool/run-pool-yesterday-ingest";

/** Boxscore ingest only — snapshot materialization runs on `/api/pool/internal/cron-materialize-yesterday`. */
export const maxDuration = 120;

/**
 * Vercel Cron calls this route daily (GET). Ingests **pool calendar yesterday**
 * into `pool_team_daily_points` (snapshot JSON is written by a follow-up cron).
 * Requires `CRON_SECRET` (Bearer) — Vercel injects it when
 * the env var is set — **unless** `ALLOW_UNAUTHENTICATED_POOL_INGEST` is enabled.
 * Schedule: `vercel.json` → `crons`.
 */
export async function GET(request: Request) {
  if (!authorizePoolIngestRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runPoolYesterdayIngestOnly();
}
