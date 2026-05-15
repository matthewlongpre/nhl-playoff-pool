"use client";

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { CenteredLoading } from "@/components/centered-loading";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { NhlTeamLogoEliminatedWrap } from "@/components/nhl-team-logo-eliminated-wrap";
import { OwnerAvatarImage } from "@/components/owner-avatar-image";
import { nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";
import { ownerAvatarSrc } from "@/lib/pool/owner-avatar";
import { runwayStackedBarWidths } from "@/lib/pool/runway-bar-segments";

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
  futureCollisions: Array<{
    conference: string;
    teamAbbrevs: [string, string];
    pickLabels: string[];
    penalty: number;
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
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === "string" ? err.error : "Request failed");
  }
  return res.json();
}

function formatOneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** Matches the short-date treatment used by `ScopeSubHeader` in Pool in review. */
function formatShortDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d");
  } catch {
    return iso;
  }
}

function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(Math.max(0, Math.min(100, n)))}%`;
}

type SortKey = "projected" | "scored" | "lockedIn" | "alive";

/** Lookup for the sort segmented control. Order also controls UI display order. */
const SORT_OPTIONS: Array<{ key: SortKey; label: string; help: string }> = [
  {
    key: "projected",
    label: "Projected",
    help: "Sort by projected end-of-playoffs total (default).",
  },
  {
    key: "scored",
    label: "Scored",
    help: "Sort by points already banked.",
  },
  {
    key: "lockedIn",
    label: "Locked-in %",
    help: "Sort by share of projected total already scored.",
  },
  {
    key: "alive",
    label: "Alive picks",
    help: "Sort by share of roster picks still in the playoffs.",
  },
];

type EnrichedRow = ProjectionRow & {
  scoredRank: number;
  projectedRank: number;
  rankDelta: number;
  lockedInPct: number;
  alivePct: number;
  totalSlots: number;
};

function computeLockedInPct(row: ProjectionRow): number {
  if (row.projectedFinal <= 0) return 0;
  return (row.totalToDate / row.projectedFinal) * 100;
}

function computeAlivePct(row: ProjectionRow): number {
  const total = row.totalSkaters + row.totalTeams;
  if (total <= 0) return 0;
  return ((row.remainingSkaters + row.remainingTeams) / total) * 100;
}

function comparatorFor(key: SortKey) {
  return (a: EnrichedRow, b: EnrichedRow): number => {
    switch (key) {
      case "scored": {
        if (b.totalToDate !== a.totalToDate) return b.totalToDate - a.totalToDate;
        break;
      }
      case "lockedIn": {
        if (b.lockedInPct !== a.lockedInPct) return b.lockedInPct - a.lockedInPct;
        break;
      }
      case "alive": {
        if (b.alivePct !== a.alivePct) return b.alivePct - a.alivePct;
        break;
      }
      case "projected":
      default:
        break;
    }
    if (b.projectedFinal !== a.projectedFinal) {
      return b.projectedFinal - a.projectedFinal;
    }
    return a.name.localeCompare(b.name);
  };
}

type Props = {
  asOfDate: string;
  onOpenTeam: (teamId: string) => void;
  /** When set, periodic refresh in ms; otherwise no auto-refresh. */
  refetchIntervalMs?: number;
};

export function PoolRosterOutlook({
  asOfDate,
  onOpenTeam,
  refetchIntervalMs,
}: Props) {
  const projectionQuery = useQuery({
    queryKey: ["pool-projection", asOfDate],
    queryFn: () =>
      fetchJson<ProjectionPayload>(
        `/api/pool/projection?date=${encodeURIComponent(asOfDate)}`,
      ),
    staleTime: 0,
    refetchInterval: refetchIntervalMs ?? false,
  });

  const [sortKey, setSortKey] = useState<SortKey>("projected");

  /**
   * Annotate every row with derived ranks and percentages so the comparator and the row
   * renderer can read them directly without re-deriving on every render of every row.
   * `scoredRank` and `projectedRank` are computed once over the unsorted list so the
   * arrow chip is stable regardless of which sort is active.
   */
  const enriched = useMemo<EnrichedRow[]>(() => {
    const rows = projectionQuery.data?.rows ?? [];
    if (rows.length === 0) return [];
    const byScored = [...rows].sort((a, b) => {
      if (b.totalToDate !== a.totalToDate) return b.totalToDate - a.totalToDate;
      return a.name.localeCompare(b.name);
    });
    const scoredRankByTeamId = new Map<string, number>();
    byScored.forEach((r, i) => {
      scoredRankByTeamId.set(r.teamId, i + 1);
    });
    const byProjected = [...rows].sort((a, b) => {
      if (b.projectedFinal !== a.projectedFinal) {
        return b.projectedFinal - a.projectedFinal;
      }
      return a.name.localeCompare(b.name);
    });
    const projectedRankByTeamId = new Map<string, number>();
    byProjected.forEach((r, i) => {
      projectedRankByTeamId.set(r.teamId, i + 1);
    });
    return rows.map<EnrichedRow>((r) => {
      const scoredRank = scoredRankByTeamId.get(r.teamId) ?? 0;
      const projectedRank = projectedRankByTeamId.get(r.teamId) ?? 0;
      return {
        ...r,
        scoredRank,
        projectedRank,
        /** Positive = projected to climb, negative = projected to fall. */
        rankDelta: scoredRank - projectedRank,
        lockedInPct: computeLockedInPct(r),
        alivePct: computeAlivePct(r),
        totalSlots: r.totalSkaters + r.totalTeams,
      };
    });
  }, [projectionQuery.data?.rows]);

  const ordered = useMemo(() => {
    return [...enriched].sort(comparatorFor(sortKey));
  }, [enriched, sortKey]);

  const maxFinal = useMemo(() => {
    let m = 0;
    for (const r of enriched) m = Math.max(m, r.projectedFinal);
    return m;
  }, [enriched]);

  const summary = useMemo(() => {
    if (enriched.length === 0) {
      return {
        leader: null as EnrichedRow | null,
        biggestRiser: null as EnrichedRow | null,
        biggestFaller: null as EnrichedRow | null,
      };
    }
    let leader: EnrichedRow | null = null;
    let biggestRiser: EnrichedRow | null = null;
    let biggestFaller: EnrichedRow | null = null;
    for (const r of enriched) {
      if (!leader || r.projectedFinal > leader.projectedFinal) leader = r;
      if (!biggestRiser || r.rankDelta > biggestRiser.rankDelta) biggestRiser = r;
      if (!biggestFaller || r.rankDelta < biggestFaller.rankDelta) biggestFaller = r;
    }
    return {
      leader,
      /** Only highlight a riser/faller when there's actually a swap projected. */
      biggestRiser:
        biggestRiser && biggestRiser.rankDelta > 0 ? biggestRiser : null,
      biggestFaller:
        biggestFaller && biggestFaller.rankDelta < 0 ? biggestFaller : null,
    };
  }, [enriched]);

  if (projectionQuery.isLoading) {
    return <CenteredLoading message="Loading roster outlook…" variant="section" />;
  }

  if (projectionQuery.error instanceof Error) {
    return (
      <div
        className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50"
        role="alert"
      >
        {projectionQuery.error.message}
      </div>
    );
  }

  if (!projectionQuery.data || enriched.length === 0) return null;

  const meta = projectionQuery.data.meta;
  const subtitle = meta.bracketAvailable
    ? "Scoring runway (pick survival) and projected points. Each row shows where every owner is now and where the model expects them to land."
    : "Bracket is unavailable right now — projection has fallen back to scored-only totals. Pick survival is shown as if no NHL clubs were eliminated; both will recover automatically.";

  return (
    <section
      className="rounded-2xl bg-white px-4 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08] sm:px-5"
      aria-labelledby="pool-roster-outlook-heading"
    >
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2
            id="pool-roster-outlook-heading"
            className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            Roster outlook
          </h2>
          {projectionQuery.data.asOfDate ? (
            <p
              className="text-[0.7rem] tabular-nums text-zinc-500 dark:text-zinc-400"
              title="Pool data is materialized after each nightly scoring ingest"
            >
              Updated{" "}
              <time dateTime={projectionQuery.data.asOfDate}>
                {formatShortDate(projectionQuery.data.asOfDate)}
              </time>
            </p>
          ) : null}
        </div>
        <p className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">
          {subtitle}
        </p>
      </header>

      {summary.leader || summary.biggestRiser || summary.biggestFaller ? (
        <div
          className="mt-3 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/80 text-[0.65rem] dark:border-zinc-800/80 dark:bg-zinc-900/35"
          aria-label="League movement highlights"
        >
          <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
            {summary.leader ? (
              <MovementHighlightRow
                kind="leader"
                label="Leader"
                name={summary.leader.name}
                value={formatOneDecimal(summary.leader.projectedFinal)}
                valueTitle="Projected total points"
              />
            ) : null}
            {summary.biggestRiser ? (
              <MovementHighlightRow
                kind="riser"
                label="Riser"
                name={summary.biggestRiser.name}
                value={`↑${summary.biggestRiser.rankDelta}`}
                valueTitle={`Up ${summary.biggestRiser.rankDelta} projected rank spots vs scored`}
              />
            ) : null}
            {summary.biggestFaller ? (
              <MovementHighlightRow
                kind="faller"
                label="Faller"
                name={summary.biggestFaller.name}
                value={`↓${Math.abs(summary.biggestFaller.rankDelta)}`}
                valueTitle={`Down ${Math.abs(summary.biggestFaller.rankDelta)} projected rank spots vs scored`}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-3 hidden flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          Sort by
        </p>
        <div
          className="inline-flex w-full overflow-x-auto rounded-full bg-zinc-200/70 p-0.5 dark:bg-zinc-950/60 sm:w-auto"
          role="group"
          aria-label="Sort outlook"
        >
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSortKey(opt.key)}
              aria-pressed={sortKey === opt.key}
              title={opt.help}
              className={`min-h-[1.75rem] flex-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.7rem] font-medium transition-colors sm:flex-none sm:px-3 ${
                sortKey === opt.key
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-white/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ul
        className="mt-3 divide-y divide-zinc-200/80 dark:divide-zinc-800/80"
        role="list"
        aria-label="Pool teams ranked by outlook"
      >
        {ordered.map((row) => (
          <OutlookRow
            key={row.teamId}
            row={row}
            maxFinal={maxFinal}
            onOpenTeam={onOpenTeam}
          />
        ))}
      </ul>

      <p className="mt-4 border-t border-zinc-200/80 pt-3 text-[0.6rem] uppercase tracking-[0.14em] text-zinc-400 dark:border-zinc-800/80 dark:text-zinc-500">
        Model {meta.perGameProbModel} · per-game p={meta.baselineP.toFixed(2)} · PPG prior{" "}
        {meta.ppgPriorWeight}g
        {meta.playoffSampleJoined ? null : " · using regular-season prior only"}
      </p>
    </section>
  );
}

