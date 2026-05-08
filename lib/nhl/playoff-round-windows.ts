import type { Db } from "@/lib/db";
import { playoffSeasonFromDate } from "@/lib/nhl/playoff-status";
import {
  computeDatesNeedingFetch,
  getScoreboardCacheTailDays,
  loadCachedScoreboards,
  upsertScoreboardDayCache,
} from "@/lib/nhl/scoreboard-day-cache";
import type {
  PlayoffBracketResponse,
  ScoreboardResponse,
} from "@/lib/nhl/schemas";
import { getCachedPlayoffBracket } from "@/lib/nhl/cached-playoff-bracket";
import { fetchNhlScoreboard } from "@/lib/nhl/upstream";
import { isPlayoffGame } from "@/lib/pool/scoring";

/** A series is decided once one side has 4 wins. */
const SERIES_WIN_THRESHOLD = 4;

/** Stanley Cup playoff round status. */
export type RoundStatus = "upcoming" | "active" | "complete";

export type RoundWindow = {
  round: number;
  status: RoundStatus;
  startDate: string | null;
  endDate: string | null;
  /** Distinct calendar dates with at least one playoff game in this round. */
  dates: string[];
};

export type PlayoffRoundWindows = {
  /** For each playoff date with games, the round that contributed the most games that day. */
  dateToDominantRound: Map<string, number>;
  roundsByNumber: Map<number, RoundWindow>;
};

/** Count of series at each Stanley Cup round in a 16-team bracket. */
const EXPECTED_SERIES_PER_ROUND: Record<number, number> = {
  1: 8,
  2: 4,
  3: 2,
  4: 1,
};

