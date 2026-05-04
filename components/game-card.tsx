"use client";

import Image from "next/image";
import { useState } from "react";
import { formatPeriodDescriptorLabel } from "@/lib/nhl/period-descriptor";
import type { NhlTeamPlayoffStatus, ScoreboardGame } from "@/lib/nhl/schemas";
import { BoxScorePanel } from "@/components/box-score-panel";

function formatStartLocal(iso: string | undefined) {
  if (iso == null || iso === "") return "Start time TBA";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function stateBadgeClass(gameState: string) {
  if (gameState === "LIVE" || gameState === "CRIT") {
    return "bg-emerald-600/15 text-emerald-800 ring-1 ring-emerald-600/30 dark:text-emerald-300";
  }
  if (gameState === "FUT" || gameState === "PRE") {
    return "bg-amber-600/15 text-amber-900 ring-1 ring-amber-600/25 dark:text-amber-200";
  }
  return "bg-zinc-500/10 text-zinc-700 ring-1 ring-zinc-500/20 dark:text-zinc-300";
}

export function GameCard({
  game,
  teamStatusByAbbrev,
}: {
  game: ScoreboardGame;
  teamStatusByAbbrev?: Readonly<Record<string, NhlTeamPlayoffStatus>>;
}) {
  const [open, setOpen] = useState(false);
  const away = game.awayTeam;
  const home = game.homeTeam;
  const series = game.seriesStatus;
  const awayEliminated =
    teamStatusByAbbrev?.[away.abbrev.trim().toUpperCase()] === "eliminated";
  const homeEliminated =
    teamStatusByAbbrev?.[home.abbrev.trim().toUpperCase()] === "eliminated";

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center justify-between gap-4 sm:justify-start">
            <div
              className={`flex min-w-0 items-center gap-3 ${
                awayEliminated ? "opacity-55 grayscale" : ""
              }`}
            >
              {away.logo ? (
                <Image
                  src={away.logo}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 object-contain"
                  unoptimized
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {away.commonName?.default ?? away.abbrev}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {away.record ? `Record ${away.record}` : "Away"}
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {away.score ?? "—"}
            </span>
          </div>

          <div className="hidden text-sm font-medium text-zinc-400 sm:block">
            @
          </div>

          <div className="flex items-center justify-between gap-4 sm:justify-start">
            <div
              className={`flex min-w-0 items-center gap-3 ${
                homeEliminated ? "opacity-55 grayscale" : ""
              }`}
            >
              {home.logo ? (
                <Image
                  src={home.logo}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 object-contain"
                  unoptimized
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {home.commonName?.default ?? home.abbrev}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {home.record ? `Record ${home.record}` : "Home"}
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {home.score ?? "—"}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <span
            className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${stateBadgeClass(game.gameState)}`}
          >
            {game.gameState}
          </span>
          {game.gameState === "LIVE" || game.gameState === "CRIT" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {game.periodDescriptor
                ? formatPeriodDescriptorLabel(game.periodDescriptor)
                : game.period != null
                  ? `Period ${game.period}`
                  : ""}
              {game.clock?.timeRemaining
                ? ` · ${game.clock.timeRemaining}`
                : ""}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatStartLocal(game.startTimeUTC)}
          </p>
          {series ? (
            <p className="max-w-xs text-right text-xs text-zinc-600 dark:text-zinc-400">
              Round {series.round} · Game {series.game}
              {series.topSeedTeamAbbrev != null ||
              series.bottomSeedTeamAbbrev != null ? (
                <>
                  {" "}
                  · {series.topSeedTeamAbbrev ?? "TBD"}{" "}
                  {series.topSeedWins}-{series.bottomSeedWins}{" "}
                  {series.bottomSeedTeamAbbrev ?? "TBD"}
                </>
              ) : null}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            aria-expanded={open}
          >
            {open ? "Hide box score" : "Box score"}
          </button>
        </div>
      </div>
      {open ? <BoxScorePanel gameId={game.id} /> : null}
    </article>
  );
}
