import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

/** Vercel Postgres / Storage often injects `POSTGRES_URL` (pooled); local dev uses `DATABASE_URL`. */
function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return url && url.length > 0 ? url : undefined;
}

function isLocalPostgresUrl(url: string): boolean {
  return (
    url.includes("127.0.0.1") ||
    url.includes("localhost") ||
    url.includes("host.docker.internal")
  );
}

const globalForDb = globalThis as unknown as {
  pool?: ReturnType<typeof postgres>;
  db?: Db;
};

export function getDb(): Db | null {
  const url = databaseUrl();
  if (!url) {
    return null;
  }
  if (!globalForDb.db) {
    const client = postgres(url, {
      max: 1,
      prepare: false,
      // Neon / most cloud Postgres require TLS; local Docker typically does not.
      ...(isLocalPostgresUrl(url) ? {} : { ssl: "require" as const }),
    });
    globalForDb.pool = client;
    globalForDb.db = drizzle(client, { schema });
  }
  return globalForDb.db;
}
