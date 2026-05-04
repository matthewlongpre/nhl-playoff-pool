import { z } from "zod";

export const skaterPickSchema = z.object({
  round: z.number().int().min(1).max(99),
  kind: z.literal("skater"),
  label: z.string(),
  position: z.enum(["F", "D"]).optional(),
  /** NHL team abbreviation at draft time (display only). */
  nhlTeamAbbrev: z.string().optional(),
  /** When missing, skater scores 0 until filled in. */
  nhlPlayerId: z.number().int().positive().nullable().optional(),
});

export const teamPickSchema = z.object({
  round: z.number().int().min(1).max(99),
  kind: z.literal("team"),
  label: z.string(),
  teamAbbrev: z.string().min(2).max(3),
});

export const poolPickSchema = z.discriminatedUnion("kind", [
  skaterPickSchema,
  teamPickSchema,
]);

export const poolTeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Pool member's real name (shown as subtitle on standings). */
  ownerName: z.string().min(1),
  /** File in `public/avatars/` (e.g. `jordannijjar.png`). */
  ownerAvatar: z.string().min(1).optional(),
  picks: z.array(poolPickSchema).min(1),
});

export const poolRostersFileSchema = z.object({
  version: z.number().int().positive(),
  teams: z.array(poolTeamSchema).min(1),
});

export type PoolRostersFile = z.infer<typeof poolRostersFileSchema>;
export type PoolTeam = z.infer<typeof poolTeamSchema>;
export type PoolPick = z.infer<typeof poolPickSchema>;
export type SkaterPick = z.infer<typeof skaterPickSchema>;
export type TeamPick = z.infer<typeof teamPickSchema>;
