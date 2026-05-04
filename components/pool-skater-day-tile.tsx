"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { formatGoalsAssistsProse } from "@/lib/format-stats";
import { nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";
import { skaterEyebrowAndPrimary } from "@/lib/pool/skater-display-name";

const tileLiClass =
  "flex w-full flex-row items-stretch gap-3 rounded-2xl bg-zinc-100/70 p-3 ring-1 ring-zinc-900/[0.05] dark:bg-zinc-900/35 dark:ring-white/[0.05] sm:w-[12.25rem] sm:shrink-0 sm:flex-col sm:gap-1";

export type PoolSkaterDayTileProps = {
  label: string;
  nhlDisplayName?: string;
  goals: number;
  assists: number;
  headshotUrl?: string | null;
  pickRound?: number | null;
  fantasyPts: number;
  /** When a fantasy scoring row exists (vs slate-only); controls points badge styling. */
  fantasyContributionPresent: boolean;
  /** Three-letter NHL team code; used for abbrev + SVG fallback when no custom logo URL. */
  nhlTeamAbbrev?: string;
  /** Preferred team mark (e.g. beneficiary logo); falls back to league SVG from `nhlTeamAbbrev`. */
  trailingTeamLogoSrc?: string | null;
  /** e.g. live slate meta beside the team rail. */
  slateLiveSlot?: ReactNode;
  lifecycleStatus?: "active" | "eliminated";
};

export function PoolSkaterDayTile({
  label,
  nhlDisplayName,
  goals,
  assists,
  headshotUrl,
  pickRound,
  fantasyPts,
  fantasyContributionPresent,
  nhlTeamAbbrev,
  trailingTeamLogoSrc,
  slateLiveSlot,
  lifecycleStatus,
}: PoolSkaterDayTileProps) {
  const ga = formatGoalsAssistsProse(goals, assists);
  const { eyebrow, primary } = skaterEyebrowAndPrimary(label, nhlDisplayName);
  const ptsBadgeClass = fantasyContributionPresent
    ? "bg-emerald-600 text-white ring-white dark:bg-emerald-500 dark:ring-zinc-950"
    : "bg-zinc-400/90 text-white ring-white dark:bg-zinc-600 dark:ring-zinc-950";

  const abbrevTrimmed = nhlTeamAbbrev?.trim();
  const resolvedTrailingLogo =
    trailingTeamLogoSrc ??
    (abbrevTrimmed ? nhlTeamLogoLightSvgUrl(abbrevTrimmed) : null);

  const hasTrailingTeam = resolvedTrailingLogo != null;
  const showRightRail = slateLiveSlot != null || hasTrailingTeam;
  const textAlign = hasTrailingTeam ? "text-left" : "text-left sm:text-center";
  const eliminated = lifecycleStatus === "eliminated";

  const teamLogoRow = hasTrailingTeam ? (
    <div className="flex items-center gap-1.5">
      <NhleTeamLogoImage
        src={resolvedTrailingLogo}
        alt={abbrevTrimmed ? `${abbrevTrimmed} logo` : "Team logo"}
        width={24}
        height={24}
        className="h-6 w-6"
      />
      {abbrevTrimmed ? (
        <span className="text-[0.65rem] font-medium leading-none tabular-nums tracking-wide text-zinc-500 dark:text-zinc-400">
          {abbrevTrimmed}
        </span>
      ) : null}
    </div>
  ) : null;

  return (
    <li className={`${tileLiClass} ${eliminated ? "opacity-55 grayscale" : ""}`}>
      <div className="relative h-14 w-14 shrink-0 sm:mx-auto">
        {headshotUrl ? (
          <Image
            src={headshotUrl}
            alt={eyebrow ? `${eyebrow} ${primary}` : primary}
            width={56}
            height={56}
            className="h-14 w-14 rounded-full border border-zinc-200 object-cover object-top dark:border-zinc-600"
            unoptimized
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200 bg-zinc-200/80 text-xs font-bold text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {pickRound != null ? String(pickRound) : "?"}
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
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p
              className={`text-xs font-medium text-zinc-500 dark:text-zinc-400 ${textAlign}`}
            >
              {eyebrow}
            </p>
          ) : null}
          <p
            className={`text-xs font-semibold leading-tight text-zinc-900 dark:text-zinc-100 ${textAlign}${
              eyebrow ? " mt-0.5" : ""
            }`}
          >
            {primary}
          </p>
          {ga ? (
            <p
              className={`mt-0.5 text-[0.65rem] text-zinc-500 dark:text-zinc-400 ${textAlign}`}
            >
              {ga}
            </p>
          ) : null}
        </div>
        {showRightRail ? (
          <div className="flex shrink-0 flex-col items-end justify-center gap-1.5">
            {slateLiveSlot}
            {teamLogoRow}
          </div>
        ) : null}
      </div>
    </li>
  );
}
