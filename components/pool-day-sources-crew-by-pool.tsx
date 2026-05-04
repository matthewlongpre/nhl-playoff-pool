"use client";

import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { PoolSkaterDayTile } from "@/components/pool-skater-day-tile";
import { formatWinsTonight } from "@/lib/format-stats";
import {
  groupDaySourcesByPoolTeam,
  type PoolTeamCrewRow,
} from "@/lib/pool/day-sources-by-pool";
import { OwnerAvatarImage } from "@/components/owner-avatar-image";
import { ownerAvatarSrc } from "@/lib/pool/owner-avatar";
import type {
  SkaterDaySource,
  TeamWinDaySource,
} from "@/lib/pool/day-sources";

type Props = {
  skaters: SkaterDaySource[];
  teamWins: TeamWinDaySource[];
  /** Cumulative standings rank for the selected date, keyed by pool `teamId`. */
  standingsRankByTeamId?: ReadonlyMap<string, number>;
  /** When no pool team has points for this slate. */
  emptyMessage?: string;
};

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % 360;
  }
  return h;
}

function ownerAvatarStyle(poolTeamId: string): CSSProperties {
  return { backgroundColor: `hsl(${hashHue(poolTeamId)} 52% 46%)` };
}

function ownerInitials(ownerName: string): string {
  const parts = ownerName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? "";
    const b = parts[parts.length - 1][0] ?? "";
    return (a + b).toUpperCase();
  }
  const one = parts[0] ?? "?";
  return one.length >= 2 ? one.slice(0, 2).toUpperCase() : `${one[0] ?? "?"}`.toUpperCase();
}

