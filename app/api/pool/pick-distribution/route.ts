import { NextResponse } from "next/server";
import { fetchPlayoffTeamStatusByDate } from "@/lib/nhl/playoff-status";
import type { NhlTeamPlayoffStatus } from "@/lib/nhl/schemas";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import {
  aggregateNhlTeamPickCountsAcrossPool,
  pickCountsByNhlTeamForPoolTeam,
} from "@/lib/pool/pick-distribution-by-team";
import { resolvePoolDateQueryParam } from "@/lib/pool/resolve-pool-date-query";
import { publicMessageForStandingsFailure } from "@/lib/pool/standings-api-error";
import { SCOREBOARD_CACHE_CONTROL } from "@/lib/nhl/constants";

export type PickDistributionEntry = {
  abbrev: string;
  count: number;
  status: NhlTeamPlayoffStatus;
};

export type PickDistributionTeamRow = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
  entries: PickDistributionEntry[];
};

export type PickDistributionLeagueRow = {
  abbrev: string;
  count: number;
  status: NhlTeamPlayoffStatus;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resolved = resolvePoolDateQueryParam(searchParams.get("date"));
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 400 });
  }
  const date = resolved.date;

  try {
    const rosters = loadPoolRosters();
    let statusByAbbrev = new Map<string, NhlTeamPlayoffStatus>();
    try {
      statusByAbbrev = await fetchPlayoffTeamStatusByDate(date);
    } catch {
      /* Bracket missing — treat all teams as active for crest styling. */
    }

    const teams: PickDistributionTeamRow[] = rosters.teams.map((t) => {
      const counts = pickCountsByNhlTeamForPoolTeam(t);
      const entries: PickDistributionEntry[] = counts.map(({ abbrev, count }) => ({
        abbrev,
        count,
        status: statusByAbbrev.get(abbrev) ?? "active",
      }));
      return {
        teamId: t.id,
        name: t.name,
        ownerName: t.ownerName,
        ...(t.ownerAvatar ? { ownerAvatar: t.ownerAvatar } : {}),
        entries,
      };
    });

    const leagueByNhlTeam: PickDistributionLeagueRow[] = aggregateNhlTeamPickCountsAcrossPool(
      rosters.teams,
    ).map(({ abbrev, count }) => ({
      abbrev,
      count,
      status: statusByAbbrev.get(abbrev) ?? "active",
    }));

    return NextResponse.json(
      { date, teams, leagueByNhlTeam },
      { headers: { "Cache-Control": SCOREBOARD_CACHE_CONTROL } },
    );
  } catch (e) {
    console.error("[pool/pick-distribution]", e);
    const message = publicMessageForStandingsFailure(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
