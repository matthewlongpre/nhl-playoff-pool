export const NHL_WEB_API = "https://api-web.nhle.com/v1";

export const SCOREBOARD_CACHE_CONTROL =
  "public, s-maxage=5, stale-while-revalidate=30";

/** Default cumulative standings (`getCachedLeaderboardResponse`) — longer CDN TTL than live slate APIs. */
export const POOL_STANDINGS_CACHE_CONTROL =
  "public, s-maxage=30, stale-while-revalidate=120";

export const BOXSCORE_CACHE_CONTROL =
  "public, s-maxage=5, stale-while-revalidate=60";
