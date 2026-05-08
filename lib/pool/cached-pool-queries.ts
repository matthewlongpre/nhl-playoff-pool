import { unstable_cache } from "next/cache";
import { buildLeaderboardResponse } from "@/lib/pool/leaderboard-cumulative";
import { buildDailyPointsSeries } from "@/lib/pool/daily-points-series";
import { buildPoolReview } from "@/lib/pool/scope-summary";

/** Shared TTL for deduping Neon-heavy builders across concurrent requests. */
const POOL_QUERY_CACHE_REVALIDATE_SEC = 120;

const cachedLeaderboard = unstable_cache(
  async (asOfDate: string) => buildLeaderboardResponse(asOfDate),
  ["pool", "leaderboard-response"],
  { revalidate: POOL_QUERY_CACHE_REVALIDATE_SEC },
);

const cachedDailyPointsSeries = unstable_cache(
  async (asOfDate: string) => buildDailyPointsSeries(asOfDate),
  ["pool", "daily-points-series"],
  { revalidate: POOL_QUERY_CACHE_REVALIDATE_SEC },
);

const cachedPoolReview = unstable_cache(
  async (asOfDate: string) => buildPoolReview(asOfDate),
  ["pool", "review-payload"],
  { revalidate: POOL_QUERY_CACHE_REVALIDATE_SEC },
);

export function getCachedLeaderboardResponse(asOfDate: string) {
  return cachedLeaderboard(asOfDate);
}

export function getCachedDailyPointsSeries(asOfDate: string) {
  return cachedDailyPointsSeries(asOfDate);
}

export function getCachedPoolReview(asOfDate: string) {
  return cachedPoolReview(asOfDate);
}
