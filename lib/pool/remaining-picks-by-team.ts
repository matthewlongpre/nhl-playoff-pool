import type { NhlTeamPlayoffStatus } from "@/lib/nhl/schemas";
import type { PoolRostersFile } from "@/lib/pool/roster-schema";

export type TeamWinPickStatus = {
  teamAbbrev: string;
  /** True when the NHL club is out of the playoffs. */
  eliminated: boolean;
};

export type TeamRemainingPicks = {
  remainingSkaters: number;
  totalSkaters: number;
  remainingTeams: number;
  totalTeams: number;
  /** Team-win picks in roster order (for UI, e.g. runway logos). */
  teamWinPicks: TeamWinPickStatus[];
};

/** NHL team still in the playoffs (or unknown abbrev → treat as active). */
export function isPickTeamStillActive(
  teamAbbrev: string | undefined,
  statusByAbbrev: ReadonlyMap<string, NhlTeamPlayoffStatus>,
): boolean {
  const a = teamAbbrev?.trim().toUpperCase();
  if (!a) return true;
  return statusByAbbrev.get(a) !== "eliminated";
}

export function buildRemainingPicksByTeamId(
  rosters: PoolRostersFile,
  statusByAbbrev: ReadonlyMap<string, NhlTeamPlayoffStatus>,
): Map<string, TeamRemainingPicks> {
  const out = new Map<string, TeamRemainingPicks>();
  for (const team of rosters.teams) {
    let totalSkaters = 0;
    let remainingSkaters = 0;
    let totalTeams = 0;
    let remainingTeams = 0;
    const teamWinPicks: TeamWinPickStatus[] = [];
    for (const pick of team.picks) {
      if (pick.kind === "skater") {
        totalSkaters += 1;
        if (isPickTeamStillActive(pick.nhlTeamAbbrev, statusByAbbrev)) {
          remainingSkaters += 1;
        }
      } else {
        totalTeams += 1;
        const stillActive = isPickTeamStillActive(pick.teamAbbrev, statusByAbbrev);
        if (stillActive) {
          remainingTeams += 1;
        }
        teamWinPicks.push({
          teamAbbrev: pick.teamAbbrev,
          eliminated: !stillActive,
        });
      }
    }
    out.set(team.id, {
      remainingSkaters,
      totalSkaters,
      remainingTeams,
      totalTeams,
      teamWinPicks,
    });
  }
  return out;
}
