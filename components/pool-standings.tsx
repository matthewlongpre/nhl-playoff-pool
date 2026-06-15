"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getNhlScoreboardRefreshIntervalMsCapped } from "@/lib/nhl/adaptive-interval";
import {
  fingerprintVisibleScoreboardGames,
  getPoolNeonBackedRefreshIntervalMs,
} from "@/lib/nhl/pool-neon-refresh-interval";
import { OwnerAvatarImage } from "@/components/owner-avatar-image";
import { ownerAvatarSrc } from "@/lib/pool/owner-avatar";
import { getVisibleGamesForDay } from "@/lib/nhl/games-for-interval";
import { CenteredLoading } from "@/components/centered-loading";
import { CompactNhlSlate } from "@/components/compact-nhl-slate";
import { PoolDaySourcesAvatars } from "@/components/pool-day-sources-avatars";
import { PoolDaySourcesCrewByPool } from "@/components/pool-day-sources-crew-by-pool";
import type { NhlScoreboardApiResponse } from "@/lib/nhl/schemas";
import type { SkaterDaySource, TeamWinDaySource } from "@/lib/pool/day-sources";
import { poolCalendarToday, previousCalendarDay } from "@/lib/pool/pool-season";
import { PoolDailyPointsChart } from "@/components/pool-daily-points-chart";
import { PoolProjectionHistory } from "@/components/pool-projection-history";
import { PoolPickDistribution } from "@/components/pool-pick-distribution";
import { PoolReview } from "@/components/pool-review";
import { PoolRosterOutlook } from "@/components/pool-roster-outlook";
import type { TeamWinPickStatus } from "@/lib/pool/remaining-picks-by-team";
import { PlayoffBracketHomeSection } from "@/components/playoff-bracket-panel";
import { PoolSiteChrome } from "@/components/pool-site-chrome";
import { ScoringDayTabs } from "@/components/scoring-day-tabs";
import type { DailyPointsSeriesPayload } from "@/lib/pool/daily-points-series";

type StandingsRow = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
  totalPoints: number;
  skaterPoints: number;
  teamWinPoints: number;
  rank: number;
  rankPrev: number | null;
  rankDelta: number | null;
  /** Alive skater / team-win slots (NHL club still in playoffs) — surfaced in roster outlook. */
  remainingSkaters: number;
  totalSkaters: number;
  remainingTeams: number;
  totalTeams: number;
  teamWinPicks: TeamWinPickStatus[];
};

type StandingsResponse = {
  date: string;
  gamesOnSlate: number;
  standings: StandingsRow[];
  leaderboardMode?: "cumulative" | "single_day_fallback";
  compareThroughPrevCalendarDay?: string | null;
};

type DaySourcesResponse = {
  date: string;
  gamesOnSlate: number;
  skaters: SkaterDaySource[];
  teamWins: TeamWinDaySource[];
  scoreboardMeta?: {
    requestedDate: string;
    effectiveDate: string;
    fellBack: boolean;
  };
};

type SourcesLayout = "crewNhl" | "crewPool";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === "string" ? err.error : "Request failed");
  }
  return res.json();
}

function rankMovementAriaSuffix(rankDelta: number | null): string {
  if (rankDelta == null) return "";
  if (rankDelta === 0) return ", rank unchanged from previous day";
  if (rankDelta > 0) return `, up ${rankDelta}`;
  return `, down ${Math.abs(rankDelta)}`;
}

function RankAndMovement({
  rank,
  rankDelta,
}: {
  rank: number;
  rankDelta: number | null;
}) {
  return (
    <div className="flex items-center gap-1.5 tabular-nums">
      <span className="font-semibold text-zinc-900 dark:text-zinc-50">{rank}</span>
      {rankDelta != null && rankDelta !== 0 ? (
        rankDelta > 0 ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ↑{rankDelta}
          </span>
        ) : (
          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
            ↓{Math.abs(rankDelta)}
          </span>
        )
      ) : null}
    </div>
  );
}

type PoolStandingsProps = {
  /** Which pool screen to show — set by the route (`/` vs `/scoring`). */
  poolView: "standings" | "sources";
  /** Preview rank ↑↓ as if standings moved vs yesterday (`/?simulateRankMovement=1`). */
  simulateRankMovement?: boolean;
};

