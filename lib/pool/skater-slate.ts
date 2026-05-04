import { nhlPlayerHeadshotUrl } from "@/lib/nhl/media";
import type {
  BoxscoreResponse,
  NhlTeamPlayoffStatus,
  ScoreboardGame,
} from "@/lib/nhl/schemas";
import type { PoolTeam } from "@/lib/pool/roster-schema";

/** Playoff game on the slate that includes this NHL team (home or away). */
export function findPlayoffGameForTeamAbbrev(
  games: ReadonlyArray<ScoreboardGame>,
  abbrev: string | undefined,
): ScoreboardGame | undefined {
  if (abbrev == null || abbrev.trim() === "") return undefined;
  const a = abbrev.trim().toUpperCase();
  return games.find(
    (g) =>
      g.awayTeam.abbrev.toUpperCase() === a ||
      g.homeTeam.abbrev.toUpperCase() === a,
  );
}

export function countSkatersInBoxscoreTeam(
  side: BoxscoreResponse["playerByGameStats"]["awayTeam"],
): number {
  return side.forwards.length + side.defense.length;
}

export function boxscoreHasPostedSkaterLines(bx: BoxscoreResponse): boolean {
  return (
    countSkatersInBoxscoreTeam(bx.playerByGameStats.awayTeam) +
      countSkatersInBoxscoreTeam(bx.playerByGameStats.homeTeam) >
    0
  );
}

export function skaterIdInBoxscore(
  bx: BoxscoreResponse,
  playerId: number,
): boolean {
  for (const side of [
    bx.playerByGameStats.awayTeam,
    bx.playerByGameStats.homeTeam,
  ]) {
    for (const p of [...side.forwards, ...side.defense]) {
      if (p.playerId === playerId) return true;
    }
  }
  return false;
}

/**
 * When the box has no skater lines yet (pregame), we cannot tell dressed vs scratch.
 * Otherwise: player appears in forwards/defense → dressed; else not dressed.
 */
export function resolveSkaterLineupStatus(
  bx: BoxscoreResponse | undefined,
  playerId: number,
): "unknown" | "dressed" | "not_dressed" {
  if (!bx) return "unknown";
  if (!boxscoreHasPostedSkaterLines(bx)) return "unknown";
  return skaterIdInBoxscore(bx, playerId) ? "dressed" : "not_dressed";
}

export type SkaterSlateGameSnapshot = {
  gameId: number;
  gameState: string;
  gameDate: string;
  startTimeUTC?: string;
  awayAbbrev: string;
  homeAbbrev: string;
  awayScore?: number;
  homeScore?: number;
  awayLogo?: string;
  homeLogo?: string;
  clock?: {
    timeRemaining?: string;
    secondsRemaining?: number;
    running?: boolean;
    inIntermission?: boolean;
  };
  period?: number;
  periodDescriptor?: {
    number: number;
    periodType: string;
    maxRegulationPeriods?: number;
  };
  seriesStatus?: ScoreboardGame["seriesStatus"];
};

export type SkaterSlateApiRow = {
  round: number;
  label: string;
  nhlPlayerId: number | null;
  /** From `data/pool-skater-display-names.json` + live landing when missing. */
  nhlDisplayName?: string;
  nhlTeamAbbrev?: string;
  headshotUrl?: string;
  game: SkaterSlateGameSnapshot | null;
  lineupStatus: "unknown" | "dressed" | "not_dressed";
  badges?: unknown[];
  lifecycleStatus?: NhlTeamPlayoffStatus;
};

export type TeamPickSlateApiRow = {
  round: number;
  label: string;
  teamAbbrev: string;
  game: SkaterSlateGameSnapshot | null;
  lifecycleStatus?: NhlTeamPlayoffStatus;
};

export type SkatersSlatePoolTeam = {
  poolTeamId: string;
  poolTeamName: string;
  ownerName: string;
  ownerAvatar?: string;
  skaters: SkaterSlateApiRow[];
  teamPicks: TeamPickSlateApiRow[];
};

export type SkatersSlateApiResponse = {
  date: string;
  gamesOnSlate: number;
  scoreboardMeta?: {
    requestedDate: string;
    effectiveDate: string;
    fellBack: boolean;
  };
  teams: SkatersSlatePoolTeam[];
};

/** Drop skaters / team picks with no playoff game on the effective slate. */
export function filterSkatersSlateTeamsOffNights(
  teams: ReadonlyArray<SkatersSlatePoolTeam>,
): SkatersSlatePoolTeam[] {
  const out: SkatersSlatePoolTeam[] = [];
  for (const team of teams) {
    const skaters = team.skaters.filter(
      (s) => s.game != null || s.lifecycleStatus === "eliminated",
    );
    const teamPicks = team.teamPicks.filter(
      (tp) => tp.game != null || tp.lifecycleStatus === "eliminated",
    );
    if (skaters.length === 0 && teamPicks.length === 0) continue;
    out.push({ ...team, skaters, teamPicks });
  }
  return out;
}

