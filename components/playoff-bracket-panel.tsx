"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { CenteredLoading } from "@/components/centered-loading";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import {
  eastBracketSlots,
  groupForDisplay,
  westBracketSlots,
} from "@/lib/nhl/playoff-bracket-layout";
import { nhlePlayoffBracketCenterLogoUrl } from "@/lib/nhl/media";
import type {
  PlayoffBracketResponse,
  PlayoffBracketSeries,
} from "@/lib/nhl/schemas";

type BracketApiPayload = PlayoffBracketResponse & {
  meta?: { season: number };
};

async function fetchBracket(): Promise<BracketApiPayload> {
  const res = await fetch("/api/nhl/bracket");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : "Failed to load bracket",
    );
  }
  return res.json();
}

function topWonSeries(s: PlayoffBracketSeries): boolean {
  if (s.winningTeamId != null && s.topSeedTeam?.id != null) {
    return s.winningTeamId === s.topSeedTeam.id;
  }
  return s.topSeedWins >= 4 && s.bottomSeedWins < 4;
}

function bottomWonSeries(s: PlayoffBracketSeries): boolean {
  if (s.winningTeamId != null && s.bottomSeedTeam?.id != null) {
    return s.winningTeamId === s.bottomSeedTeam.id;
  }
  return s.bottomSeedWins >= 4 && s.topSeedWins < 4;
}

function SeriesMatchupCard({
  series,
  variant = "default",
}: {
  series: PlayoffBracketSeries;
  variant?: "default" | "bracket";
}) {
  const top = series.topSeedTeam;
  const bottom = series.bottomSeedTeam;
  const topWon = topWonSeries(series);
  const bottomWon = bottomWonSeries(series);
  const gamesPlayed = series.topSeedWins + series.bottomSeedWins;
  /** Undecided and at least one game played — not future 0–0 placeholders. */
  const seriesInProgress = !topWon && !bottomWon && gamesPlayed > 0;

  const shell =
    variant === "bracket"
      ? [
          "overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-[#333333] dark:bg-[#222222]",
          seriesInProgress
            ? "border-sky-300/80 bg-sky-50 ring-1 ring-sky-200/70 dark:border-[#3d4a5c] dark:bg-[#252b34] dark:ring-0 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(96,165,250,0.32)]"
            : "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
        ].join(" ")
      : "overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950";

  return (
    <div
      className={shell}
      {...(variant === "bracket" && seriesInProgress
        ? {
            "data-series-in-progress": "",
            title: "Ongoing series",
          }
        : {})}
    >
      <div
        className={
          variant === "bracket"
            ? "divide-y divide-zinc-100 dark:divide-[#2e2e2e]"
            : "divide-y divide-zinc-100 dark:divide-zinc-800"
        }
      >
        <TeamRow
          variant={variant}
          team={top}
          wins={series.topSeedWins}
          emphasize={topWon}
          faded={bottomWon}
          seriesInProgress={seriesInProgress}
        />
        <TeamRow
          variant={variant}
          team={bottom}
          wins={series.bottomSeedWins}
          emphasize={bottomWon}
          faded={topWon}
          seriesInProgress={seriesInProgress}
        />
      </div>
    </div>
  );
}

