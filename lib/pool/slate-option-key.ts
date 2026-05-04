import type { PoolPick } from "@/lib/pool/roster-schema";
import type { BoxSlateOption } from "@/lib/pool/box-slates-schema";

/**
 * Identity for an official slate row — must match {@link pickSlateKey} for roster picks
 * (label + team, not NHL player id, so PDF options line up with `pool-rosters.json`).
 */
export function slateOptionToIdentityKey(opt: BoxSlateOption): string {
  if (opt.kind === "team") {
    return `team:${opt.teamAbbrev.toUpperCase()}`;
  }
  const abbrev = opt.nhlTeamAbbrev.toUpperCase();
  return `skater:${opt.label}|${abbrev}`;
}

/**
 * Key used to match a pool roster pick to a slate option (same string rules as the sheet).
 */
export function pickSlateKey(p: PoolPick): string {
  if (p.kind === "team") {
    return `team:${p.teamAbbrev.toUpperCase()}`;
  }
  const abbrev = (p.nhlTeamAbbrev ?? "").toUpperCase();
  return `skater:${p.label}|${abbrev}`;
}
