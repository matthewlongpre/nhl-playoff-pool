import {
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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

/** Precomputed JSON from nightly ingest — review + projection (cheap reads for clients). */
export const poolIngestSnapshots = pgTable(
  "pool_ingest_snapshots",
  {
    id: serial("id").primaryKey(),
    asOfDate: date("as_of_date", { mode: "string" }).notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    dateKindUq: unique("pool_ingest_snapshots_date_kind_uidx").on(
      t.asOfDate,
      t.kind,
    ),
  }),
);

export type PoolIngestSnapshotRow = typeof poolIngestSnapshots.$inferSelect;

/**
 * Cached NHL `/scoreboard/{date}` JSON for round-window derivation (`composePlayoffRoundWindows`).
 * Keyed by playoff season year + calendar date so overlapping seasons cannot collide.
 */
export const nhlScoreboardDayCache = pgTable(
  "nhl_scoreboard_day_cache",
  {
    playoffSeason: integer("playoff_season").notNull(),
    calendarDate: date("calendar_date", { mode: "string" }).notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.playoffSeason, t.calendarDate] }),
  }),
);

export type NhlScoreboardDayCacheRow = typeof nhlScoreboardDayCache.$inferSelect;

/**
 * Records when each NHL team was eliminated from the playoffs, derived from the
 * scoreboard day cache (series clinching games). PK on (abbrev, season) ensures
 * one row per team per season; `ON CONFLICT DO NOTHING` during ingest preserves
 * the earliest-detected date across reingests.
 */
export const poolNhlEliminationEvents = pgTable(
  "pool_nhl_elimination_events",
  {
    nhlTeamAbbrev: text("nhl_team_abbrev").notNull(),
    eliminatedDate: date("eliminated_date", { mode: "string" }).notNull(),
    playoffSeason: integer("playoff_season").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.nhlTeamAbbrev, t.playoffSeason] }),
  }),
);

export type PoolNhlEliminationEventRow =
  typeof poolNhlEliminationEvents.$inferSelect;