export function PoolStandings({
  poolView,
  simulateRankMovement = false,
}: PoolStandingsProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const today = poolCalendarToday();
  const yesterday = useMemo(() => previousCalendarDay(today), [today]);
  const [scoringDayTab, setScoringDayTab] = useState<"today" | "yesterday">(
    "today",
  );
  const selectedScoringDate =
    scoringDayTab === "today" ? today : yesterday;

  const isStandingsRoute = pathname === "/";
  const isScoringRoute =
    pathname === "/scoring" || pathname === "/scoring/players";
  const isScoringPoolTeamRoute = pathname === "/scoring";
  const isScoringPlayersRoute = pathname === "/scoring/players";

  /** `/scoring/players` → NHL skater layout; `/scoring` → pool team cards. */
  const sourcesLayout: SourcesLayout =
    poolView === "sources" && isScoringPlayersRoute ? "crewNhl" : "crewPool";

  const standingsHref = simulateRankMovement ? "/?simulateRankMovement=1" : "/";
  const scoringHref = simulateRankMovement ? "/scoring?simulateRankMovement=1" : "/scoring";
  const scoringPlayersHref = simulateRankMovement
    ? "/scoring/players?simulateRankMovement=1"
    : "/scoring/players";
  const scoreboardQuery = useQuery({
    queryKey: ["nhl-scoreboard", today],
    queryFn: () =>
      fetchJson<NhlScoreboardApiResponse>(
        `/api/nhl/scoreboard?date=${encodeURIComponent(today)}&playoffFallback=1`,
      ),
    refetchInterval: (q) => {
      const sb = q.state.data as NhlScoreboardApiResponse | undefined;
      const d = sb?.meta?.effectiveDate ?? today;
      return getNhlScoreboardRefreshIntervalMsCapped(
        getVisibleGamesForDay(sb, d, true),
      );
    },
  });

  const scoreboardSlateDate = useMemo(
    () => scoreboardQuery.data?.meta?.effectiveDate ?? today,
    [scoreboardQuery.data?.meta?.effectiveDate, today],
  );

  const scoringSlateGames = useMemo(
    () => getVisibleGamesForDay(scoreboardQuery.data, scoreboardSlateDate, true),
    [scoreboardQuery.data, scoreboardSlateDate],
  );

  const neonBackedSlateFingerprint = useMemo(
    () => fingerprintVisibleScoreboardGames(scoringSlateGames),
    [scoringSlateGames],
  );

  const prevNeonSlateFingerprint = useRef<string | null>(null);
  useEffect(() => {
    if (prevNeonSlateFingerprint.current === null) {
      prevNeonSlateFingerprint.current = neonBackedSlateFingerprint;
      return;
    }
    if (prevNeonSlateFingerprint.current !== neonBackedSlateFingerprint) {
      prevNeonSlateFingerprint.current = neonBackedSlateFingerprint;
      void queryClient.invalidateQueries({ queryKey: ["pool-standings"] });
      void queryClient.invalidateQueries({
        queryKey: ["pool-daily-points-series"],
      });
      void queryClient.invalidateQueries({ queryKey: ["pool-day-sources"] });
      void queryClient.invalidateQueries({ queryKey: ["pool-team-day"] });
    }
  }, [neonBackedSlateFingerprint, queryClient]);

  const scoreboardYesterdayQuery = useQuery({
    queryKey: ["nhl-scoreboard", yesterday],
    queryFn: () =>
      fetchJson<NhlScoreboardApiResponse>(
        `/api/nhl/scoreboard?date=${encodeURIComponent(yesterday)}&playoffFallback=1`,
      ),
    enabled: poolView === "sources",
    refetchInterval: false,
  });

  const yesterdaySlateDate = useMemo(
    () => scoreboardYesterdayQuery.data?.meta?.effectiveDate ?? yesterday,
    [scoreboardYesterdayQuery.data?.meta?.effectiveDate, yesterday],
  );

  const yesterdaySlateGames = useMemo(
    () =>
      getVisibleGamesForDay(
        scoreboardYesterdayQuery.data,
        yesterdaySlateDate,
        true,
      ),
    [scoreboardYesterdayQuery.data, yesterdaySlateDate],
  );

  const standingsQuery = useQuery({
    queryKey: ["pool-standings", "playoff-cumulative", today, simulateRankMovement],
    queryFn: () => {
      const params = new URLSearchParams();
      if (simulateRankMovement) params.set("simulateRankMovement", "1");
      const qs = params.toString();
      return fetchJson<StandingsResponse>(
        `/api/pool/standings${qs ? `?${qs}` : ""}`,
      );
    },
    enabled: poolView === "standings" || poolView === "sources",
    refetchInterval: () =>
      getPoolNeonBackedRefreshIntervalMs(
        getVisibleGamesForDay(scoreboardQuery.data, scoreboardSlateDate, true),
      ),
  });

  const dailyPointsQuery = useQuery({
    queryKey: ["pool-daily-points-series", today],
    queryFn: () => fetchJson<DailyPointsSeriesPayload>("/api/pool/daily-points-series"),
    enabled: poolView === "standings",
    refetchInterval: () =>
      getPoolNeonBackedRefreshIntervalMs(
        getVisibleGamesForDay(scoreboardQuery.data, scoreboardSlateDate, true),
      ),
  });

  const daySourcesQuery = useQuery({
    queryKey: ["pool-day-sources", selectedScoringDate],
    queryFn: () =>
      fetchJson<DaySourcesResponse>(
        `/api/pool/day-sources?date=${encodeURIComponent(selectedScoringDate)}`,
      ),
    enabled: poolView === "sources",
    refetchInterval: () =>
      poolView === "sources" && scoringDayTab === "today"
        ? getNhlScoreboardRefreshIntervalMsCapped(
            getVisibleGamesForDay(scoreboardQuery.data, scoreboardSlateDate, true),
          )
        : false,
  });

  const standingsThroughLabel = useMemo(
    () =>
      format(parseISO(standingsQuery.data?.date ?? today), "MMMM d, yyyy"),
    [standingsQuery.data?.date, today],
  );

  const standingsRankByTeamId = useMemo(() => {
    const standings = standingsQuery.data?.standings;
    if (!standings) return undefined;
    const m = new Map<string, number>();
    for (const r of standings) {
      m.set(r.teamId, r.rank);
    }
    return m;
  }, [standingsQuery.data?.standings]);

  const scoringEmptyMessage =
    scoringDayTab === "today"
      ? "No scores yet for today"
      : "No scores yesterday";

  const compactSlateProps = useMemo(() => {
    if (scoringDayTab === "today") {
      return {
        games: scoringSlateGames,
        slateDate: scoreboardSlateDate,
        fellBack: scoreboardQuery.data?.meta?.fellBack,
        requestedDate: scoreboardQuery.data?.meta?.requestedDate ?? today,
        teamStatusByAbbrev: scoreboardQuery.data?.teamStatusByAbbrev,
        isLoading: scoreboardQuery.isLoading,
      };
    }
    return {
      games: yesterdaySlateGames,
      slateDate: yesterdaySlateDate,
      fellBack: scoreboardYesterdayQuery.data?.meta?.fellBack,
      requestedDate:
        scoreboardYesterdayQuery.data?.meta?.requestedDate ?? yesterday,
      teamStatusByAbbrev: scoreboardYesterdayQuery.data?.teamStatusByAbbrev,
      isLoading: scoreboardYesterdayQuery.isLoading,
    };
  }, [
    scoringDayTab,
    scoringSlateGames,
    scoreboardSlateDate,
    scoreboardQuery.data?.meta?.fellBack,
    scoreboardQuery.data?.meta?.requestedDate,
    scoreboardQuery.data?.teamStatusByAbbrev,
    scoreboardQuery.isLoading,
    today,
    yesterdaySlateGames,
    yesterdaySlateDate,
    scoreboardYesterdayQuery.data?.meta?.fellBack,
    scoreboardYesterdayQuery.data?.meta?.requestedDate,
    scoreboardYesterdayQuery.data?.teamStatusByAbbrev,
    scoreboardYesterdayQuery.isLoading,
    yesterday,
  ]);

  function goToTeamDetail(teamId: string) {
    router.push(`/standings/team/${encodeURIComponent(teamId)}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-8">
        <PoolSiteChrome
          standingsHref={standingsHref}
          scoringHref={scoringHref}
          scoringPlayersHref={scoringPlayersHref}
          isStandingsRoute={isStandingsRoute}
          isScoringRoute={isScoringRoute}
          isScoringPoolTeamRoute={isScoringPoolTeamRoute}
          isScoringPlayersRoute={isScoringPlayersRoute}
          showScoringGroupNav={poolView === "sources"}
        />
        {poolView === "sources" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 sm:sr-only">
              Day
            </p>
            <ScoringDayTabs
              value={scoringDayTab}
              onChange={setScoringDayTab}
              controlsId="pool-scoring-day-panel"
            />
          </div>
        ) : null}
        {poolView === "sources" && daySourcesQuery.data?.scoreboardMeta?.fellBack ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No playoff games on{" "}
            {format(parseISO(selectedScoringDate), "MMMM d")}. Showing scoring
            from{" "}
            {format(
              parseISO(daySourcesQuery.data.scoreboardMeta.effectiveDate),
              "MMMM d",
            )}{" "}
            (most recent slate).
          </p>
        ) : null}
      </header>

      {poolView === "sources" ? (
        <div
          id="pool-scoring-day-panel"
          role="tabpanel"
          aria-label={
            scoringDayTab === "today"
              ? "Daily scoring"
              : "Yesterday’s scoring"
          }
        >
          <CompactNhlSlate
            games={compactSlateProps.games}
            slateDate={compactSlateProps.slateDate}
            fellBack={compactSlateProps.fellBack}
            requestedDate={compactSlateProps.requestedDate}
            teamStatusByAbbrev={compactSlateProps.teamStatusByAbbrev}
            isLoading={compactSlateProps.isLoading}
          />
        </div>
      ) : null}

      {standingsQuery.error instanceof Error && poolView === "standings" ? (
        <div
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50"
          role="alert"
        >
          {standingsQuery.error.message}
        </div>
      ) : null}

      {daySourcesQuery.error instanceof Error && poolView === "sources" ? (
        <div
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50"
          role="alert"
        >
          {daySourcesQuery.error.message}
        </div>
      ) : null}

      {standingsQuery.isLoading && poolView === "standings" ? (
        <CenteredLoading message="Loading standings…" variant="section" />
      ) : null}

      {daySourcesQuery.isLoading && poolView === "sources" ? (
        <CenteredLoading message="Loading daily scoring…" variant="section" />
      ) : null}

      {poolView === "sources" && daySourcesQuery.data ? (
        sourcesLayout === "crewNhl" ? (
          <PoolDaySourcesAvatars
            skaters={daySourcesQuery.data.skaters}
            teamWins={daySourcesQuery.data.teamWins}
            emptyMessage={scoringEmptyMessage}
          />
        ) : (
          <PoolDaySourcesCrewByPool
            skaters={daySourcesQuery.data.skaters}
            teamWins={daySourcesQuery.data.teamWins}
            standingsRankByTeamId={standingsRankByTeamId}
            emptyMessage={scoringEmptyMessage}
          />
        )
      ) : null}

      {standingsQuery.data && poolView === "standings" ? (
        <div className="flex flex-col">
          {standingsQuery.data.standings[0] ? (
            <div className="order-0 mb-6 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400/20 to-amber-300/10 px-4 py-3.5 ring-1 ring-amber-500/40 dark:from-amber-400/15 dark:to-amber-300/5 dark:ring-amber-400/30">
              <span className="text-2xl" aria-hidden="true">
                🏆
              </span>
              {ownerAvatarSrc(standingsQuery.data.standings[0].ownerAvatar) ? (
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950">
                  <OwnerAvatarImage
                    filename={standingsQuery.data.standings[0].ownerAvatar}
                    width={44}
                    height={44}
                    className="h-11 w-11 object-cover object-top"
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
                  Pool Champion
                </p>
                <p className="truncate font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {standingsQuery.data.standings[0].name}
                </p>
                <p className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {standingsQuery.data.standings[0].ownerName}
                </p>
              </div>
            </div>
          ) : null}

          <ul className="order-1 space-y-2 sm:hidden" role="list" aria-label="Standings">
            {standingsQuery.data.standings.map((row) => (
              <li key={row.teamId}>
                <button
                  type="button"
                  onClick={() => goToTeamDetail(row.teamId)}
                  className="touch-manipulation flex min-h-[4.5rem] w-full min-w-0 items-center gap-2 rounded-2xl bg-white px-3 py-3.5 text-left shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] transition-colors active:bg-zinc-50 dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08] dark:active:bg-zinc-900/80"
                  aria-label={`${row.name}, ${row.ownerName}. Rank ${row.rank}${rankMovementAriaSuffix(row.rankDelta)}. ${row.totalPoints} cumulative playoff points through ${standingsThroughLabel}. Open team detail.`}
                >
                    <div
                      className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl tabular-nums shadow-sm ${
                        row.rank === 1
                          ? "bg-amber-400/25 ring-2 ring-amber-500/55 dark:bg-amber-400/15 dark:ring-amber-400/45"
                          : "bg-zinc-100 ring-1 ring-zinc-900/[0.1] dark:bg-zinc-800/90 dark:ring-white/[0.12]"
                      }`}
                    >
                      <span
                        className={`font-pool-display text-xl font-bold leading-none tracking-tight ${
                          row.rank === 1
                            ? "text-amber-950 dark:text-amber-100"
                            : "text-zinc-900 dark:text-zinc-50"
                        }`}
                      >
                        {row.rank}
                      </span>
                      {row.rankDelta != null && row.rankDelta !== 0 ? (
                        row.rankDelta > 0 ? (
                          <span className="text-[0.65rem] font-semibold leading-none text-emerald-600 dark:text-emerald-400">
                            ↑{row.rankDelta}
                          </span>
                        ) : (
                          <span className="text-[0.65rem] font-semibold leading-none text-red-600 dark:text-red-400">
                            ↓{Math.abs(row.rankDelta)}
                          </span>
                        )
                      ) : null}
                    </div>
                    {ownerAvatarSrc(row.ownerAvatar) ? (
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950">
                        <OwnerAvatarImage
                          filename={row.ownerAvatar}
                          width={44}
                          height={44}
                          className="h-11 w-11 object-cover object-top"
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                        {row.name}
                      </div>
                      <div className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {row.ownerName}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-pool-display text-xl font-medium tabular-nums leading-none text-zinc-700 dark:text-zinc-300">
                        {row.totalPoints}
                      </div>
                      <div className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        pts
                      </div>
                    </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="order-2 mt-6 sm:order-3 sm:mt-8">
            <PoolRosterOutlook asOfDate={today} onOpenTeam={goToTeamDetail} />
          </div>

          <div className="order-3 mt-6 sm:order-4 sm:mt-8">
            <PoolReview asOfDate={today} />
          </div>

          <div className="order-5 hidden overflow-x-auto rounded-2xl bg-white shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.04] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.06] sm:order-2 sm:block">
            <table className="min-w-[640px] w-full text-left text-sm">
              <thead className="bg-zinc-50/90 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">
                    # <span className="sr-only">and movement</span>
                  </th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Player points (G+A)</th>
                  <th className="px-4 py-3">Team wins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/80">
                {standingsQuery.data.standings.map((row) => (
                  <tr
                    key={row.teamId}
                    className="cursor-pointer text-zinc-900 transition-colors hover:bg-zinc-50/80 dark:text-zinc-100 dark:hover:bg-zinc-900/40"
                    tabIndex={0}
                    role="link"
                    aria-label={`${row.name}, ${row.ownerName}. Rank ${row.rank}${rankMovementAriaSuffix(row.rankDelta)}. ${row.totalPoints} cumulative playoff points through ${standingsThroughLabel}. Open team detail.`}
                    onClick={() => goToTeamDetail(row.teamId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goToTeamDetail(row.teamId);
                      }
                    }}
                  >
                    <td className="px-4 py-3 text-zinc-500">
                      <RankAndMovement rank={row.rank} rankDelta={row.rankDelta} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {ownerAvatarSrc(row.ownerAvatar) ? (
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950">
                            <OwnerAvatarImage
                              filename={row.ownerAvatar}
                              width={40}
                              height={40}
                              className="h-10 w-10 object-cover object-top"
                            />
                          </div>
                        ) : null}
                        <div className="min-w-0">
                          <div className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                            {row.name}
                          </div>
                          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {row.ownerName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{row.totalPoints}</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {row.skaterPoints}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {row.teamWinPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="order-6 mt-10 flex flex-col gap-4">
            {dailyPointsQuery.isLoading ? (
              <CenteredLoading message="Loading daily points chart…" variant="section" />
            ) : null}
            {dailyPointsQuery.error instanceof Error ? (
              <div
                className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50"
                role="alert"
              >
                {dailyPointsQuery.error.message}
              </div>
            ) : null}
            {dailyPointsQuery.data ? (
              <PoolDailyPointsChart data={dailyPointsQuery.data} />
            ) : null}
          </div>

          <div className="order-7 mt-10">
            <PoolProjectionHistory />
          </div>

          <div id="team-mix" className="order-8 mt-10 scroll-mt-4">
            <PoolPickDistribution asOfDate={today} onOpenPoolTeam={goToTeamDetail} />
          </div>
        </div>
      ) : null}

      {poolView === "standings" ? <PlayoffBracketHomeSection /> : null}
    </div>
  );
}
