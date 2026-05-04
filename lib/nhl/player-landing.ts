import { z } from "zod";
import { NHL_WEB_API } from "@/lib/nhl/constants";

/**
 * Player landing includes legal first/last names. Boxscore `name.default` is usually
 * abbreviated (e.g. "J. Eriksson Ek"), so we use landing for display names.
 */
const playerLandingNameSchema = z
  .object({
    playerId: z.number(),
    firstName: z.object({ default: z.string() }).passthrough(),
    lastName: z.object({ default: z.string() }).passthrough(),
  })
  .passthrough();

const playerLandingBadgesSchema = z
  .object({
    playerId: z.number(),
    badges: z.array(z.unknown()).optional(),
  })
  .passthrough();

async function fetchOne(playerId: number): Promise<string | null> {
  const res = await fetch(`${NHL_WEB_API}/player/${playerId}/landing`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86_400 },
  });
  if (!res.ok) return null;
  const json: unknown = await res.json();
  const parsed = playerLandingNameSchema.safeParse(json);
  if (!parsed.success) return null;
  const fn = parsed.data.firstName.default.trim();
  const ln = parsed.data.lastName.default.trim();
  const full = `${fn} ${ln}`.trim();
  return full.length > 0 ? full : null;
}

/** Resolves `"FirstName LastName"` for each id; omits ids that fail to load or parse. */
export async function fetchNhlPlayerDisplayNames(
  playerIds: ReadonlyArray<number>,
): Promise<Map<number, string>> {
  const unique = [...new Set(playerIds)];
  if (unique.length === 0) return new Map();

  const settled = await Promise.allSettled(unique.map((id) => fetchOne(id)));
  const out = new Map<number, string>();
  for (let i = 0; i < settled.length; i++) {
    const id = unique[i]!;
    const r = settled[i]!;
    if (r.status !== "fulfilled" || r.value == null) continue;
    out.set(id, r.value);
  }
  return out;
}

async function fetchBadgesOne(playerId: number): Promise<unknown[] | null> {
  const res = await fetch(`${NHL_WEB_API}/player/${playerId}/landing`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const json: unknown = await res.json();
  const parsed = playerLandingBadgesSchema.safeParse(json);
  if (!parsed.success) return null;
  const b = parsed.data.badges;
  return Array.isArray(b) ? b : null;
}

/** Badges from player landing (e.g. status chips when NHLE provides them). */
export async function fetchNhlPlayerBadges(
  playerIds: ReadonlyArray<number>,
): Promise<Map<number, unknown[]>> {
  const unique = [...new Set(playerIds)];
  if (unique.length === 0) return new Map();

  const settled = await Promise.allSettled(unique.map((id) => fetchBadgesOne(id)));
  const out = new Map<number, unknown[]>();
  for (let i = 0; i < settled.length; i++) {
    const id = unique[i]!;
    const r = settled[i]!;
    if (r.status !== "fulfilled" || r.value == null || r.value.length === 0) {
      continue;
    }
    out.set(id, r.value);
  }
  return out;
}

/**
 * Coarse season-level rate stats lifted from NHLE `/player/{id}/landing`. Used to seed
 * the Bayesian prior on PPG for the projection model — see `blendedPpg` in
 * `lib/pool/projection.ts`. Numeric fields default to 0 when NHLE omits them, which
 * preserves rookies / brand-new pros without polluting the prior with non-existent stats.
 */
export type NhlPlayerSeasonRates = {
  /** Regular-season games played in NHLE `featuredStats.regularSeason.subSeason`. */
  rsGp: number;
  rsPts: number;
  /** Career playoff totals from `careerTotals.playoffs`, when present. */
  careerPlayoffGp: number;
  careerPlayoffPts: number;
  /** First letter from NHLE `position` string (`F` rolled up from C/L/R, `D`, or `G`). */
  position?: "F" | "D" | "G";
};

const subSeasonStatsSchema = z
  .object({
    gamesPlayed: z.number().nonnegative().optional(),
    points: z.number().optional(),
  })
  .passthrough();

const playerLandingRatesSchema = z
  .object({
    playerId: z.number(),
    position: z.string().optional(),
    featuredStats: z
      .object({
        regularSeason: z
          .object({
            subSeason: subSeasonStatsSchema.optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    careerTotals: z
      .object({
        playoffs: subSeasonStatsSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

function rolledUpPosition(raw: string | undefined): "F" | "D" | "G" | undefined {
  if (!raw) return undefined;
  const head = raw.trim().charAt(0).toUpperCase();
  if (head === "C" || head === "L" || head === "R" || head === "F") return "F";
  if (head === "D") return "D";
  if (head === "G") return "G";
  return undefined;
}

async function fetchSeasonRatesOne(
  playerId: number,
): Promise<NhlPlayerSeasonRates | null> {
  const res = await fetch(`${NHL_WEB_API}/player/${playerId}/landing`, {
    headers: { Accept: "application/json" },
    /** Season totals barely move during a season; the daily revalidate matches names. */
    next: { revalidate: 86_400 },
  });
  if (!res.ok) return null;
  const json: unknown = await res.json();
  const parsed = playerLandingRatesSchema.safeParse(json);
  if (!parsed.success) return null;

  const rs = parsed.data.featuredStats?.regularSeason?.subSeason;
  const playoffs = parsed.data.careerTotals?.playoffs;
  const position = rolledUpPosition(parsed.data.position);

  return {
    rsGp: Math.max(0, rs?.gamesPlayed ?? 0),
    rsPts: Math.max(0, rs?.points ?? 0),
    careerPlayoffGp: Math.max(0, playoffs?.gamesPlayed ?? 0),
    careerPlayoffPts: Math.max(0, playoffs?.points ?? 0),
    ...(position ? { position } : {}),
  };
}

/**
 * Resolves season-rate stats for every requested skater id. Fans out in parallel to
 * NHLE; ids that fail to load or parse are silently omitted (callers should fall back
 * to `0` / prior-only PPG, matching `blendedPpg`).
 */
export async function fetchNhlPlayerSeasonRates(
  playerIds: ReadonlyArray<number>,
): Promise<Map<number, NhlPlayerSeasonRates>> {
  const unique = [...new Set(playerIds)];
  if (unique.length === 0) return new Map();

  const settled = await Promise.allSettled(
    unique.map((id) => fetchSeasonRatesOne(id)),
  );
  const out = new Map<number, NhlPlayerSeasonRates>();
  for (let i = 0; i < settled.length; i++) {
    const id = unique[i]!;
    const r = settled[i]!;
    if (r.status !== "fulfilled" || r.value == null) continue;
    out.set(id, r.value);
  }
  return out;
}