function TeamRow({
  team,
  wins,
  emphasize,
  faded,
  seriesInProgress = false,
  variant = "default",
}: {
  team?: { id: number; abbrev: string; logo?: string };
  wins: number;
  emphasize: boolean;
  faded: boolean;
  /** Undecided with games played; bracket scores stay legible (not zinc-500). */
  seriesInProgress?: boolean;
  variant?: "default" | "bracket";
}) {
  const logo = team?.logo;

  const isBracket = variant === "bracket";
  const abbrev = team?.abbrev?.trim() || "TBD";

  return (
    <div
      className={`flex items-center justify-between gap-2 sm:gap-3 ${
        isBracket ? "px-2 py-1.5" : "px-2.5 py-2 sm:px-3"
      } ${faded ? "opacity-40 grayscale" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
        {logo ? (
          <NhleTeamLogoImage src={logo} width={32} height={32} alt="" />
        ) : (
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
              isBracket
                ? "bg-zinc-100 text-[0.95rem] font-light leading-none text-zinc-500 dark:bg-[#2a2a2a] dark:text-zinc-500/80"
                : "text-[0.6rem] font-semibold uppercase tracking-wide bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {isBracket ? "?" : "TBD"}
          </span>
        )}
        <div
          className={
            isBracket
              ? "@container min-w-0 flex-1 basis-0"
              : "min-w-0"
          }
        >
          <p
            className={`truncate text-xs font-semibold tracking-tight sm:text-sm ${
              isBracket ? "hidden @min-[2.75rem]:block " : ""
            }${
              isBracket
                ? emphasize
                  ? "text-zinc-950 dark:text-white"
                  : seriesInProgress
                    ? "text-zinc-800 dark:text-zinc-200"
                    : "text-zinc-600 dark:text-zinc-300"
                : emphasize
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-800 dark:text-zinc-200"
            }`}
          >
            {abbrev}
          </p>
        </div>
      </div>
      <span
        className={`shrink-0 tabular-nums text-base font-bold sm:text-lg ${
          isBracket
            ? emphasize
              ? "text-zinc-950 dark:text-white"
              : seriesInProgress
                ? "text-zinc-800 dark:text-zinc-200"
                : "text-zinc-500 dark:text-zinc-500"
            : emphasize
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-zinc-600 dark:text-zinc-400"
        }`}
      >
        {wins}
      </span>
    </div>
  );
}

function RoundTag({
  children,
  align = "center",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const alignCls =
    align === "left"
      ? "text-left"
      : align === "right"
        ? "text-right"
        : "text-center";
  return (
    <span
      className={`block text-[0.52rem] font-bold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-300 ${alignCls} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

/**
 * Upper & lower halves: R1 label above R1 cards; R2 label stacked above R2 card in the R2 column.
 * R2 column spans the two R1 rows so the series sits between them.
 */
function ConferenceBracketSlice({
  side,
  half,
  r1,
  r2,
}: {
  side: "west" | "east";
  half: "upper" | "lower";
  r1: [PlayoffBracketSeries | undefined, PlayoffBracketSeries | undefined];
  r2: PlayoffBracketSeries | undefined;
}) {
  const r2Rail =
    "flex min-h-0 flex-col items-center justify-center gap-1 py-0";

  if (side === "west" && half === "upper") {
    return (
      <div
        className="grid min-w-0 w-full gap-x-2 gap-y-1"
        style={{
          gridTemplateColumns: `minmax(0,1fr) minmax(5rem,34%)`,
          gridTemplateRows: "auto minmax(0,1fr) minmax(0,1fr)",
        }}
      >
        <RoundTag align="left" className="col-start-1 row-start-1 mb-0.5">
          R1
        </RoundTag>
        <div className="col-start-1 row-start-2 min-w-0 self-center">
          <SeriesSlot series={r1[0]} />
        </div>
        <div className="col-start-1 row-start-3 min-w-0 self-center">
          <SeriesSlot series={r1[1]} />
        </div>
        <div className={`col-start-2 row-span-2 row-start-2 ${r2Rail}`}>
          <RoundTag>R2</RoundTag>
          <div className="w-full min-w-0">
            <SeriesSlot series={r2} />
          </div>
        </div>
      </div>
    );
  }

  if (side === "west" && half === "lower") {
    return (
      <div
        className="grid min-w-0 w-full gap-x-2 gap-y-1"
        style={{
          gridTemplateColumns: `minmax(0,1fr) minmax(5rem,34%)`,
          gridTemplateRows: "auto minmax(0,1fr) minmax(0,1fr)",
        }}
      >
        <RoundTag align="left" className="col-start-1 row-start-1 mb-0.5">
          R1
        </RoundTag>
        <div className="col-start-1 row-start-2 min-w-0 self-center">
          <SeriesSlot series={r1[0]} />
        </div>
        <div className="col-start-1 row-start-3 min-w-0 self-center">
          <SeriesSlot series={r1[1]} />
        </div>
        <div className={`col-start-2 row-span-2 row-start-2 ${r2Rail}`}>
          <RoundTag>R2</RoundTag>
          <div className="w-full min-w-0">
            <SeriesSlot series={r2} />
          </div>
        </div>
      </div>
    );
  }

  if (side === "east" && half === "upper") {
    return (
      <div
        className="grid min-w-0 w-full gap-x-2 gap-y-1"
        style={{
          gridTemplateColumns: `minmax(5rem,34%) minmax(0,1fr)`,
          gridTemplateRows: "auto minmax(0,1fr) minmax(0,1fr)",
        }}
      >
        <RoundTag align="right" className="col-start-2 row-start-1 mb-0.5">
          R1
        </RoundTag>
        <div className={`col-start-1 row-span-2 row-start-2 ${r2Rail}`}>
          <RoundTag>R2</RoundTag>
          <div className="w-full min-w-0">
            <SeriesSlot series={r2} />
          </div>
        </div>
        <div className="col-start-2 row-start-2 min-w-0 self-center">
          <SeriesSlot series={r1[0]} />
        </div>
        <div className="col-start-2 row-start-3 min-w-0 self-center">
          <SeriesSlot series={r1[1]} />
        </div>
      </div>
    );
  }

  /* east lower */
  return (
    <div
      className="grid min-w-0 w-full gap-x-2 gap-y-1"
      style={{
        gridTemplateColumns: `minmax(5rem,34%) minmax(0,1fr)`,
        gridTemplateRows: "auto minmax(0,1fr) minmax(0,1fr)",
      }}
    >
      <RoundTag align="right" className="col-start-2 row-start-1 mb-0.5">
        R1
      </RoundTag>
      <div className={`col-start-1 row-span-2 row-start-2 ${r2Rail}`}>
        <RoundTag>R2</RoundTag>
        <div className="w-full min-w-0">
          <SeriesSlot series={r2} />
        </div>
      </div>
      <div className="col-start-2 row-start-2 min-w-0 self-center">
        <SeriesSlot series={r1[0]} />
      </div>
      <div className="col-start-2 row-start-3 min-w-0 self-center">
        <SeriesSlot series={r1[1]} />
      </div>
    </div>
  );
}

/** Equator row: WCF | Stanley Cup + Final | ECF (full width between upper and lower halves). */
function BracketCenterRow({
  logoUrl,
  wcf,
  ecf,
  cup,
  wcfTitle,
  ecfTitle,
  cupTitle,
}: {
  logoUrl?: string;
  wcf?: PlayoffBracketSeries;
  ecf?: PlayoffBracketSeries;
  cup?: PlayoffBracketSeries;
  wcfTitle: string;
  ecfTitle: string;
  cupTitle: string;
}) {
  return (
    <div
      className="-mb-3 grid min-w-0 w-full items-start gap-x-1.5 pt-4 pb-0 sm:-mb-4 sm:gap-x-2 sm:pt-5 sm:pb-0"
      style={{
        gridTemplateColumns: `minmax(0,1fr) minmax(6rem,auto) minmax(0,1fr)`,
      }}
    >
      <section
        className="flex min-w-0 flex-col items-center gap-1"
        aria-label={wcfTitle}
      >
        <RoundTag>WCF</RoundTag>
        <span className="sr-only">{wcfTitle}</span>
        <div className="w-full min-w-0">
          <SeriesSlot series={wcf} />
        </div>
      </section>

      <section
        className="flex min-w-0 flex-col items-center gap-1 px-1 sm:px-2"
        aria-label={cupTitle}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={140}
            height={180}
            className="h-[4.25rem] w-auto max-w-[4.25rem] object-contain sm:h-[5rem] sm:max-w-[5rem]"
            unoptimized
          />
        ) : (
          <div
            className="flex h-[3.75rem] w-[4.25rem] items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 sm:h-[4.25rem] sm:w-16 dark:border-[#333333] dark:bg-[#222222]"
            aria-hidden
          >
            <span className="text-[0.45rem] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              SCP
            </span>
          </div>
        )}
        <RoundTag>Final</RoundTag>
        <span className="sr-only">{cupTitle}</span>
        <div className="w-full min-w-0">
          {cup ? (
            <SeriesMatchupCard series={cup} variant="bracket" />
          ) : (
            <SeriesSlot series={undefined} />
          )}
        </div>
      </section>

      <section
        className="flex min-w-0 flex-col items-center gap-1"
        aria-label={ecfTitle}
      >
        <RoundTag>ECF</RoundTag>
        <span className="sr-only">{ecfTitle}</span>
        <div className="w-full min-w-0">
          <SeriesSlot series={ecf} />
        </div>
      </section>
    </div>
  );
}

function WestEastRow({
  west,
  east,
}: {
  west: ReactNode;
  east: ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-5">
      <div className="min-w-0">{west}</div>
      <div className="min-w-0">{east}</div>
    </div>
  );
}

/** Full-width slot inside the 2-column grid — no fixed pixel widths (fits narrow viewports). */
function SeriesSlot({ series }: { series?: PlayoffBracketSeries }) {
  if (!series) {
    return (
      <div className="flex min-h-[72px] w-full min-w-0 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/90 dark:border-[#3a3a3a] dark:bg-[#1a1a1a]/90">
        <span className="text-lg font-light text-zinc-400 dark:text-zinc-600" aria-hidden>
          —
        </span>
      </div>
    );
  }
  return (
    <div className="w-full min-w-0">
      <SeriesMatchupCard series={series} variant="bracket" />
    </div>
  );
}

/** Upper & lower conference halves with a full-width equator row (WCF | Final | ECF). */
function BracketView({ data }: { data: BracketApiPayload }) {
  const { east, west, final: finalSeries } = groupForDisplay(data);
  const westSlots = westBracketSlots(west);
  const eastSlots = eastBracketSlots(east);
  const wcf = westSlots.r3[0];
  const ecf = eastSlots.r3[0];
  const wcfTitle = wcf?.seriesTitle?.trim() || "Western Conference Final";
  const ecfTitle = ecf?.seriesTitle?.trim() || "Eastern Conference Final";
  const cup = finalSeries[0];
  const cupTitle = cup?.seriesTitle?.trim() || "Stanley Cup Final";

  return (
    <div className="overflow-x-hidden rounded-2xl bg-zinc-100 px-2.5 pt-5 pb-6 shadow-inner ring-1 ring-zinc-200/80 sm:px-4 sm:pt-6 sm:pb-8 dark:bg-[#121212] dark:ring-[#2a2a2a]">
      <div className="mb-1">
        <WestEastRow
          west={
            <ConferenceBracketSlice
              half="upper"
              side="west"
              r1={[westSlots.r1[0], westSlots.r1[1]]}
              r2={westSlots.r2[0]}
            />
          }
          east={
            <ConferenceBracketSlice
              half="upper"
              side="east"
              r1={[eastSlots.r1[0], eastSlots.r1[1]]}
              r2={eastSlots.r2[0]}
            />
          }
        />
      </div>

      <BracketCenterRow
        logoUrl={nhlePlayoffBracketCenterLogoUrl(data.bracketLogo)}
        wcf={wcf}
        ecf={ecf}
        cup={cup}
        wcfTitle={wcfTitle}
        ecfTitle={ecfTitle}
        cupTitle={cupTitle}
      />

      <div className="-mt-4 sm:-mt-5">
        <WestEastRow
          west={
            <ConferenceBracketSlice
              half="lower"
              side="west"
              r1={[westSlots.r1[2], westSlots.r1[3]]}
              r2={westSlots.r2[1]}
            />
          }
          east={
            <ConferenceBracketSlice
              half="lower"
              side="east"
              r1={[eastSlots.r1[2], eastSlots.r1[3]]}
              r2={eastSlots.r2[1]}
            />
          }
        />
      </div>
    </div>
  );
}

/** NHL bracket embed for the pool home page (`/`). */
export function PlayoffBracketHomeSection() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["nhl-bracket"],
    queryFn: fetchBracket,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  return (
    <section
      className="mb-10 flex flex-col gap-3 sm:mb-14 [overflow-anchor:none]"
      aria-labelledby="pool-home-bracket-heading"
    >
      <h2
        id="pool-home-bracket-heading"
        className="font-pool-display text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
      >
        Playoff bracket
      </h2>

      {error instanceof Error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error.message}
        </div>
      ) : null}

      {isLoading ? (
        <CenteredLoading message="Loading bracket…" variant="section" />
      ) : null}

      {!isLoading && data ? (
        data.series.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            Bracket has no series yet.
          </p>
        ) : (
          <BracketView data={data} />
        )
      ) : null}
    </section>
  );
}

