"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { NhlScoreboardApiResponse } from "@/lib/nhl/schemas";
import { getNhlScoreboardRefreshIntervalMsCapped } from "@/lib/nhl/adaptive-interval";
import { getVisibleGamesForDay } from "@/lib/nhl/games-for-interval";
import { useAdaptiveNhlRefreshInterval } from "@/hooks/use-adaptive-nhl-refresh-interval";
import Link from "next/link";
import { CenteredLoading } from "@/components/centered-loading";
import { GameCard } from "@/components/game-card";
import { poolCalendarToday } from "@/lib/pool/pool-season";

async function fetchScoreboard(date: string): Promise<NhlScoreboardApiResponse> {
  const res = await fetch(
    `/api/nhl/scoreboard?date=${encodeURIComponent(date)}&playoffFallback=1`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : "Failed to load scoreboard",
    );
  }
  return res.json();
}

export function NhlDashboard() {
  const today = poolCalendarToday();

  const [playoffsOnly, setPlayoffsOnly] = useState(true);

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ["nhl-scoreboard", today],
    queryFn: () => fetchScoreboard(today),
    refetchInterval: (q) => {
      const scoreboard = q.state.data as NhlScoreboardApiResponse | undefined;
      const d = scoreboard?.meta?.effectiveDate ?? today;
      const games = getVisibleGamesForDay(scoreboard, d, playoffsOnly);
      return getNhlScoreboardRefreshIntervalMsCapped(games);
    },
  });

  const slateDate = data?.meta?.effectiveDate ?? today;
  const fellBack = data?.meta?.fellBack ?? false;

  const visibleGames = useMemo(
    () => getVisibleGamesForDay(data, slateDate, playoffsOnly),
    [data, slateDate, playoffsOnly],
  );

  const refreshMs = useAdaptiveNhlRefreshInterval(visibleGames);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            <span className="text-zinc-900 dark:text-zinc-100">Game scores</span>
            <span className="mx-2 text-zinc-400">/</span>
            <Link
              href="/nhl/bracket"
              className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
            >
              Bracket
            </Link>
            <span className="mx-2 text-zinc-400">/</span>
            <Link
              href="/"
              className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
            >
              Pool standings
            </Link>
          </p>
          <h1 className="font-pool-display mt-2 text-[2rem] font-semibold leading-[1.12] tracking-[-0.02em] text-zinc-900 sm:text-4xl dark:text-zinc-50">
            NHL playoff dashboard
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Live scores from the NHL web API. Box scores load on demand per game.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Playoff slate · {slateDate}
              {fellBack ? (
                <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
                  (no games on {today}; showing most recent night)
                </span>
              ) : null}
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={playoffsOnly}
              onChange={(e) => setPlayoffsOnly(e.target.checked)}
              className="size-4 rounded border-zinc-400"
            />
            Playoffs only (game type 3)
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            {visibleGames.length} game{visibleGames.length === 1 ? "" : "s"} on this slate
          </span>
          <span className="text-xs text-zinc-500">
            {typeof refreshMs === "number"
              ? `~${Math.round(refreshMs / 1000)}s adaptive refresh`
              : "Auto-refresh off while slate is idle"}
          </span>
          {isFetching && !isLoading ? (
            <span className="text-xs text-zinc-500">Refreshing…</span>
          ) : null}
        </div>
      </header>

      {error instanceof Error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error.message}
        </div>
      ) : null}

      {isLoading ? (
        <CenteredLoading message="Loading schedule…" variant="section" />
      ) : null}

      {!isLoading && visibleGames.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No playoff games found for {slateDate}
          {fellBack ? ` (after checking recent days from ${today})` : ""}. Try
          turning off &quot;Playoffs only&quot; to include regular-season games.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {visibleGames.map((game) => (
            <li key={game.id}>
              <GameCard game={game} teamStatusByAbbrev={data?.teamStatusByAbbrev} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
