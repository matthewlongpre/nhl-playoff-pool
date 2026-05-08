/** Cache headers for JSON written only by ingest — safe for browsers and CDN. */
export const POOL_INGEST_SNAPSHOT_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * Latest nightly snapshot is behind pool-calendar yesterday (ingest not landed yet).
 * Short TTL so clients pick up fresh rows soon after cron without hammering NHL.
 */
export const POOL_STALE_INGEST_SNAPSHOT_CACHE_CONTROL =
  "public, max-age=120, s-maxage=120, stale-while-revalidate=600";
