"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { OwnerAvatarImage } from "@/components/owner-avatar-image";
import { ownerAvatarSrc } from "@/lib/pool/owner-avatar";

/** Mirror of `app/api/pool/projection/route.ts`. */
type ProjectionRow = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
  rank: number;
  totalToDate: number;
  projectedRemaining: number;
  projectedFinal: number;
  bestPick: {
    round: number;
    label: string;
    teamAbbrev?: string;
    ev: number;
  } | null;
  collisions: Array<{
    seriesAbbrev: string;
    round: number;
    teamAbbrevs: [string, string];
    pickLabels: string[];
  }>;
  remainingSkaters: number;
  totalSkaters: number;
  remainingTeams: number;
  totalTeams: number;
  teamWinPicks: Array<{ teamAbbrev: string; eliminated: boolean }>;
};

type ProjectionPayload = {
  asOfDate: string;
  rows: ProjectionRow[];
  meta: {
    perGameProbModel: string;
    baselineP: number;
    ppgPriorWeight: number;
    bracketAvailable: boolean;
    playoffSampleJoined: boolean;
  };
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === "string" ? err.error : "Request failed");
  }
  return res.json();
}

function formatOneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

type Props = {
  asOfDate: string;
  onOpenTeam: (teamId: string) => void;
  /** When set, periodic refresh in ms; otherwise no auto-refresh. */
  refetchIntervalMs?: number;
};

export function PoolProjectionPanel({
  asOfDate,
  onOpenTeam,
  refetchIntervalMs,
}: Props) {
  const query = useQuery({
    queryKey: ["pool-projection", asOfDate],
    queryFn: () =>
      fetchJson<ProjectionPayload>(
        `/api/pool/projection?date=${encodeURIComponent(asOfDate)}`,
      ),
    refetchInterval: refetchIntervalMs ?? false,
  });

  const ordered = useMemo(() => {
    const rows = query.data?.rows ?? [];
    return [...rows].sort((a, b) => {
      if (b.projectedFinal !== a.projectedFinal) {
        return b.projectedFinal - a.projectedFinal;
      }
      return a.name.localeCompare(b.name);
    });
  }, [query.data?.rows]);

  const maxFinal = useMemo(() => {
    let m = 0;
    for (const r of ordered) m = Math.max(m, r.projectedFinal);
    return m;
  }, [ordered]);

  if (query.isLoading) {
    return (
      <section
        className="rounded-2xl bg-white px-4 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08] sm:px-5"
        aria-label="Loading projected points"
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading projected points…
        </p>
      </section>
    );
  }

  if (query.error instanceof Error) {
    return (
      <section
        className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50"
        role="alert"
      >
        {query.error.message}
      </section>
    );
  }

  if (!query.data || ordered.length === 0) return null;

  const meta = query.data.meta;
  const subtitle = meta.bracketAvailable
    ? "Expected end-of-playoffs total: scored points so far plus blended PPG × expected remaining games for each pick. Picks on eliminated NHL clubs contribute 0."
    : "Bracket is unavailable right now — showing scored points only. Projection will resume once the playoff bracket loads.";

  return (
    <section
      className="rounded-2xl bg-white px-4 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08] sm:px-5"
      aria-labelledby="pool-projection-heading"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="pool-projection-heading"
          className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Projected points
        </h2>
        <p className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">
          {subtitle}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 shrink-0 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
          Scored
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 shrink-0 rounded-sm bg-emerald-300 dark:bg-emerald-700" />
          Projected remaining
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 shrink-0 rounded-sm bg-zinc-200 dark:bg-zinc-700" />
          Gap to leader
        </span>
      </div>

      <ul className="mt-3 divide-y divide-zinc-200/80 dark:divide-zinc-800/80" role="list">
        {ordered.map((row) => {
          const actualPct =
            maxFinal > 0 ? (row.totalToDate / maxFinal) * 100 : 0;
          const projPct =
            maxFinal > 0 ? (row.projectedRemaining / maxFinal) * 100 : 0;
          const gapPct = Math.max(0, 100 - actualPct - projPct);
          const collisionCount = row.collisions.length;
          const aria =
            `${row.name}, ${row.ownerName}. ${formatOneDecimal(row.projectedFinal)} projected total points: ` +
            `${row.totalToDate} scored, ${formatOneDecimal(row.projectedRemaining)} projected remaining.` +
            (collisionCount > 0
              ? ` ${collisionCount} pick collision${collisionCount === 1 ? "" : "s"} flagged.`
              : "") +
            " Open team detail.";

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
                    <span className="inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap font-pool-display text-base font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                      {formatOneDecimal(row.projectedFinal)}
                      <span className="text-[0.6rem] font-normal font-sans leading-none tracking-tight text-zinc-500 dark:text-zinc-400">
                        proj
                      </span>
                    </span>
                  </div>
                  <p className="truncate text-[0.7rem] text-zinc-500 dark:text-zinc-400">
                    <span>{row.ownerName}</span>
                    <span className="text-zinc-400/80 dark:text-zinc-500/80" aria-hidden="true">
                      {" · "}
                    </span>
                    <span className="tabular-nums text-zinc-400 dark:text-zinc-500">
                      {row.totalToDate} scored
                    </span>
                    <span className="text-zinc-400/80 dark:text-zinc-500/80" aria-hidden="true">
                      {" · "}
                    </span>
                    <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                      +{formatOneDecimal(row.projectedRemaining)} projected
                    </span>
                  </p>

                  <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-zinc-200/90 ring-1 ring-zinc-900/[0.06] dark:bg-zinc-800/90 dark:ring-white/[0.08]">
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

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.65rem] text-zinc-500 dark:text-zinc-400">
                    {row.bestPick ? (
                      <span className="tabular-nums">
                        Top pick:{" "}
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {row.bestPick.label}
                        </span>{" "}
                        +{formatOneDecimal(row.bestPick.ev)}
                      </span>
                    ) : (
                      <span>No projected scoring picks remaining</span>
                    )}
                    {collisionCount > 0 ? (
                      <span className="ml-auto inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-semibold text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/50">
                        {`${collisionCount} pick${
                          collisionCount === 1 ? "" : "s"
                        } face off · ${row.collisions
                          .map((c) => `R${c.round}`)
                          .filter((v, i, arr) => arr.indexOf(v) === i)
                          .join(", ")}`}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 border-t border-zinc-200/80 pt-3 text-[0.6rem] uppercase tracking-[0.14em] text-zinc-400 dark:border-zinc-800/80 dark:text-zinc-500">
        Model {meta.perGameProbModel} · per-game p={meta.baselineP.toFixed(2)} · PPG prior{" "}
        {meta.ppgPriorWeight}g
      </p>
    </section>
  );
}
