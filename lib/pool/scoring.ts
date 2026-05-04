import type { BoxscoreResponse } from "@/lib/nhl/schemas";
import type { ScoreboardGame } from "@/lib/nhl/schemas";
import type { PoolTeam } from "@/lib/pool/roster-schema";

/** Playoff games only for pool scoring. */
export const POOL_GAME_TYPE_PLAYOFFS = 3;

const FINAL_GAME_STATES = new Set(["OFF", "FINAL"]);

export function isPlayoffGame(game: ScoreboardGame): boolean {
  return game.gameType === POOL_GAME_TYPE_PLAYOFFS;
}

export function isFinalScoreboardGame(game: ScoreboardGame): boolean {
  return FINAL_GAME_STATES.has(game.gameState);
}

/**
 * For each team abbrev, number of wins that calendar day (can be 0 or 1+).
 */
export function countWinsByTeamAbbrev(
  games: ReadonlyArray<ScoreboardGame>,
): Map<string, number> {
  const wins = new Map<string, number>();
  for (const g of games) {
    if (!isPlayoffGame(g)) continue;
    if (!isFinalScoreboardGame(g)) continue;
    const as = g.awayTeam.score;
    const hs = g.homeTeam.score;
    if (as == null || hs == null) continue;
    if (as > hs) {
      const a = g.awayTeam.abbrev;
      wins.set(a, (wins.get(a) ?? 0) + 1);
    } else if (hs > as) {
      const h = g.homeTeam.abbrev;
      wins.set(h, (wins.get(h) ?? 0) + 1);
    }
  }
  return wins;
}

export function aggregateSkaterGoalsAssists(
  boxscores: ReadonlyArray<BoxscoreResponse>,
): Map<number, { goals: number; assists: number }> {
  const map = new Map<number, { goals: number; assists: number }>();
  const add = (id: number, g: number, a: number) => {
    const cur = map.get(id) ?? { goals: 0, assists: 0 };
    cur.goals += g;
    cur.assists += a;
    map.set(id, cur);
  };

  for (const bx of boxscores) {
    for (const side of [
      bx.playerByGameStats.awayTeam,
      bx.playerByGameStats.homeTeam,
    ]) {
      for (const p of [...side.forwards, ...side.defense]) {
        add(p.playerId, p.goals, p.assists);
      }
    }
  }
  return map;
}

export type TeamScoreBreakdown = {
  skaterPoints: number;
  teamWinPoints: number;
  skaterDetail: Array<{
    round: number;
    label: string;
    points: number;
    goals: number;
    assists: number;
    nhlPlayerId: number | null;
    nhlTeamAbbrev?: string;
    position?: "F" | "D";
  }>;
  teamDetail: Array<{
    round: number;
    label: string;
    points: number;
    wins: number;
    teamAbbrev: string;
  }>;
};

export function scorePoolTeamForDay(
  team: PoolTeam,
  skaterStats: ReadonlyMap<number, { goals: number; assists: number }>,
  winsByAbbrev: ReadonlyMap<string, number>,
): TeamScoreBreakdown {
  let skaterPoints = 0;
  let teamWinPoints = 0;
  const skaterDetail: TeamScoreBreakdown["skaterDetail"] = [];
  const teamDetail: TeamScoreBreakdown["teamDetail"] = [];

  for (const pick of team.picks) {
    if (pick.kind === "skater") {
      const id = pick.nhlPlayerId;
      if (id == null) {
        skaterDetail.push({
          round: pick.round,
          label: pick.label,
          points: 0,
          goals: 0,
          assists: 0,
          nhlPlayerId: null,
          ...(pick.nhlTeamAbbrev ? { nhlTeamAbbrev: pick.nhlTeamAbbrev } : {}),
          ...(pick.position ? { position: pick.position } : {}),
        });
        continue;
      }
      const s = skaterStats.get(id) ?? { goals: 0, assists: 0 };
      const pts = s.goals + s.assists;
      skaterPoints += pts;
      skaterDetail.push({
        round: pick.round,
        label: pick.label,
        points: pts,
        goals: s.goals,
        assists: s.assists,
        nhlPlayerId: id,
        ...(pick.nhlTeamAbbrev ? { nhlTeamAbbrev: pick.nhlTeamAbbrev } : {}),
        ...(pick.position ? { position: pick.position } : {}),
      });
    } else {
      const abbr = pick.teamAbbrev;
      const w = winsByAbbrev.get(abbr) ?? 0;
      const pts = w >= 1 ? 1 : 0;
      teamWinPoints += pts;
      teamDetail.push({
        round: pick.round,
        label: pick.label,
        points: pts,
        wins: w,
        teamAbbrev: pick.teamAbbrev,
      });
    }
  }

  return {
    skaterPoints,
    teamWinPoints,
    skaterDetail,
    teamDetail,
  };
}

export function totalFantasyPoints(b: TeamScoreBreakdown): number {
  return b.skaterPoints + b.teamWinPoints;
}
