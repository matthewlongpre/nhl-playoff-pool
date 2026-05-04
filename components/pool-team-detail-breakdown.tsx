"use client";

import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { PoolSkaterStatsResponsive } from "@/components/pool-skater-stats-responsive";
import { nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";
import type { NhlTeamPlayoffStatus } from "@/lib/nhl/schemas";
import type { TeamScoreBreakdown } from "@/lib/pool/scoring";

function compareSkaterNhlTeamAbbrev(
  a: string | undefined,
  b: string | undefined,
): number {
  const na = (a ?? "").trim().toUpperCase();
  const nb = (b ?? "").trim().toUpperCase();
  const emptyA = na === "";
  const emptyB = nb === "";
  if (emptyA !== emptyB) return emptyA ? 1 : -1;
  return na.localeCompare(nb);
}

/** Forwards before defense; unknown position last. */
function skaterPositionRank(pos: "F" | "D" | undefined): number {
  if (pos === "F") return 0;
  if (pos === "D") return 1;
  return 2;
}

type Props = {
  breakdown: TeamScoreBreakdown;
  /** When true, copy refers to full playoff run; when false, single-day wording is avoided (DB-less mode). */
  isCumulative: boolean;
  teamStatusByAbbrev?: Readonly<Record<string, NhlTeamPlayoffStatus>>;
  /** Optional per-pick projected EV — keyed by `${round}::${label}`. Renders a "Proj +X.X" chip. */
  projectedEvByPickKey?: ReadonlyMap<string, number>;
};

function pickKey(round: number, label: string): string {
  return `${round}::${label}`;
}

function formatOneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

/**
 * Full roster pick scoring — season-to-date when `isCumulative`, otherwise the selected date only.
 */
export function PoolTeamDetailBreakdown({
  breakdown,
  isCumulative,
  teamStatusByAbbrev,
  projectedEvByPickKey,
}: Props) {
  const skaters = [...breakdown.skaterDetail].sort((a, b) => {
    const byTeam = compareSkaterNhlTeamAbbrev(a.nhlTeamAbbrev, b.nhlTeamAbbrev);
    if (byTeam !== 0) return byTeam;
    const byPos =
      skaterPositionRank(a.position) - skaterPositionRank(b.position);
    if (byPos !== 0) return byPos;
    return a.label.localeCompare(b.label);
  });

  const teams = [...breakdown.teamDetail].sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Roster
        </h3>
        {skaters.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No skaters on this roster.
          </p>
        ) : (
          <div className="mt-3">
            <PoolSkaterStatsResponsive
              skaters={skaters}
              teamStatusByAbbrev={teamStatusByAbbrev}
              projectedEvByPickKey={projectedEvByPickKey}
            />
          </div>
        )}
      </section>

      <section>
        <h3 className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Teams
        </h3>
        {teams.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No team picks on this roster.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {teams.map((t) => {
              const teamAbbrev = t.teamAbbrev.trim().toUpperCase();
              const eliminated = teamStatusByAbbrev?.[teamAbbrev] === "eliminated";
              return (
                <li
                key={`tm-${t.round}-${t.label}`}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 ring-1 ${
                  t.points > 0
                    ? "bg-emerald-50/70 ring-emerald-200/60 dark:bg-emerald-950/20 dark:ring-emerald-800/40"
                    : "bg-zinc-100/50 ring-zinc-900/[0.06] dark:bg-zinc-900/30 dark:ring-white/[0.06]"
                } ${eliminated ? "opacity-55 grayscale" : ""}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/90 ring-1 ring-zinc-900/10 dark:bg-zinc-950/80 dark:ring-white/10">
                    <NhleTeamLogoImage
                      src={nhlTeamLogoLightSvgUrl(t.teamAbbrev)}
                      alt=""
                      width={36}
                      height={36}
                      className="h-9 w-9 p-0.5"
                    />
                  </div>
                  <span className="min-w-0 font-medium text-zinc-900 dark:text-zinc-100">
                    {t.label}
                  </span>
                </div>
                <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <span>
                    {isCumulative ? (
                      t.points > 0 || t.wins > 0 ? (
                        <>
                          <span className="tabular-nums">{t.wins}</span> playoff win
                          {t.wins === 1 ? "" : "s"}
                          {t.points > 0 ? (
                            <>
                              {" "}
                              ·{" "}
                              <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                                {t.points} pt{t.points === 1 ? "" : "s"}
                              </span>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <>No wins yet</>
                      )
                    ) : t.wins >= 1 ? (
                      <>
                        <span className="tabular-nums">{t.wins}</span> win
                        {t.wins === 1 ? "" : "s"}
                        {t.points > 0 ? (
                          <>
                            {" "}
                            ·{" "}
                            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                              +{t.points} pt
                            </span>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>No wins</>
                    )}
                  </span>
                  {(() => {
                    const ev = projectedEvByPickKey?.get(pickKey(t.round, t.label));
                    if (ev == null || ev <= 0 || eliminated) return null;
                    return (
                      <span
                        className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.6rem] font-semibold tabular-nums text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/50"
                        title="Probability-weighted expected remaining wins (= remaining points)"
                      >
                        Proj +{formatOneDecimal(ev)}
                      </span>
                    );
                  })()}
                </span>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