/** Inclusive YYYY-MM-DD range, no DST shenanigans (treats dates as UTC midnight). */
export function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return out;
  if (endTime < startTime) return out;
  const oneDay = 24 * 60 * 60 * 1000;
  for (let t = startTime; t <= endTime; t += oneDay) {
    const d = new Date(t);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

/**
 * Pure: derive `{ dateToDominantRound, roundsByNumber }` from already-fetched scoreboard
 * pages and the bracket. Each scoreboard's `gamesByDate` may include extra dates beyond
 * the requested key — we collapse all of them into a single per-date view.
 */
export function composePlayoffRoundWindows(args: {
  scoreboards: ReadonlyArray<ScoreboardResponse>;
  bracket: PlayoffBracketResponse | null;
  /** Optional clamp so we don't surface dates beyond the queried window. */
  windowStart?: string;
  windowEnd?: string;
}): PlayoffRoundWindows {
  const dateToCounts = new Map<string, Map<number, number>>();
  const roundDates = new Map<number, Set<string>>();

  for (const scoreboard of args.scoreboards) {
    for (const day of scoreboard.gamesByDate) {
      const date = day.date;
      if (args.windowStart && date < args.windowStart) continue;
      if (args.windowEnd && date > args.windowEnd) continue;
      for (const game of day.games) {
        if (!isPlayoffGame(game)) continue;
        const round = game.seriesStatus?.round;
        if (round == null || !Number.isFinite(round)) continue;
        const counts = dateToCounts.get(date) ?? new Map<number, number>();
        counts.set(round, (counts.get(round) ?? 0) + 1);
        dateToCounts.set(date, counts);
        const set = roundDates.get(round) ?? new Set<string>();
        set.add(date);
        roundDates.set(round, set);
      }
    }
  }

  const dateToDominantRound = new Map<string, number>();
  for (const [date, counts] of dateToCounts) {
    let best: { round: number; count: number } | null = null;
    for (const [round, count] of counts) {
      if (
        !best ||
        count > best.count ||
        (count === best.count && round < best.round)
      ) {
        best = { round, count };
      }
    }
    if (best) dateToDominantRound.set(date, best.round);
  }

  const completedSeriesByRound = new Map<number, number>();
  const totalSeriesByRound = new Map<number, number>();
  if (args.bracket) {
    for (const series of args.bracket.series) {
      const r = series.playoffRound;
      if (!Number.isFinite(r)) continue;
      totalSeriesByRound.set(r, (totalSeriesByRound.get(r) ?? 0) + 1);
      const decided =
        series.topSeedWins >= SERIES_WIN_THRESHOLD ||
        series.bottomSeedWins >= SERIES_WIN_THRESHOLD;
      if (decided) {
        completedSeriesByRound.set(
          r,
          (completedSeriesByRound.get(r) ?? 0) + 1,
        );
      }
    }
  }

  const roundsByNumber = new Map<number, RoundWindow>();
  for (const round of [1, 2, 3, 4]) {
    const dateSet = roundDates.get(round) ?? new Set<string>();
    const dates = [...dateSet].sort();
    const startDate = dates[0] ?? null;
    const endDate = dates[dates.length - 1] ?? null;

    const expected =
      EXPECTED_SERIES_PER_ROUND[round] ?? totalSeriesByRound.get(round) ?? 0;
    const completed = completedSeriesByRound.get(round) ?? 0;

    let status: RoundStatus;
    if (dates.length === 0) {
      status = "upcoming";
    } else if (expected > 0 && completed >= expected) {
      status = "complete";
    } else {
      status = "active";
    }

    roundsByNumber.set(round, { round, status, startDate, endDate, dates });
  }

  return { dateToDominantRound, roundsByNumber };
}

/** Small batches avoid tripping NHL 429 when the playoff window spans many days. */
const SCOREBOARD_FETCH_CONCURRENCY = 4;
const PAUSE_BETWEEN_SCOREBOARD_BATCHES_MS = 120;

/**
 * Fetch NHL scoreboards for `dates` only (subset of the playoff window).
 * Failed days are omitted; mirrors legacy behavior when a single date fails upstream.
 */
export async function fetchScoreboardsInBatches(
  dates: ReadonlyArray<string>,
): Promise<Map<string, ScoreboardResponse>> {
  const out = new Map<string, ScoreboardResponse>();
  if (dates.length === 0) return out;

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  for (let i = 0; i < dates.length; i += SCOREBOARD_FETCH_CONCURRENCY) {
    const slice = dates.slice(i, i + SCOREBOARD_FETCH_CONCURRENCY);
    const settled = await Promise.allSettled(
      slice.map((d) => fetchNhlScoreboard(d)),
    );
    settled.forEach((r, j) => {
      if (r.status === "fulfilled") {
        out.set(slice[j]!, r.value);
      }
    });
    if (i + SCOREBOARD_FETCH_CONCURRENCY < dates.length) {
      await sleep(PAUSE_BETWEEN_SCOREBOARD_BATCHES_MS);
    }
  }
  return out;
}

function cacheLookupKey(calendarDate: string): string {
  return `${playoffSeasonFromDate(calendarDate)}:${calendarDate}`;
}

/**
 * Fetch scoreboards across the playoff window in small batches (avoids NHL 429s) plus
 * the playoff bracket, then compose round windows.
 *
 * When `db` is set, uses `nhl_scoreboard_day_cache`: loads hits from Postgres, fetches
 * only misses plus a rolling tail refresh (`POOL_SCOREBOARD_CACHE_TAIL_DAYS`, default 2).
 */
export async function buildPlayoffRoundWindows(
  playoffStart: string,
  asOfDate: string,
  db?: Db | null,
): Promise<PlayoffRoundWindows> {
  const dates = eachDateInclusive(playoffStart, asOfDate);
  if (dates.length === 0) {
    return { dateToDominantRound: new Map(), roundsByNumber: new Map() };
  }

  let scoreboards: ScoreboardResponse[];

  if (db) {
    const cached = await loadCachedScoreboards(db, dates);
    const tailDays = getScoreboardCacheTailDays();
    const needFetch = computeDatesNeedingFetch({
      datesAscending: dates,
      cachedValidByKey: cached,
      tailDays,
    });
    if (process.env.NODE_ENV !== "test") {
      console.log(
        `[nhl_scoreboard_cache] scoreboard_fetch_dates=${needFetch.length} total_window_days=${dates.length}`,
      );
    }

    const fetchedByDate = await fetchScoreboardsInBatches(needFetch);
    const upserts: { calendarDate: string; payload: ScoreboardResponse }[] = [];
    for (const d of needFetch) {
      const sb = fetchedByDate.get(d);
      if (sb != null) upserts.push({ calendarDate: d, payload: sb });
    }
    await upsertScoreboardDayCache(db, upserts);

    scoreboards = [];
    for (const d of dates) {
      const key = cacheLookupKey(d);
      const fresh = fetchedByDate.get(d);
      if (fresh != null) {
        scoreboards.push(fresh);
        continue;
      }
      const hit = cached.get(key);
      if (hit != null) {
        scoreboards.push(hit);
      }
    }
  } else {
    const fetchedByDate = await fetchScoreboardsInBatches(dates);
    scoreboards = dates
      .map((d) => fetchedByDate.get(d))
      .filter((sb): sb is ScoreboardResponse => sb != null);
  }

  let bracket: PlayoffBracketResponse | null = null;
  try {
    bracket = await getCachedPlayoffBracket(playoffSeasonFromDate(asOfDate));
  } catch {
    bracket = null;
  }

  return composePlayoffRoundWindows({
    scoreboards,
    bracket,
    windowStart: playoffStart,
    windowEnd: asOfDate,
  });
}
