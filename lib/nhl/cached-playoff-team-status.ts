import { unstable_cache } from "next/cache";
import type { NhlTeamPlayoffStatus } from "@/lib/nhl/schemas";
import { fetchPlayoffTeamStatusByDate } from "@/lib/nhl/playoff-status";

const TEAM_STATUS_REVALIDATE_SEC = 90;

function mapToRecord(
  m: Map<string, NhlTeamPlayoffStatus>,
): Record<string, NhlTeamPlayoffStatus> {
  return Object.fromEntries(m);
}

function recordToMap(
  r: Record<string, NhlTeamPlayoffStatus>,
): Map<string, NhlTeamPlayoffStatus> {
  return new Map(Object.entries(r));
}

const cachedPlayoffTeamStatusByDateInner = unstable_cache(
  async (
    date: string,
  ): Promise<Record<string, NhlTeamPlayoffStatus>> => {
    const m = await fetchPlayoffTeamStatusByDate(date);
    return mapToRecord(m);
  },
  ["playoff-team-status-by-date"],
  { revalidate: TEAM_STATUS_REVALIDATE_SEC },
);

export async function getCachedPlayoffTeamStatusByDate(
  date: string,
): Promise<Map<string, NhlTeamPlayoffStatus>> {
  const r = await cachedPlayoffTeamStatusByDateInner(date);
  return recordToMap(r);
}
