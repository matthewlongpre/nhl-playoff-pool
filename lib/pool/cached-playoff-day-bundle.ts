import { unstable_cache } from "next/cache";
import type {
  BoxscoreResponse,
  NhlTeamPlayoffStatus,
  ScoreboardGame,
} from "@/lib/nhl/schemas";
import { fingerprintVisibleScoreboardGames } from "@/lib/nhl/pool-neon-refresh-interval";
import type { PlayoffDayNhlBundle } from "@/lib/pool/playoff-day-bundle";
import {
  fetchPlayoffDayScoreboardPhase,
  finalizePlayoffDayNhlBundle,
} from "@/lib/pool/playoff-day-bundle";

/**
 * `unstable_cache` persists via JSON-like serialization: `Map` becomes `{}` and
 * breaks `for (… of map)` downstream ("t is not iterable" in prod bundles).
 * We store entry tuples and rehydrate Maps after a hit.
 */
type CachedPlayoffDayNhlBundlePayload = {
  requestedCalendarDate: string;
  requestedDate: string;
  effectiveDate: string;
  fellBack: boolean;
  gamesOnSlate: number;
  playoffGames: ScoreboardGame[];
  boxscores: BoxscoreResponse[];
  boxByGameIdEntries: [number, BoxscoreResponse][];
  skaterStatsEntries: [number, { goals: number; assists: number }][];
  winsByAbbrevEntries: [string, number][];
  teamLogosEntries: [string, string][];
  teamStatusByAbbrevEntries: [string, NhlTeamPlayoffStatus][];
};

function playoffDayNhlBundleToCachePayload(
  b: PlayoffDayNhlBundle,
): CachedPlayoffDayNhlBundlePayload {
  return {
    requestedCalendarDate: b.requestedCalendarDate,
    requestedDate: b.requestedDate,
    effectiveDate: b.effectiveDate,
    fellBack: b.fellBack,
    gamesOnSlate: b.gamesOnSlate,
    playoffGames: b.playoffGames,
    boxscores: b.boxscores,
    boxByGameIdEntries: [...b.boxByGameId],
    skaterStatsEntries: [...b.skaterStats],
    winsByAbbrevEntries: [...b.winsByAbbrev],
    teamLogosEntries: [...b.teamLogos],
    teamStatusByAbbrevEntries: [...b.teamStatusByAbbrev],
  };
}

function playoffDayNhlBundleFromCachePayload(
  c: CachedPlayoffDayNhlBundlePayload,
): PlayoffDayNhlBundle {
  return {
    requestedCalendarDate: c.requestedCalendarDate,
    requestedDate: c.requestedDate,
    effectiveDate: c.effectiveDate,
    fellBack: c.fellBack,
    gamesOnSlate: c.gamesOnSlate,
    playoffGames: c.playoffGames,
    boxscores: c.boxscores,
    boxByGameId: new Map(c.boxByGameIdEntries),
    skaterStats: new Map(c.skaterStatsEntries),
    winsByAbbrev: new Map(c.winsByAbbrevEntries),
    teamLogos: new Map(c.teamLogosEntries),
    teamStatusByAbbrev: new Map(c.teamStatusByAbbrevEntries),
  };
}

/**
 * Dedupes boxscore fan-out across concurrent browsers for the same (date, slate) key.
 * One probe scoreboard fetch outside the cache to build `slateFingerprint`, then a
 * second scoreboard fetch inside the cache on miss (unavoidable without passing
 * non-serializable phase through `unstable_cache`).
 */
const POOL_DAY_BUNDLE_CACHE_REVALIDATE_SEC = 12;

const loadBundleForSlateFingerprint = unstable_cache(
  async (date: string, _slateFingerprint: string) => {
    const phase = await fetchPlayoffDayScoreboardPhase(date);
    const bundle = await finalizePlayoffDayNhlBundle(phase);
    return playoffDayNhlBundleToCachePayload(bundle);
  },
  ["pool-playoff-day-nhl-bundle", "v2-map-tuples"],
  { revalidate: POOL_DAY_BUNDLE_CACHE_REVALIDATE_SEC },
);

export async function loadPlayoffDayNhlBundleCached(date: string) {
  const probe = await fetchPlayoffDayScoreboardPhase(date);
  const fp = fingerprintVisibleScoreboardGames(probe.playoffGames);
  const payload = await loadBundleForSlateFingerprint(date, fp);
  return playoffDayNhlBundleFromCachePayload(payload);
}
