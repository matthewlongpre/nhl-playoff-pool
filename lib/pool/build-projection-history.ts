import { asc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { poolIngestSnapshots, poolNhlEliminationEvents } from "@/lib/db/schema";
import type { ProjectionResponsePayload, ProjectionRowOut } from "@/lib/pool/build-projection-payload";
import { playoffSeasonFromDate } from "@/lib/nhl/playoff-status";
import { POOL_SNAPSHOT_KIND_PROJECTION } from "@/lib/pool/pool-ingest-snapshots";

export type ProjectionDayEntry = {
  date: string;
  rank: number;
  /** Positive = moved up (rank number fell), negative = moved down, null = first day. */
  rankDelta: number | null;
  projectedFinal: number;
  projectedFinalDelta: number | null;
  totalToDate: number;
};

export type ProjectionHistoryTeam = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
  history: ProjectionDayEntry[];
};

export type EliminationEvent = {
  date: string;
  teamAbbrev: string;
};

export type ProjectionHistoryPayload = {
  dates: string[];
  teams: ProjectionHistoryTeam[];
  eliminations: EliminationEvent[];
};

export async function buildProjectionHistory(
  db: Db,
): Promise<ProjectionHistoryPayload> {
  const rows = await db
    .select({
      asOfDate: poolIngestSnapshots.asOfDate,
      payload: poolIngestSnapshots.payload,
    })
    .from(poolIngestSnapshots)
    .where(eq(poolIngestSnapshots.kind, POOL_SNAPSHOT_KIND_PROJECTION))
    .orderBy(asc(poolIngestSnapshots.asOfDate));

  const dates = rows.map((r) => r.asOfDate);
  const teamMap = new Map<string, ProjectionHistoryTeam>();

  for (let i = 0; i < rows.length; i++) {
    const { asOfDate, payload } = rows[i];
    const snap = payload as unknown as ProjectionResponsePayload;

    const prevByTeamId = new Map<string, ProjectionRowOut>();
    if (i > 0) {
      const prevSnap = rows[i - 1].payload as unknown as ProjectionResponsePayload;
      for (const r of prevSnap.rows) {
        prevByTeamId.set(r.teamId, r);
      }
    }

    for (const teamRow of snap.rows) {
      if (!teamMap.has(teamRow.teamId)) {
        teamMap.set(teamRow.teamId, {
          teamId: teamRow.teamId,
          name: teamRow.name,
          ownerName: teamRow.ownerName,
          ...(teamRow.ownerAvatar ? { ownerAvatar: teamRow.ownerAvatar } : {}),
          history: [],
        });
      }
      const prev = prevByTeamId.get(teamRow.teamId);
      teamMap.get(teamRow.teamId)!.history.push({
        date: asOfDate,
        rank: teamRow.rank,
        rankDelta: prev != null ? prev.rank - teamRow.rank : null,
        projectedFinal: teamRow.projectedFinal,
        projectedFinalDelta:
          prev != null ? teamRow.projectedFinal - prev.projectedFinal : null,
        totalToDate: teamRow.totalToDate,
      });
    }
  }

  const teams = [...teamMap.values()].sort((a, b) => {
    const aRank = a.history.at(-1)?.rank ?? 999;
    const bRank = b.history.at(-1)?.rank ?? 999;
    return aRank - bRank;
  });

  // Load elimination events from the dedicated table (written at ingest time from
  // scoreboard series-clinching data — accurate regardless of when snapshots were
  // materialized).
  const playoffSeason =
    dates.length > 0 ? playoffSeasonFromDate(dates[0]!) : null;
  let eliminations: EliminationEvent[] = [];
  if (playoffSeason != null) {
    const elimRows = await db
      .select({
        nhlTeamAbbrev: poolNhlEliminationEvents.nhlTeamAbbrev,
        eliminatedDate: poolNhlEliminationEvents.eliminatedDate,
      })
      .from(poolNhlEliminationEvents)
      .where(eq(poolNhlEliminationEvents.playoffSeason, playoffSeason))
      .orderBy(asc(poolNhlEliminationEvents.eliminatedDate));
    eliminations = elimRows.map((r) => ({
      date: r.eliminatedDate,
      teamAbbrev: r.nhlTeamAbbrev,
    }));
  }

  return { dates, teams, eliminations };
}
