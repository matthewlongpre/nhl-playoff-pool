import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// `vercel env pull .env.local` — load like Next.js: `.env` then `.env.local` overrides.
config({ path: ".env" });
config({ path: ".env.local", override: true });

/** Schema sync only (`npm run db:push`) — no versioned migrations while in active development. */
function drizzleDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    ""
  );
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: drizzleDatabaseUrl(),
  },
});
