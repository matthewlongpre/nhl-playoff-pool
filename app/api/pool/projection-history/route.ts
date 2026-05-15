import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildProjectionHistory } from "@/lib/pool/build-projection-history";
import { POOL_INGEST_SNAPSHOT_CACHE_CONTROL } from "@/lib/pool/pool-snapshot-http";
import { publicMessageForStandingsFailure } from "@/lib/pool/standings-api-error";

export const maxDuration = 30;

export async function GET() {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  try {
    const payload = await buildProjectionHistory(db);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": POOL_INGEST_SNAPSHOT_CACHE_CONTROL },
    });
  } catch (e) {
    console.error("[pool/projection-history]", e);
    const message = publicMessageForStandingsFailure(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
