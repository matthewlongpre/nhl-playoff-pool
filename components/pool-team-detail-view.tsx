"use client";

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";
import { OwnerAvatarImage } from "@/components/owner-avatar-image";
import { CenteredLoading } from "@/components/centered-loading";
import { PoolTeamDayUnifiedCard } from "@/components/pool-team-day-unified-card";
import { PoolTeamDetailBreakdown } from "@/components/pool-team-detail-breakdown";
import { PoolTeamDetailPickMix } from "@/components/pool-team-pick-mix-strip";
import {
  PoolTeamRosterOutlookSection,
  type PoolTeamRosterOutlookMeta,
  type PoolTeamRosterOutlookSectionModel,
} from "@/components/pool-team-roster-outlook-section";
import { ScoringDayTabs } from "@/components/scoring-day-tabs";
import { getPoolNeonBackedRefreshIntervalMs } from "@/lib/nhl/pool-neon-refresh-interval";
import type { NhlTeamPlayoffStatus } from "@/lib/nhl/schemas";
import type { PoolTeamProjection } from "@/lib/pool/projection";
import type { TeamDayApiResponse } from "@/lib/pool/team-day-api";
import { ownerAvatarSrc } from "@/lib/pool/owner-avatar";
import { poolCalendarToday, previousCalendarDay } from "@/lib/pool/pool-season";
import type { TeamWinPickStatus } from "@/lib/pool/remaining-picks-by-team";
import type { TeamScoreBreakdown } from "@/lib/pool/scoring";

type TeamPayload = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
  rank: number;
  rankPrev: number | null;
  rankDelta: number | null;
  totalPoints: number;
  skaterPoints: number;
  teamWinPoints: number;
  pointsBehindLeader: number;
};

type ApiResponse = {
  asOfDate: string;
  compareThroughPrevCalendarDay: string | null;
  leaderboardMode: "cumulative" | "single_day_fallback";
  gamesOnSlate: number;
  team: TeamPayload;
  breakdown: TeamScoreBreakdown | null;
  /** Probability-weighted projection — null on bracket / NHLE failures. */
  projection?: PoolTeamProjection | null;
  teamStatusByAbbrev?: Record<string, NhlTeamPlayoffStatus>;
};

type ProjectionListPayload = {
  asOfDate: string;
  rows: Array<{
    teamId: string;
    name: string;
    totalToDate: number;
    projectedRemaining: number;
    projectedFinal: number;
    bestPick: PoolTeamProjection["bestPick"];
    collisions: PoolTeamProjection["collisions"];
    remainingSkaters: number;
    totalSkaters: number;
    remainingTeams: number;
    totalTeams: number;
    teamWinPicks: TeamWinPickStatus[];
  }>;
  meta: PoolTeamRosterOutlookMeta & {
    bracketAvailable: boolean;
    playoffSampleJoined: boolean;
  };
};

