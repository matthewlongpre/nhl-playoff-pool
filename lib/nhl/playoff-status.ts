import type {
  NhlTeamPlayoffStatus,
  PlayoffBracketResponse,
} from "@/lib/nhl/schemas";
import { fetchNhlPlayoffBracket } from "@/lib/nhl/upstream";

const SERIES_WIN_THRESHOLD = 4;

function parseForcedEliminatedTeamAbbrevs(
  raw: string | undefined,
): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);
}

export function applyForcedEliminatedOverrides(
  statusByAbbrev: Map<string, NhlTeamPlayoffStatus>,
  forcedEliminatedAbbrevs: ReadonlyArray<string>,
): void {
  for (const abbrev of forcedEliminatedAbbrevs) {
    statusByAbbrev.set(abbrev, "eliminated");
  }
}

export function playoffSeasonFromDate(date: string): number {
  const [yearRaw, monthRaw] = date.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error(`Invalid date for playoff season: ${date}`);
  }
  return month >= 9 ? year + 1 : year;
}

export function buildTeamStatusFromPlayoffBracket(
  bracket: PlayoffBracketResponse,
): Map<string, NhlTeamPlayoffStatus> {
  const eliminated = new Set<string>();
  const allTeams = new Set<string>();

  for (const series of bracket.series) {
    const top = series.topSeedTeam?.abbrev?.trim().toUpperCase() ?? "";
    const bottom = series.bottomSeedTeam?.abbrev?.trim().toUpperCase() ?? "";
    if (top) allTeams.add(top);
    if (bottom) allTeams.add(bottom);
    if (series.topSeedWins >= SERIES_WIN_THRESHOLD) {
      if (bottom) eliminated.add(bottom);
    } else if (series.bottomSeedWins >= SERIES_WIN_THRESHOLD) {
      if (top) eliminated.add(top);
    }
  }

  const out = new Map<string, NhlTeamPlayoffStatus>();
  for (const abbrev of allTeams) {
    out.set(abbrev, eliminated.has(abbrev) ? "eliminated" : "active");
  }
  return out;
}

export function teamStatusMapToRecord(
  statusByAbbrev: ReadonlyMap<string, NhlTeamPlayoffStatus>,
): Record<string, NhlTeamPlayoffStatus> {
  const out: Record<string, NhlTeamPlayoffStatus> = {};
  for (const [abbrev, status] of statusByAbbrev) {
    out[abbrev] = status;
  }
  return out;
}

export async function fetchPlayoffTeamStatusByDate(
  date: string,
): Promise<Map<string, NhlTeamPlayoffStatus>> {
  const season = playoffSeasonFromDate(date);
  const bracket = await fetchNhlPlayoffBracket(season);
  const statusByAbbrev = buildTeamStatusFromPlayoffBracket(bracket);
  const forcedEliminated = parseForcedEliminatedTeamAbbrevs(
    process.env.POOL_TEST_ELIMINATED_TEAMS ??
      process.env.NEXT_PUBLIC_POOL_TEST_ELIMINATED_TEAMS,
  );
  applyForcedEliminatedOverrides(statusByAbbrev, forcedEliminated);
  return statusByAbbrev;
}
