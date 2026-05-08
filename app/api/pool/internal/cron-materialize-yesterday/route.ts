import { NextResponse } from "next/server";
import { authorizePoolIngestRequest } from "@/lib/pool/cron-authorize";
import { runPoolYesterdaySnapshotOnly } from "@/lib/pool/run-pool-yesterday-ingest";

/** `buildPoolReview` + `buildProjectionPayload` + DB writes; Vercel max duration must allow this value. */
export const maxDuration = 120;

/**
 * Second-phase nightly job: materialize review + projection snapshots for pool-calendar
 * **yesterday** after `runPoolYesterdayIngestOnly` has written daily rows.
 * Schedule: `vercel.json` → `crons` (a few minutes after ingest cron).
 */
export async function GET(request: Request) {
  if (!authorizePoolIngestRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runPoolYesterdaySnapshotOnly();
}
