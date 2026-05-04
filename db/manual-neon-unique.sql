-- If ingest fails with "no unique or exclusion constraint matching ON CONFLICT",
-- run this once in the Neon SQL editor (then re-run `npm run db:push` from dev).

-- If an old unique INDEX blocks adding the constraint, drop it first:
-- DROP INDEX IF EXISTS pool_team_daily_points_team_date_uidx;

ALTER TABLE pool_team_daily_points
  ADD CONSTRAINT pool_team_daily_points_team_date_uidx
  UNIQUE (team_id, date);

-- Same drill for the per-skater-per-day table:
-- DROP INDEX IF EXISTS pool_skater_daily_points_player_date_uidx;

ALTER TABLE pool_skater_daily_points
  ADD CONSTRAINT pool_skater_daily_points_player_date_uidx
  UNIQUE (nhl_player_id, date);