export function PlayoffBracketPanel() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["nhl-bracket"],
    queryFn: fetchBracket,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-10 pb-20 sm:px-6 sm:pb-28">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            <Link
              href="/nhl"
              className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
            >
              Game scores
            </Link>
            <span className="mx-2 text-zinc-400">/</span>
            <span className="text-zinc-900 dark:text-zinc-100">Bracket</span>
            <span className="mx-2 text-zinc-400">/</span>
            <Link
              href="/"
              className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
            >
              Pool standings
            </Link>
          </p>
          <h1 className="font-pool-display mt-2 text-[2rem] font-semibold leading-[1.12] tracking-[-0.02em] text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Playoff bracket
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Series and wins from the NHL web API
            {data?.meta?.season != null ? (
              <span className="text-zinc-500 dark:text-zinc-500">
                {" "}
                · season {data.meta.season}
              </span>
            ) : null}
            .
          </p>
        </div>
      </header>

      {error instanceof Error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error.message}
        </div>
      ) : null}

      {isLoading ? (
        <CenteredLoading message="Loading bracket…" variant="section" />
      ) : null}

      {!isLoading && data ? (
        <>
          {data.series.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              Bracket has no series yet.
            </p>
          ) : (
            <BracketView data={data} />
          )}
        </>
      ) : null}
    </div>
  );
}
