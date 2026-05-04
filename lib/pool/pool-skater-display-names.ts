import raw from "@/data/pool-skater-display-names.json";
import { z } from "zod";
import { poolSkaterNhlPlayerIds } from "@/lib/pool/day-sources";
import { fetchNhlPlayerDisplayNames } from "@/lib/nhl/player-landing";
import type { PoolTeam } from "@/lib/pool/roster-schema";

/**
 * NHL legal first + last from player landing, keyed by `nhlPlayerId`.
 * Regenerate after roster edits: `npm run pool:skater-names` (writes `data/pool-skater-display-names.json`).
 * At runtime, any id missing here is fetched once per deploy cache via `fetchNhlPlayerDisplayNames`.
 */
const poolSkaterDisplayNamesFileSchema = z.object({
  version: z.number().optional(),
  names: z.record(z.string(), z.string()),
});

export function loadStaticPoolSkaterDisplayNameById(): ReadonlyMap<number, string> {
  const parsed = poolSkaterDisplayNamesFileSchema.safeParse(raw);
  if (!parsed.success) return new Map();
  const m = new Map<number, string>();
  for (const [k, v] of Object.entries(parsed.data.names)) {
    const id = Number(k);
    if (!Number.isInteger(id) || id <= 0) continue;
    const name = v.trim();
    if (name.length > 0) m.set(id, name);
  }
  return m;
}

export function mergePoolSkaterDisplayNameMaps(
  base: ReadonlyMap<number, string>,
  overlay: ReadonlyMap<number, string>,
): Map<number, string> {
  const out = new Map(base);
  for (const [k, v] of overlay) out.set(k, v);
  return out;
}

/** Static file plus live landing fetches for roster ids not yet in the file. */
export async function resolvePoolSkaterDisplayNameMap(
  teams: ReadonlyArray<PoolTeam>,
): Promise<Map<number, string>> {
  const staticMap = loadStaticPoolSkaterDisplayNameById();
  const rosterIds = poolSkaterNhlPlayerIds(teams);
  const missing = [...rosterIds].filter((id) => !staticMap.has(id));
  const live = await fetchNhlPlayerDisplayNames(missing);
  return mergePoolSkaterDisplayNameMaps(staticMap, live);
}
