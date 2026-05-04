import { format, parseISO, subDays } from "date-fns";

/**
 * First calendar day to include in cumulative playoff fantasy scoring.
 * Override with POOL_PLAYOFF_START_DATE=YYYY-MM-DD in production.
 */
export function getPoolPlayoffStartDate(): string {
  const env = process.env.POOL_PLAYOFF_START_DATE;
  if (env && /^\d{4}-\d{2}-\d{2}$/.test(env)) {
    return env;
  }
  /** Default: start of 2026 Stanley Cup Playoffs (adjust when known). */
  return "2026-04-18";
}

/**
 * IANA zone for “what calendar day is it for the pool?” Defaults to Pacific so
 * 5pm PT is still the same NHL evening as “today”, not UTC midnight (Vercel).
 * Set `NEXT_PUBLIC_POOL_CALENDAR_TIMEZONE` (client + server) or `POOL_CALENDAR_TIMEZONE` (server).
 */
export function getPoolCalendarTimezone(): string {
  const pub =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_POOL_CALENDAR_TIMEZONE;
  if (pub && pub.length > 0) {
    return pub;
  }
  const srv = typeof process !== "undefined" && process.env.POOL_CALENDAR_TIMEZONE;
  if (srv && srv.length > 0) {
    return srv;
  }
  return "America/Los_Angeles";
}

function formatYyyyMmDdInTimeZone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) {
    return format(d, "yyyy-MM-dd");
  }
  return `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** “Today” for standings, ingest guards, and merge-today — pool calendar, not raw UTC. */
export function poolCalendarToday(): string {
  return formatYyyyMmDdInTimeZone(new Date(), getPoolCalendarTimezone());
}

/** @deprecated Use {@link poolCalendarToday} — old name implied UTC only. */
export function calendarTodayUtc(): string {
  return poolCalendarToday();
}

/** Previous calendar day (YYYY-MM-DD). */
export function previousCalendarDay(date: string): string {
  return format(subDays(parseISO(date), 1), "yyyy-MM-dd");
}
