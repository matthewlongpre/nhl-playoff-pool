"use client";

import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import type { PoolStandingsDayRow } from "@/lib/pool/compute-standings-for-date";
import type { DailyPointsSeriesPayload } from "@/lib/pool/daily-points-series";
import { sortStandingsRows } from "@/lib/pool/leaderboard-rank";

type Props = {
  data: DailyPointsSeriesPayload;
};

const W = 800;
const H = 300;
const M = { top: 12, right: 16, bottom: 52, left: 44 };

export function PoolDailyPointsChart({ data }: Props) {
  const { series, teams, dates, leaderboardMode } = data;
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null);
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  /** Same ordering as pool standings: cumulative points in this chart, then name. */
  const teamsStandingsOrder = useMemo(() => {
    const cumulative = new Map<string, number>();
    for (const t of teams) cumulative.set(t.teamId, 0);
    for (const row of series) {
      for (const t of teams) {
        cumulative.set(
          t.teamId,
          (cumulative.get(t.teamId) ?? 0) + (row.byTeamId[t.teamId] ?? 0),
        );
      }
    }
    const metaById = new Map(teams.map((t) => [t.teamId, t]));
    const rows: PoolStandingsDayRow[] = teams.map((t) => {
      const totalPoints = cumulative.get(t.teamId) ?? 0;
      return {
        teamId: t.teamId,
        name: t.name,
        ownerName: t.ownerName,
        ...(t.ownerAvatar ? { ownerAvatar: t.ownerAvatar } : {}),
        totalPoints,
        skaterPoints: 0,
        teamWinPoints: 0,
      };
    });
    return sortStandingsRows(rows).map((r) => metaById.get(r.teamId)!);
  }, [teams, series]);

  const displayTeams = useMemo(
    () =>
      focusedTeamId
        ? teamsStandingsOrder.filter((t) => t.teamId === focusedTeamId)
        : teamsStandingsOrder,
    [teamsStandingsOrder, focusedTeamId],
  );

  const maxY = useMemo(() => {
    let m = 5;
    for (const row of series) {
      for (const t of teams) {
        const v = row.byTeamId[t.teamId] ?? 0;
        if (v > m) m = v;
      }
    }
    return m;
  }, [series, teams]);

  if (series.length === 0) {
    return (
      <section
        className="rounded-2xl bg-zinc-50/90 px-4 py-6 ring-1 ring-zinc-200/80 dark:bg-zinc-950/40 dark:ring-zinc-800/80 sm:px-6"
        aria-label="Daily fantasy points chart"
      >
        <h2 className="font-pool-display text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Points per playoff day
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {leaderboardMode === "single_day_fallback"
            ? "Daily history needs persisted scoring (database). Once games are on the board, today’s points will show here."
            : "No fantasy points yet for days with games — check back after the next slate."}
        </p>
      </section>
    );
  }

  function xAt(i: number): number {
    const n = dates.length;
    if (n <= 1) return M.left + plotW / 2;
    return M.left + (i / (n - 1)) * plotW;
  }

  function yAt(v: number): number {
    return M.top + plotH - (v / maxY) * plotH;
  }

  const yTicks = pickYTicks(maxY);

  return (
    <section
      className="rounded-2xl bg-zinc-50/90 px-2 py-5 ring-1 ring-zinc-200/80 dark:bg-zinc-950/40 dark:ring-zinc-800/80 sm:px-4"
      aria-label="Daily fantasy points by pool team"
    >
      <div className="mb-4 px-2 sm:px-2">
        <h2 className="font-pool-display text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Points per playoff day
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Fantasy points earned on each day there was a playoff slate (skaters + team
          wins). Click a legend entry to show only that team; click it again to show
          everyone.
        </p>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          className="mx-auto block max-h-[min(360px,70vh)] w-full min-w-[min(100%,520px)] text-zinc-400 dark:text-zinc-500"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Line chart of daily fantasy points for each pool team across playoff dates"
        >
          <title>Daily fantasy points by pool team</title>

          {yTicks.map((tick) => {
            const y = yAt(tick);
            return (
              <g key={tick}>
                <line
                  x1={M.left}
                  x2={W - M.right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.22}
                  strokeWidth={1}
                />
                <text
                  x={M.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-zinc-500 text-[11px] dark:fill-zinc-400"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <line
            x1={M.left}
            x2={M.left}
            y1={M.top}
            y2={H - M.bottom}
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeWidth={1}
          />
          <line
            x1={M.left}
            x2={W - M.right}
            y1={H - M.bottom}
            y2={H - M.bottom}
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeWidth={1}
          />

          {displayTeams.map((team) => {
            const pts = series.map((row, i) => {
              const v = row.byTeamId[team.teamId] ?? 0;
              return { i, v, x: xAt(i), y: yAt(v) };
            });
            const dPath = pts
              .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
              .join(" ");
            return (
              <g key={team.teamId}>
                <path
                  d={dPath}
                  fill="none"
                  stroke={team.chartColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.92}
                />
                {pts.map((p) => (
                  <circle
                    key={`${team.teamId}-${p.i}`}
                    cx={p.x}
                    cy={p.y}
                    r={3.25}
                    fill={team.chartColor}
                    className="stroke-white dark:stroke-zinc-950"
                    strokeWidth={1}
                  />
                ))}
              </g>
            );
          })}

          {dates.map((d, i) => (
            <text
              key={d}
              x={xAt(i)}
              y={H - M.bottom + 20}
              textAnchor={dates.length === 1 ? "middle" : i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"}
              className="fill-zinc-500 text-[10px] font-medium dark:fill-zinc-400"
            >
              {format(parseISO(d), "MMM d")}
            </text>
          ))}
        </svg>
      </div>

      <ul
        className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-2 text-[0.7rem] sm:px-2"
        aria-label="Chart legend"
      >
        {teamsStandingsOrder.map((t) => {
          const isFocused = focusedTeamId === t.teamId;
          const dimOthers = focusedTeamId !== null && !isFocused;
          return (
            <li key={t.teamId} className="min-w-0">
              <button
                type="button"
                aria-pressed={isFocused}
                aria-label={
                  isFocused
                    ? `${t.name}, showing only this team. Click to show all teams.`
                    : `Show only ${t.name}`
                }
                onClick={() =>
                  setFocusedTeamId((id) => (id === t.teamId ? null : t.teamId))
                }
                className={`inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left font-[inherit] transition hover:bg-zinc-200/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-400 dark:hover:bg-zinc-800/80 dark:focus-visible:outline-zinc-500 ${
                  isFocused
                    ? "font-semibold text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-600 dark:text-zinc-300"
                } ${dimOthers ? "opacity-45" : ""}`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: t.chartColor }}
                  aria-hidden
                />
                <span className="truncate">{t.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function pickYTicks(maxY: number): number[] {
  if (maxY <= 0) return [0];
  const divisions = 4;
  const out = new Set<number>();
  for (let i = 0; i <= divisions; i++) {
    out.add(Math.round((maxY * i) / divisions));
  }
  return [...out].sort((a, b) => a - b);
}
