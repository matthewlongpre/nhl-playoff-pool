import { and, eq, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { nhlScoreboardDayCache } from "@/lib/db/schema";
import { playoffSeasonFromDate } from "@/lib/nhl/playoff-status";
import {
  type ScoreboardResponse,
  scoreboardResponseSchema,
} from "@/lib/nhl/schemas";

const CACHE_KEY_TAIL_ENV = "POOL_SCOREBOARD_CACHE_TAIL_DAYS";

/** Last N calendar dates in the playoff window are always re-fetched (late corrections). */
export function getScoreboardCacheTailDays(): number {
  const raw = process.env[CACHE_KEY_TAIL_ENV];
  if (raw == null || raw === "") return 2;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

function cacheKey(playoffSeason: number, calendarDate: string): string {
  return `${playoffSeason}:${calendarDate}`;
}

/**
 * The last `tailDays` dates in `dates` (preserving ascending sort).
 * Exported for tests.
 */
export function tailDatesToRefresh(
  datesAscending: ReadonlyArray<string>,
  tailDays: number,
): Set<string> {
  if (tailDays <= 0 || datesAscending.length === 0) return new Set();
  const n = Math.min(tailDays, datesAscending.length);
  const out = new Set<string>();
  for (let i = datesAscending.length - n; i < datesAscending.length; i++) {
    out.add(datesAscending[i]!);
  }
  return out;
}

function parseStoredPayload(raw: unknown): ScoreboardResponse | null {
  const parsed = scoreboardResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Dates that must be fetched: cache miss, corrupt row, or tail refresh. */
export function computeDatesNeedingFetch(args: {
  datesAscending: ReadonlyArray<string>;
  cachedValidByKey: ReadonlyMap<string, ScoreboardResponse>;
  tailDays: number;
}): string[] {
  const tail = tailDatesToRefresh(args.datesAscending, args.tailDays);
  const out: string[] = [];
  for (const d of args.datesAscending) {
    const season = playoffSeasonFromDate(d);
    const key = cacheKey(season, d);
    if (tail.has(d)) {
      out.push(d);
      continue;
    }
    if (!args.cachedValidByKey.has(key)) {
      out.push(d);
    }
  }
  return out;
}

export async function loadCachedScoreboards(
  db: Db,
  datesAscending: ReadonlyArray<string>,
): Promise<Map<string, ScoreboardResponse>> {
  const out = new Map<string, ScoreboardResponse>();
  if (datesAscending.length === 0) return out;

  const conditions = datesAscending.map((d) =>
    and(
      eq(nhlScoreboardDayCache.playoffSeason, playoffSeasonFromDate(d)),
      eq(nhlScoreboardDayCache.calendarDate, d),
    ),
  );

  const whereClause =
    conditions.length === 1 ? conditions[0]! : or(...conditions);

  const rows = await db
    .select({
      playoffSeason: nhlScoreboardDayCache.playoffSeason,
      calendarDate: nhlScoreboardDayCache.calendarDate,
      payload: nhlScoreboardDayCache.payload,
    })
    .from(nhlScoreboardDayCache)
    .where(whereClause);

  for (const r of rows) {
    const parsed = parseStoredPayload(r.payload);
    if (parsed == null) continue;
    out.set(cacheKey(r.playoffSeason, r.calendarDate), parsed);
  }
  return out;
}

export async function upsertScoreboardDayCache(
  db: Db,
  entries: ReadonlyArray<{ calendarDate: string; payload: ScoreboardResponse }>,
): Promise<void> {
  if (entries.length === 0) return;

  const now = new Date();
  for (const e of entries) {
    const playoffSeason = playoffSeasonFromDate(e.calendarDate);
    await db
      .insert(nhlScoreboardDayCache)
      .values({
        playoffSeason,
        calendarDate: e.calendarDate,
        payload: e.payload as unknown as Record<string, unknown>,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          nhlScoreboardDayCache.playoffSeason,
          nhlScoreboardDayCache.calendarDate,
        ],
        set: {
          payload: e.payload as unknown as Record<string, unknown>,
          fetchedAt: sql`now()`,
        },
      });
  }
}
