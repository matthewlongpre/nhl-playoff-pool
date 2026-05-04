"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { CenteredLoading } from "@/components/centered-loading";
import { PoolSlateTeamPickList } from "@/components/pool-slate-live-meta";
import {
  filterSkatersSlateTeamsOffNights,
  type SkatersSlateApiResponse,
  type SkatersSlatePoolTeam,
} from "@/lib/pool/skater-slate";
import { OwnerAvatarImage } from "@/components/owner-avatar-image";
import { ownerAvatarSrc } from "@/lib/pool/owner-avatar";

export type SkatersSlatePanelProps = {
  payload: SkatersSlateApiResponse | null | undefined;
  isLoading?: boolean;
  error?: Error | null;
  emptyDayMessage: string;
  hideOffNight?: boolean;
  /** Single-team layout without pool-team header (team detail). */
  embedded?: boolean;
};

/** Renders skaters-slate API shape; parent owns fetching. */
export function SkatersSlatePanel({
  payload,
  isLoading,
  error,
  emptyDayMessage,
  hideOffNight = true,
  embedded = false,
}: SkatersSlatePanelProps) {
  const displayTeams = useMemo(() => {
    const raw = payload?.teams ?? [];
    if (!hideOffNight) return raw;
    return filterSkatersSlateTeamsOffNights(raw);
  }, [payload?.teams, hideOffNight]);

  if (isLoading) {
    return (
      <CenteredLoading
        message="Loading skaters slate…"
        variant="compact"
        className="max-w-none py-10"
      />
    );
  }

  if (error instanceof Error) {
    return (
      <div
        className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50"
        role="alert"
      >
        {error.message}
      </div>
    );
  }

  const data = payload;
  if (!data) return null;

  const meta = data.scoreboardMeta;

  return (
    <div className="flex flex-col gap-4">
      {meta?.fellBack ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No playoff games on{" "}
          {format(parseISO(meta.requestedDate), "MMMM d")}. Showing the slate from{" "}
          {format(parseISO(meta.effectiveDate), "MMMM d")} (most recent with games).
        </p>
      ) : null}
      {data.gamesOnSlate === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{emptyDayMessage}</p>
      ) : null}
      {displayTeams.length === 0 && data.gamesOnSlate > 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          None of your picks play on this slate.
        </p>
      ) : null}
      {embedded && displayTeams[0] ? (
        <div
          className="overflow-hidden rounded-2xl bg-white px-2 py-2 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08] sm:px-3"
          aria-label="Skaters and team picks on this slate"
        >
          <PoolSlateTeamPickList team={displayTeams[0]} />
        </div>
      ) : (
        <ul
          className="flex list-none flex-col gap-4 p-0"
          aria-label="Pool teams skaters slate"
        >
          {displayTeams.map((team: SkatersSlatePoolTeam) => (
            <li
              key={team.poolTeamId}
              className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08]"
            >
              <div className="flex items-start gap-3 border-b border-zinc-200/80 bg-zinc-50/90 px-4 py-3 dark:border-zinc-800/80 dark:bg-zinc-900/40">
                {ownerAvatarSrc(team.ownerAvatar) ? (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950">
                    <OwnerAvatarImage
                      filename={team.ownerAvatar}
                      width={40}
                      height={40}
                      className="h-10 w-10 object-cover object-top"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {team.poolTeamName}
                  </div>
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {team.ownerName}
                  </div>
                </div>
              </div>
              <div className="px-2 py-2 sm:px-3">
                <PoolSlateTeamPickList team={team} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
