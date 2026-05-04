import { collectErrorMessages } from "@/lib/pool/db-error-chain";

/**
 * Map DB/driver errors to a safe client message; log the full chain server-side.
 */
export function publicMessageForStandingsFailure(error: unknown): string {
  const chain = collectErrorMessages(error);
  const joined = chain.join(" ");

  if (
    /pool_team_daily_points/i.test(joined) &&
    /does not exist|relation/i.test(joined)
  ) {
    return "Database tables are missing on Neon. Production (Vercel) only talks to Neon—it does not create tables. One-time: copy DATABASE_URL from this project’s Vercel env, run `npm run db:push` locally (or in CI) against that same URL, then reload.";
  }

  if (process.env.NODE_ENV === "production") {
    return "Could not load standings. See Vercel function logs for details.";
  }

  return chain[0] ?? "Standings failed";
}
