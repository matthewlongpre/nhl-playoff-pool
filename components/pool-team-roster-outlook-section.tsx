"use client";

import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { NhlTeamLogoEliminatedWrap } from "@/components/nhl-team-logo-eliminated-wrap";
import { nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";
import type { PoolTeamProjection } from "@/lib/pool/projection";
import type { TeamWinPickStatus } from "@/lib/pool/remaining-picks-by-team";
import { runwayStackedBarWidths } from "@/lib/pool/runway-bar-segments";

function formatOneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(Math.max(0, Math.min(100, n)))}%`;
}

export type PoolTeamRosterOutlookMeta = {
  perGameProbModel: string;
  baselineP: number;
  ppgPriorWeight: number;
  playoffSampleJoined: boolean;
};

export type PoolTeamRosterOutlookSectionModel = {
  poolTeamId: string;
  subtitle: string;
  totalToDate: number;
  projectedFinal: number | null;
  projectedRemaining: number | null;
  lockedInPct: number | null;
  maxFinal: number | null;
  runway: {
    remainingSkaters: number;
    totalSkaters: number;
    remainingTeams: number;
    totalTeams: number;
    teamWinPicks: TeamWinPickStatus[];
  } | null;
  bestPick: PoolTeamProjection["bestPick"];
  collisions: PoolTeamProjection["collisions"];
  projectionMeta: PoolTeamRosterOutlookMeta | null;
};

export function PoolTeamRosterOutlookSection({
  model,
}: {
  model: PoolTeamRosterOutlookSectionModel;
}) {
  const {
    poolTeamId,
    subtitle,
    totalToDate,
    projectedFinal,
    projectedRemaining,
    lockedInPct,
    maxFinal,
    runway,
    bestPick,
    collisions,
    projectionMeta,
  } = model;

  const max = maxFinal ?? 0;
  const actualPct =
    max > 0 && projectedFinal != null ? (totalToDate / max) * 100 : 0;
  const projPct =
    max > 0 && projectedRemaining != null ? (projectedRemaining / max) * 100 : 0;
  const gapPct = Math.max(0, 100 - actualPct - projPct);

  const runwayCounts = runway ?? {
    remainingSkaters: 0,
    totalSkaters: 0,
    remainingTeams: 0,
    totalTeams: 0,
  };
  const { skAlivePct, tmAlivePct, eliminatedPct, totalSlots } =
    runwayStackedBarWidths({
      remainingSkaters: runwayCounts.remainingSkaters,
      totalSkaters: runwayCounts.totalSkaters,
      remainingTeams: runwayCounts.remainingTeams,
      totalTeams: runwayCounts.totalTeams,
    });
  const teamWinPicks = runway?.teamWinPicks ?? [];
  const collisionCount = collisions.length;

  const showPointsBar = maxFinal != null && maxFinal > 0 && projectedFinal != null;

  return (
    <section
      className="rounded-2xl bg-white px-4 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08] sm:px-5"
      aria-labelledby="team-roster-outlook-heading"
    >
      <header className="flex flex-col gap-1">
        <h2
          id="team-roster-outlook-heading"
          className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Roster outlook
        </h2>
        <p className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">
          {subtitle}
        </p>
      </header>

      <div className="mt-3">
        <div className="flex flex-col gap-1 text-[0.72rem] leading-snug text-zinc-500 dark:text-zinc-400 sm:hidden">
          <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
            <span>{totalToDate} scored</span>
            {projectedRemaining != null ? (
              <span className="text-emerald-700 dark:text-emerald-400">
                +{formatOneDecimal(projectedRemaining)} projected
              </span>
            ) : null}
            {lockedInPct != null ? (
              <span>{formatPercent(lockedInPct)} locked-in</span>
            ) : null}
          </div>
        </div>
        <p className="hidden truncate text-[0.7rem] text-zinc-500 dark:text-zinc-400 sm:block">
          <span className="tabular-nums text-zinc-400 dark:text-zinc-500">
            {totalToDate} scored
          </span>
          {projectedRemaining != null ? (
            <>
              <span className="text-zinc-400/80 dark:text-zinc-500/80" aria-hidden="true">
                {" · "}
              </span>
              <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                +{formatOneDecimal(projectedRemaining)} projected
              </span>
            </>
          ) : null}
          {lockedInPct != null ? (
            <>
              <span className="text-zinc-400/80 dark:text-zinc-500/80" aria-hidden="true">
                {" · "}
              </span>
              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatPercent(lockedInPct)} locked-in
              </span>
            </>
          ) : null}
        </p>

        <div className="mt-2.5 flex flex-col gap-3.5">
          {showPointsBar ? (
            <div className="flex flex-col gap-1 sm:gap-0">
              <p className="text-[0.55rem] font-semibold uppercase leading-none tracking-[0.12em] text-zinc-500 dark:text-zinc-400 sm:hidden">
                Points vs leader
              </p>
              <p className="text-[0.5rem] leading-snug text-zinc-500 dark:text-zinc-500 sm:hidden">
                Dark scored · light expected · gray headroom
              </p>
              <div
                className="h-3 w-full overflow-hidden rounded-full bg-zinc-200/90 ring-1 ring-zinc-900/[0.06] dark:bg-zinc-800/90 dark:ring-white/[0.08] sm:h-2.5"
                aria-hidden="true"
              >
                <div className="flex h-full w-full min-w-0">
                  {actualPct > 0 ? (
                    <div
                      className="h-full min-w-0 bg-emerald-600 dark:bg-emerald-500"
                      style={{ width: `${actualPct}%` }}
                    />
                  ) : null}
                  {projPct > 0 ? (
                    <div
                      className="h-full min-w-0 bg-emerald-300 dark:bg-emerald-700"
                      style={{ width: `${projPct}%` }}
                    />
                  ) : null}
                  {gapPct > 0 ? (
                    <div
                      className="h-full min-w-0 bg-zinc-200 dark:bg-zinc-700"
                      style={{ width: `${gapPct}%` }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {totalSlots > 0 ? (
            <div className="flex flex-col gap-1 sm:gap-0">
              <p className="text-[0.55rem] font-semibold uppercase leading-none tracking-[0.12em] text-zinc-500 dark:text-zinc-400 sm:hidden">
                Pick survival
              </p>
              <p className="text-[0.5rem] leading-snug text-zinc-500 dark:text-zinc-500 sm:hidden">
                Blue skaters · gold teams · gray out
              </p>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/90 ring-1 ring-zinc-900/[0.06] dark:bg-zinc-800/90 dark:ring-white/[0.08] sm:h-2"
                aria-hidden="true"
              >
                <div className="flex h-full w-full min-w-0">
                  {skAlivePct > 0 ? (
                    <div
                      className="h-full min-w-0 bg-sky-500 dark:bg-sky-400"
                      style={{ width: `${skAlivePct}%` }}
                    />
                  ) : null}
                  {tmAlivePct > 0 ? (
                    <div
                      className="h-full min-w-0 bg-amber-500 dark:bg-amber-400"
                      style={{ width: `${tmAlivePct}%` }}
                    />
                  ) : null}
                  {eliminatedPct > 0 ? (
                    <div
                      className="h-full min-w-0 bg-zinc-300 dark:bg-zinc-600"
                      style={{ width: `${eliminatedPct}%` }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {totalSlots > 0 ? (
          <div className="mt-2 flex flex-col gap-2 text-[0.65rem] text-zinc-500 dark:text-zinc-400 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="tabular-nums">
                P {runwayCounts.remainingSkaters}/{runwayCounts.totalSkaters}
                <span className="text-zinc-400 dark:text-zinc-500"> sk</span>
                {runwayCounts.totalTeams > 0 ? (
                  <>
                    <span
                      className="mx-1 text-zinc-400/80 dark:text-zinc-500/80"
                      aria-hidden="true"
                    >
                      ·
                    </span>
                    T {runwayCounts.remainingTeams}/{runwayCounts.totalTeams}
                    <span className="text-zinc-400 dark:text-zinc-500"> tm</span>
                  </>
                ) : null}
              </span>
              {teamWinPicks.length > 0 ? (
                <span className="inline-flex items-center gap-1" aria-hidden="true">
                  {teamWinPicks.map((t, idx) => (
                    <NhlTeamLogoEliminatedWrap
                      key={`${poolTeamId}-ro-${idx}`}
                      eliminated={t.eliminated}
                      className="h-5 w-5 shrink-0 sm:h-4 sm:w-4"
                    >
                      <NhleTeamLogoImage
                        src={nhlTeamLogoLightSvgUrl(t.teamAbbrev)}
                        width={20}
                        height={20}
                        alt=""
                        className="max-h-5 max-w-5 sm:max-h-4 sm:max-w-4"
                      />
                    </NhlTeamLogoEliminatedWrap>
                  ))}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:contents">
              {bestPick ? (
                <span className="tabular-nums sm:min-w-0">
                  Top:{" "}
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {bestPick.label}
                  </span>{" "}
                  +{formatOneDecimal(bestPick.ev)}
                </span>
              ) : null}
              {collisionCount > 0 ? (
                <span
                  className="inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-semibold text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/50 sm:ml-auto"
                  title={collisions
                    .map(
                      (c) =>
                        `R${c.round} ${c.teamAbbrevs[0]} vs ${c.teamAbbrevs[1]}: ${c.pickLabels.join(", ")}`,
                    )
                    .join(" · ")}
                >
                  {`${collisionCount} face off · ${collisions
                    .map((c) => `R${c.round}`)
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .join(", ")}`}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2 text-[0.65rem] text-zinc-500 dark:text-zinc-400 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:contents">
              {bestPick ? (
                <span className="tabular-nums sm:min-w-0">
                  Top:{" "}
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {bestPick.label}
                  </span>{" "}
                  +{formatOneDecimal(bestPick.ev)}
                </span>
              ) : null}
              {collisionCount > 0 ? (
                <span
                  className="inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-semibold text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/50 sm:ml-auto"
                  title={collisions
                    .map(
                      (c) =>
                        `R${c.round} ${c.teamAbbrevs[0]} vs ${c.teamAbbrevs[1]}: ${c.pickLabels.join(", ")}`,
                    )
                    .join(" · ")}
                >
                  {`${collisionCount} face off · ${collisions
                    .map((c) => `R${c.round}`)
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .join(", ")}`}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {projectionMeta ? (
        <p className="mt-4 border-t border-zinc-200/80 pt-3 text-[0.6rem] uppercase tracking-[0.14em] text-zinc-400 dark:border-zinc-800/80 dark:text-zinc-500">
          Model {projectionMeta.perGameProbModel} · per-game p=
          {projectionMeta.baselineP.toFixed(2)} · PPG prior {projectionMeta.ppgPriorWeight}g
          {projectionMeta.playoffSampleJoined ? null : " · using regular-season prior only"}
        </p>
      ) : null}
    </section>
  );
}
