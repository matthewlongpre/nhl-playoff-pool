"use client";

import { CenteredLoading } from "@/components/centered-loading";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { format, parseISO } from "date-fns";
import { formatPeriodDescriptorLabel } from "@/lib/nhl/period-descriptor";
import type { NhlTeamPlayoffStatus, ScoreboardGame } from "@/lib/nhl/schemas";

function formatStartWithZone(iso: string | undefined) {
  if (iso == null || iso === "") return "Time TBA";
  return new Date(iso).toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** e.g. 1ST, 2ND, 3RD, 4TH for regulation-style period numbers */
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

function liveTickerPeriodLabel(game: ScoreboardGame): string {
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

function intermissionTickerLabel(game: ScoreboardGame): string {
  const n = game.periodDescriptor?.number ?? game.period ?? 1;
  return `${periodOrdinal(n)} INT`;
}

function formatSeriesStanding(game: ScoreboardGame): string | null {
  const s = game.seriesStatus;
  if (!s) return null;
  if (s.topSeedWins === s.bottomSeedWins) {
    return `TIED ${s.topSeedWins}-${s.bottomSeedWins}`;
  }
  const leader =
    s.topSeedWins > s.bottomSeedWins
      ? s.topSeedTeamAbbrev
      : s.bottomSeedTeamAbbrev;
  const hi = Math.max(s.topSeedWins, s.bottomSeedWins);
  const lo = Math.min(s.topSeedWins, s.bottomSeedWins);
  return `${leader ?? "TBD"} ${hi}-${lo}`;
}

function roundGameLabel(game: ScoreboardGame): string | null {
  const s = game.seriesStatus;
  if (!s) return null;
  return `R${s.round}, GM ${s.game}`;
}

function gameStatusLine(game: ScoreboardGame): string {
  const live = game.gameState === "LIVE" || game.gameState === "CRIT";
  if (live) {
    const parts: string[] = [];
    if (game.clock?.inIntermission) {
      parts.push(intermissionTickerLabel(game));
    } else {
      parts.push(liveTickerPeriodLabel(game));
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

function logoCell(logo: string | undefined) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center">
      {logo ? (
        <NhleTeamLogoImage
          src={logo}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 object-contain"
        />
      ) : (
        <span className="block h-6 w-6 shrink-0" aria-hidden />
      )}
    </span>
  );
}

function abbrevCell(abbrev: string) {
  return (
    <span className="min-w-0 truncate text-[0.8125rem] font-bold uppercase leading-none tracking-tight text-zinc-900 dark:text-zinc-50">
      {abbrev}
    </span>
  );
}

function rightCell(right: string, rightIsScore: boolean) {
  return (
    <span
      className={`ml-auto shrink-0 tabular-nums ${
        rightIsScore
          ? "text-[1.0625rem] font-bold leading-none text-zinc-900 dark:text-zinc-50"
          : "max-w-[5.5rem] text-right text-[0.65rem] font-medium leading-tight text-zinc-500 dark:text-zinc-400"
      }`}
    >
      {right}
    </span>
  );
}

function TeamRow({
  abbrev,
  logo,
  right,
  rightIsScore,
  eliminated,
}: {
  abbrev: string;
  logo?: string;
  right: string;
  rightIsScore: boolean;
  eliminated?: boolean;
}) {
  return (
    <div
      className={`flex min-h-[1.375rem] items-center gap-2 ${
        eliminated ? "opacity-55 grayscale" : ""
      }`}
    >
      {logoCell(logo)}
      {abbrevCell(abbrev)}
      {rightCell(right, rightIsScore)}
    </div>
  );
}

/** Series standing once in the right column, vertically centered between the two teams */
function TeamRowsWithSharedSeries({
  awayAbbrev,
  awayLogo,
  homeAbbrev,
  homeLogo,
  seriesText,
  awayEliminated,
  homeEliminated,
}: {
  awayAbbrev: string;
  awayLogo?: string;
  homeAbbrev: string;
  homeLogo?: string;
  seriesText: string;
  awayEliminated?: boolean;
  homeEliminated?: boolean;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_max-content] items-center gap-x-2 gap-y-0.5">
      <div
        className={`col-start-1 row-start-1 flex min-h-[1.375rem] items-center ${
          awayEliminated ? "opacity-55 grayscale" : ""
        }`}
      >
        {logoCell(awayLogo)}
      </div>
      <div
        className={`col-start-2 row-start-1 flex min-h-[1.375rem] min-w-0 items-center ${
          awayEliminated ? "opacity-55 grayscale" : ""
        }`}
      >
        {abbrevCell(awayAbbrev)}
      </div>
      <div
        className={`col-start-1 row-start-2 flex min-h-[1.375rem] items-center ${
          homeEliminated ? "opacity-55 grayscale" : ""
        }`}
      >
        {logoCell(homeLogo)}
      </div>
      <div
        className={`col-start-2 row-start-2 flex min-h-[1.375rem] min-w-0 items-center ${
          homeEliminated ? "opacity-55 grayscale" : ""
        }`}
      >
        {abbrevCell(homeAbbrev)}
      </div>
      <span className="col-start-3 row-span-2 row-start-1 self-center text-right text-[0.65rem] font-medium leading-tight tabular-nums text-zinc-500 dark:text-zinc-400">
        {seriesText}
      </span>
    </div>
  );
}

type CompactNhlSlateProps = {
  games: ReadonlyArray<ScoreboardGame>;
  /** YYYY-MM-DD — shown in subtle label when helpful */
  slateDate?: string;
  /** When the API walked back to a different calendar day */
  fellBack?: boolean;
  /** Original requested date (for fallback copy) */
  requestedDate?: string;
  isLoading?: boolean;
  teamStatusByAbbrev?: Readonly<Record<string, NhlTeamPlayoffStatus>>;
};

export function CompactNhlSlate({
  games,
  slateDate,
  fellBack,
  requestedDate,
  isLoading,
  teamStatusByAbbrev,
}: CompactNhlSlateProps) {
  if (isLoading) {
    return (
      <div
        className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 px-4 py-3 dark:border-zinc-700/60 dark:bg-zinc-900/30"
        aria-busy="true"
        aria-label="Loading games"
      >
        <CenteredLoading
          message="Loading games…"
          ariaLabel="Loading games"
          variant="compact"
          className="max-w-none py-8"
        />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300/90 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-600/70 dark:text-zinc-400">
        No playoff games on this slate
        {slateDate ? (
          <span className="tabular-nums"> · {slateDate}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-zinc-100/80 px-0 py-0 dark:border-zinc-700/60 dark:bg-zinc-900/40">
      {fellBack && requestedDate ? (
        <p className="border-b border-zinc-200/80 px-3 py-2 text-[0.7rem] leading-snug text-zinc-500 dark:border-zinc-700/50 dark:text-zinc-400">
          No games on{" "}
          <time dateTime={requestedDate} className="tabular-nums">
            {format(parseISO(requestedDate), "MMM d")}
          </time>
          — showing most recent night
        </p>
      ) : null}
      <div className="flex min-h-0 items-stretch overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slateDate ? (
          <div
            className="flex shrink-0 flex-col items-center justify-center self-stretch border-r border-zinc-200/90 bg-zinc-50/90 px-1.5 py-2 dark:border-zinc-700/70 dark:bg-zinc-900/50"
            aria-hidden
          >
            <time
              dateTime={slateDate}
              className="flex flex-col items-center text-center text-[0.65rem] font-bold uppercase leading-[1.05] tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              <span>{format(parseISO(slateDate), "MMM")}</span>
              <span className="tabular-nums">{format(parseISO(slateDate), "d")}</span>
            </time>
          </div>
        ) : null}
        <ul
          className="flex min-w-0 gap-0"
          role="list"
          aria-label="Playoff games on this slate"
        >
          {games.map((game) => {
            const away = game.awayTeam;
            const home = game.homeTeam;
            const awayEliminated =
              teamStatusByAbbrev?.[away.abbrev.trim().toUpperCase()] ===
              "eliminated";
            const homeEliminated =
              teamStatusByAbbrev?.[home.abbrev.trim().toUpperCase()] ===
              "eliminated";
            const live = game.gameState === "LIVE" || game.gameState === "CRIT";
            const finalOrOff =
              game.gameState === "OFF" || game.gameState === "FINAL";
            const showScore =
              live ||
              finalOrOff ||
              away.score != null ||
              home.score != null;
            const pre = game.gameState === "FUT" || game.gameState === "PRE";
            const seriesText = formatSeriesStanding(game);
            const roundGame = roundGameLabel(game);

            const intermission = Boolean(
              live && game.clock?.inIntermission,
            );

            let badgeText: string;
            let badgeTone: "live" | "muted" | "pregame" | "final";
            if (pre) {
              badgeText = formatStartWithZone(game.startTimeUTC);
              badgeTone = "pregame";
            } else if (finalOrOff) {
              badgeText = "FINAL";
              badgeTone = "final";
            } else if (intermission) {
              badgeText = intermissionTickerLabel(game);
              badgeTone = "muted";
            } else {
              badgeText = liveTickerPeriodLabel(game);
              badgeTone = "live";
            }

            const showClock =
              live && !intermission && Boolean(game.clock?.timeRemaining);

            const badgeClass =
              badgeTone === "live"
                ? "bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white"
                : badgeTone === "muted"
                  ? "bg-zinc-400/35 text-zinc-900 dark:bg-zinc-500/40 dark:text-zinc-100"
                  : badgeTone === "pregame"
                    ? "bg-zinc-200/90 text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-200"
                    : "bg-zinc-300/80 text-zinc-800 dark:bg-zinc-600/50 dark:text-zinc-100";

            const awayRight = showScore ? String(away.score ?? "—") : "—";
            const homeRight = showScore ? String(home.score ?? "—") : "—";

            const aria = `${away.commonName?.default ?? away.abbrev} at ${home.commonName?.default ?? home.abbrev}. ${gameStatusLine(game)}${
              !showScore && seriesText ? `. ${seriesText}` : ""
            }`;

            return (
              <li
                key={game.id}
                className="min-w-0 shrink-0 border-r border-zinc-200/90 last:border-r-0 dark:border-zinc-700/70"
              >
                <div
                  className={`flex h-full w-[11rem] flex-col gap-1.5 px-2.5 py-2 sm:w-[11.25rem] ${
                    live && !intermission
                      ? "bg-emerald-500/[0.07] dark:bg-emerald-500/[0.09]"
                      : "bg-white/95 dark:bg-zinc-950/60"
                  }`}
                  aria-label={aria}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span
                        className={`inline-flex min-w-0 max-w-full shrink items-center truncate rounded px-1.5 py-0.5 text-[0.6rem] font-semibold leading-none ${badgeClass}`}
                      >
                        {badgeText}
                      </span>
                      {showClock ? (
                        <span className="shrink-0 text-[0.65rem] font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                          {game.clock!.timeRemaining}
                        </span>
                      ) : null}
                    </div>
                    {roundGame ? (
                      <span className="shrink-0 text-[0.6rem] font-medium leading-none text-zinc-400 dark:text-zinc-500">
                        {roundGame}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-0.5">
                    {showScore ? (
                      <>
                        <TeamRow
                          abbrev={away.abbrev}
                          logo={away.logo}
                          right={awayRight}
                          rightIsScore
                          eliminated={awayEliminated}
                        />
                        <TeamRow
                          abbrev={home.abbrev}
                          logo={home.logo}
                          right={homeRight}
                          rightIsScore
                          eliminated={homeEliminated}
                        />
                      </>
                    ) : seriesText ? (
                      <TeamRowsWithSharedSeries
                        awayAbbrev={away.abbrev}
                        awayLogo={away.logo}
                        homeAbbrev={home.abbrev}
                        homeLogo={home.logo}
                        seriesText={seriesText}
                        awayEliminated={awayEliminated}
                        homeEliminated={homeEliminated}
                      />
                    ) : (
                      <>
                        <TeamRow
                          abbrev={away.abbrev}
                          logo={away.logo}
                          right={awayRight}
                          rightIsScore={false}
                          eliminated={awayEliminated}
                        />
                        <TeamRow
                          abbrev={home.abbrev}
                          logo={home.logo}
                          right={homeRight}
                          rightIsScore={false}
                          eliminated={homeEliminated}
                        />
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
