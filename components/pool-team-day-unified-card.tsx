"use client";

import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { CenteredLoading } from "@/components/centered-loading";
import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { PoolSkaterDayTile } from "@/components/pool-skater-day-tile";
import { formatWinsTonight } from "@/lib/format-stats";
import {
  gamePhaseLabel,
  SlateSkaterInlineMeta,
  SlateTeamPickInlineMeta,
} from "@/components/pool-slate-live-meta";
import type {
  PoolTeamCrewRow,
  PoolTeamSkaterContribution,
  PoolTeamTeamContribution,
} from "@/lib/pool/day-sources-by-pool";
import type {
  SkaterSlateApiRow,
  SkatersSlatePoolTeam,
  TeamPickSlateApiRow,
} from "@/lib/pool/skater-slate";
import type { TeamDayApiResponse } from "@/lib/pool/team-day-api";
import { nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";

function slatePlayingOnly(team: SkatersSlatePoolTeam): SkatersSlatePoolTeam {
  return {
    ...team,
    skaters: team.skaters.filter((s) => s.game != null),
    teamPicks: team.teamPicks.filter((tp) => tp.game != null),
  };
}

function matchSlateSkater(
  slate: SkatersSlatePoolTeam,
  nhlPlayerId: number,
  pickRound: number,
): SkaterSlateApiRow | undefined {
  const exact = slate.skaters.find(
    (s) => s.nhlPlayerId === nhlPlayerId && s.round === pickRound,
  );
  if (exact) return exact;
  return slate.skaters.find((s) => s.nhlPlayerId === nhlPlayerId);
}

function matchSlateTeamPick(
  slate: SkatersSlatePoolTeam,
  teamAbbrev: string,
  pickRound: number,
): TeamPickSlateApiRow | undefined {
  const t = teamAbbrev.trim().toUpperCase();
  const exact = slate.teamPicks.find(
    (p) => p.teamAbbrev.toUpperCase() === t && p.round === pickRound,
  );
  if (exact) return exact;
  return slate.teamPicks.find((p) => p.teamAbbrev.toUpperCase() === t);
}

function matchFantasySkater(
  crew: PoolTeamCrewRow,
  slateRow: SkaterSlateApiRow,
): PoolTeamSkaterContribution | null {
  if (slateRow.nhlPlayerId == null) return null;
  return (
    crew.skaters.find(
      (x) =>
        x.nhlPlayerId === slateRow.nhlPlayerId && x.pickRound === slateRow.round,
    ) ?? null
  );
}

function matchFantasyTeamPick(
  crew: PoolTeamCrewRow,
  slateRow: TeamPickSlateApiRow,
): PoolTeamTeamContribution | null {
  const ab = slateRow.teamAbbrev.toUpperCase();
  return (
    crew.teamPicks.find(
      (x) => x.teamAbbrev.toUpperCase() === ab && x.pickRound === slateRow.round,
    ) ?? null
  );
}

type Props = {
  scoringDayTab: "today" | "yesterday";
  isLoading: boolean;
  error: Error | null;
  gamesOnSlate: number;
  scoreboardMeta?: TeamDayApiResponse["scoreboardMeta"];
  slate: SkatersSlatePoolTeam | null | undefined;
  fantasy: PoolTeamCrewRow | null | undefined;
  emptyDayMessage: string;
  scoringEmptyMessage: string;
};

const cardShell =
  "overflow-hidden rounded-[1.75rem] bg-white shadow-[0_6px_36px_-20px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.04] dark:bg-zinc-950/40 dark:shadow-[0_8px_40px_-24px_rgba(0,0,0,0.55)] dark:ring-white/[0.06]";

export function PoolTeamDayUnifiedCard({
  scoringDayTab,
  isLoading,
  error,
  gamesOnSlate,
  scoreboardMeta,
  slate,
  fantasy,
  emptyDayMessage,
  scoringEmptyMessage,
}: Props) {
  const filteredSlate = useMemo(() => {
    if (!slate) return null;
    return slatePlayingOnly(slate);
  }, [slate]);

  const { skatersOut, teamPicksOut } = useMemo(() => {
    if (!filteredSlate) {
      return { skatersOut: [] as UnifiedSkater[], teamPicksOut: [] as UnifiedTeamPick[] };
    }
    if (!fantasy) {
      const skatersOut = sortUnifiedSkaters(
        filteredSlate.skaters.map((s) => ({
          fantasy: null,
          slate: s,
        })),
      );
      const teamPicksOut = sortUnifiedTeamPicks(
        filteredSlate.teamPicks.map((tp) => ({
          fantasy: null,
          slate: tp,
        })),
      );
      return { skatersOut, teamPicksOut };
    }

    const skatersOut: UnifiedSkater[] = filteredSlate.skaters.map((sr) => ({
      fantasy: matchFantasySkater(fantasy, sr),
      slate: sr,
    }));
    const matchedSkaterKeys = new Set(
      skatersOut
        .map((u) => u.fantasy)
        .filter(Boolean)
        .map((f) => `${f!.nhlPlayerId}-${f!.pickRound}`),
    );
    for (const f of fantasy.skaters) {
      const k = `${f.nhlPlayerId}-${f.pickRound}`;
      if (!matchedSkaterKeys.has(k)) {
        skatersOut.push({
          fantasy: f,
          slate: matchSlateSkater(filteredSlate, f.nhlPlayerId, f.pickRound),
        });
      }
    }

    const teamPicksOut: UnifiedTeamPick[] = filteredSlate.teamPicks.map((tp) => ({
      fantasy: matchFantasyTeamPick(fantasy, tp),
      slate: tp,
    }));
    const matchedTeamKeys = new Set(
      teamPicksOut
        .map((u) => u.fantasy)
        .filter(Boolean)
        .map((t) => `${t!.teamAbbrev.toUpperCase()}-${t!.pickRound}`),
    );
    for (const t of fantasy.teamPicks) {
      const k = `${t.teamAbbrev.toUpperCase()}-${t.pickRound}`;
      if (!matchedTeamKeys.has(k)) {
        teamPicksOut.push({
          fantasy: t,
          slate: matchSlateTeamPick(filteredSlate, t.teamAbbrev, t.pickRound),
        });
      }
    }

    return {
      skatersOut: sortUnifiedSkaters(skatersOut),
      teamPicksOut: sortUnifiedTeamPicks(teamPicksOut),
    };
  }, [fantasy, filteredSlate]);

  const hasSkaters = skatersOut.length > 0;
  const hasTeamPicks = teamPicksOut.length > 0;
  const skatersAndTeamsSameRow = hasSkaters && hasTeamPicks;

  const pointsEyebrow =
    scoringDayTab === "today" ? "Points today" : "Points yesterday";
  const slateEyebrow =
    scoringDayTab === "today" ? "Today’s slate" : "Yesterday’s slate";

  const headerRight =
    fantasy != null ? (
      <p className="font-pool-display text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
        +{fantasy.totalFantasyPts}
      </p>
    ) : hasSkaters || hasTeamPicks ? null : gamesOnSlate === 0 ? null : (
      <p className="font-pool-display text-2xl font-semibold tabular-nums text-zinc-400 dark:text-zinc-500">
        —
      </p>
    );

  if (isLoading) {
    return (
      <div className={cardShell} aria-busy="true">
        <CenteredLoading
          message="Loading…"
          variant="compact"
          className="max-w-none py-14"
        />
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div
        className={`${cardShell} px-5 py-4`}
        role="alert"
      >
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50">
          {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className={cardShell}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/40 px-5 py-4 dark:border-white/[0.06]">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            {fantasy != null ? pointsEyebrow : slateEyebrow}
          </p>
        </div>
        {headerRight}
      </div>

      <div className="px-1 pb-1 pt-0 sm:px-2">
        {scoreboardMeta?.fellBack ? (
          <p className="px-4 pt-4 text-sm text-zinc-600 dark:text-zinc-400">
            No playoff games on{" "}
            {format(parseISO(scoreboardMeta.requestedDate), "MMMM d")}. Showing
            the slate from{" "}
            {format(parseISO(scoreboardMeta.effectiveDate), "MMMM d")} (most
            recent with games).
          </p>
        ) : null}

        {gamesOnSlate === 0 ? (
          <p className="px-4 py-5 text-sm text-zinc-600 dark:text-zinc-400">
            {emptyDayMessage}
          </p>
        ) : !hasSkaters && !hasTeamPicks ? (
          <p className="px-4 py-5 text-sm text-zinc-600 dark:text-zinc-400">
            {fantasy != null
              ? scoringEmptyMessage
              : "None of your picks play on this slate."}
          </p>
        ) : (
          <div
            className={
              skatersAndTeamsSameRow
                ? "flex flex-col gap-8 px-4 py-5 md:flex-row md:items-start md:gap-8"
                : "space-y-5 px-4 py-5"
            }
          >
            {hasSkaters ? (
              <section
                className={skatersAndTeamsSameRow ? "min-w-0 flex-1" : undefined}
              >
                <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Players
                </h3>
                <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                  {skatersOut.map((row) => (
                    <UnifiedSkaterTile key={skaterKey(row)} row={row} />
                  ))}
                </ul>
              </section>
            ) : null}

            {hasTeamPicks ? (
              <section
                className={
                  skatersAndTeamsSameRow
                    ? "min-w-0 shrink-0 md:max-w-[min(100%,22rem)]"
                    : undefined
                }
              >
                <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  Teams
                </h3>
                <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                  {teamPicksOut.map((row) => (
                    <UnifiedTeamTile key={teamKey(row)} row={row} />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

type UnifiedSkater = {
  fantasy: PoolTeamSkaterContribution | null;
  slate: SkaterSlateApiRow | undefined;
};

type UnifiedTeamPick = {
  fantasy: PoolTeamTeamContribution | null;
  slate: TeamPickSlateApiRow | undefined;
};

function skaterNhlTeamAbbrevUpper(row: UnifiedSkater): string {
  return (
    row.fantasy?.nhlTeamAbbrev ??
    row.slate?.nhlTeamAbbrev ??
    ""
  )
    .trim()
    .toUpperCase();
}

function teamPickAbbrevUpper(row: UnifiedTeamPick): string {
  return (row.fantasy?.teamAbbrev ?? row.slate?.teamAbbrev ?? "")
    .trim()
    .toUpperCase();
}

/** Points (desc), then NHL team so teammates sit together, then name. */
function sortUnifiedSkaters(rows: UnifiedSkater[]): UnifiedSkater[] {
  return [...rows].sort((a, b) => {
    const ptsA = a.fantasy?.fantasyPts ?? 0;
    const ptsB = b.fantasy?.fantasyPts ?? 0;
    if (ptsB !== ptsA) return ptsB - ptsA;
    const ta = skaterNhlTeamAbbrevUpper(a);
    const tb = skaterNhlTeamAbbrevUpper(b);
    if (ta !== tb) return ta.localeCompare(tb);
    const la = a.fantasy?.label ?? a.slate?.label ?? "";
    const lb = b.fantasy?.label ?? b.slate?.label ?? "";
    return la.localeCompare(lb);
  });
}

function sortUnifiedTeamPicks(rows: UnifiedTeamPick[]): UnifiedTeamPick[] {
  return [...rows].sort((a, b) => {
    const ptsA = a.fantasy?.fantasyPts ?? 0;
    const ptsB = b.fantasy?.fantasyPts ?? 0;
    if (ptsB !== ptsA) return ptsB - ptsA;
    const ta = teamPickAbbrevUpper(a);
    const tb = teamPickAbbrevUpper(b);
    if (ta !== tb) return ta.localeCompare(tb);
    const la = a.fantasy?.label ?? a.slate?.label ?? "";
    const lb = b.fantasy?.label ?? b.slate?.label ?? "";
    return la.localeCompare(lb);
  });
}

function skaterKey(row: UnifiedSkater) {
  if (row.fantasy) {
    return `f-sk-${row.fantasy.nhlPlayerId}-${row.fantasy.pickRound}`;
  }
  const s = row.slate!;
  return `s-sk-${s.round}-${s.label}`;
}

function teamKey(row: UnifiedTeamPick) {
  if (row.fantasy) {
    return `f-tm-${row.fantasy.teamAbbrev}-${row.fantasy.pickRound}`;
  }
  const t = row.slate!;
  return `s-tm-${t.round}-${t.teamAbbrev}`;
}

function UnifiedSkaterTile({ row }: { row: UnifiedSkater }) {
  const s = row.fantasy;
  const slateRow = row.slate;
  const labelSource = s?.label ?? slateRow?.label ?? "";
  const displayName = s?.nhlDisplayName ?? slateRow?.nhlDisplayName;
  const headshotUrl = s?.headshotUrl ?? slateRow?.headshotUrl;
  const nhlTeamAbbrev = s?.nhlTeamAbbrev ?? slateRow?.nhlTeamAbbrev;
  const pickRound = s?.pickRound ?? slateRow?.round;
  const fantasyPts = s?.fantasyPts ?? 0;

  const slateLive =
    slateRow?.game != null &&
    gamePhaseLabel(slateRow.game).tone === "live";

  return (
    <PoolSkaterDayTile
      label={labelSource}
      nhlDisplayName={displayName}
      goals={s?.goals ?? 0}
      assists={s?.assists ?? 0}
      headshotUrl={headshotUrl}
      pickRound={pickRound}
      fantasyPts={fantasyPts}
      fantasyContributionPresent={s != null}
      nhlTeamAbbrev={nhlTeamAbbrev}
      trailingTeamLogoSrc={s?.teamLogoUrl ?? null}
      lifecycleStatus={slateRow?.lifecycleStatus}
      slateLiveSlot={
        slateLive && slateRow ? (
          <SlateSkaterInlineMeta row={slateRow} />
        ) : undefined
      }
    />
  );
}

function UnifiedTeamTile({ row }: { row: UnifiedTeamPick }) {
  const t = row.fantasy;
  const slateRow = row.slate;
  const winsLineRaw = t != null ? formatWinsTonight(t.wins) : "";
  const winsLine = winsLineRaw ? winsLineRaw : null;
  const label = t?.label ?? slateRow?.label ?? "";
  const logoUrl = t?.logoUrl;
  const abbrev = t?.teamAbbrev ?? slateRow?.teamAbbrev ?? "";
  const fantasyPts = t?.fantasyPts ?? 0;
  const ptsBadgeClass =
    t != null
      ? "bg-emerald-600 text-white ring-white dark:bg-emerald-500 dark:ring-zinc-950"
      : "bg-zinc-400/90 text-white ring-white dark:bg-zinc-600 dark:ring-zinc-950";

  const teamSlateLive =
    slateRow?.game != null &&
    gamePhaseLabel(slateRow.game).tone === "live";
  const teamSlateEliminated = slateRow?.lifecycleStatus === "eliminated";

  return (
    <li
      className={`flex w-full flex-row items-stretch gap-3 rounded-2xl bg-zinc-100/70 p-3 ring-1 ring-zinc-900/[0.05] dark:bg-zinc-900/35 dark:ring-white/[0.05] sm:w-[12.25rem] sm:shrink-0 sm:flex-col sm:gap-1 sm:items-center ${
        teamSlateEliminated ? "opacity-55 grayscale" : ""
      }`}
    >
      <div className="relative h-14 w-14 shrink-0 sm:mx-auto">
        {logoUrl ? (
          <NhleTeamLogoImage
            src={logoUrl}
            alt={`${label} logo`}
            width={56}
            height={56}
            className="h-14 w-14"
          />
        ) : abbrev ? (
          <NhleTeamLogoImage
            src={nhlTeamLogoLightSvgUrl(abbrev)}
            alt={`${label} logo`}
            width={56}
            height={56}
            className="h-14 w-14"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-200 text-xs font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
            ?
          </div>
        )}
        {fantasyPts > 0 ? (
          <span
            className={`pointer-events-none absolute -bottom-0.5 -right-0.5 min-w-[1.75rem] rounded-md px-1 py-0.5 text-center text-sm font-black tabular-nums shadow ring-1 ${ptsBadgeClass}`}
            aria-hidden
          >
            +{fantasyPts}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:w-full">
        <div className="min-w-0 flex-1 sm:text-center">
          <p className="text-left text-xs font-semibold text-zinc-900 sm:text-center dark:text-zinc-100">
            {label}
          </p>
          {winsLine ? (
            <p className="mt-0.5 text-left text-[0.65rem] text-zinc-500 sm:text-center dark:text-zinc-400">
              {winsLine}
            </p>
          ) : null}
        </div>
        {teamSlateLive && slateRow ? (
          <div className="flex shrink-0 flex-col items-end justify-center">
            <SlateTeamPickInlineMeta row={slateRow} />
          </div>
        ) : null}
      </div>
    </li>
  );
}
