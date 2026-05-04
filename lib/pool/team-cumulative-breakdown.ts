import { eachDayOfInterval, format, parseISO } from "date-fns";
import { computePoolStandingsDetailedForDate } from "@/lib/pool/compute-standings-for-date";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import { getPoolPlayoffStartDate } from "@/lib/pool/pool-season";
import type { TeamScoreBreakdown } from "@/lib/pool/scoring";
import { scorePoolTeamForDay } from "@/lib/pool/scoring";

/**
 * Sums single-day {@link TeamScoreBreakdown} rows from each playoff day through `throughDate`
 * (inclusive) so pick lines show season-to-date goals, assists, wins, and fantasy points.
 *
 * Note: one NHL fetch per calendar day — can be slow for long playoff runs.
 */
export async function computeCumulativeTeamBreakdownThroughDate(
  teamId: string,
  throughDate: string,
): Promise<TeamScoreBreakdown | null> {
  const rosters = loadPoolRosters();
  const team = rosters.teams.find((t) => t.id === teamId);
  if (!team) return null;

  const start = getPoolPlayoffStartDate();
  if (throughDate < start) {
    return scorePoolTeamForDay(team, new Map(), new Map());
  }

  const days = eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(throughDate),
  });

  let merged: TeamScoreBreakdown | null = null;

  for (const day of days) {
    const d = format(day, "yyyy-MM-dd");
    const { standings } = await computePoolStandingsDetailedForDate(
      rosters,
      d,
      teamId,
    );
    const row = standings.find((r) => r.teamId === teamId);
    const b = row?.breakdown;
    if (!b) continue;

    if (merged === null) {
      merged = {
        skaterPoints: 0,
        teamWinPoints: 0,
        skaterDetail: b.skaterDetail.map((s) => ({ ...s })),
        teamDetail: b.teamDetail.map((t) => ({ ...t })),
      };
    } else {
      for (let i = 0; i < b.skaterDetail.length; i++) {
        const acc = merged.skaterDetail[i];
        const cur = b.skaterDetail[i];
        if (acc && cur) {
          acc.goals += cur.goals;
          acc.assists += cur.assists;
          acc.points += cur.points;
        }
      }
      for (let i = 0; i < b.teamDetail.length; i++) {
        const acc = merged.teamDetail[i];
        const cur = b.teamDetail[i];
        if (acc && cur) {
          acc.wins += cur.wins;
          acc.points += cur.points;
        }
      }
    }
  }

  if (merged === null) {
    return scorePoolTeamForDay(team, new Map(), new Map());
  }

  merged.skaterPoints = merged.skaterDetail.reduce((s, x) => s + x.points, 0);
  merged.teamWinPoints = merged.teamDetail.reduce((s, x) => s + x.points, 0);
  return merged;
}
