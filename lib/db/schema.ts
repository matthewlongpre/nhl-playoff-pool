import {
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/** Fantasy points earned by one pool team on one calendar day (playoff games). */
export const poolTeamDailyPoints = pgTable(
  "pool_team_daily_points",
  {
    id: serial("id").primaryKey(),
    teamId: text("team_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    skaterPoints: integer("skater_points").notNull().default(0),
    teamWinPoints: integer("team_win_points").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    /** Table-level UNIQUE so `ON CONFLICT (team_id, date)` upserts work reliably on Postgres/Neon. */
    teamDateUq: unique("pool_team_daily_points_team_date_uidx").on(
      t.teamId,
      t.date,
    ),
  }),
);

export type PoolTeamDailyPointsRow = typeof poolTeamDailyPoints.$inferSelect;

/**
 * Goals/assists by one NHL skater on one playoff calendar day. Persisted only for
 * skaters referenced by at least one pool roster pick (table stays small) and only
 * on days they recorded a non-zero stat. In playoffs each skater plays at most one
 * game per day, so per-day rows double as per-game data.
 */
export const poolSkaterDailyPoints = pgTable(
  "pool_skater_daily_points",
  {
    id: serial("id").primaryKey(),
    nhlPlayerId: integer("nhl_player_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    goals: integer("goals").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    /** Roster-pick snapshot of the player's NHL team at draft time (display only). */
    nhlTeamAbbrev: text("nhl_team_abbrev"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    /** Table-level UNIQUE so `ON CONFLICT (nhl_player_id, date)` upserts work reliably on Postgres/Neon. */
    playerDateUq: unique("pool_skater_daily_points_player_date_uidx").on(
      t.nhlPlayerId,
      t.date,
    ),
  }),
);

export type PoolSkaterDailyPointsRow = typeof poolSkaterDailyPoints.$inferSelect;
