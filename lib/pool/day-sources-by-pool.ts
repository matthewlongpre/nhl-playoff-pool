import type { NhlTeamPlayoffStatus } from "@/lib/nhl/schemas";
import type {
  SkaterDaySource,
  TeamWinDaySource,
} from "@/lib/pool/day-sources";

export type PoolTeamSkaterContribution = {
  nhlPlayerId: number;
  label: string;
  nhlDisplayName?: string;
  headshotUrl: string;
  goals: number;
  assists: number;
  fantasyPts: number;
  pickRound: number;
  nhlTeamAbbrev?: string;
  teamLogoUrl?: string;
  lifecycleStatus?: NhlTeamPlayoffStatus;
};

export type PoolTeamTeamContribution = {
  teamAbbrev: string;
  label: string;
  logoUrl?: string;
  wins: number;
  fantasyPts: number;
  pickRound: number;
  lifecycleStatus?: NhlTeamPlayoffStatus;
};

export type PoolTeamCrewRow = {
  poolTeamId: string;
  poolTeamName: string;
  ownerName: string;
  ownerAvatar?: string;
  skaters: PoolTeamSkaterContribution[];
  teamPicks: PoolTeamTeamContribution[];
  totalFantasyPts: number;
};

/**
 * Re-groups day-sources payload by fantasy pool team (who gained points), sorted by total
 * fantasy points that day (desc), then cumulative standings rank when provided (asc: 1 before 2),
 * then pool team name.
 */
export function groupDaySourcesByPoolTeam(
  skaters: ReadonlyArray<SkaterDaySource>,
  teamWins: ReadonlyArray<TeamWinDaySource>,
  standingsRankByPoolTeamId?: ReadonlyMap<string, number>,
): PoolTeamCrewRow[] {
  const byId = new Map<
    string,
    {
      poolTeamId: string;
      poolTeamName: string;
      ownerName: string;
      ownerAvatar?: string;
      skaters: PoolTeamSkaterContribution[];
      teamPicks: PoolTeamTeamContribution[];
    }
  >();

  for (const s of skaters) {
    for (const b of s.beneficiaries) {
      let row = byId.get(b.poolTeamId);
      if (!row) {
        row = {
          poolTeamId: b.poolTeamId,
          poolTeamName: b.poolTeamName,
          ownerName: b.ownerName,
          ownerAvatar: b.ownerAvatar,
          skaters: [],
          teamPicks: [],
        };
        byId.set(b.poolTeamId, row);
      } else {
        row.ownerAvatar = row.ownerAvatar ?? b.ownerAvatar;
      }
      row.skaters.push({
        nhlPlayerId: s.nhlPlayerId,
        label: s.label,
        ...(s.nhlDisplayName ? { nhlDisplayName: s.nhlDisplayName } : {}),
        headshotUrl: s.headshotUrl,
        goals: s.goals,
        assists: s.assists,
        fantasyPts: b.fantasyPts,
        pickRound: b.pickRound,
        ...(b.nhlTeamAbbrev ? { nhlTeamAbbrev: b.nhlTeamAbbrev } : {}),
        ...(b.teamLogoUrl ? { teamLogoUrl: b.teamLogoUrl } : {}),
        ...(s.lifecycleStatus ? { lifecycleStatus: s.lifecycleStatus } : {}),
      });
    }
  }

  for (const t of teamWins) {
    for (const b of t.beneficiaries) {
      let row = byId.get(b.poolTeamId);
      if (!row) {
        row = {
          poolTeamId: b.poolTeamId,
          poolTeamName: b.poolTeamName,
          ownerName: b.ownerName,
          ownerAvatar: b.ownerAvatar,
          skaters: [],
          teamPicks: [],
        };
        byId.set(b.poolTeamId, row);
      } else {
        row.ownerAvatar = row.ownerAvatar ?? b.ownerAvatar;
      }
      row.teamPicks.push({
        teamAbbrev: t.teamAbbrev,
        label: t.label,
        logoUrl: t.logoUrl,
        wins: t.wins,
        fantasyPts: b.fantasyPts,
        pickRound: b.pickRound,
        ...(t.lifecycleStatus ? { lifecycleStatus: t.lifecycleStatus } : {}),
      });
    }
  }

  const sortSkater = (a: PoolTeamSkaterContribution, b: PoolTeamSkaterContribution) => {
    if (b.fantasyPts !== a.fantasyPts) return b.fantasyPts - a.fantasyPts;
    return a.label.localeCompare(b.label);
  };
  const sortTeam = (a: PoolTeamTeamContribution, b: PoolTeamTeamContribution) => {
    if (b.fantasyPts !== a.fantasyPts) return b.fantasyPts - a.fantasyPts;
    return a.teamAbbrev.localeCompare(b.teamAbbrev);
  };

  const rows: PoolTeamCrewRow[] = [];
  for (const row of byId.values()) {
    row.skaters.sort(sortSkater);
    row.teamPicks.sort(sortTeam);
    const totalFantasyPts =
      row.skaters.reduce((sum, x) => sum + x.fantasyPts, 0) +
      row.teamPicks.reduce((sum, x) => sum + x.fantasyPts, 0);
    rows.push({
      poolTeamId: row.poolTeamId,
      poolTeamName: row.poolTeamName,
      ownerName: row.ownerName,
      ...(row.ownerAvatar ? { ownerAvatar: row.ownerAvatar } : {}),
      skaters: row.skaters,
      teamPicks: row.teamPicks,
      totalFantasyPts,
    });
  }

  rows.sort((a, b) => {
    if (b.totalFantasyPts !== a.totalFantasyPts) {
      return b.totalFantasyPts - a.totalFantasyPts;
    }
    if (standingsRankByPoolTeamId) {
      const ra =
        standingsRankByPoolTeamId.get(a.poolTeamId) ?? Number.POSITIVE_INFINITY;
      const rb =
        standingsRankByPoolTeamId.get(b.poolTeamId) ?? Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
    }
    return a.poolTeamName.localeCompare(b.poolTeamName);
  });

  return rows;
}
