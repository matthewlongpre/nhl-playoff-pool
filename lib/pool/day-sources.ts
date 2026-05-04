import {
  nhlPlayerHeadshotUrl,
  nhlTeamLogoLightSvgUrl,
} from "@/lib/nhl/media";
import type { NhlTeamPlayoffStatus } from "@/lib/nhl/schemas";
import type { PoolTeam } from "@/lib/pool/roster-schema";

/** NHL player ids referenced by at least one skater pick in the pool. */
export function poolSkaterNhlPlayerIds(
  teams: ReadonlyArray<PoolTeam>,
): Set<number> {
  const ids = new Set<number>();
  for (const team of teams) {
    for (const pick of team.picks) {
      if (pick.kind === "skater" && pick.nhlPlayerId != null) {
        ids.add(pick.nhlPlayerId);
      }
    }
  }
  return ids;
}

export type PoolDayBeneficiary = {
  poolTeamId: string;
  poolTeamName: string;
  ownerName: string;
  /** Filename in `public/avatars/` when the roster lists one. */
  ownerAvatar?: string;
  /** Fantasy points gained from this NHL source today for this pick. */
  fantasyPts: number;
  pickRound: number;
  /** From the skater pick (`nhlTeamAbbrev`); used for team logo on player cards. */
  nhlTeamAbbrev?: string;
  /** Scoreboard URL when available, else NHLE light SVG for `nhlTeamAbbrev`. */
  teamLogoUrl?: string;
};

export type SkaterDaySource = {
  nhlPlayerId: number;
  label: string;
  /** From NHL player landing (`firstName` + `lastName`) when the API returns it. */
  nhlDisplayName?: string;
  goals: number;
  assists: number;
  /** NHLE mug URL for this player. */
  headshotUrl: string;
  lifecycleStatus?: NhlTeamPlayoffStatus;
  beneficiaries: PoolDayBeneficiary[];
};

export type TeamWinDaySource = {
  teamAbbrev: string;
  label: string;
  wins: number;
  /** From the day’s scoreboard when available. */
  logoUrl?: string;
  lifecycleStatus?: NhlTeamPlayoffStatus;
  beneficiaries: PoolDayBeneficiary[];
};

export type PoolDaySourcesPayload = {
  skaters: SkaterDaySource[];
  teamWins: TeamWinDaySource[];
};

/**
 * For each NHL skater who recorded stats today, and each NHL team that won a final today,
 * lists pool teams that gained fantasy points from that source.
 */
export function buildPoolDaySources(
  teams: ReadonlyArray<PoolTeam>,
  skaterStats: ReadonlyMap<number, { goals: number; assists: number }>,
  winsByAbbrev: ReadonlyMap<string, number>,
  /** Team logo URLs from the scoreboard, keyed by NHL team abbrev. */
  teamLogoByAbbrev: ReadonlyMap<string, string>,
  nhlNameByPlayerId: ReadonlyMap<number, string> = new Map(),
  teamStatusByAbbrev: ReadonlyMap<string, NhlTeamPlayoffStatus> = new Map(),
): PoolDaySourcesPayload {
  const skaters: SkaterDaySource[] = [];

  for (const [playerId, stat] of skaterStats) {
    const pts = stat.goals + stat.assists;
    if (pts <= 0) continue;

    const beneficiaries: PoolDayBeneficiary[] = [];
    let label = `Player #${playerId}`;
    let labelSet = false;

    for (const team of teams) {
      for (const pick of team.picks) {
        if (pick.kind !== "skater") continue;
        if (pick.nhlPlayerId !== playerId) continue;
        if (!labelSet) {
          label = pick.label;
          labelSet = true;
        }
        const abbrev =
          pick.nhlTeamAbbrev != null && pick.nhlTeamAbbrev.length > 0
            ? pick.nhlTeamAbbrev.toUpperCase()
            : undefined;
        const teamLogoUrl =
          abbrev != null
            ? teamLogoByAbbrev.get(abbrev) ?? nhlTeamLogoLightSvgUrl(abbrev)
            : undefined;
        beneficiaries.push({
          poolTeamId: team.id,
          poolTeamName: team.name,
          ownerName: team.ownerName,
          ...(team.ownerAvatar ? { ownerAvatar: team.ownerAvatar } : {}),
          fantasyPts: pts,
          pickRound: pick.round,
          ...(abbrev ? { nhlTeamAbbrev: abbrev } : {}),
          ...(teamLogoUrl ? { teamLogoUrl } : {}),
        });
      }
    }

    if (beneficiaries.length === 0) continue;

    beneficiaries.sort((a, b) => {
      if (b.fantasyPts !== a.fantasyPts) return b.fantasyPts - a.fantasyPts;
      return a.poolTeamName.localeCompare(b.poolTeamName);
    });

    const nhlDisplayName = nhlNameByPlayerId.get(playerId);
    const lifecycleStatus =
      beneficiaries[0]?.nhlTeamAbbrev != null
        ? teamStatusByAbbrev.get(beneficiaries[0].nhlTeamAbbrev)
        : undefined;
    skaters.push({
      nhlPlayerId: playerId,
      label,
      ...(nhlDisplayName ? { nhlDisplayName } : {}),
      goals: stat.goals,
      assists: stat.assists,
      headshotUrl: nhlPlayerHeadshotUrl(playerId),
      ...(lifecycleStatus ? { lifecycleStatus } : {}),
      beneficiaries,
    });
  }

  skaters.sort((a, b) => {
    const ap = a.goals + a.assists;
    const bp = b.goals + b.assists;
    if (bp !== ap) return bp - ap;
    return a.label.localeCompare(b.label);
  });

  const teamWins: TeamWinDaySource[] = [];

  for (const [abbrev, wins] of winsByAbbrev) {
    if (wins < 1) continue;

    const beneficiaries: PoolDayBeneficiary[] = [];
    let label = abbrev;
    let labelSet = false;

    for (const team of teams) {
      for (const pick of team.picks) {
        if (pick.kind !== "team") continue;
        if (pick.teamAbbrev !== abbrev) continue;
        if (!labelSet) {
          label = pick.label;
          labelSet = true;
        }
        beneficiaries.push({
          poolTeamId: team.id,
          poolTeamName: team.name,
          ownerName: team.ownerName,
          ...(team.ownerAvatar ? { ownerAvatar: team.ownerAvatar } : {}),
          fantasyPts: 1,
          pickRound: pick.round,
        });
      }
    }

    if (beneficiaries.length === 0) continue;

    beneficiaries.sort((a, b) => {
      if (b.fantasyPts !== a.fantasyPts) return b.fantasyPts - a.fantasyPts;
      return a.poolTeamName.localeCompare(b.poolTeamName);
    });

    teamWins.push({
      teamAbbrev: abbrev,
      label,
      wins,
      logoUrl: teamLogoByAbbrev.get(abbrev),
      ...(teamStatusByAbbrev.get(abbrev)
        ? { lifecycleStatus: teamStatusByAbbrev.get(abbrev) }
        : {}),
      beneficiaries,
    });
  }

  teamWins.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.teamAbbrev.localeCompare(b.teamAbbrev);
  });

  return { skaters, teamWins };
}
