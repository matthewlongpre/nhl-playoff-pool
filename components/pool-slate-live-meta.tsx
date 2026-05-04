"use client";

import Image from "next/image";
import { formatPeriodDescriptorLabel } from "@/lib/nhl/period-descriptor";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";
import type {
  SkaterSlateApiRow,
  SkaterSlateGameSnapshot,
  SkatersSlatePoolTeam,
  TeamPickSlateApiRow,
} from "@/lib/pool/skater-slate";

function formatStartWithZone(iso: string | undefined) {
  if (iso == null || iso === "") return "Time TBA";
  return new Date(iso).toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function periodOrdinal(n: number): string {
  const rem = n % 100;
  const suffix =
    rem >= 11 && rem <= 13
      ? "TH"
      : n % 10 === 1
        ? "ST"
        : n % 10 === 2
          ? "ND"
          : n % 10 === 3
            ? "RD"
            : "TH";
  return `${n}${suffix}`;
}

function liveTickerFromSnapshot(game: SkaterSlateGameSnapshot | null): string {
  if (!game) return "";
  const pd = game.periodDescriptor;
  if (pd) {
    const t = pd.periodType.trim().toUpperCase();
    if (t === "REG" && pd.number >= 1 && pd.number <= 3) {
      return periodOrdinal(pd.number);
    }
    return formatPeriodDescriptorLabel(pd).toUpperCase();
  }
  if (game.period != null && game.period >= 1 && game.period <= 3) {
    return periodOrdinal(game.period);
  }
  if (game.period != null) {
    return `P${game.period}`;
  }
  return "LIVE";
}

function intermissionTicker(game: SkaterSlateGameSnapshot): string {
  const n = game.periodDescriptor?.number ?? game.period ?? 1;
  return `${periodOrdinal(n)} INT`;
}

export function gameStatusLine(game: SkaterSlateGameSnapshot): string {
  const live = game.gameState === "LIVE" || game.gameState === "CRIT";
  if (live) {
    const parts: string[] = [];
    if (game.clock?.inIntermission) {
      parts.push(intermissionTicker(game));
    } else {
      parts.push(liveTickerFromSnapshot(game));
    }
    if (game.clock?.timeRemaining) {
      parts.push(game.clock.timeRemaining);
    }
    return parts.join(" · ") || "Live";
  }
  if (game.gameState === "FUT" || game.gameState === "PRE") {
    return formatStartWithZone(game.startTimeUTC);
  }
  if (game.gameState === "OFF" || game.gameState === "FINAL") {
    return "Final";
  }
  return game.gameState;
}

export function gamePhaseLabel(
  game: SkaterSlateGameSnapshot | null,
): { label: string; tone: "live" | "sched" | "final" | "off" } {
  if (!game) return { label: "Off night", tone: "off" };
  const live = game.gameState === "LIVE" || game.gameState === "CRIT";
  if (live) return { label: "Live", tone: "live" };
  if (game.gameState === "FUT" || game.gameState === "PRE") {
    return { label: "Scheduled", tone: "sched" };
  }
  if (game.gameState === "OFF" || game.gameState === "FINAL") {
    return { label: "Final", tone: "final" };
  }
  return { label: game.gameState, tone: "sched" };
}

export function lineupLabel(
  status: SkaterSlateApiRow["lineupStatus"],
  hasGame: boolean,
): string {
  if (!hasGame) return "—";
  if (status === "unknown") return "Lineup pending";
  if (status === "dressed") return "On game roster";
  return "Not on game roster";
}

export function badgeText(b: unknown): string {
  if (b == null) return "";
  if (typeof b === "string") return b;
  if (typeof b === "object" && b !== null && "default" in b) {
    const d = (b as { default?: unknown }).default;
    if (typeof d === "string") return d;
  }
  try {
    return JSON.stringify(b);
  } catch {
    return "";
  }
}

export function PhasePill({
  label,
  tone,
}: {
  label: string;
  tone: "live" | "sched" | "final" | "off";
}) {
  const cls =
    tone === "live"
      ? "bg-emerald-500/15 text-emerald-800 ring-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/30"
      : tone === "final"
        ? "bg-zinc-500/10 text-zinc-700 ring-zinc-500/20 dark:text-zinc-200 dark:ring-zinc-500/25"
        : tone === "off"
          ? "bg-zinc-400/10 text-zinc-600 ring-zinc-400/20 dark:text-zinc-400 dark:ring-zinc-500/20"
          : "bg-amber-500/10 text-amber-900 ring-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-400/25";
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] ring-1 ${cls}`}
    >
      {label}
    </span>
  );
}

/** Compact slate status under fantasy tiles (team detail unified card). */
export function SlateSkaterInlineMeta({ row }: { row: SkaterSlateApiRow }) {
  const phase = gamePhaseLabel(row.game);
  if (phase.tone !== "live") return null;
  return <PhasePill label={phase.label} tone={phase.tone} />;
}

export function SlateTeamPickInlineMeta({ row }: { row: TeamPickSlateApiRow }) {
  const phase = gamePhaseLabel(row.game);
  if (phase.tone !== "live") return null;
  return <PhasePill label={phase.label} tone={phase.tone} />;
}

/** Full list layout for skaters-slate panel (embedded or multi-team). */
export function PoolSlateTeamPickList({ team }: { team: SkatersSlatePoolTeam }) {
  return (
    <>
      <ul className="space-y-1.5" role="list">
        {team.skaters.map((s) => {
          const g = s.game;
          const phase = gamePhaseLabel(g);
          const hasGame = g != null;
          const scoreLine =
            g && (g.awayScore != null || g.homeScore != null)
              ? `${g.awayAbbrev} ${g.awayScore ?? "—"} @ ${g.homeAbbrev} ${g.homeScore ?? "—"}`
              : g
                ? `${g.awayAbbrev} @ ${g.homeAbbrev}`
                : null;
          const sub =
            g &&
            (phase.tone === "live" ||
              g.gameState === "FUT" ||
              g.gameState === "PRE")
              ? gameStatusLine(g)
              : null;
          return (
            <li
              key={`${team.poolTeamId}-sk-${s.round}-${s.label}`}
              className={`flex flex-col gap-2 rounded-xl px-2 py-2.5 sm:flex-row sm:items-center sm:gap-3 ${
                s.lifecycleStatus === "eliminated"
                  ? "opacity-55 grayscale"
                  : ""
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {s.headshotUrl ? (
                  <Image
                    src={s.headshotUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-full bg-zinc-100 object-cover dark:bg-zinc-800"
                    unoptimized
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-200/80 dark:bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {s.label}
                  </div>
                  <div className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                    R{s.round}
                    {s.nhlTeamAbbrev ? ` · ${s.nhlTeamAbbrev}` : ""}
                  </div>
                  {s.badges && s.badges.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.badges.map((b, i) => {
                        const t = badgeText(b);
                        if (!t) return null;
                        return (
                          <span
                            key={i}
                            className="inline-flex max-w-full truncate rounded-md bg-zinc-200/80 px-1.5 py-0.5 text-[0.65rem] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            title={t}
                          >
                            {t}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end sm:text-right">
                <div className="flex flex-wrap items-center gap-2">
                  <PhasePill label={phase.label} tone={phase.tone} />
                  <span className="text-[0.7rem] font-medium text-zinc-600 dark:text-zinc-400">
                    {lineupLabel(s.lineupStatus, hasGame)}
                  </span>
                </div>
                {scoreLine ? (
                  <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {scoreLine}
                  </div>
                ) : null}
                {sub ? (
                  <div className="text-[0.7rem] text-zinc-500 dark:text-zinc-400">
                    {sub}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {team.teamPicks.length > 0 ? (
        <div className="mt-3 border-t border-zinc-200/70 pt-3 dark:border-zinc-800/80">
          <p className="mb-2 px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            Team picks
          </p>
          <ul className="space-y-2" role="list">
            {team.teamPicks.map((tp) => {
              const g = tp.game;
              const phase = gamePhaseLabel(g);
              return (
                <li
                  key={`${team.poolTeamId}-tp-${tp.round}-${tp.teamAbbrev}`}
                  className={`flex items-center gap-3 rounded-xl px-2 py-2 ${
                    tp.lifecycleStatus === "eliminated"
                      ? "opacity-55 grayscale"
                      : ""
                  }`}
                >
                  <NhleTeamLogoImage
                    src={nhlTeamLogoLightSvgUrl(tp.teamAbbrev)}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {tp.label}
                    </div>
                    <div className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      R{tp.round} · {tp.teamAbbrev}
                    </div>
                  </div>
                  <PhasePill label={phase.label} tone={phase.tone} />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </>
  );
}
