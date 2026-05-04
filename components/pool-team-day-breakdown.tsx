"use client";

import Image from "next/image";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { CenteredLoading } from "@/components/centered-loading";
import { useState } from "react";
import { PoolSkaterStatsResponsive } from "@/components/pool-skater-stats-responsive";
import { nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";
import type { TeamScoreBreakdown } from "@/lib/pool/scoring";

type Props = {
  breakdown?: TeamScoreBreakdown;
  isLoading?: boolean;
  errorMessage?: string;
};

export function PoolTeamDayBreakdown({
  breakdown,
  isLoading,
  errorMessage,
}: Props) {
  if (isLoading) {
    return (
      <CenteredLoading
        message="Loading scoring details…"
        variant="section"
        className="max-w-none"
      />
    );
  }

  if (errorMessage) {
    return (
      <div className="px-4 py-6 text-sm text-red-600 dark:text-red-400">
        {errorMessage}
      </div>
    );
  }

  if (!breakdown) {
    return (
      <div className="px-4 py-6 text-sm text-zinc-500">
        No scoring details available.
      </div>
    );
  }

  const [showFullSkaterRoster, setShowFullSkaterRoster] = useState(false);
  const [showAllTeamPicks, setShowAllTeamPicks] = useState(false);

  const skaters = [...breakdown.skaterDetail].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.label.localeCompare(b.label);
  });

  const skatersWithPoints = skaters.filter((s) => s.points > 0);
  const skatersQuiet = skaters.filter((s) => s.points === 0);
  const skatersDisplayed = showFullSkaterRoster ? skaters : skatersWithPoints;
  const hasHiddenSkaters = skatersQuiet.length > 0;

  const allTeams = [...breakdown.teamDetail].sort((a, b) => {
    const winA = a.wins >= 1 ? 1 : 0;
    const winB = b.wins >= 1 ? 1 : 0;
    if (winB !== winA) return winB - winA;
    return a.label.localeCompare(b.label);
  });
  const teamsWonToday = allTeams.filter((t) => t.wins >= 1);
  const teamsDisplayed = showAllTeamPicks ? allTeams : teamsWonToday;
  const hasHiddenTeamPicks = allTeams.some((t) => t.wins < 1);

  return (
    <div className="space-y-6 px-4 py-5">
      <section>
        <h3 className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Players
        </h3>
        {skatersDisplayed.length === 0 ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {showFullSkaterRoster
                ? "No skaters on this roster."
                : "No skaters scored points today."}
            </p>
            {!showFullSkaterRoster && hasHiddenSkaters ? (
              <button
                type="button"
                className="text-sm font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
                onClick={() => setShowFullSkaterRoster(true)}
              >
                Show full roster ({skaters.length})
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-2">
              <PoolSkaterStatsResponsive skaters={skatersDisplayed} />
            </div>
            {hasHiddenSkaters ? (
              <div className="mt-2">
                <button
                  type="button"
                  className="text-sm font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
                  onClick={() => setShowFullSkaterRoster((v) => !v)}
                  aria-expanded={showFullSkaterRoster}
                >
                  {showFullSkaterRoster
                    ? "Show only scorers"
                    : `Show full roster (${skaters.length})`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section>
        <h3 className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Teams
        </h3>
        {allTeams.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No team picks on this roster.
          </p>
        ) : teamsDisplayed.length === 0 ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No team picks won today.
            </p>
            {!showAllTeamPicks && hasHiddenTeamPicks ? (
              <button
                type="button"
                className="text-sm font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
                onClick={() => setShowAllTeamPicks(true)}
              >
                Show all picks ({allTeams.length})
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <ul className="mt-2 space-y-2 text-sm">
              {teamsDisplayed.map((t) => (
                <li
                  key={`tm-${t.round}-${t.label}`}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 ring-1 ${
                    t.points > 0
                      ? "bg-emerald-50/70 ring-emerald-200/60 dark:bg-emerald-950/20 dark:ring-emerald-800/40"
                      : "bg-zinc-100/50 ring-zinc-900/[0.06] dark:bg-zinc-900/30 dark:ring-white/[0.06]"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/90 ring-1 ring-zinc-900/10 dark:bg-zinc-950/80 dark:ring-white/10">
                      <NhleTeamLogoImage
                        src={nhlTeamLogoLightSvgUrl(t.teamAbbrev)}
                        alt=""
                        width={36}
                        height={36}
                        className="h-9 w-9 p-0.5"
                      />
                    </div>
                    <span className="min-w-0 font-medium text-zinc-900 dark:text-zinc-100">
                      {t.label}
                    </span>
                  </div>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {t.wins >= 1 ? (
                      <>
                        Won <span className="tabular-nums">{t.wins}</span> game
                        {t.wins === 1 ? "" : "s"}
                        {t.points > 0 ? (
                          <>
                            {" "}
                            ·{" "}
                            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                              +{t.points} pt
                            </span>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>No win today</>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {hasHiddenTeamPicks ? (
              <div className="mt-2">
                <button
                  type="button"
                  className="text-sm font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
                  onClick={() => setShowAllTeamPicks((v) => !v)}
                  aria-expanded={showAllTeamPicks}
                >
                  {showAllTeamPicks
                    ? "Show only winners"
                    : `Show all picks (${allTeams.length})`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
