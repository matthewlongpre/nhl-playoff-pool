import { NextResponse } from "next/server";
import { authorizePoolIngestRequest } from "@/lib/pool/cron-authorize";
import { handleIngestDailyPost } from "@/lib/pool/handle-ingest-daily-post";
import { runPoolYesterdayCalendarIngest } from "@/lib/pool/run-pool-yesterday-ingest";

/** NHL boxscores + DB writes can exceed default 10s on busy slates. */
export const maxDuration = 60;

/**
 * Manual pool ingest: same behavior as cron + `ingest-daily`, with shared auth.
 *
 * - **GET** — ingest pool-calendar **yesterday** (same as `/api/pool/internal/cron-ingest-yesterday`).
 * - **POST** — JSON body like `/api/pool/internal/ingest-daily` (`date` or `from`/`to`).
 *
 * Auth: `Authorization: Bearer CRON_SECRET`, **or** `ALLOW_UNAUTHENTICATED_POOL_INGEST=true`
 * so you can call from a browser or curl without a Bearer header (only if you accept the risk).
 */
export async function GET(request: Request) {
  if (!authorizePoolIngestRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runPoolYesterdayCalendarIngest();
}

export async function POST(request: Request) {
  if (!authorizePoolIngestRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return handleIngestDailyPost(request);
}
