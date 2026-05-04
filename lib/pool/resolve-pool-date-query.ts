import { poolCalendarToday } from "@/lib/pool/pool-season";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ResolveOk = { ok: true; date: string };
type ResolveErr = { ok: false; message: string };

/**
 * Pool APIs treat a missing `date` as “as of now”: pool calendar today (see
 * `getPoolCalendarTimezone`), matching merge-today handling in cumulative code.
 */
export function resolvePoolDateQueryParam(raw: string | null): ResolveOk | ResolveErr {
  if (raw == null || raw.length === 0) {
    return { ok: true, date: poolCalendarToday() };
  }
  if (!DATE_RE.test(raw)) {
    return {
      ok: false,
      message:
        "Query parameter `date`, when provided, must be YYYY-MM-DD.",
    };
  }
  return { ok: true, date: raw };
}
