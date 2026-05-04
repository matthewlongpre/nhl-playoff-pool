import { NextResponse } from "next/server";
import { addDays, format, parseISO } from "date-fns";
import {
  assertIngestDateNotTodayIfStrict,
  ingestPoolPointsForCalendarDate,
} from "@/lib/pool/ingest-daily-points";
import { joinErrorChain } from "@/lib/pool/db-error-chain";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Shared POST body handler for `/api/pool/internal/ingest-daily` and `/api/pool/internal/reingest`. */
export async function handleIngestDailyPost(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const strictToday = url.searchParams.get("strictToday") === "1";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected JSON object" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if ("from" in b && "to" in b) {
    const from = b.from;
    const to = b.to;
    if (typeof from !== "string" || typeof to !== "string" || !DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json(
        { error: "`from` and `to` must be YYYY-MM-DD" },
        { status: 400 },
      );
    }
    if (from > to) {
      return NextResponse.json({ error: "`from` must be <= `to`" }, { status: 400 });
    }

    const results: Array<{ date: string; gamesOnSlate: number; teamsWritten: number }> = [];
    let cursor = parseISO(from);
    const end = parseISO(to);
    while (cursor.getTime() <= end.getTime()) {
      const ds = format(cursor, "yyyy-MM-dd");
      try {
        assertIngestDateNotTodayIfStrict(ds, strictToday);
        const r = await ingestPoolPointsForCalendarDate(ds);
        results.push({ date: ds, ...r });
      } catch (e) {
        console.error("[ingest-daily]", e);
        const message = e instanceof Error ? e.message : "Ingest failed";
        return NextResponse.json(
          {
            error: message,
            detail: joinErrorChain(e),
            partial: results,
          },
          { status: 502 },
        );
      }
      cursor = addDays(cursor, 1);
      await new Promise((r) => setTimeout(r, 150));
    }

    return NextResponse.json({ ok: true, count: results.length, results });
  }

  const date = b.date;
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "Body must include `date` (YYYY-MM-DD) or `from`/`to` range" },
      { status: 400 },
    );
  }

  try {
    assertIngestDateNotTodayIfStrict(date, strictToday);
    const r = await ingestPoolPointsForCalendarDate(date);
    return NextResponse.json({ ok: true, date, ...r });
  } catch (e) {
    console.error("[ingest-daily]", e);
    const message = e instanceof Error ? e.message : "Ingest failed";
    return NextResponse.json(
      { error: message, detail: joinErrorChain(e) },
      { status: 502 },
    );
  }
}
