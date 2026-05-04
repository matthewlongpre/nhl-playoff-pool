"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CenteredLoading } from "@/components/centered-loading";
import { formatGoalsAssistsCompact } from "@/lib/format-stats";
import type { BoxscoreResponse, SkaterBox } from "@/lib/nhl/schemas";

async function fetchBoxscore(gameId: number): Promise<BoxscoreResponse> {
  const res = await fetch(`/api/nhl/boxscore?gameId=${gameId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : "Failed to load box score",
    );
  }
  return res.json();
}

function collectSkaters(team: BoxscoreResponse["playerByGameStats"]["awayTeam"]) {
  return [...team.forwards, ...team.defense];
}

function scoringRows(home: SkaterBox[], away: SkaterBox[]) {
  const rows = [...home, ...away].filter((p) => p.goals > 0 || p.assists > 0);
  rows.sort((a, b) => {
    const ptsA = a.points ?? a.goals + a.assists;
    const ptsB = b.points ?? b.goals + b.assists;
    if (ptsB !== ptsA) return ptsB - ptsA;
    return b.goals - a.goals;
  });
  return rows;
}

function SkaterTable({
  title,
  players,
}: {
  title: string;
  players: SkaterBox[];
}) {
  if (players.length === 0) {
    return null;
  }
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h4>
      <ul
        className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800 md:hidden"
        role="list"
      >
        {players.map((p) => {
          const pts = p.points ?? p.goals + p.assists;
          return (
            <li key={p.playerId} className="px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-medium leading-snug">{p.name.default}</span>
                <span className="shrink-0 tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                  #{p.sweaterNumber ?? "—"}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                <span>{p.position}</span>
                <span>
                  G {p.goals}
                </span>
                <span>
                  A {p.assists}
                </span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">Pts {pts}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 hidden overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Player</th>
              <th className="px-3 py-2 font-medium">Pos</th>
              <th className="px-3 py-2 font-medium">G</th>
              <th className="px-3 py-2 font-medium">A</th>
              <th className="px-3 py-2 font-medium">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {players.map((p) => (
              <tr key={p.playerId} className="text-zinc-800 dark:text-zinc-200">
                <td className="px-3 py-1.5 tabular-nums text-zinc-500">
                  {p.sweaterNumber ?? "—"}
                </td>
                <td className="px-3 py-1.5">{p.name.default}</td>
                <td className="px-3 py-1.5">{p.position}</td>
                <td className="px-3 py-1.5 tabular-nums">{p.goals}</td>
                <td className="px-3 py-1.5 tabular-nums">{p.assists}</td>
                <td className="px-3 py-1.5 tabular-nums">
                  {p.points ?? p.goals + p.assists}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BoxScorePanel({ gameId }: { gameId: number }) {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ["nhl-boxscore", gameId],
    queryFn: () => fetchBoxscore(gameId),
  });

  const [showFull, setShowFull] = useState(false);

  const leaders = useMemo(() => {
    if (!data) return [];
    const home = collectSkaters(data.playerByGameStats.homeTeam);
    const away = collectSkaters(data.playerByGameStats.awayTeam);
    return scoringRows(home, away);
  }, [data]);

  if (isLoading) {
    return (
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <CenteredLoading
          message="Loading box score…"
          variant="compact"
          className="max-w-none py-12"
        />
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div className="border-t border-zinc-200 px-4 py-3 text-sm text-red-600 dark:border-zinc-800 dark:text-red-400">
        {error.message}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const homeSk = collectSkaters(data.playerByGameStats.homeTeam);
  const awaySk = collectSkaters(data.playerByGameStats.awayTeam);

  return (
    <div className="border-t border-zinc-200 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Box score
          {isFetching ? <span className="ml-2 text-zinc-400">Updating…</span> : null}
        </p>
        <button
          type="button"
          onClick={() => setShowFull((v) => !v)}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {showFull ? "Hide full skater stats" : "Show full skater stats"}
        </button>
      </div>

      {leaders.length > 0 ? (
        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Scoring
          </h4>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-800 dark:text-zinc-200">
            {leaders.map((p) => {
              const ga = formatGoalsAssistsCompact(p.goals, p.assists);
              const derived = p.goals + p.assists;
              const ptsExtra =
                p.points != null && p.points !== derived
                  ? ` · ${p.points} PTS`
                  : p.points == null && derived > 0
                    ? ` · ${derived} PTS`
                    : "";
              return (
                <li key={p.playerId} className="flex flex-wrap gap-x-2">
                  <span className="font-medium">{p.name.default}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {ga}
                    {ptsExtra}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          No goals or assists recorded yet.
        </p>
      )}

      {showFull ? (
        <>
          <SkaterTable
            title={`${data.awayTeam.abbrev} — skaters`}
            players={awaySk}
          />
          <SkaterTable
            title={`${data.homeTeam.abbrev} — skaters`}
            players={homeSk}
          />
        </>
      ) : null}
    </div>
  );
}
