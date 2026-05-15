"use client";

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { CenteredLoading } from "@/components/centered-loading";

type ProjectionDayEntry = {
  date: string;
  rank: number;
  rankDelta: number | null;
  projectedFinal: number;
  projectedFinalDelta: number | null;
  totalToDate: number;
};

type ProjectionHistoryTeam = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
  history: ProjectionDayEntry[];
};

type EliminationEvent = {
  date: string;
  teamAbbrev: string;
};

type ProjectionHistoryPayload = {
  dates: string[];
  teams: ProjectionHistoryTeam[];
  eliminations: EliminationEvent[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === "string" ? err.error : "Request failed");
  }
  return res.json();
}

function chartColorForIndex(i: number, n: number): string {
  const h = ((i * 360) / Math.max(n, 1)) % 360;
  return `hsl(${Math.round(h)} 62% 52%)`;
}

const W = 800;
const H = 320;
const M = { top: 32, right: 16, bottom: 52, left: 36 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

function xAt(i: number, n: number): number {
  if (n <= 1) return M.left + PLOT_W / 2;
  return M.left + (i / (n - 1)) * PLOT_W;
}

function yAt(rank: number, totalRanks: number): number {
  return M.top + ((rank - 1) / Math.max(totalRanks - 1, 1)) * PLOT_H;
}

export function PoolProjectionHistory() {
  const query = useQuery({
    queryKey: ["pool-projection-history"],
    queryFn: () =>
      fetchJson<ProjectionHistoryPayload>("/api/pool/projection-history"),
    staleTime: 0,
  });

  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null);

  const colorByTeamId = useMemo(() => {
    const teams = query.data?.teams ?? [];
    return new Map(
      teams.map((t, i) => [t.teamId, chartColorForIndex(i, teams.length)]),
    );
  }, [query.data?.teams]);

  if (query.isLoading) {
    return (
      <CenteredLoading
        message="Loading projection history…"
        variant="section"
      />
    );
  }

  if (query.error instanceof Error) {
    return (
      <section
        className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50"
        role="alert"
      >
        {query.error.message}
      </section>
    );
  }

  if (!query.data || query.data.teams.length === 0) return null;

  const { dates, teams, eliminations = [] } = query.data;
  const totalRanks = teams.length;
  const dateToX = new Map(dates.map((d, i) => [d, xAt(i, dates.length)]));
  const displayTeams = focusedTeamId
    ? teams.filter((t) => t.teamId === focusedTeamId)
    : teams;

  const labelStep = dates.length > 14 ? Math.ceil(dates.length / 7) : 1;

  // Only show eliminations that happened after the first snapshot — earlier ones
  // were already eliminated before our tracking window and cause no visible rank shift.
  const firstDate = dates[0] ?? "";
  const visibleEliminations = eliminations.filter((e) => e.date > firstDate);

  // Group by date so we can stagger labels that share an x position.
  const eliminationsByDate = new Map<string, EliminationEvent[]>();
  for (const e of visibleEliminations) {
    const group = eliminationsByDate.get(e.date) ?? [];
    group.push(e);
    eliminationsByDate.set(e.date, group);
  }

  return (
    <section
      className="rounded-2xl bg-zinc-50/90 px-2 py-5 ring-1 ring-zinc-200/80 dark:bg-zinc-950/40 dark:ring-zinc-800/80 sm:px-4"
      aria-label="Projection rank history by pool team"
    >
      <div className="mb-4 px-2">
        <h2 className="font-pool-display text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Projected rank over time
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Each team's projected final-standings rank for every playoff day. Rank
          1 is at the top. Dashed lines mark NHL team eliminations. Click a name
          to isolate their trajectory.
        </p>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          className="mx-auto block max-h-[min(380px,70vh)] w-full min-w-[min(100%,520px)] text-zinc-400 dark:text-zinc-500"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Line chart of projected final rank for each pool team across playoff days"
        >
          <title>Projected rank over time</title>

          {/* Rank gridlines */}
          {Array.from({ length: totalRanks }, (_, i) => i + 1).map((rank) => {
            const y = yAt(rank, totalRanks);
            return (
              <g key={rank}>
                <line
                  x1={M.left}
                  x2={W - M.right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.18}
                  strokeWidth={1}
                />
                <text
                  x={M.left - 6}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-zinc-500 text-[11px] dark:fill-zinc-400"
                >
                  {rank}
                </text>
              </g>
            );
          })}

          {/* Axes */}
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

          {/* Elimination overlays — rendered before team lines so they sit behind */}
          {[...eliminationsByDate.entries()].map(([date, group]) => {
            const x = dateToX.get(date);
            if (x == null) return null;
            return (
              <g key={date}>
                <line
                  x1={x}
                  x2={x}
                  y1={M.top}
                  y2={H - M.bottom}
                  stroke="#f87171"
                  strokeOpacity={0.45}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                {group.map((e, labelIdx) => (
                  <text
                    key={e.teamAbbrev}
                    x={x + 3}
                    y={M.top - 4 - labelIdx * 12}
                    textAnchor="start"
                    className="fill-red-400 dark:fill-red-500"
                    style={{ fontSize: 9, fontWeight: 600 }}
                  >
                    {e.teamAbbrev}
                  </text>
                ))}
              </g>
            );
          })}

          {/* Team trajectory lines */}
          {displayTeams.map((team) => {
            const color = colorByTeamId.get(team.teamId) ?? "#888";
            const points = team.history.map((h) => ({
              x: dateToX.get(h.date) ?? 0,
              y: yAt(h.rank, totalRanks),
              date: h.date,
            }));
            const d = points
              .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
              .join(" ");
            return (
              <g key={team.teamId}>
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.92}
                />
                {points.map((p) => (
                  <circle
                    key={`${team.teamId}-${p.date}`}
                    cx={p.x}
                    cy={p.y}
                    r={3.25}
                    fill={color}
                    className="stroke-white dark:stroke-zinc-950"
                    strokeWidth={1}
                  />
                ))}
              </g>
            );
          })}

          {/* X-axis date labels */}
          {dates.map((d, i) => {
            const isFirst = i === 0;
            const isLast = i === dates.length - 1;
            if (!isFirst && !isLast && i % labelStep !== 0) return null;
            return (
              <text
                key={d}
                x={xAt(i, dates.length)}
                y={H - M.bottom + 20}
                textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
                className="fill-zinc-500 text-[10px] font-medium dark:fill-zinc-400"
              >
                {format(parseISO(d), "MMM d")}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <ul
        className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-2 text-[0.7rem]"
        aria-label="Chart legend"
      >
        {teams.map((t) => {
          const isFocused = focusedTeamId === t.teamId;
          const dimOthers = focusedTeamId !== null && !isFocused;
          const color = colorByTeamId.get(t.teamId) ?? "#888";
          const last = t.history.at(-1);
          const delta = last?.rankDelta ?? null;

          return (
            <li key={t.teamId}>
              <button
                type="button"
                aria-pressed={isFocused}
                onClick={() =>
                  setFocusedTeamId((id) =>
                    id === t.teamId ? null : t.teamId,
                  )
                }
                className={`inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left font-[inherit] transition hover:bg-zinc-200/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-400 dark:hover:bg-zinc-800/80 dark:focus-visible:outline-zinc-500 ${
                  isFocused
                    ? "font-semibold text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-600 dark:text-zinc-300"
                } ${dimOthers ? "opacity-45" : ""}`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="truncate">{t.name}</span>
                {last ? (
                  <span className="shrink-0 tabular-nums text-zinc-400 dark:text-zinc-500">
                    #{last.rank}
                    {delta !== null && delta !== 0 ? (
                      <span
                        className={
                          delta > 0
                            ? "ml-0.5 text-emerald-600 dark:text-emerald-400"
                            : "ml-0.5 text-red-500 dark:text-red-400"
                        }
                      >
                        {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