/** Skater + team-win tiles for one pool team — same layout as Daily scoring pool-team cards. */
export function PoolTeamDayScoringBreakdown({ row }: { row: PoolTeamCrewRow }) {
  const hasSkaters = row.skaters.length > 0;
  const hasTeamPicks = row.teamPicks.length > 0;
  const skatersAndTeamsSameRow = hasSkaters && hasTeamPicks;

  return (
    <div
      className={
        skatersAndTeamsSameRow
          ? "flex flex-col gap-8 px-4 py-5 md:flex-row md:items-start md:gap-8"
          : "space-y-5 px-4 py-5"
      }
    >
      {hasSkaters ? (
        <section className={skatersAndTeamsSameRow ? "min-w-0 flex-1" : undefined}>
          <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Players
          </h3>
          <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            {row.skaters.map((s) => (
              <PoolSkaterDayTile
                key={`sk-${s.nhlPlayerId}-${s.pickRound}`}
                label={s.label}
                nhlDisplayName={s.nhlDisplayName}
                goals={s.goals}
                assists={s.assists}
                headshotUrl={s.headshotUrl}
                pickRound={s.pickRound}
                fantasyPts={s.fantasyPts}
                fantasyContributionPresent
                nhlTeamAbbrev={s.nhlTeamAbbrev}
                trailingTeamLogoSrc={s.teamLogoUrl ?? null}
                lifecycleStatus={s.lifecycleStatus}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {hasTeamPicks ? (
        <section
          className={
            skatersAndTeamsSameRow ? "min-w-0 shrink-0 md:max-w-[min(100%,22rem)]" : undefined
          }
        >
          <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Teams
          </h3>
          <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            {row.teamPicks.map((t) => (
              <li
                key={`tm-${t.teamAbbrev}-${t.pickRound}`}
                className={`flex w-full flex-row items-center gap-3 rounded-2xl bg-zinc-100/70 p-3 ring-1 ring-zinc-900/[0.05] dark:bg-zinc-900/35 dark:ring-white/[0.05] sm:w-[11rem] sm:shrink-0 sm:flex-col sm:gap-1 sm:items-center ${
                  t.lifecycleStatus === "eliminated"
                    ? "opacity-55 grayscale"
                    : ""
                }`}
              >
                <div className="relative h-14 w-14 shrink-0 sm:mx-auto">
                  {t.logoUrl ? (
                    <NhleTeamLogoImage
                      src={t.logoUrl}
                      alt={`${t.label} logo`}
                      width={56}
                      height={56}
                      className="h-14 w-14"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-200 text-xs font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                      {t.teamAbbrev}
                    </div>
                  )}
                  <span
                    className="pointer-events-none absolute -bottom-0.5 -right-0.5 min-w-[1.75rem] rounded-md bg-emerald-600 px-1 py-0.5 text-center text-sm font-black tabular-nums text-white shadow ring-1 ring-white dark:bg-emerald-500 dark:ring-zinc-950"
                    aria-hidden
                  >
                    +{t.fantasyPts}
                  </span>
                </div>
                <div className="min-w-0 flex-1 sm:w-full sm:text-center">
                  <p className="text-left text-xs font-semibold text-zinc-900 sm:text-center dark:text-zinc-100">
                    {t.label}
                  </p>
                  {formatWinsTonight(t.wins) ? (
                    <p className="mt-0.5 text-left text-[0.65rem] text-zinc-500 sm:text-center dark:text-zinc-400">
                      {formatWinsTonight(t.wins)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PoolTeamCrewCard({
  row,
  standingsRank,
}: {
  row: PoolTeamCrewRow;
  standingsRank?: number;
}) {
  return (
    <li className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_6px_36px_-20px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.04] dark:bg-zinc-950/40 dark:shadow-[0_8px_40px_-24px_rgba(0,0,0,0.55)] dark:ring-white/[0.06]">
      <Link
        href={`/standings/team/${encodeURIComponent(row.poolTeamId)}`}
        className="flex flex-wrap items-center gap-3 rounded-t-[1.75rem] border-b border-zinc-200/40 px-5 py-4 transition-colors hover:bg-zinc-50/70 sm:gap-4 dark:border-white/[0.06] dark:hover:bg-zinc-900/50"
        aria-label={`View ${row.poolTeamName} roster and standings`}
      >
        <div className="relative h-20 w-20 shrink-0">
          {ownerAvatarSrc(row.ownerAvatar) ? (
            <div className="relative h-20 w-20 overflow-hidden rounded-full shadow-md ring-2 ring-white dark:ring-zinc-800">
              <OwnerAvatarImage
                filename={row.ownerAvatar}
                width={80}
                height={80}
                className="h-20 w-20 object-cover object-top"
              />
            </div>
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-lg font-bold text-white shadow-md ring-2 ring-white dark:ring-zinc-800"
              style={ownerAvatarStyle(row.poolTeamId)}
              aria-hidden
            >
              {ownerInitials(row.ownerName)}
            </div>
          )}
          <span
            className="pointer-events-none absolute -bottom-1 -right-1 z-10 min-w-[2.25rem] rounded-lg bg-emerald-600 px-1.5 py-0.5 text-center text-lg font-black leading-tight tabular-nums text-white shadow-md ring-2 ring-white dark:bg-emerald-500 dark:ring-zinc-950"
            aria-hidden
          >
            +{row.totalFantasyPts}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-pool-display text-xl font-semibold leading-none tracking-tight text-zinc-900 dark:text-zinc-50">
            {row.poolTeamName}
          </p>
          <p className="mt-0.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">{row.ownerName}</p>
          <p className="sr-only">
            {row.totalFantasyPts} points today from listed NHL players and teams
          </p>
        </div>
        {standingsRank != null ? (
          <div
            className="ml-auto flex min-h-[4.5rem] min-w-[3.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-zinc-100/90 px-1.5 py-2 ring-1 ring-zinc-900/[0.05] dark:bg-zinc-800/45 dark:ring-white/[0.06]"
            aria-label={`Standings rank ${standingsRank}`}
          >
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Rank
            </span>
            <span className="font-pool-display text-2xl font-semibold leading-none tabular-nums text-zinc-900 dark:text-zinc-50">
              {standingsRank}
            </span>
          </div>
        ) : null}
      </Link>

      <PoolTeamDayScoringBreakdown row={row} />
    </li>
  );
}

export function PoolDaySourcesCrewByPool({
  skaters,
  teamWins,
  standingsRankByTeamId,
  emptyMessage = "No scores yet for today",
}: Props) {
  const rows = useMemo(
    () =>
      groupDaySourcesByPoolTeam(skaters, teamWins, standingsRankByTeamId),
    [skaters, teamWins, standingsRankByTeamId],
  );

  return (
    <>
      {rows.length === 0 ? (
        <p className="pl-3 text-sm text-zinc-600 sm:pl-4 dark:text-zinc-400">
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-6">
          {rows.map((row) => (
            <PoolTeamCrewCard
              key={row.poolTeamId}
              row={row}
              standingsRank={standingsRankByTeamId?.get(row.poolTeamId)}
            />
          ))}
        </ul>
      )}
    </>
  );
}