function pickKey(round: number, label: string): string {
  return `${round}::${label}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === "string" ? err.error : "Request failed");
  }
  return res.json();
}

function RankDelta({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) return null;
  return delta > 0 ? (
    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
      ↑{delta}
    </span>
  ) : (
    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
      ↓{Math.abs(delta)}
    </span>
  );
}

function isTeamRemaining(
  teamAbbrev: string | undefined,
  statusByAbbrev: Readonly<Record<string, NhlTeamPlayoffStatus>> | undefined,
): boolean {
  const abbrev = teamAbbrev?.trim().toUpperCase();
  if (!abbrev) return true;
  return statusByAbbrev?.[abbrev] !== "eliminated";
}

export function PoolTeamDetailView({ teamId }: { teamId: string }) {
  const today = poolCalendarToday();
  const yesterday = useMemo(() => previousCalendarDay(today), [today]);
  const [scoringDayTab, setScoringDayTab] = useState<"today" | "yesterday">(
    "today",
  );
  const selectedScoringDate =
    scoringDayTab === "today" ? today : yesterday;

  const q = useQuery({
    queryKey: ["pool-team-detail", teamId],
    queryFn: () =>
      fetchJson<ApiResponse>(
        `/api/pool/team/${encodeURIComponent(teamId)}`,
      ),
  });

  const projectionQuery = useQuery({
    queryKey: ["pool-projection", q.data?.asOfDate ?? ""],
    queryFn: () =>
      fetchJson<ProjectionListPayload>(
        `/api/pool/projection?date=${encodeURIComponent(q.data!.asOfDate)}`,
      ),
    enabled: !!q.data?.asOfDate,
  });

  const teamDayQuery = useQuery({
    queryKey: ["pool-team-day", teamId, selectedScoringDate],
    queryFn: () =>
      fetchJson<TeamDayApiResponse>(
        `/api/pool/team/${encodeURIComponent(teamId)}/day?date=${encodeURIComponent(selectedScoringDate)}`,
      ),
    refetchInterval: (query) => {
      if (scoringDayTab !== "today") return false;
      const d = query.state.data as TeamDayApiResponse | undefined;
      if (!d?.playoffGamesForPoll?.length) {
        return getPoolNeonBackedRefreshIntervalMs([]);
      }
      return getPoolNeonBackedRefreshIntervalMs(d.playoffGamesForPoll);
    },
  });

  const dayLabelDate = useMemo(() => {
    const d = teamDayQuery.data;
    if (!d) return selectedScoringDate;
    return d.scoreboardMeta?.effectiveDate ?? d.date;
  }, [teamDayQuery.data, selectedScoringDate]);

  const scoringEmptyMessage =
    scoringDayTab === "today"
      ? "No scores yet for today"
      : "No scores yesterday";

  const runwayMetrics = useMemo(() => {
    const bd = q.data?.breakdown;
    const statusBy = q.data?.teamStatusByAbbrev;
    if (!bd) return null;
    const isRem = (abbrev?: string) => isTeamRemaining(abbrev, statusBy);
    const totalSkaters = bd.skaterDetail.length;
    const remainingSkaters = bd.skaterDetail.filter((s) =>
      isRem(s.nhlTeamAbbrev),
    ).length;
    const teamWinPicks = bd.teamDetail.map((t) => ({
      teamAbbrev: t.teamAbbrev,
      eliminated: !isRem(t.teamAbbrev),
    }));
    const totalTeams = teamWinPicks.length;
    const remainingTeams = teamWinPicks.filter((t) => !t.eliminated).length;
    if (totalSkaters + totalTeams <= 0) return null;
    return {
      remainingSkaters,
      totalSkaters,
      remainingTeams,
      totalTeams,
      teamWinPicks,
    };
  }, [q.data?.breakdown, q.data?.teamStatusByAbbrev]);

  const rosterOutlookSectionModel = useMemo((): PoolTeamRosterOutlookSectionModel | null => {
    if (!q.data) return null;
    const rows = projectionQuery.data?.rows;
    const meta = projectionQuery.data?.meta;
    const row = rows?.find((r) => r.teamId === teamId) ?? null;

    let maxFinal: number | null = null;
    if (rows && rows.length > 0) {
      maxFinal = 0;
      for (const r of rows) maxFinal = Math.max(maxFinal, r.projectedFinal);
    }

    const serverProj = q.data.projection;
    const projectedFinal = row?.projectedFinal ?? serverProj?.projectedFinal ?? null;
    const projectedRemaining =
      row?.projectedRemaining ?? serverProj?.projectedRemaining ?? null;
    const bestPick = row?.bestPick ?? serverProj?.bestPick ?? null;
    const collisions = row?.collisions ?? serverProj?.collisions ?? [];

    const runway =
      row != null
        ? {
            remainingSkaters: row.remainingSkaters,
            totalSkaters: row.totalSkaters,
            remainingTeams: row.remainingTeams,
            totalTeams: row.totalTeams,
            teamWinPicks: row.teamWinPicks,
          }
        : runwayMetrics;

    const totalToDate = q.data.team.totalPoints;
    let lockedInPct: number | null = null;
    if (projectedFinal != null && projectedFinal > 0) {
      lockedInPct = (totalToDate / projectedFinal) * 100;
    }

    const bracketAvailable = meta?.bracketAvailable ?? !!serverProj;
    const subtitle = bracketAvailable
      ? "Scoring runway (pick survival) and projected points. Each row shows where every owner is now and where the model expects them to land."
      : "Bracket is unavailable right now — projection has fallen back to scored-only totals. Pick survival is shown as if no NHL clubs were eliminated; both will recover automatically.";

    const runwaySlots =
      (runway?.totalSkaters ?? 0) + (runway?.totalTeams ?? 0);
    const showOutlookBody =
      projectedFinal != null ||
      projectedRemaining != null ||
      runwaySlots > 0 ||
      bestPick != null ||
      collisions.length > 0;
    if (!showOutlookBody) return null;

    return {
      poolTeamId: teamId,
      subtitle,
      totalToDate,
      projectedFinal,
      projectedRemaining,
      lockedInPct,
      maxFinal,
      runway,
      bestPick,
      collisions,
      projectionMeta: meta
        ? {
            perGameProbModel: meta.perGameProbModel,
            baselineP: meta.baselineP,
            ppgPriorWeight: meta.ppgPriorWeight,
            playoffSampleJoined: meta.playoffSampleJoined,
          }
        : null,
    };
  }, [q.data, teamId, projectionQuery.data, runwayMetrics]);

  const projectedEvByPickKey = useMemo(() => {
    const proj = q.data?.projection;
    if (!proj) return undefined;
    const m = new Map<string, number>();
    for (const p of proj.perPickEv) {
      m.set(pickKey(p.round, p.label), p.ev);
    }
    return m;
  }, [q.data?.projection]);

  if (q.isLoading) {
    return (
      <CenteredLoading
        message="Loading team…"
        ariaLabel="Loading team"
        variant="viewport"
      />
    );
  }

  if (q.error instanceof Error) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50"
          role="alert"
        >
          {q.error.message}
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-amber-800/90 underline-offset-2 hover:underline hover:text-amber-900 dark:text-amber-400/95 dark:hover:text-amber-300"
        >
          ← Back to standings
        </Link>
      </div>
    );
  }

  if (!q.data) return null;

  const { team, breakdown, leaderboardMode } = q.data;
  const isCumulative = leaderboardMode === "cumulative";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-3">
        <header className="flex flex-col gap-3 sm:gap-4">
          <Link
            href="/"
            className="w-fit text-sm font-medium text-amber-800/90 underline-offset-2 hover:underline hover:text-amber-900 dark:text-amber-400/95 dark:hover:text-amber-300"
          >
            ← Standings
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <div className="flex min-w-0 items-center gap-4">
              {ownerAvatarSrc(team.ownerAvatar) ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950">
                  <OwnerAvatarImage
                    filename={team.ownerAvatar}
                    width={64}
                    height={64}
                    className="h-16 w-16 object-cover object-top"
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <h1 className="font-pool-display text-2xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
                  {team.name}
                </h1>
                <p className="mt-0.5 text-sm font-medium leading-snug text-zinc-600 dark:text-zinc-400">
                  {team.ownerName}
                </p>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 rounded-2xl bg-zinc-50/90 px-5 py-4 dark:bg-zinc-900/40 sm:ml-auto sm:w-auto sm:max-w-sm sm:px-6 sm:py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="w-fit rounded-xl bg-white/70 px-3 py-2.5 text-center ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950/35 dark:ring-white/[0.08]">
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    Rank
                  </p>
                  <div className="mt-1 flex items-center justify-center gap-2 tabular-nums">
                    <span className="font-pool-display text-3xl font-semibold leading-none text-zinc-900 dark:text-zinc-50">
                      {team.rank}
                    </span>
                    <RankDelta delta={team.rankDelta} />
                  </div>
                </div>
                <div className="px-1 py-1 text-right">
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                    Total points
                  </p>
                  <p className="mt-1 font-pool-display text-3xl font-semibold leading-none tabular-nums text-zinc-900 dark:text-zinc-50">
                    {team.totalPoints}
                  </p>
                </div>
              </div>
              <p className="text-pretty border-t border-zinc-200/70 pt-3 text-sm leading-relaxed text-zinc-600 dark:border-zinc-700/60 dark:text-zinc-400">
                <span className="tabular-nums">{team.skaterPoints}</span> skater ·{" "}
                <span className="tabular-nums">{team.teamWinPoints}</span> team ·{" "}
                <span className="tabular-nums">{team.pointsBehindLeader}</span> behind leader
              </p>
            </div>
          </div>
        </header>
      </div>

      <section className="space-y-4" aria-labelledby="team-daily-scoring-heading">
        <div className="min-w-0 space-y-3">
          <h2
            id="team-daily-scoring-heading"
            className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            Daily scoring
          </h2>
          <ScoringDayTabs
            value={scoringDayTab}
            onChange={setScoringDayTab}
            controlsId="team-scoring-day-panel"
          />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {format(parseISO(dayLabelDate), "MMMM d, yyyy")}
            {teamDayQuery.data?.gamesOnSlate != null ? (
              <>
                {" "}
                ·{" "}
                <span className="tabular-nums">
                  {teamDayQuery.data.gamesOnSlate}
                </span>{" "}
                game
                {teamDayQuery.data.gamesOnSlate === 1 ? "" : "s"}
              </>
            ) : null}
          </p>
        </div>

        <div
          id="team-scoring-day-panel"
          role="tabpanel"
          aria-label={
            scoringDayTab === "today"
              ? "Today’s scoring for this team"
              : "Yesterday’s scoring for this team"
          }
        >
          <PoolTeamDayUnifiedCard
            scoringDayTab={scoringDayTab}
            isLoading={teamDayQuery.isLoading}
            error={
              teamDayQuery.error instanceof Error ? teamDayQuery.error : null
            }
            gamesOnSlate={teamDayQuery.data?.gamesOnSlate ?? 0}
            scoreboardMeta={teamDayQuery.data?.scoreboardMeta}
            slate={teamDayQuery.data?.slate}
            fantasy={teamDayQuery.data?.fantasy ?? null}
            emptyDayMessage={
              scoringDayTab === "today"
                ? "No slate data yet for today."
                : "No slate data for yesterday."
            }
            scoringEmptyMessage={scoringEmptyMessage}
          />
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {rosterOutlookSectionModel ? (
          <PoolTeamRosterOutlookSection model={rosterOutlookSectionModel} />
        ) : null}
        <PoolTeamDetailPickMix teamId={teamId} asOfDate={q.data.asOfDate} />
      </div>

      {breakdown ? (
        <PoolTeamDetailBreakdown
          breakdown={breakdown}
          isCumulative={isCumulative}
          teamStatusByAbbrev={q.data.teamStatusByAbbrev}
          projectedEvByPickKey={projectedEvByPickKey}
        />
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No pick breakdown available.
        </p>
      )}
    </div>
  );
}
