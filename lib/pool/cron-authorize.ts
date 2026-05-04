/** Shared by ingest POST and Vercel Cron GET handlers. */
export function authorizeCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length === 0) {
    return false;
  }
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return false;
  }
  const token = auth.slice("Bearer ".length).trim();
  return token === secret;
}

/**
 * When `ALLOW_UNAUTHENTICATED_POOL_INGEST=true` (or `1`), pool ingest routes accept
 * requests **without** `Authorization: Bearer CRON_SECRET`. Use only behind deployment
 * protection or a private network — the URL becomes a write capability.
 */
export function allowUnauthenticatedPoolIngestFromEnv(): boolean {
  const v = process.env.ALLOW_UNAUTHENTICATED_POOL_INGEST;
  return v === "true" || v === "1";
}

/** Cron Bearer token **or** opt-in unauthenticated ingest (see env above). */
export function authorizePoolIngestRequest(request: Request): boolean {
  if (allowUnauthenticatedPoolIngestFromEnv()) {
    return true;
  }
  return authorizeCronRequest(request);
}