function MovementHighlightRow({
  kind,
  label,
  name,
  value,
  valueTitle,
}: {
  kind: "leader" | "riser" | "faller";
  label: string;
  name: string;
  value: string;
  valueTitle?: string;
}) {
  const labelClass =
    kind === "leader"
      ? "text-emerald-800 dark:text-emerald-200"
      : kind === "riser"
        ? "text-sky-800 dark:text-sky-200"
        : "text-rose-800 dark:text-rose-200";
  const dotClass =
    kind === "leader"
      ? "bg-emerald-500 dark:bg-emerald-400"
      : kind === "riser"
        ? "bg-sky-500 dark:bg-sky-400"
        : "bg-rose-500 dark:bg-rose-400";
  const valueClass =
    kind === "leader"
      ? "text-emerald-700 dark:text-emerald-400"
      : kind === "riser"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-rose-600 dark:text-rose-400";
  return (
    <div className="flex min-h-[2.25rem] items-center gap-2 px-2.5 py-2 sm:min-h-0 sm:px-3 sm:py-2">
      <span className="flex shrink-0 items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
          aria-hidden="true"
        />
        <span className={`w-[3.75rem] shrink-0 font-bold uppercase tracking-[0.08em] ${labelClass}`}>
          {label}
        </span>
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900 dark:text-zinc-50">
        {name}
      </span>
      <span
        className={`shrink-0 font-pool-display text-sm font-semibold tabular-nums tracking-tight ${valueClass}`}
        title={valueTitle}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Renders the "current scored rank → projected finishing rank" badge under each row's avatar.
 * Shows both numbers so readers don't have to subtract the delta in their head; the projected
 * rank is colour-coded (green = climbing, red = falling). When the model expects no movement,
 * collapses to a single number to avoid redundant `1 → 1` noise.
 */
function ScoredToProjectedRank({
  scoredRank,
  projectedRank,
}: {
  scoredRank: number;
  projectedRank: number;
}) {
  const delta = scoredRank - projectedRank;
  const baseRank =
    "font-pool-display text-sm font-semibold leading-none tabular-nums";
  if (delta === 0) {
    return (
      <span
        className={`${baseRank} text-zinc-900 dark:text-zinc-50`}
        aria-hidden="true"
      >
        {scoredRank}
      </span>
    );
  }
  const projectedColor =
    delta > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <span
      className="inline-flex items-center gap-1 text-[0.6rem]"
      aria-hidden="true"
    >
      <span className={`${baseRank} text-zinc-900 dark:text-zinc-50`}>
        {scoredRank}
      </span>
      <span className={`leading-none ${projectedColor}`}>→</span>
      <span className={`${baseRank} ${projectedColor}`}>{projectedRank}</span>
    </span>
  );
}

function OutlookRow({
  row,
  maxFinal,
  onOpenTeam,
}: {
  row: EnrichedRow;
  maxFinal: number;
  onOpenTeam: (teamId: string) => void;
}) {
  const actualPct =
    maxFinal > 0 ? (row.totalToDate / maxFinal) * 100 : 0;
  const projPct =
    maxFinal > 0 ? (row.projectedRemaining / maxFinal) * 100 : 0;
  const gapPct = Math.max(0, 100 - actualPct - projPct);

  const { skAlivePct, tmAlivePct, eliminatedPct, totalSlots } =
    runwayStackedBarWidths(row);

  const collisionCount = row.collisions.length;
  const futureCollisionCount = row.futureCollisions.length;
  const teamWinPicksDescription =
    row.teamWinPicks.length > 0
      ? ` Team-win clubs: ${row.teamWinPicks
          .map((t) => (t.eliminated ? `${t.teamAbbrev} (eliminated)` : t.teamAbbrev))
          .join(", ")}.`
      : "";
  const aria =
    `${row.name}, ${row.ownerName}. ${formatOneDecimal(row.projectedFinal)} projected total, ` +
    `${row.totalToDate} scored, ${formatOneDecimal(row.projectedRemaining)} projected remaining. ` +
    (totalSlots > 0
      ? `${row.remainingSkaters + row.remainingTeams} of ${totalSlots} picks alive (${row.remainingSkaters} skaters, ${row.remainingTeams} team picks).${teamWinPicksDescription} `
      : "") +
    (row.scoredRank !== row.projectedRank
      ? `Currently ${row.scoredRank} on scored, projected to finish ${row.projectedRank}. `
      : `Holding rank ${row.scoredRank}. `) +
    (collisionCount > 0
      ? `${collisionCount} pick collision${collisionCount === 1 ? "" : "s"} flagged. `
      : "") +
    (futureCollisionCount > 0
      ? `${futureCollisionCount} same-conference pick pair${futureCollisionCount === 1 ? "" : "s"} that will eventually collide. `
      : "") +
    "Open team detail.";

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenTeam(row.teamId)}
        className="touch-manipulation flex w-full gap-3 py-4 text-left first:pt-3 active:bg-zinc-50/80 sm:py-3.5 sm:first:pt-2 dark:active:bg-zinc-900/50"
        aria-label={aria}
      >
        <div className="flex shrink-0 flex-col items-center gap-1">
          {ownerAvatarSrc(row.ownerAvatar) ? (
            <div className="relative h-10 w-10 overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950">
              <OwnerAvatarImage
                filename={row.ownerAvatar}
                width={40}
                height={40}
                className="h-10 w-10 object-cover object-top"
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-zinc-200/80 dark:bg-zinc-800" />
          )}
          <ScoredToProjectedRank
            scoredRank={row.scoredRank}
            projectedRank={row.projectedRank}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-row items-baseline justify-between gap-2">
            <span className="min-w-0 flex-1 break-words font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:truncate">
              {row.name}
            </span>
            <span className="inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap font-pool-display text-base font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
              {formatOneDecimal(row.projectedFinal)}
              <span className="text-[0.6rem] font-normal font-sans leading-none tracking-tight text-zinc-500 dark:text-zinc-400">
                proj
              </span>
            </span>
          </div>

          {/* Mobile: stack owner + stats so nothing truncates mid-sentence */}
          <div className="mt-1 flex flex-col gap-1 text-[0.72rem] leading-snug text-zinc-500 dark:text-zinc-400 sm:hidden">
            <span className="text-zinc-400 dark:text-zinc-500">{row.ownerName}</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
              <span>{row.totalToDate} scored</span>
              <span className="text-emerald-700 dark:text-emerald-400">
                +{formatOneDecimal(row.projectedRemaining)} projected
              </span>
              <span>{formatPercent(row.lockedInPct)} locked-in</span>
            </div>
          </div>
          <p className="mt-1 hidden truncate text-[0.7rem] text-zinc-500 dark:text-zinc-400 sm:block">
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
            <span className="text-zinc-400/80 dark:text-zinc-500/80" aria-hidden="true">
              {" · "}
            </span>
            <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
              {formatPercent(row.lockedInPct)} locked-in
            </span>
          </p>

          <div className="mt-2.5 flex flex-col gap-3.5">
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
          </div>

          <div className="mt-2 flex flex-col gap-2 text-[0.65rem] text-zinc-500 dark:text-zinc-400 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {totalSlots > 0 ? (
                <span className="tabular-nums">
                  P {row.remainingSkaters}/{row.totalSkaters}
                  <span className="text-zinc-400 dark:text-zinc-500"> sk</span>
                  {row.totalTeams > 0 ? (
                    <>
                      <span
                        className="mx-1 text-zinc-400/80 dark:text-zinc-500/80"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      T {row.remainingTeams}/{row.totalTeams}
                      <span className="text-zinc-400 dark:text-zinc-500"> tm</span>
                    </>
                  ) : null}
                </span>
              ) : null}
              {row.teamWinPicks.length > 0 ? (
                <span
                  className="inline-flex items-center gap-1"
                  aria-hidden="true"
                >
                  {row.teamWinPicks.map((t, idx) => (
                    <NhlTeamLogoEliminatedWrap
                      key={`${row.teamId}-twp-${idx}`}
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
              {row.bestPick ? (
                <span className="tabular-nums sm:min-w-0">
                  Top:{" "}
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {row.bestPick.label}
                  </span>{" "}
                  +{formatOneDecimal(row.bestPick.ev)}
                </span>
              ) : null}
              {collisionCount > 0 ? (
                <span className="inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-semibold text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/50 sm:ml-auto">
                  {`${collisionCount} face off · ${row.collisions
                    .map((c) => `R${c.round}`)
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .join(", ")}`}
                </span>
              ) : null}
              {futureCollisionCount > 0 ? (
                <span
                  className="inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full bg-orange-50 px-2 py-0.5 text-[0.6rem] font-semibold text-orange-700 ring-1 ring-orange-200/70 dark:bg-orange-950/30 dark:text-orange-300 dark:ring-orange-900/40 sm:ml-auto"
                  title={row.futureCollisions
                    .map((fc) => `${fc.teamAbbrevs.join(" vs ")} (${fc.conference})`)
                    .join("; ")}
                >
                  {`${futureCollisionCount} conf. path clash`}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}
