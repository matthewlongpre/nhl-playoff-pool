"use client";

import Link from "next/link";

export type PoolSiteChromeProps = {
  standingsHref: string;
  scoringHref: string;
  scoringPlayersHref: string;
  isStandingsRoute: boolean;
  /** `/scoring` or `/scoring/players` */
  isScoringRoute: boolean;
  isScoringPoolTeamRoute: boolean;
  isScoringPlayersRoute: boolean;
  /** Daily scoring sub-nav (pool team vs players) */
  showScoringGroupNav: boolean;
};

export function PoolSiteChrome({
  standingsHref,
  scoringHref,
  scoringPlayersHref,
  isStandingsRoute,
  isScoringRoute,
  isScoringPoolTeamRoute,
  isScoringPlayersRoute,
  showScoringGroupNav,
}: PoolSiteChromeProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-pool-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-balance text-zinc-900 sm:text-4xl dark:text-zinc-50">
          Friends of Longpre
        </h1>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-800/90 dark:text-amber-400/95">
          NHL Playoff Pool 2026
        </p>
      </div>

      <nav
        className="rounded-2xl bg-zinc-100/70 p-3 sm:rounded-[2rem] dark:bg-zinc-900/35"
        aria-label="Pool view"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 sm:pl-1">
          <div className="w-full sm:w-auto sm:shrink-0 sm:min-w-0">
            <p className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 sm:hidden">
              View
            </p>
            <div
              className="inline-flex w-full rounded-full bg-zinc-200/70 p-1 dark:bg-zinc-950/60 sm:w-auto"
              role="group"
              aria-label="What to show"
            >
              <Link
                href={standingsHref}
                scroll={false}
                aria-current={isStandingsRoute ? "page" : undefined}
                className={`min-h-[2.25rem] flex-1 rounded-full px-3 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-4 ${
                  isStandingsRoute
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-white/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
                }`}
                title="Ranked table: tap a row for that team’s cumulative totals and pick breakdown"
              >
                Standings
              </Link>
              <Link
                href={scoringHref}
                scroll={false}
                aria-current={isScoringRoute ? "page" : undefined}
                className={`min-h-[2.25rem] flex-1 rounded-full px-3 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-4 ${
                  isScoringRoute
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-white/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
                }`}
                title="Who scored from this date’s playoff games"
              >
                Daily scoring
              </Link>
            </div>
          </div>

          <div
            className={`w-full sm:min-w-0 sm:flex-1 ${
              showScoringGroupNav
                ? "sm:border-l sm:border-zinc-200/50 sm:pl-6 dark:sm:border-zinc-700/50"
                : ""
            }`}
          >
            {showScoringGroupNav ? (
              <>
                <p className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 sm:hidden">
                  Group by
                </p>
                <div
                  className="flex flex-col overflow-hidden rounded-xl border border-zinc-200/90 bg-zinc-50/80 sm:hidden dark:border-zinc-700/60 dark:bg-zinc-950/40"
                  role="group"
                  aria-label="How to group daily scoring"
                >
                  <Link
                    href={scoringHref}
                    scroll={false}
                    aria-current={isScoringPoolTeamRoute ? "page" : undefined}
                    className={`min-h-[2.75rem] w-full border-b border-zinc-200/70 px-4 py-2.5 text-left text-sm font-medium transition-colors dark:border-zinc-700/60 ${
                      isScoringPoolTeamRoute
                        ? "bg-white text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
                        : "text-zinc-600 hover:bg-white/60 active:bg-white/80 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:active:bg-zinc-800"
                    }`}
                    title="One card per pool team—whose picks scored that day"
                  >
                    Pool team
                  </Link>
                  <Link
                    href={scoringPlayersHref}
                    scroll={false}
                    aria-current={isScoringPlayersRoute ? "page" : undefined}
                    className={`min-h-[2.75rem] w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                      isScoringPlayersRoute
                        ? "bg-white text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
                        : "text-zinc-600 hover:bg-white/60 active:bg-white/80 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:active:bg-zinc-800"
                    }`}
                    title="Grouped by NHL skater (goals/assists) and by team win"
                  >
                    Players
                  </Link>
                </div>
                <div
                  className="hidden sm:inline-flex w-full rounded-full bg-zinc-200/70 p-1 dark:bg-zinc-950/60 sm:w-auto"
                  role="group"
                  aria-label="How to group daily scoring"
                >
                  <Link
                    href={scoringHref}
                    scroll={false}
                    aria-current={isScoringPoolTeamRoute ? "page" : undefined}
                    className={`min-h-[2.25rem] flex-1 rounded-full px-3 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-5 ${
                      isScoringPoolTeamRoute
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                        : "text-zinc-600 hover:bg-white/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
                    }`}
                    title="One card per pool team—whose picks scored that day"
                  >
                    Pool team
                  </Link>
                  <Link
                    href={scoringPlayersHref}
                    scroll={false}
                    aria-current={isScoringPlayersRoute ? "page" : undefined}
                    className={`min-h-[2.25rem] flex-1 rounded-full px-3 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-5 ${
                      isScoringPlayersRoute
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                        : "text-zinc-600 hover:bg-white/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
                    }`}
                    title="Grouped by NHL skater (goals/assists) and by team win"
                  >
                    Players
                  </Link>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </nav>
    </div>
  );
}
