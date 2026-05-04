"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { NhlTeamLogoEliminatedWrap } from "@/components/nhl-team-logo-eliminated-wrap";
import { CenteredLoading } from "@/components/centered-loading";
import { nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";
import { nhlTeamPrimaryHex } from "@/lib/nhl/team-primary-color";
import { computePickDistributionRanking } from "@/lib/pool/pick-distribution-ranking";

type Entry = {
  abbrev: string;
  count: number;
  status: "active" | "eliminated";
};

type TeamRow = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
  entries: Entry[];
};

type LeagueRow = {
  abbrev: string;
  count: number;
  status: "active" | "eliminated";
};

type PickDistributionResponse = {
  date: string;
  teams: TeamRow[];
  leagueByNhlTeam?: LeagueRow[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === "string" ? err.error : "Request failed");
  }
  return res.json();
}

type Props = {
  /** Pool calendar day — forwarded to the API as `date`. */
  asOfDate: string;
  onOpenPoolTeam: (teamId: string) => void;
};

export function PoolPickDistribution({ asOfDate, onOpenPoolTeam }: Props) {
  const [highlightAbbrev, setHighlightAbbrev] = useState<string | null>(null);

  useEffect(() => {
    setHighlightAbbrev(null);
  }, [asOfDate]);

  const q = useQuery({
    queryKey: ["pool-pick-distribution", asOfDate],
    queryFn: () =>
      fetchJson<PickDistributionResponse>(
        `/api/pool/pick-distribution?date=${encodeURIComponent(asOfDate)}`,
      ),
    refetchInterval: 90_000,
  });

  const { teamsSorted, abbrevOrder, legendEntries } = useMemo(() => {
    const teams = q.data?.teams ?? [];
    return computePickDistributionRanking(teams);
  }, [q.data?.teams]);

  if (q.isLoading) {
    return <CenteredLoading message="Loading pick distribution…" variant="section" />;
  }

  if (q.error instanceof Error) {
    return (
      <div
        className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50"
        role="alert"
      >
        {q.error.message}
      </div>
    );
  }

  if (!q.data) return null;

  const filterActive = highlightAbbrev != null;
  const leagueByNhlTeam = q.data.leagueByNhlTeam ?? [];
  const leagueMax = leagueByNhlTeam.reduce((m, r) => Math.max(m, r.count), 0);

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="pool-pick-distribution-heading"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="pool-pick-distribution-heading"
          className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Team mix
        </h2>
        <p className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">
          How each pool team’s picks split across NHL clubs, with league-wide skater and team-win totals per club
          below—greyscale means that club is eliminated.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-pool-display text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">
          By pool team
        </h3>

        <figure
        className="rounded-2xl bg-white px-3 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08] sm:px-4 sm:py-5"
        aria-label="Stacked bar chart of NHL team pick share for each pool team, using team logos in each segment"
      >
        <figcaption className="sr-only">
          Rows list pool teams; horizontal bars show pick share per NHL team using team logos. Tap a row for that
          pool team&apos;s detail page.
        </figcaption>

        <div className="flex flex-col gap-2.5">
          {teamsSorted.map((team) => {
            const total = team.entries.reduce((s, e) => s + e.count, 0);
            const byAbbrev = new Map(team.entries.map((e) => [e.abbrev, e]));
            return (
              <button
                key={team.teamId}
                type="button"
                onClick={() => onOpenPoolTeam(team.teamId)}
                className="touch-manipulation flex w-full min-w-0 items-center gap-2 rounded-xl px-1 py-1 text-left transition-colors hover:bg-zinc-50/90 active:bg-zinc-100/90 dark:hover:bg-zinc-900/50 dark:active:bg-zinc-900"
                aria-label={`${team.name}, ${team.ownerName}. ${total} picks across NHL teams. Open team detail.`}
              >
                <div className="w-[6.5rem] shrink-0 sm:w-40">
                  <div className="truncate text-[0.8rem] font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                    {team.name}
                  </div>
                  <div className="truncate text-[0.65rem] text-zinc-500 dark:text-zinc-400">{team.ownerName}</div>
                </div>
                <div className="min-w-0 flex-1">
                  {total <= 0 ? (
                    <div className="h-4 rounded-md bg-zinc-200/80 dark:bg-zinc-800/80" />
                  ) : (
                    <div className="flex h-4 overflow-hidden rounded-md ring-1 ring-zinc-900/10 dark:brightness-110 dark:ring-white/10 sm:h-5">
                      {abbrevOrder.map((abbrev) => {
                        const e = byAbbrev.get(abbrev);
                        const count = e?.count ?? 0;
                        if (count <= 0) return null;
                        const eliminated = e?.status === "eliminated";
                        const src = nhlTeamLogoLightSvgUrl(abbrev);
                        const primary = nhlTeamPrimaryHex(abbrev);
                        const barDimmed =
                          filterActive && abbrev !== highlightAbbrev;
                        return (
                          <div
                            key={abbrev}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setHighlightAbbrev((cur) =>
                                cur === abbrev ? null : abbrev,
                              );
                            }}
                            style={{
                              flexGrow: count,
                              flexBasis: 0,
                              minWidth: 2,
                              ...(!eliminated && primary
                                ? { backgroundColor: primary }
                                : {}),
                            }}
                            className={`relative min-h-0 cursor-pointer self-stretch overflow-hidden ring-1 ring-inset ring-black/10 transition-opacity duration-150 dark:ring-white/15 ${
                              !eliminated && primary
                                ? ""
                                : "bg-zinc-300/90 dark:bg-zinc-700/95"
                            } ${barDimmed ? "opacity-[0.22]" : ""}`}
                            title={`${abbrev} ×${count}${eliminated ? " (eliminated)" : ""}. Click to ${filterActive && abbrev === highlightAbbrev ? "clear highlight" : "highlight this team"}.`}
                          >
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-px">
                              <NhlTeamLogoEliminatedWrap
                                eliminated={eliminated}
                                eliminatedDimClassName="opacity-55 grayscale"
                              >
                                <NhleTeamLogoImage
                                  src={src}
                                  alt=""
                                  width={16}
                                  height={16}
                                  onTeamPrimaryBackground={
                                    !eliminated && Boolean(primary)
                                  }
                                  className="max-h-[11px] w-auto max-w-[min(100%,2rem)] object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)] sm:max-h-[14px] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
                                />
                              </NhlTeamLogoEliminatedWrap>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-zinc-200/80 pt-3 dark:border-zinc-800/80">
          <p className="mb-2 text-[0.65rem] font-semibold tracking-tight text-zinc-500 dark:text-zinc-400">
            Teams
          </p>
          <div className="flex flex-wrap content-start gap-x-2 gap-y-2 p-1.5">
            {legendEntries.map(({ abbrev, status }) => {
              const eliminated = status === "eliminated";
              const primary = nhlTeamPrimaryHex(abbrev);
              const chipSelected = highlightAbbrev === abbrev;
              const chipDimmed = filterActive && !chipSelected;
              return (
                <button
                  key={abbrev}
                  type="button"
                  aria-pressed={chipSelected}
                  onClick={() =>
                    setHighlightAbbrev((cur) => (cur === abbrev ? null : abbrev))
                  }
                  className={`inline-flex h-6 w-[4.5rem] shrink-0 items-center gap-1 rounded-full bg-zinc-100/90 py-0.5 pl-0.5 pr-2 text-[0.65rem] font-medium tabular-nums ring-1 ring-zinc-200/80 transition-opacity duration-150 dark:bg-zinc-900/60 dark:ring-zinc-700/60 ${
                    eliminated
                      ? "text-zinc-500 dark:text-zinc-500"
                      : "text-zinc-700 dark:text-zinc-200"
                  } ${
                    chipDimmed ? "opacity-[0.28]" : ""
                  } ${
                    chipSelected
                      ? "ring-2 ring-amber-600/70 ring-offset-1 ring-offset-white dark:ring-amber-400/65 dark:ring-offset-zinc-950"
                      : ""
                  }`}
                  title={`${abbrev}${eliminated ? " (eliminated)" : ""}. Click to ${chipSelected ? "show all teams" : "dim other teams in the chart"}.`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-zinc-900/10 dark:ring-white/10 ${
                      eliminated
                        ? "bg-zinc-300 dark:bg-zinc-700"
                        : primary
                          ? ""
                          : "bg-zinc-200 dark:bg-zinc-800"
                    }`}
                    style={
                      !eliminated && primary
                        ? { backgroundColor: primary }
                        : undefined
                    }
                  >
                    <NhlTeamLogoEliminatedWrap
                      eliminated={eliminated}
                      className="h-full w-full"
                      eliminatedDimClassName="opacity-55 grayscale"
                    >
                      <NhleTeamLogoImage
                        src={nhlTeamLogoLightSvgUrl(abbrev)}
                        alt=""
                        width={16}
                        height={16}
                        onTeamPrimaryBackground={
                          !eliminated && Boolean(primary)
                        }
                        className="h-3.5 w-3.5 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
                      />
                    </NhlTeamLogoEliminatedWrap>
                  </span>
                  {abbrev}
                </button>
              );
            })}
          </div>
        </div>
      </figure>
      </div>

      {leagueByNhlTeam.length > 0 ? (
        <div id="nhl-pick-volume" className="flex flex-col gap-2 scroll-mt-4">
          <h3 className="font-pool-display text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">
            Picks per NHL club
          </h3>
          <figure
            className="rounded-2xl bg-white px-3 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08] sm:px-4 sm:py-5"
            aria-label="Horizontal bars of total pool picks per NHL team, skaters and team picks combined"
          >
            <figcaption className="sr-only">
              Each row is an NHL club; bar length and the number show how many roster picks across the whole pool
              reference that club.
            </figcaption>
            <div className="flex flex-col gap-2">
              {leagueByNhlTeam.map(({ abbrev, count, status }) => {
                const eliminated = status === "eliminated";
                const primary = nhlTeamPrimaryHex(abbrev);
                const pct = leagueMax > 0 ? (count / leagueMax) * 100 : 0;
                return (
                  <div key={abbrev} className="flex items-center gap-2 sm:gap-3">
                    <div className="flex w-[4.75rem] shrink-0 items-center gap-1.5 sm:w-[5.25rem]">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-zinc-900/10 dark:ring-white/10 ${
                          eliminated
                            ? "bg-zinc-300 dark:bg-zinc-700"
                            : primary
                              ? ""
                              : "bg-zinc-200 dark:bg-zinc-800"
                        }`}
                        style={
                          !eliminated && primary
                            ? { backgroundColor: primary }
                            : undefined
                        }
                      >
                        <NhlTeamLogoEliminatedWrap
                          eliminated={eliminated}
                          className="h-full w-full"
                          eliminatedDimClassName="opacity-55 grayscale"
                        >
                          <NhleTeamLogoImage
                            src={nhlTeamLogoLightSvgUrl(abbrev)}
                            alt=""
                            width={18}
                            height={18}
                            onTeamPrimaryBackground={
                              !eliminated && Boolean(primary)
                            }
                            className="h-4 w-4 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
                          />
                        </NhlTeamLogoEliminatedWrap>
                      </span>
                      <span
                        className={`text-[0.75rem] font-semibold tabular-nums ${
                          eliminated
                            ? "text-zinc-500 dark:text-zinc-500"
                            : "text-zinc-800 dark:text-zinc-100"
                        }`}
                      >
                        {abbrev}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="h-3 overflow-hidden rounded-full bg-zinc-200/90 ring-1 ring-zinc-900/[0.06] dark:bg-zinc-800/90 dark:ring-white/[0.06] sm:h-3.5">
                        <div
                          className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                            primary ? "" : "bg-zinc-400 dark:bg-zinc-500"
                          } ${eliminated ? "grayscale" : ""}`}
                          style={{
                            width: `${pct}%`,
                            ...(primary ? { backgroundColor: primary } : {}),
                          }}
                        />
                      </div>
                    </div>
                    <div
                      className={`w-9 shrink-0 text-right font-pool-display text-sm font-medium tabular-nums ${
                        eliminated
                          ? "text-zinc-500 dark:text-zinc-500"
                          : "text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          </figure>
        </div>
      ) : null}
    </section>
  );
}
