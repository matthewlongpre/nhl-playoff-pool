import { z } from "zod";

export const boxSlateSkaterOptionSchema = z.object({
  kind: z.literal("skater"),
  label: z.string().min(1),
  nhlTeamAbbrev: z.string().min(2).max(3),
});

export const boxSlateTeamOptionSchema = z.object({
  kind: z.literal("team"),
  label: z.string().min(1),
  teamAbbrev: z.string().min(2).max(3),
});

export const boxSlateOptionSchema = z.discriminatedUnion("kind", [
  boxSlateSkaterOptionSchema,
  boxSlateTeamOptionSchema,
]);

export const boxSlateRoundSchema = z.object({
  round: z.number().int().min(1).max(99),
  title: z.string().min(1),
  options: z.array(boxSlateOptionSchema).min(1),
});

export const poolBoxSlatesFileSchema = z.object({
  version: z.number().int().positive(),
  /** Provenance (e.g. PDF export name). */
  source: z.string().optional(),
  rounds: z.array(boxSlateRoundSchema).min(1),
});

export type PoolBoxSlatesFile = z.infer<typeof poolBoxSlatesFileSchema>;
export type BoxSlateRound = z.infer<typeof boxSlateRoundSchema>;
export type BoxSlateOption = z.infer<typeof boxSlateOptionSchema>;
