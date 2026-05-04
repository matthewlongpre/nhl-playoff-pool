"use client";

import { useMemo } from "react";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { NhlTeamLogoEliminatedWrap } from "@/components/nhl-team-logo-eliminated-wrap";
import { OwnerAvatarImage } from "@/components/owner-avatar-image";
import { nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";
import { ownerAvatarSrc } from "@/lib/pool/owner-avatar";
import type { TeamWinPickStatus } from "@/lib/pool/remaining-picks-by-team";
import { runwayStackedBarWidths } from "@/lib/pool/runway-bar-segments";

export type PoolScoringRunwayRow = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
  totalPoints: number;
  remainingSkaters: number;
  totalSkaters: number;
  remainingTeams: number;
  totalTeams: number;
  teamWinPicks?: TeamWinPickStatus[];
};

type Props = {
  rows: PoolScoringRunwayRow[];
  onOpenTeam: (teamId: string) => void;
};

export function PoolScoringRunway({ rows, onOpenTeam }: Props) {
  const ordered = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aliveA = a.remainingSkaters + a.remainingTeams;
      const aliveB = b.remainingSkaters + b.remainingTeams;
      if (aliveB !== aliveA) return aliveB - aliveA;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return a.name.localeCompare(b.name);
    });
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <section
      className="rounded-2xl bg-white px-4 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08] sm:px-5"
      aria-labelledby="pool-scoring-runway-heading"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="pool-scoring-runway-heading"
          className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Scoring runway
        </h2>
        <p className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">
          Who still has roster room to score as teams drop out—bars are alive vs. eliminated picks, not a points
          projection.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 shrink-0 rounded-sm bg-sky-500 dark:bg-sky-400" />
          Skaters alive
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 shrink-0 rounded-sm bg-amber-500 dark:bg-amber-400" />
          Teams alive
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 shrink-0 rounded-sm bg-zinc-300 dark:bg-zinc-600" />
          Eliminated
        </span>
      </div>

      <ul className="mt-3 divide-y divide-zinc-200/80 dark:divide-zinc-800/80" role="list">
        {ordered.map((row) => {
          const { skAlivePct, tmAlivePct, eliminatedPct, totalSlots } =
            runwayStackedBarWidths(row);
          const aliveTotal = row.remainingSkaters + row.remainingTeams;
          const teamWinPicksS =
            row.teamWinPicks && row.teamWinPicks.length > 0
              ? ` Team win clubs: ${row.teamWinPicks
                  .map((t) =>
                    t.eliminated ? `${t.teamAbbrev} (eliminated)` : t.teamAbbrev,
                  )
                  .join(", ")}.`
              : "";
          const aria =
            totalSlots > 0
              ? `${row.name}, ${row.ownerName}. ${aliveTotal} of ${totalSlots} picks remaining, ${row.remainingSkaters} skaters and ${row.remainingTeams} team picks.${teamWinPicksS} ${row.totalPoints} points to date. Open team detail.`
              : `${row.name}, ${row.ownerName}. No roster picks. ${row.totalPoints} points to date. Open team detail.`;
          return (
            <li key={row.teamId}>
              <button
                type="button"
                onClick={() => onOpenTeam(row.teamId)}
                className="touch-manipulation flex w-full gap-3 py-3.5 text-left first:pt-2 active:bg-zinc-50/80 dark:active:bg-zinc-900/50"
                aria-label={aria}
              >
                {ownerAvatarSrc(row.ownerAvatar) ? (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950">
                    <OwnerAvatarImage
                      filename={row.ownerAvatar}
                      width={40}
                      height={40}
                      className="h-10 w-10 object-cover object-top"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-200/80 dark:bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                      {row.name}
                    </span>
                    {totalSlots > 0 ? (
                      <span className="inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap font-pool-display text-base font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                        {aliveTotal}
                        <span className="text-[0.6rem] font-normal font-sans leading-none tracking-tight text-zinc-500 dark:text-zinc-400">
                          left
                        </span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-[0.7rem] tabular-nums text-zinc-400 dark:text-zinc-500">
                        —
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[0.7rem] text-zinc-500 dark:text-zinc-400">
                    <span>{row.ownerName}</span>
                    <span className="text-zinc-400/80 dark:text-zinc-500/80" aria-hidden="true">
                      {" · "}
                    </span>
                    <span className="tabular-nums text-zinc-400 dark:text-zinc-500">
                      {row.totalPoints} pts
                    </span>
                  </p>

                  <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-zinc-200/90 ring-1 ring-zinc-900/[0.06] dark:bg-zinc-800/90 dark:ring-white/[0.08]">
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
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.65rem] tabular-nums text-zinc-500 dark:text-zinc-400">
                    {totalSlots > 0 ? (
                      <>
                        <span>
                          P {row.remainingSkaters}/{row.totalSkaters}
                          <span className="text-zinc-400 dark:text-zinc-500"> skaters</span>
                        </span>
                        {row.totalTeams > 0 ? (
                          <>
                            {row.teamWinPicks && row.teamWinPicks.length > 0 ? (
                              <>
                                <span
                                  className="text-zinc-400/80 dark:text-zinc-500/80"
                                  aria-hidden="true"
                                >
                                  ·
                                </span>
                                <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                                  {row.teamWinPicks.map((t, idx) => (
                                    <NhlTeamLogoEliminatedWrap
                                      key={`${row.teamId}-twp-${idx}`}
                                      eliminated={t.eliminated}
                                      className="h-5 w-5 shrink-0"
                                    >
                                      <NhleTeamLogoImage
                                        src={nhlTeamLogoLightSvgUrl(t.teamAbbrev)}
                                        width={20}
                                        height={20}
                                        alt=""
                                        className="max-h-5 max-w-5"
                                      />
                                    </NhlTeamLogoEliminatedWrap>
                                  ))}
                                </span>
                              </>
                            ) : (
                              <>
                                <span
                                  className="text-zinc-400/80 dark:text-zinc-500/80"
                                  aria-hidden="true"
                                >
                                  ·
                                </span>
                                <span>
                                  T {row.remainingTeams}/{row.totalTeams}
                                  <span className="text-zinc-400 dark:text-zinc-500"> teams</span>
                                </span>
                              </>
                            )}
                          </>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-zinc-500">No roster picks</span>
                    )}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
