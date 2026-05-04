"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import {
  formatGoalsAssistsProse,
  formatWinsTonight,
} from "@/lib/format-stats";
import type {
  PoolDayBeneficiary,
  SkaterDaySource,
  TeamWinDaySource,
} from "@/lib/pool/day-sources";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { OwnerAvatarImage } from "@/components/owner-avatar-image";
import { nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";
import { ownerAvatarSrc } from "@/lib/pool/owner-avatar";
import { skaterEyebrowAndPrimary } from "@/lib/pool/skater-display-name";

type Props = {
  skaters: SkaterDaySource[];
  teamWins: TeamWinDaySource[];
  /** Shown when there are no skater or team-win sources (e.g. yesterday vs today copy). */
  emptyMessage?: string;
};

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % 360;
  }
  return h;
}

function initials(ownerName: string): string {
  const parts = ownerName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? "";
    const b = parts[parts.length - 1][0] ?? "";
    return (a + b).toUpperCase();
  }
  const one = parts[0] ?? "?";
  return one.length >= 2 ? one.slice(0, 2).toUpperCase() : `${one[0] ?? "?"}`.toUpperCase();
}

function avatarStyle(poolTeamId: string): CSSProperties {
  const hue = hashHue(poolTeamId);
  return {
    backgroundColor: `hsl(${hue} 52% 46%)`,
  };
}

