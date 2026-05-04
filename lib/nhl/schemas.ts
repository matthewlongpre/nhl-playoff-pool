import { z } from "zod";

/** NHL game types: 2 = regular season, 3 = playoffs */
export const scoreboardTeamSchema = z
  .object({
    id: z.number(),
    abbrev: z.string(),
    score: z.number().optional(),
    sog: z.number().optional(),
    name: z
      .object({
        default: z.string().optional(),
      })
      .passthrough()
      .optional(),
    commonName: z
      .object({
        default: z.string(),
      })
      .passthrough()
      .optional(),
    logo: z.string().optional(),
    record: z.string().optional(),
  })
  .passthrough();

export const seriesStatusSchema = z
  .object({
    round: z.number(),
    seriesAbbrev: z.string(),
    game: z.number(),
    /** May be absent on placeholder `FUT` / TBD games before the slot is filled. */
    topSeedTeamAbbrev: z.string().optional(),
    topSeedWins: z.number(),
    /** May be absent when the second-round (etc.) opponent is not yet known. */
    bottomSeedTeamAbbrev: z.string().optional(),
    bottomSeedWins: z.number(),
  })
  .passthrough();

export const clockSchema = z
  .object({
    timeRemaining: z.string().optional(),
    secondsRemaining: z.number().optional(),
    running: z.boolean().optional(),
    inIntermission: z.boolean().optional(),
  })
  .passthrough();

export const periodDescriptorSchema = z
  .object({
    number: z.number(),
    periodType: z.string(),
    maxRegulationPeriods: z.number().optional(),
  })
  .passthrough();

export const scoreboardGameSchema = z
  .object({
    id: z.number(),
    season: z.number(),
    gameType: z.number(),
    gameDate: z.string(),
    gameState: z.string(),
    /** Absent for some `FUT` games when `gameScheduleState` is `TBD` (placeholder slot). */
    startTimeUTC: z.string().optional(),
    awayTeam: scoreboardTeamSchema,
    homeTeam: scoreboardTeamSchema,
    clock: clockSchema.optional(),
    period: z.number().optional(),
    periodDescriptor: periodDescriptorSchema.optional(),
    seriesStatus: seriesStatusSchema.optional(),
  })
  .passthrough();

export const gamesByDateSchema = z.object({
  date: z.string(),
  games: z.array(scoreboardGameSchema),
});

export const scoreboardResponseSchema = z.object({
  focusedDate: z.string().optional(),
  focusedDateCount: z.number().optional(),
  gamesByDate: z.array(gamesByDateSchema),
});

export const playoffBracketTeamSchema = z
  .object({
    id: z.number(),
    abbrev: z.string(),
    logo: z.string().optional(),
    darkLogo: z.string().optional(),
  })
  .passthrough();

export const playoffBracketSeriesSchema = z
  .object({
    seriesAbbrev: z.string(),
    playoffRound: z.number(),
    topSeedWins: z.number(),
    bottomSeedWins: z.number(),
    topSeedTeam: playoffBracketTeamSchema.optional(),
    bottomSeedTeam: playoffBracketTeamSchema.optional(),
    /** NHL bracket slot id (`A`–`O`); used when `conferenceAbbrev` is absent (early rounds). */
    seriesLetter: z.string().optional(),
    seriesTitle: z.string().optional(),
    seriesUrl: z.string().optional(),
    conferenceAbbrev: z.string().optional(),
    conferenceName: z.string().optional(),
    winningTeamId: z.number().optional(),
    losingTeamId: z.number().optional(),
    topSeedRank: z.number().optional(),
    bottomSeedRank: z.number().optional(),
    topSeedRankAbbrev: z.string().optional(),
    bottomSeedRankAbbrev: z.string().optional(),
  })
  .passthrough();

export type PlayoffBracketSeries = z.infer<typeof playoffBracketSeriesSchema>;

export const playoffBracketResponseSchema = z
  .object({
    bracketLogo: z.string().optional(),
    bracketLogoFr: z.string().optional(),
    bracketTitle: z
      .union([z.string(), z.object({}).passthrough()])
      .optional(),
    bracketSubTitle: z
      .union([z.string(), z.object({}).passthrough()])
      .optional(),
    series: z.array(playoffBracketSeriesSchema),
  })
  .passthrough();

export const skaterBoxSchema = z
  .object({
    playerId: z.number(),
    sweaterNumber: z.number().optional(),
    name: z.object({ default: z.string() }).passthrough(),
    position: z.string(),
    goals: z.number(),
    assists: z.number(),
    points: z.number().optional(),
  })
  .passthrough();

export const goalieBoxSchema = z
  .object({
    playerId: z.number(),
    sweaterNumber: z.number().optional(),
    name: z.object({ default: z.string() }).passthrough(),
    position: z.string(),
    savePctg: z.number().optional(),
    decision: z.string().optional(),
    starter: z.boolean().optional(),
  })
  .passthrough();

export const teamBoxStatsSchema = z.object({
  forwards: z.array(skaterBoxSchema),
  defense: z.array(skaterBoxSchema),
  goalies: z.array(goalieBoxSchema),
});

export const boxscoreResponseSchema = z
  .object({
    id: z.number(),
    season: z.number(),
    gameType: z.number(),
    gameDate: z.string(),
    gameState: z.string(),
    startTimeUTC: z.string(),
    awayTeam: scoreboardTeamSchema,
    homeTeam: scoreboardTeamSchema,
    playerByGameStats: z.object({
      awayTeam: teamBoxStatsSchema,
      homeTeam: teamBoxStatsSchema,
    }),
  })
  .passthrough();

export type ScoreboardResponse = z.infer<typeof scoreboardResponseSchema>;

/** Added by GET /api/nhl/scoreboard when `playoffFallback` is enabled (default). */
export type NhlScoreboardApiMeta = {
  requestedDate: string;
  effectiveDate: string;
  fellBack: boolean;
};

export type NhlTeamPlayoffStatus = "active" | "eliminated";

export type NhlScoreboardApiResponse = ScoreboardResponse & {
  meta?: NhlScoreboardApiMeta;
  teamStatusByAbbrev?: Record<string, NhlTeamPlayoffStatus>;
};
export type ScoreboardGame = z.infer<typeof scoreboardGameSchema>;
export type BoxscoreResponse = z.infer<typeof boxscoreResponseSchema>;
export type SkaterBox = z.infer<typeof skaterBoxSchema>;
export type PlayoffBracketResponse = z.infer<typeof playoffBracketResponseSchema>;
