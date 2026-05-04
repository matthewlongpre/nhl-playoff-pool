import type { PoolTeam } from "@/lib/pool/roster-schema";

export type NhlTeamPickCount = {
  abbrev: string;
  count: number;
};

/**
 * Sum skater + team picks per NHL club across every pool roster (same rules as
 * {@link pickCountsByNhlTeamForPoolTeam}).
 */
export function aggregateNhlTeamPickCountsAcrossPool(teams: PoolTeam[]): NhlTeamPickCount[] {
  const m = new Map<string, number>();
  for (const team of teams) {
    for (const { abbrev, count } of pickCountsByNhlTeamForPoolTeam(team)) {
      m.set(abbrev, (m.get(abbrev) ?? 0) + count);
    }
  }
  return [...m.entries()]
    .map(([abbrev, count]) => ({ abbrev, count }))
    .sort((a, b) => b.count - a.count || a.abbrev.localeCompare(b.abbrev));
}

/**
 * Count how many roster picks (skaters + team wins) each pool team has tied to each NHL club.
 * Skaters use `nhlTeamAbbrev`; team picks use `teamAbbrev`. Skaters missing `nhlTeamAbbrev` are skipped.
 */
export function pickCountsByNhlTeamForPoolTeam(team: PoolTeam): NhlTeamPickCount[] {
  const m = new Map<string, number>();
  for (const pick of team.picks) {
    if (pick.kind === "skater") {
      const a = pick.nhlTeamAbbrev?.trim().toUpperCase();
      if (!a) continue;
      m.set(a, (m.get(a) ?? 0) + 1);
    } else {
      const a = pick.teamAbbrev.trim().toUpperCase();
      m.set(a, (m.get(a) ?? 0) + 1);
    }
  }
  return [...m.entries()]
    .map(([abbrev, count]) => ({ abbrev, count }))
    .sort((a, b) => b.count - a.count || a.abbrev.localeCompare(b.abbrev));
}
