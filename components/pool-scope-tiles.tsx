"use client";

import { format, parseISO } from "date-fns";
import Image from "next/image";
import { useState } from "react";
import type { ReactNode } from "react";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { OwnerAvatarImage } from "@/components/owner-avatar-image";
import {
  nhlPlayerHeadshotUrl,
  nhlTeamLogoLightSvgUrl,
} from "@/lib/nhl/media";
import { ownerAvatarSrc } from "@/lib/pool/owner-avatar";
import type { ScopeSummary } from "@/lib/pool/scope-summary";

function formatShortDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d");
  } catch {
    return iso;
  }
}

function formatLongDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

type TileMeta = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
};

function OwnerChip({ meta, size = 28 }: { meta: TileMeta; size?: number }) {
  const px = `${size}px`;
  return (
    <div className="flex min-w-0 items-center gap-2">
      {ownerAvatarSrc(meta.ownerAvatar) ? (
        <div
          className="relative shrink-0 overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950"
          style={{ width: px, height: px }}
        >
          <OwnerAvatarImage
            filename={meta.ownerAvatar}
            width={size}
            height={size}
            className="h-full w-full object-cover object-top"
          />
        </div>
      ) : (
        <div
          className="shrink-0 rounded-full bg-zinc-200/80 dark:bg-zinc-800"
          style={{ width: px, height: px }}
        />
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {meta.name}
        </div>
        <div className="truncate text-[0.7rem] text-zinc-500 dark:text-zinc-400">
          {meta.ownerName}
        </div>
      </div>
    </div>
  );
}

function TeamLogoBadge({
  teamAbbrev,
  size = 22,
}: {
  teamAbbrev: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <NhleTeamLogoImage
        src={nhlTeamLogoLightSvgUrl(teamAbbrev)}
        width={size}
        height={size}
        alt=""
      />
    </span>
  );
}

function PlayerHeadshot({
  nhlPlayerId,
  label,
  size = 44,
}: {
  nhlPlayerId: number;
  label: string;
  size?: number;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950"
      style={{ width: size, height: size }}
    >
      <Image
        src={nhlPlayerHeadshotUrl(nhlPlayerId)}
        alt={label}
        width={size}
        height={size}
        className="h-full w-full object-cover object-top"
        unoptimized
      />
    </div>
  );
}

type TileProps = {
  label: string;
  hero: ReactNode;
  heroUnit?: string;
  children?: ReactNode;
};

function Tile({ label, hero, heroUnit, children }: TileProps) {
  return (
    <div className="flex min-h-[6.25rem] w-full flex-col self-stretch rounded-2xl bg-white px-4 py-3 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08]">
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-3">
        <div className="flex min-h-0 min-w-0 flex-col justify-start gap-2">
          <p className="text-[0.65rem] font-bold uppercase leading-none tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          {children ? (
            <div className="flex flex-col gap-2 text-[0.78rem] leading-snug text-zinc-600 dark:text-zinc-300">
              {children}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end justify-center gap-1 self-stretch leading-none">
          <span className="font-pool-display text-3xl font-semibold leading-none tracking-tight text-zinc-900 dark:text-zinc-50">
            {hero}
          </span>
          {heroUnit ? (
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              {heroUnit}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TileEmpty({ label, message }: { label: string; message: string }) {
  return (
    <div className="flex min-h-[6.25rem] w-full flex-col gap-2 self-stretch rounded-2xl bg-white px-4 py-3 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08]">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="my-auto text-sm text-zinc-500 dark:text-zinc-400">
        {message}
      </p>
    </div>
  );
}

function emptyMessage(scope: ScopeSummary, fallback: string): string {
  if (scope.scope !== "all" && scope.status === "upcoming") {
    return "Round hasn't started.";
  }
  return fallback;
}

function tieBadge(count: number) {
  if (count <= 1) return null;
  return (
    <p className="text-[0.65rem] font-semibold tracking-tight text-amber-800/90 dark:text-amber-400/90">
      {count}-way tie
    </p>
  );
}

function teamDayBreakdown(skaterPoints: number, teamWinPoints: number): string {
  return skaterPoints > 0 && teamWinPoints > 0
    ? `${skaterPoints} G+A · ${teamWinPoints} team-win`
    : skaterPoints > 0
      ? `${skaterPoints} G+A`
      : `${teamWinPoints} team-win`;
}

function TopPoolTeamTile({ scope }: { scope: ScopeSummary }) {
  const teams = scope.topPoolTeams;
  const label =
    scope.scope === "all"
      ? "Top team"
      : scope.status === "complete"
        ? "Round winner"
        : "Round leader";
  if (teams.length === 0) {
    return <TileEmpty label={label} message={emptyMessage(scope, "No scoring yet.")} />;
  }
  const heroPts = teams[0].totalPoints;
  return (
    <Tile label={label} hero={heroPts} heroUnit="pts">
      <div className="flex flex-col gap-2">
        {tieBadge(teams.length)}
        {teams.map((t) => (
          <div
            key={t.teamId}
            className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <OwnerChip meta={t} size={32} />
            </div>
            <p className="shrink-0 text-[0.7rem] tabular-nums leading-snug text-zinc-500 sm:max-w-[48%] sm:text-right dark:text-zinc-400">
              {teamDayBreakdown(t.skaterPoints, t.teamWinPoints)}
            </p>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function TopTeamWinTile({ scope }: { scope: ScopeSummary }) {
  const teams = scope.topTeamWinTeams ?? [];
  if (teams.length === 0) {
    return (
      <TileEmpty label="Team wins" message={emptyMessage(scope, "No team wins yet.")} />
    );
  }
  const heroPts = teams[0].teamWinPoints;
  return (
    <Tile label="Team wins" hero={heroPts} heroUnit="pts">
      <div className="flex flex-col gap-2">
        {tieBadge(teams.length)}
        {teams.map((t) => (
          <div
            key={t.teamId}
            className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <OwnerChip meta={t} size={32} />
            </div>
            <p className="shrink-0 text-[0.7rem] tabular-nums leading-snug text-zinc-500 sm:max-w-[48%] sm:text-right dark:text-zinc-400">
              {teamDayBreakdown(t.skaterPoints, t.teamWinPoints)}
            </p>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function BiggestDayTile({ scope }: { scope: ScopeSummary }) {
  const days = scope.biggestDays;
  if (days.length === 0) {
    return (
      <TileEmpty
        label="Biggest day"
        message={emptyMessage(scope, "No scoring days yet.")}
      />
    );
  }
  const heroPts = days[0].totalPoints;
  return (
    <Tile label="Biggest day" hero={heroPts} heroUnit="pts">
      <div className="flex flex-col gap-2">
        {tieBadge(days.length)}
        {days.map((d) => (
          <div
            key={d.teamId}
            className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <OwnerChip meta={d} size={32} />
            </div>
            <p className="shrink-0 text-[0.7rem] tabular-nums leading-snug text-zinc-500 sm:max-w-[48%] sm:text-right dark:text-zinc-400">
              {formatLongDate(d.date)} · {teamDayBreakdown(d.skaterPoints, d.teamWinPoints)}
            </p>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function MvpSkaterTile({ scope }: { scope: ScopeSummary }) {
  const m = scope.mvpSkater;
  const label = scope.scope === "all" ? "MVP skater" : "Round MVP";
  if (!m) {
    return (
      <TileEmpty label={label} message={emptyMessage(scope, "Awaiting goals.")} />
    );
  }
  return (
    <Tile label={label} hero={m.points} heroUnit="g+a">
      <div className="flex items-center gap-2.5">
        <PlayerHeadshot nhlPlayerId={m.nhlPlayerId} label={m.label} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {m.label}
            </span>
            {m.nhlTeamAbbrev ? (
              <TeamLogoBadge teamAbbrev={m.nhlTeamAbbrev} size={18} />
            ) : null}
          </div>
          <div className="text-[0.7rem] tabular-nums text-zinc-500 dark:text-zinc-400">
            {m.goals} G · {m.assists} A · owned by {m.owners.length}{" "}
            {m.owners.length === 1 ? "team" : "teams"}
          </div>
        </div>
      </div>
    </Tile>
  );
}

function BestSingleGameTile({ scope }: { scope: ScopeSummary }) {
  const g = scope.bestSingleGame;
  if (!g) {
    return (
      <TileEmpty
        label="Best single game"
        message={emptyMessage(scope, "No multi-point nights yet.")}
      />
    );
  }
  return (
    <Tile label="Best single game" hero={g.points} heroUnit="pts">
      <div className="flex items-center gap-2.5">
        <PlayerHeadshot nhlPlayerId={g.nhlPlayerId} label={g.label} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {g.label}
            </span>
            {g.nhlTeamAbbrev ? (
              <TeamLogoBadge teamAbbrev={g.nhlTeamAbbrev} size={18} />
            ) : null}
          </div>
          <div className="text-[0.7rem] tabular-nums text-zinc-500 dark:text-zinc-400">
            {formatShortDate(g.date)} · {g.goals} G · {g.assists} A · {g.owners.length}{" "}
            {g.owners.length === 1 ? "owner" : "owners"}
          </div>
        </div>
      </div>
    </Tile>
  );
}

function DaysAtTopTile({ scope }: { scope: ScopeSummary }) {
  const leaders = scope.daysAtTop;
  if (leaders.length === 0 || leaders[0].days <= 0) {
    return (
      <TileEmpty
        label="Days at #1"
        message={emptyMessage(scope, "No leader yet.")}
      />
    );
  }
  const dayCount = leaders[0].days;
  return (
    <Tile
      label="Days at #1"
      hero={dayCount}
      heroUnit={dayCount === 1 ? "day" : "days"}
    >
      <div className="flex flex-col gap-2">
        {tieBadge(leaders.length)}
        {leaders.map((top) => (
          <OwnerChip key={top.teamId} meta={top} size={32} />
        ))}
      </div>
    </Tile>
  );
}

const LEAD_CHANGE_AVATAR_MAX = 5;
const LEAD_CHANGE_AVATAR_PX = 26;

function LeadChangeLeaderAvatars({ leaders }: { leaders: TileMeta[] }) {
  if (leaders.length === 0) return null;
  const shown = leaders.slice(0, LEAD_CHANGE_AVATAR_MAX);
  const extra = leaders.length - shown.length;
  const px = LEAD_CHANGE_AVATAR_PX;
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1"
      aria-label={`${leaders.length} distinct ${leaders.length === 1 ? "leader" : "leaders"} at number one`}
    >
      <div className="flex items-center pr-0.5">
        <div className="flex items-center -space-x-2">
          {shown.map((m, i) => (
            <div
              key={m.teamId}
              className="relative shrink-0"
              style={{ zIndex: i }}
              title={`${m.name} · ${m.ownerName}`}
            >
              {ownerAvatarSrc(m.ownerAvatar) ? (
                <div
                  className="relative overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950"
                  style={{ width: px, height: px }}
                >
                  <OwnerAvatarImage
                    filename={m.ownerAvatar}
                    width={px}
                    height={px}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
              ) : (
                <div
                  className="rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950"
                  style={{ width: px, height: px }}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      {extra > 0 ? (
        <span className="text-[0.65rem] font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
          +{extra} other{extra === 1 ? "" : "s"}
        </span>
      ) : null}
    </div>
  );
}

function LeadChangesTile({ scope }: { scope: ScopeSummary }) {
  return (
    <Tile
      label="Lead changes"
      hero={scope.leadChanges}
      heroUnit={scope.leadChanges === 1 ? "swap" : "swaps"}
    >
      <p className="text-pretty">
        Distinct top-team transitions across {scope.daysCovered}{" "}
        {scope.daysCovered === 1 ? "day" : "days"}.
      </p>
      <LeadChangeLeaderAvatars leaders={scope.leadChangeLeaders} />
    </Tile>
  );
}

function LongestRunAtTopTile({ scope }: { scope: ScopeSummary }) {
  const streaks = scope.longestRunsAtTop;
  if (streaks.length === 0) {
    return (
      <TileEmpty
        label="Longest run at #1"
        message={emptyMessage(scope, "No #1 streaks yet.")}
      />
    );
  }
  const heroDays = streaks[0].days;
  return (
    <Tile
      label="Longest run at #1"
      hero={heroDays}
      heroUnit={heroDays === 1 ? "day" : "days"}
    >
      <div className="flex flex-col gap-2">
        {tieBadge(streaks.length)}
        {streaks.map((s) => (
          <div
            key={s.teamId}
            className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <OwnerChip meta={s} size={32} />
            </div>
            <p className="shrink-0 text-[0.7rem] tabular-nums leading-snug text-zinc-500 sm:max-w-[48%] sm:text-right dark:text-zinc-400">
              {formatShortDate(s.fromDate)} → {formatShortDate(s.toDate)}
            </p>
          </div>
        ))}
      </div>
    </Tile>
  );
}

function BiggestMoverTile({ scope }: { scope: ScopeSummary }) {
  const movers = scope.biggestMovers;
  if (movers.length === 0) {
    return (
      <TileEmpty
        label="Biggest jump"
        message={emptyMessage(scope, "No rank moves yet.")}
      />
    );
  }
  const jump = movers[0].jump;
  return (
    <Tile
      label="Biggest jump"
      hero={`+${jump}`}
      heroUnit={jump === 1 ? "spot" : "spots"}
    >
      <div className="flex flex-col gap-2">
        {tieBadge(movers.length)}
        {movers.map((m) => (
          <div
            key={`${m.teamId}-${m.date}`}
            className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <OwnerChip meta={m} size={32} />
            </div>
            <p className="shrink-0 text-[0.7rem] tabular-nums leading-snug text-zinc-500 sm:max-w-[48%] sm:text-right dark:text-zinc-400">
              {formatLongDate(m.date)} · #{m.fromRank} → #{m.toRank}
            </p>
          </div>
        ))}
      </div>
    </Tile>
  );
}

const BEST_PICK_DEFAULT_VISIBLE = 6;

function BestPickPerRoundTile({ scope }: { scope: ScopeSummary }) {
  const [showAll, setShowAll] = useState(false);
  const rounds = scope.bestPickPerRound;
  if (rounds.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-4 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08]">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          Best pick per box
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {emptyMessage(scope, "Awaiting playoff scoring.")}
        </p>
      </div>
    );
  }
  const sorted = [...rounds].sort((a, b) => b.points - a.points || a.round - b.round);
  const visible = showAll ? sorted : sorted.slice(0, BEST_PICK_DEFAULT_VISIBLE);
  const showToggle = sorted.length > BEST_PICK_DEFAULT_VISIBLE;
  return (
    <div className="rounded-2xl bg-white px-4 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          Best pick per box
        </p>
        <p className="text-[0.65rem] tabular-nums text-zinc-500 dark:text-zinc-400">
          {sorted.length} {sorted.length === 1 ? "box" : "boxes"}
        </p>
      </div>
      <ul
        className="mt-3 divide-y divide-zinc-200/80 dark:divide-zinc-800/80"
        role="list"
      >
        {visible.map((r) => {
          const ownerSummary =
            r.totalRoundPicks > 0
              ? `${r.ownerCount}/${r.totalRoundPicks} owners`
              : `${r.ownerCount} owner${r.ownerCount === 1 ? "" : "s"}`;
          return (
            <li
              key={`${r.round}-${r.nhlPlayerId}`}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <PlayerHeadshot
                nhlPlayerId={r.nhlPlayerId}
                label={r.label}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {r.label}
                  </span>
                  {r.nhlTeamAbbrev ? (
                    <TeamLogoBadge teamAbbrev={r.nhlTeamAbbrev} size={16} />
                  ) : null}
                </div>
                <div className="truncate text-[0.7rem] text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">
                    Box {r.round}
                  </span>
                  <span
                    className="text-zinc-400/80 dark:text-zinc-500/80"
                    aria-hidden="true"
                  >
                    {" · "}
                  </span>
                  <span className="truncate">{r.title}</span>
                  <span
                    className="text-zinc-400/80 dark:text-zinc-500/80"
                    aria-hidden="true"
                  >
                    {" · "}
                  </span>
                  <span className="tabular-nums">{ownerSummary}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-pool-display text-lg font-semibold leading-none tabular-nums text-zinc-900 dark:text-zinc-50">
                  {r.points}
                </div>
                <div className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  pts
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {showToggle ? (
        <button
          type="button"
          className="mt-3 w-full rounded-full bg-zinc-100 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-zinc-700 transition-colors hover:bg-zinc-200/90 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show top picks" : `Show all ${sorted.length} boxes`}
        </button>
      ) : null}
    </div>
  );
}

export function ScopeSubHeader({ scope }: { scope: ScopeSummary }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <div className="flex items-center gap-2">
        <h3 className="font-pool-display text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {scope.label}
        </h3>
        {scope.scope !== "all" && scope.status === "active" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            Live
          </span>
        ) : null}
        {scope.scope !== "all" && scope.status === "complete" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300">
            Complete
          </span>
        ) : null}
      </div>
      <div className="text-[0.7rem] tabular-nums text-zinc-500 dark:text-zinc-400">
        <ScopeDateRange scope={scope} />
        {scope.daysCovered > 0 ? (
          <>
            <span
              className="text-zinc-400/80 dark:text-zinc-500/80"
              aria-hidden="true"
            >
              {" · "}
            </span>
            {scope.daysCovered}{" "}
            {scope.daysCovered === 1 ? "day" : "days"}
          </>
        ) : null}
      </div>
    </div>
  );
}

function ScopeDateRange({ scope }: { scope: ScopeSummary }) {
  if (!scope.startDate) return null;
  const start = formatShortDate(scope.startDate);
  const end =
    scope.endDate && scope.endDate !== scope.startDate
      ? formatShortDate(scope.endDate)
      : null;
  return (
    <span className="tabular-nums">
      {start}
      {end ? ` → ${end}` : ""}
    </span>
  );
}

/**
 * Stat-tile grid + sub-header for a single scope ("all" or a Stanley Cup round).
 * Same shape rendered on every tab — only the data window differs.
 */
export function PoolScopeTiles({
  scope,
  poolPlayerStatsAvailable,
  ariaLabelledBy,
}: {
  scope: ScopeSummary;
  poolPlayerStatsAvailable: boolean;
  /** ID of the heading describing this tab panel (for `aria-labelledby`). */
  ariaLabelledBy?: string;
}) {
  return (
    <div
      id={`pool-review-panel-${scope.scope}`}
      role="tabpanel"
      {...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {})}
      className="relative z-0 flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TopPoolTeamTile scope={scope} />
        <TopTeamWinTile scope={scope} />
        <BiggestDayTile scope={scope} />
        {poolPlayerStatsAvailable ? <MvpSkaterTile scope={scope} /> : null}
        {poolPlayerStatsAvailable ? <BestSingleGameTile scope={scope} /> : null}
        <DaysAtTopTile scope={scope} />
        <LeadChangesTile scope={scope} />
        <LongestRunAtTopTile scope={scope} />
        <BiggestMoverTile scope={scope} />
      </div>

      {poolPlayerStatsAvailable ? <BestPickPerRoundTile scope={scope} /> : null}
    </div>
  );
}