/** Build skater-slate rows for the given pool teams (one scoreboard + boxscore pass). */
export function buildSkatersSlatePoolTeams(
  poolTeams: ReadonlyArray<PoolTeam>,
  playoffGames: ReadonlyArray<ScoreboardGame>,
  boxByGameId: ReadonlyMap<number, BoxscoreResponse>,
  displayNameByPlayerId?: ReadonlyMap<number, string>,
  teamStatusByAbbrev: ReadonlyMap<string, NhlTeamPlayoffStatus> = new Map(),
): SkatersSlatePoolTeam[] {
  return poolTeams.map((poolTeam) => {
    const skaters: SkaterSlateApiRow[] = [];
    const teamPicks: TeamPickSlateApiRow[] = [];

    for (const pick of poolTeam.picks) {
      if (pick.kind === "team") {
        const teamAbbrev = pick.teamAbbrev.trim().toUpperCase();
        const lifecycleStatus = teamStatusByAbbrev.get(teamAbbrev);
        const g = findPlayoffGameForTeamAbbrev(playoffGames, pick.teamAbbrev);
        teamPicks.push({
          round: pick.round,
          label: pick.label,
          teamAbbrev: pick.teamAbbrev,
          game: g ? scoreboardGameToSnapshot(g) : null,
          ...(lifecycleStatus ? { lifecycleStatus } : {}),
        });
        continue;
      }

      const g = findPlayoffGameForTeamAbbrev(playoffGames, pick.nhlTeamAbbrev);
      const gameSnapshot = g ? scoreboardGameToSnapshot(g) : null;
      const pid = pick.nhlPlayerId ?? null;

      let lineupStatus: SkaterSlateApiRow["lineupStatus"] = "unknown";
      if (pid != null && g != null) {
        const bx = boxByGameId.get(g.id);
        lineupStatus = resolveSkaterLineupStatus(bx, pid);
      }

      const displayName =
        pid != null ? displayNameByPlayerId?.get(pid) : undefined;
      const skaterTeamAbbrev = pick.nhlTeamAbbrev?.trim().toUpperCase();
      const lifecycleStatus =
        skaterTeamAbbrev != null
          ? teamStatusByAbbrev.get(skaterTeamAbbrev)
          : undefined;
      skaters.push({
        round: pick.round,
        label: pick.label,
        nhlPlayerId: pid,
        ...(displayName ? { nhlDisplayName: displayName } : {}),
        ...(pick.nhlTeamAbbrev ? { nhlTeamAbbrev: pick.nhlTeamAbbrev } : {}),
        ...(pid != null ? { headshotUrl: nhlPlayerHeadshotUrl(pid) } : {}),
        game: gameSnapshot,
        lineupStatus,
        ...(lifecycleStatus ? { lifecycleStatus } : {}),
      });
    }

    skaters.sort((a, b) => a.round - b.round);
    teamPicks.sort((a, b) => a.round - b.round);

    return {
      poolTeamId: poolTeam.id,
      poolTeamName: poolTeam.name,
      ownerName: poolTeam.ownerName,
      ...(poolTeam.ownerAvatar ? { ownerAvatar: poolTeam.ownerAvatar } : {}),
      skaters,
      teamPicks,
    };
  });
}

export function collectSkaterSlateBadgePlayerIds(
  teams: ReadonlyArray<SkatersSlatePoolTeam>,
): number[] {
  const ids: number[] = [];
  for (const t of teams) {
    for (const s of t.skaters) {
      if (s.nhlPlayerId != null && s.game != null) {
        ids.push(s.nhlPlayerId);
      }
    }
  }
  return [...new Set(ids)];
}

export function applyBadgesToSkatersSlateTeams(
  teams: SkatersSlatePoolTeam[],
  badgesByPlayer: ReadonlyMap<number, unknown[]>,
): void {
  for (const t of teams) {
    for (const s of t.skaters) {
      if (s.nhlPlayerId == null) continue;
      const b = badgesByPlayer.get(s.nhlPlayerId);
      if (b && b.length > 0) {
        s.badges = b;
      }
    }
  }
}

/**
 * Distinct `nhlPlayerId`s referenced by at least one skater pick across the given pool teams.
 * Used by the daily-points ingest to know which NHL skaters to persist to `pool_skater_daily_points`.
 */
export function poolSkaterNhlPlayerIds(
  poolTeams: ReadonlyArray<PoolTeam>,
): number[] {
  const ids = new Set<number>();
  for (const team of poolTeams) {
    for (const pick of team.picks) {
      if (pick.kind !== "skater") continue;
      if (pick.nhlPlayerId == null) continue;
      ids.add(pick.nhlPlayerId);
    }
  }
  return [...ids];
}

export function scoreboardGameToSnapshot(
  game: ScoreboardGame,
): SkaterSlateGameSnapshot {
  return {
    gameId: game.id,
    gameState: game.gameState,
    gameDate: game.gameDate,
    startTimeUTC: game.startTimeUTC,
    awayAbbrev: game.awayTeam.abbrev,
    homeAbbrev: game.homeTeam.abbrev,
    ...(game.awayTeam.score != null
      ? { awayScore: game.awayTeam.score }
      : {}),
    ...(game.homeTeam.score != null
      ? { homeScore: game.homeTeam.score }
      : {}),
    ...(game.awayTeam.logo ? { awayLogo: game.awayTeam.logo } : {}),
    ...(game.homeTeam.logo ? { homeLogo: game.homeTeam.logo } : {}),
    ...(game.clock ? { clock: game.clock } : {}),
    ...(game.period != null ? { period: game.period } : {}),
    ...(game.periodDescriptor
      ? { periodDescriptor: game.periodDescriptor }
      : {}),
    ...(game.seriesStatus ? { seriesStatus: game.seriesStatus } : {}),
  };
}