function BeneficiaryBubble({ b }: { b: PoolDayBeneficiary }) {
  const photo = ownerAvatarSrc(b.ownerAvatar);
  return (
    <div
      className="flex w-full flex-row items-center gap-3 rounded-2xl bg-white/90 px-3 py-2.5 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.08)] ring-1 ring-zinc-900/[0.05] backdrop-blur-sm dark:bg-zinc-900/50 dark:ring-white/[0.06] sm:w-[7.5rem] sm:shrink-0 sm:flex-col sm:gap-2 sm:px-2 sm:py-3 sm:text-center"
      title={`${b.poolTeamName} · ${b.ownerName}`}
    >
      {photo ? (
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full shadow-md ring-2 ring-white/30 sm:mx-auto dark:ring-zinc-800/80">
          <OwnerAvatarImage
            filename={b.ownerAvatar}
            width={48}
            height={48}
            className="h-12 w-12 object-cover object-top"
          />
        </div>
      ) : (
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-md ring-2 ring-white/30 sm:mx-auto dark:ring-zinc-800/80"
          style={avatarStyle(b.poolTeamId)}
          aria-hidden
        >
          {initials(b.ownerName)}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left sm:w-full sm:gap-1 sm:text-center">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
          {b.ownerName}
        </p>
        <p className="line-clamp-2 text-[0.65rem] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {b.poolTeamName}
        </p>
      </div>
    </div>
  );
}

export function PoolDaySourcesAvatars({
  skaters,
  teamWins,
  emptyMessage = "No scores yet for today",
}: Props) {
  const empty = skaters.length === 0 && teamWins.length === 0;

  return (
    <div className="space-y-10">
      {empty ? (
        <p className="pl-1 text-sm text-zinc-600 dark:text-zinc-400">
          {emptyMessage}
        </p>
      ) : null}

      {skaters.length > 0 ? (
        <section className="space-y-5">
          <h2 className="font-pool-display text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Players
          </h2>
          <ul className="space-y-5">
            {skaters.map((s) => {
              const gaProse = formatGoalsAssistsProse(s.goals, s.assists);
              const { eyebrow, primary } = skaterEyebrowAndPrimary(
                s.label,
                s.nhlDisplayName,
              );
              const nhlTeamAbbrev = s.beneficiaries[0]?.nhlTeamAbbrev;
              const nhlTeamLogoSrc =
                s.beneficiaries[0]?.teamLogoUrl ??
                (nhlTeamAbbrev ? nhlTeamLogoLightSvgUrl(nhlTeamAbbrev) : null);
              return (
              <li
                key={s.nhlPlayerId}
                className={`overflow-hidden rounded-[1.75rem] bg-white shadow-[0_6px_36px_-20px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.04] dark:bg-zinc-950/40 dark:shadow-[0_8px_40px_-24px_rgba(0,0,0,0.55)] dark:ring-white/[0.06] ${
                  s.lifecycleStatus === "eliminated"
                    ? "opacity-55 grayscale"
                    : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-4 border-b border-zinc-200/40 px-5 py-4 dark:border-white/[0.06]">
                  <div className="relative h-20 w-20 shrink-0">
                    <Image
                      src={s.headshotUrl}
                      alt={eyebrow ? `${eyebrow} ${primary}` : primary}
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-full border border-zinc-200 object-cover object-top dark:border-zinc-600"
                      unoptimized
                    />
                    <span
                      className="pointer-events-none absolute -bottom-1 -right-1 min-w-[2.25rem] rounded-lg bg-emerald-600 px-1.5 py-0.5 text-center text-lg font-black leading-tight tabular-nums text-white shadow-md ring-2 ring-white dark:bg-emerald-500 dark:ring-zinc-950"
                      aria-hidden
                    >
                      +{s.goals + s.assists}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {eyebrow ? (
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {eyebrow}
                      </p>
                    ) : null}
                    <p
                      className={`font-pool-display text-xl font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50${
                        eyebrow ? " mt-0.5" : ""
                      }`}
                    >
                      {primary}
                    </p>
                    {gaProse ? (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {gaProse}
                      </p>
                    ) : null}
                    <p className="sr-only">
                      +{s.goals + s.assists} pool points from this skater today
                    </p>
                  </div>
                  {nhlTeamLogoSrc ? (
                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      <NhleTeamLogoImage
                        src={nhlTeamLogoSrc}
                        alt={nhlTeamAbbrev ? `${nhlTeamAbbrev} logo` : ""}
                        width={24}
                        height={24}
                        className="h-6 w-6"
                      />
                      {nhlTeamAbbrev ? (
                        <span className="text-[0.7rem] font-semibold tabular-nums tracking-wide text-zinc-500 dark:text-zinc-400">
                          {nhlTeamAbbrev}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 px-4 py-5 sm:flex-row sm:flex-wrap sm:gap-4">
                  {s.beneficiaries.map((b) => (
                    <BeneficiaryBubble
                      key={`${s.nhlPlayerId}-${b.poolTeamId}-${b.pickRound}`}
                      b={b}
                    />
                  ))}
                </div>
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {teamWins.length > 0 ? (
        <section className="space-y-5">
          <h2 className="font-pool-display text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Teams
          </h2>
          <ul className="space-y-5">
            {teamWins.map((t) => {
              const winsLine = formatWinsTonight(t.wins);
              return (
              <li
                key={t.teamAbbrev}
                className={`overflow-hidden rounded-[1.75rem] bg-white shadow-[0_6px_36px_-20px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.04] dark:bg-zinc-950/40 dark:shadow-[0_8px_40px_-24px_rgba(0,0,0,0.55)] dark:ring-white/[0.06] ${
                  t.lifecycleStatus === "eliminated"
                    ? "opacity-55 grayscale"
                    : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-4 border-b border-zinc-200/40 px-5 py-4 dark:border-white/[0.06]">
                  <div className="relative h-20 w-20 shrink-0">
                    {t.logoUrl ? (
                      <Image
                        src={t.logoUrl}
                        alt={`${t.label} logo`}
                        width={80}
                        height={80}
                        className="h-20 w-20 object-contain"
                        unoptimized
                      />
                    ) : (
                      <div
                        className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-100 text-lg font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        aria-hidden
                      >
                        {t.teamAbbrev}
                      </div>
                    )}
                    <span
                      className="pointer-events-none absolute -bottom-1 -right-1 min-w-[2.25rem] rounded-lg bg-emerald-600 px-1.5 py-0.5 text-center text-lg font-black leading-tight tabular-nums text-white shadow-md ring-2 ring-white dark:bg-emerald-500 dark:ring-zinc-950"
                      aria-hidden
                    >
                      +1
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-pool-display text-xl font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">
                      {t.label}
                    </p>
                    {winsLine ? (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {winsLine}
                      </p>
                    ) : null}
                    <p className="sr-only">
                      +1 pool point for each team pick when this NHL team won today
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 px-4 py-5 sm:flex-row sm:flex-wrap sm:gap-4">
                  {t.beneficiaries.map((b) => (
                    <BeneficiaryBubble
                      key={`${t.teamAbbrev}-${b.poolTeamId}-${b.pickRound}`}
                      b={b}
                    />
                  ))}
                </div>
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
