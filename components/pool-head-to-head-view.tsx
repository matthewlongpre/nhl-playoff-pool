"use client";

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { CenteredLoading } from "@/components/centered-loading";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { NhlTeamLogoEliminatedWrap } from "@/components/nhl-team-logo-eliminated-wrap";
import { OwnerAvatarImage } from "@/components/owner-avatar-image";
import { PoolSiteChrome } from "@/components/pool-site-chrome";
import { nhlPlayerHeadshotUrl, nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";
import type { NhlTeamPlayoffStatus } from "@/lib/nhl/schemas";
import { ownerAvatarSrc } from "@/lib/pool/owner-avatar";
import { loadStaticPoolSkaterDisplayNameById } from "@/lib/pool/pool-skater-display-names";
import { skaterEyebrowAndPrimary } from "@/lib/pool/skater-display-name";
import type { DailyPointsSeriesPayload } from "@/lib/pool/daily-points-series";
import type { TeamScoreBreakdown } from "@/lib/pool/scoring";

const skaterDisplayNameById = loadStaticPoolSkaterDisplayNameById();

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamSummary = {
  id: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
};

type TeamPayload = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
  rank: number;
  rankPrev: number | null;
  rankDelta: number | null;
  totalPoints: number;
  skaterPoints: number;
  teamWinPoints: number;
  pointsBehindLeader: number;
  breakdown: TeamScoreBreakdown | null;
};

type H2HApiResponse = {
  asOfDate: string;
  compareThroughPrevCalendarDay: string | null;
  leaderboardMode: "cumulative" | "single_day_fallback";
  teamA: TeamPayload;
  teamB: TeamPayload;
  teamStatusByAbbrev: Record<string, NhlTeamPlayoffStatus>;
};

type UnifiedPick =
  | {
      kind: "skater";
      round: number;
      label: string;
      points: number;
      goals: number;
      assists: number;
      nhlPlayerId: number | null;
      nhlTeamAbbrev?: string;
      position?: "F" | "D";
    }
  | {
      kind: "team";
      round: number;
      label: string;
      points: number;
      wins: number;
      teamAbbrev: string;
    };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === "string" ? err.error : "Request failed");
  }
  return res.json();
}

function buildPicksByRound(breakdown: TeamScoreBreakdown): Map<number, UnifiedPick> {
  const m = new Map<number, UnifiedPick>();
  for (const s of breakdown.skaterDetail) {
    m.set(s.round, { kind: "skater", ...s });
  }
  for (const t of breakdown.teamDetail) {
    m.set(t.round, { kind: "team", ...t });
  }
  return m;
}

function delta(a: number, b: number): number {
  return a - b;
}

function fmtDelta(d: number): string {
  if (d === 0) return "—";
  return d > 0 ? `+${d}` : `${d}`;
}

function deltaColorClass(d: number, reverse = false): string {
  if (d === 0) return "text-zinc-400 dark:text-zinc-500";
  const positive = reverse ? d < 0 : d > 0;
  return positive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-500 dark:text-rose-400";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RankDelta({ delta: d }: { delta: number | null }) {
  if (d == null || d === 0) return null;
  return d > 0 ? (
    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
      ↑{d}
    </span>
  ) : (
    <span className="text-xs font-semibold text-rose-500 dark:text-rose-400">
      ↓{Math.abs(d)}
    </span>
  );
}

function TeamCard({
  team,
  isWinner,
  side,
}: {
  team: TeamPayload;
  isWinner: boolean;
  side: "left" | "right";
}) {
  const alignClass = side === "left" ? "items-start text-left" : "items-end text-right";
  const avatarOrder = side === "right" ? "order-last sm:order-first" : "";

  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-2 ${alignClass}`}>
      <div
        className={`flex min-w-0 items-center gap-3 ${side === "right" ? "flex-row-reverse sm:flex-row" : ""}`}
      >
        {ownerAvatarSrc(team.ownerAvatar) ? (
          <div
            className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950 ${avatarOrder} ${isWinner ? "ring-amber-400/60 dark:ring-amber-400/40" : ""}`}
          >
            <OwnerAvatarImage
              filename={team.ownerAvatar}
              width={48}
              height={48}
              className="h-12 w-12 object-cover object-top"
            />
          </div>
        ) : null}
        <div className={`min-w-0 ${side === "right" ? "sm:text-left" : ""}`}>
          <p className="truncate font-pool-display text-lg font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
            {team.name}
          </p>
          <p className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {team.ownerName}
          </p>
        </div>
      </div>

      <div className={`flex items-baseline gap-2 ${side === "right" ? "flex-row-reverse sm:flex-row" : ""}`}>
        <span
          className={`font-pool-display text-4xl font-semibold tabular-nums leading-none ${
            isWinner ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {team.totalPoints}
        </span>
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          pts
        </span>
        {isWinner ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/50">
            Ahead
          </span>
        ) : null}
      </div>

      <div
        className={`flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 ${side === "right" ? "flex-row-reverse sm:flex-row" : ""}`}
      >
        <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
          #{team.rank}
        </span>
        <RankDelta delta={team.rankDelta} />
        <span className="text-zinc-400 dark:text-zinc-600" aria-hidden>·</span>
        <span className="tabular-nums">{team.skaterPoints} sk · {team.teamWinPoints} tm</span>
      </div>
    </div>
  );
}

function MatchupBanner({
  teamA,
  teamB,
}: {
  teamA: TeamPayload;
  teamB: TeamPayload;
}) {
  const diff = teamA.totalPoints - teamB.totalPoints;
  const aWins = diff > 0;
  const tied = diff === 0;

  return (
    <div className="rounded-2xl bg-white px-5 py-5 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08]">
      <div className="flex min-w-0 items-center gap-4">
        <TeamCard team={teamA} isWinner={aWins && !tied} side="left" />

        <div className="flex shrink-0 flex-col items-center gap-1">
          <span className="font-pool-display text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {tied ? (
              <span className="text-zinc-500 dark:text-zinc-400">Tied</span>
            ) : (
              <span
                className={diff > 0 ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}
              >
                {Math.abs(diff)}
              </span>
            )}
          </span>
          {!tied && (
            <span className="text-[0.55rem] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
              ahead
            </span>
          )}
          <span
            className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500"
            aria-hidden
          >
            vs
          </span>
        </div>

        <TeamCard team={teamB} isWinner={!aWins && !tied} side="right" />
      </div>
    </div>
  );
}

function StatRow({
  label,
  valA,
  valB,
  format: fmt = (n: number) => String(n),
}: {
  label: string;
  valA: number;
  valB: number;
  format?: (n: number) => string;
}) {
  const d = delta(valA, valB);
  return (
    <div className="flex items-center gap-3 py-2.5 text-sm">
      <span className="w-[5.5rem] shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span
        className={`w-10 shrink-0 text-right font-pool-display font-semibold tabular-nums leading-none ${
          d > 0
            ? "text-zinc-900 dark:text-zinc-50"
            : d < 0
              ? "text-zinc-500 dark:text-zinc-400"
              : "text-zinc-700 dark:text-zinc-300"
        }`}
      >
        {fmt(valA)}
      </span>
      <span
        className={`flex-1 text-center text-xs font-semibold tabular-nums ${deltaColorClass(d)}`}
      >
        {fmtDelta(d)}
      </span>
      <span
        className={`w-10 shrink-0 text-left font-pool-display font-semibold tabular-nums leading-none ${
          d < 0
            ? "text-zinc-900 dark:text-zinc-50"
            : d > 0
              ? "text-zinc-500 dark:text-zinc-400"
              : "text-zinc-700 dark:text-zinc-300"
        }`}
      >
        {fmt(valB)}
      </span>
      <span className="w-[5.5rem] shrink-0 text-right text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
        &nbsp;
      </span>
    </div>
  );
}

function ScoreSummaryCard({
  teamA,
  teamB,
}: {
  teamA: TeamPayload;
  teamB: TeamPayload;
}) {
  return (
    <section
      className="rounded-2xl bg-white px-5 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08]"
      aria-label="Score summary"
    >
      <div className="mb-1 flex items-center">
        <span className="w-[5.5rem] shrink-0" />
        <span className="w-10 shrink-0 text-right text-[0.6rem] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          {teamA.name.split(" ")[0]}
        </span>
        <span className="flex-1" />
        <span className="w-10 shrink-0 text-left text-[0.6rem] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          {teamB.name.split(" ")[0]}
        </span>
        <span className="w-[5.5rem] shrink-0" />
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
        <StatRow label="Total" valA={teamA.totalPoints} valB={teamB.totalPoints} />
        <StatRow label="Skater pts" valA={teamA.skaterPoints} valB={teamB.skaterPoints} />
        <StatRow label="Team wins" valA={teamA.teamWinPoints} valB={teamB.teamWinPoints} />
      </div>
    </section>
  );
}

function DailyScoresSection({
  series,
  teamIdA,
  teamIdB,
  nameA,
  nameB,
}: {
  series: DailyPointsSeriesPayload;
  teamIdA: string;
  teamIdB: string;
  nameA: string;
  nameB: string;
}) {
  const gameDays = useMemo(
    () =>
      series.series.filter(
        (row) =>
          (row.byTeamId[teamIdA] ?? 0) > 0 || (row.byTeamId[teamIdB] ?? 0) > 0,
      ),
    [series.series, teamIdA, teamIdB],
  );

  if (gameDays.length === 0) {
    return (
      <section aria-labelledby="h2h-daily-heading">
        <h2
          id="h2h-daily-heading"
          className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          Daily scores
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          No scoring days yet.
        </p>
      </section>
    );
  }

  const shortNameA = nameA.split(" ")[0] ?? nameA;
  const shortNameB = nameB.split(" ")[0] ?? nameB;

  const totalDiff = gameDays.reduce((acc, row) => {
    const a = row.byTeamId[teamIdA] ?? 0;
    const b = row.byTeamId[teamIdB] ?? 0;
    return acc + (a - b);
  }, 0);
  const aDaysWon = gameDays.filter(
    (r) => (r.byTeamId[teamIdA] ?? 0) > (r.byTeamId[teamIdB] ?? 0),
  ).length;
  const bDaysWon = gameDays.filter(
    (r) => (r.byTeamId[teamIdB] ?? 0) > (r.byTeamId[teamIdA] ?? 0),
  ).length;
  const tiedDays = gameDays.length - aDaysWon - bDaysWon;

  return (
    <section
      className="rounded-2xl bg-white px-5 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08]"
      aria-labelledby="h2h-daily-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id="h2h-daily-heading"
          className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          Daily scores
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {aDaysWon > bDaysWon ? (
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {shortNameA} won {aDaysWon}
            </span>
          ) : bDaysWon > aDaysWon ? (
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {shortNameB} won {bDaysWon}
            </span>
          ) : (
            <span>Even</span>
          )}
          {" · "}
          {aDaysWon}-{bDaysWon}
          {tiedDays > 0 ? `-${tiedDays}` : ""}
          {" days"}
          {totalDiff !== 0 && (
            <>
              {" · "}
              <span
                className={
                  totalDiff > 0
                    ? "font-semibold text-emerald-600 dark:text-emerald-400"
                    : "font-semibold text-rose-500 dark:text-rose-400"
                }
              >
                {fmtDelta(totalDiff)} overall
              </span>
            </>
          )}
        </p>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <thead>
            <tr className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              <th className="pb-1.5 text-left font-bold">Date</th>
              <th className="pb-1.5 pr-2 text-right font-bold">{shortNameA}</th>
              <th className="pb-1.5 px-2 text-center font-bold">vs</th>
              <th className="pb-1.5 pl-2 text-left font-bold">{shortNameB}</th>
              <th className="pb-1.5 text-right font-bold">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {gameDays.map((row) => {
              const a = row.byTeamId[teamIdA] ?? 0;
              const b = row.byTeamId[teamIdB] ?? 0;
              const d = a - b;
              return (
                <tr key={row.date} className="text-zinc-700 dark:text-zinc-300">
                  <td className="py-2 text-left text-[0.72rem] text-zinc-500 dark:text-zinc-400">
                    {format(parseISO(row.date), "MMM d")}
                  </td>
                  <td
                    className={`py-2 pr-2 text-right tabular-nums font-semibold ${
                      d > 0
                        ? "text-zinc-900 dark:text-zinc-50"
                        : d < 0
                          ? "text-zinc-400 dark:text-zinc-600"
                          : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    +{a}
                  </td>
                  <td className="py-2 px-2 text-center text-zinc-400 dark:text-zinc-600" aria-hidden>
                    ·
                  </td>
                  <td
                    className={`py-2 pl-2 text-left tabular-nums font-semibold ${
                      d < 0
                        ? "text-zinc-900 dark:text-zinc-50"
                        : d > 0
                          ? "text-zinc-400 dark:text-zinc-600"
                          : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    +{b}
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={`text-xs font-semibold tabular-nums ${deltaColorClass(d)}`}
                    >
                      {d === 0 ? "Tied" : d > 0 ? `${shortNameA} +${d}` : `${shortNameB} +${Math.abs(d)}`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SkaterPickLabel({
  pick,
  teamStatusByAbbrev,
}: {
  pick: Extract<UnifiedPick, { kind: "skater" }>;
  teamStatusByAbbrev: Record<string, NhlTeamPlayoffStatus>;
}) {
  const nhlDisplayName =
    pick.nhlPlayerId != null
      ? skaterDisplayNameById.get(pick.nhlPlayerId)
      : undefined;
  const { eyebrow, primary } = skaterEyebrowAndPrimary(pick.label, nhlDisplayName);
  const abbrev = pick.nhlTeamAbbrev?.trim().toUpperCase();
  const eliminated = abbrev != null && teamStatusByAbbrev[abbrev] === "eliminated";
  const headshotUrl = pick.nhlPlayerId != null ? nhlPlayerHeadshotUrl(pick.nhlPlayerId) : null;
  const initial = primary.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={`flex min-w-0 items-center gap-2 ${eliminated ? "opacity-55 grayscale" : ""}`}>
      {headshotUrl ? (
        <Image
          src={headshotUrl}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-full object-cover object-top ring-1 ring-zinc-900/10 dark:ring-white/10"
        />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200/90 text-[0.6rem] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {initial}
        </div>
      )}
      <div className="min-w-0">
        {eyebrow ? (
          <p className="truncate text-[0.6rem] text-zinc-500 dark:text-zinc-400">{eyebrow}</p>
        ) : null}
        <p className="truncate text-xs font-medium leading-snug text-zinc-900 dark:text-zinc-100">
          {primary}
        </p>
        {abbrev ? (
          <div className="flex items-center gap-1">
            <span className="text-[0.6rem] font-semibold tabular-nums text-zinc-400 dark:text-zinc-500">
              {abbrev}
            </span>
            <NhleTeamLogoImage
              src={nhlTeamLogoLightSvgUrl(abbrev)}
              alt=""
              width={12}
              height={12}
              className="h-3 w-3"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TeamPickLabel({
  pick,
  teamStatusByAbbrev,
}: {
  pick: Extract<UnifiedPick, { kind: "team" }>;
  teamStatusByAbbrev: Record<string, NhlTeamPlayoffStatus>;
}) {
  const abbrev = pick.teamAbbrev.trim().toUpperCase();
  const eliminated = teamStatusByAbbrev[abbrev] === "eliminated";

  return (
    <NhlTeamLogoEliminatedWrap
      eliminated={eliminated}
      className="flex min-w-0 items-center gap-2"
    >
      <NhleTeamLogoImage
        src={nhlTeamLogoLightSvgUrl(abbrev)}
        alt=""
        width={24}
        height={24}
        className={`h-6 w-6 shrink-0 ${eliminated ? "opacity-55 grayscale" : ""}`}
      />
      <span
        className={`truncate text-xs font-medium text-zinc-900 dark:text-zinc-100 ${eliminated ? "opacity-55" : ""}`}
      >
        {pick.label}
      </span>
    </NhlTeamLogoEliminatedWrap>
  );
}

function PickLabel({
  pick,
  teamStatusByAbbrev,
}: {
  pick: UnifiedPick | undefined;
  teamStatusByAbbrev: Record<string, NhlTeamPlayoffStatus>;
}) {
  if (!pick) {
    return (
      <span className="text-[0.7rem] text-zinc-400 dark:text-zinc-600 italic">No pick</span>
    );
  }
  if (pick.kind === "skater") {
    return <SkaterPickLabel pick={pick} teamStatusByAbbrev={teamStatusByAbbrev} />;
  }
  return <TeamPickLabel pick={pick} teamStatusByAbbrev={teamStatusByAbbrev} />;
}

function PickPoints({ pick }: { pick: UnifiedPick | undefined }) {
  if (!pick) return <span className="text-zinc-300 dark:text-zinc-700">—</span>;
  return (
    <span
      className={`font-pool-display font-semibold tabular-nums leading-none ${
        pick.points > 0
          ? "text-zinc-900 dark:text-zinc-50"
          : "text-zinc-400 dark:text-zinc-600"
      }`}
    >
      {pick.points}
    </span>
  );
}

function RosterComparisonSection({
  breakdownA,
  breakdownB,
  teamStatusByAbbrev,
  nameA,
  nameB,
  isCumulative,
}: {
  breakdownA: TeamScoreBreakdown;
  breakdownB: TeamScoreBreakdown;
  teamStatusByAbbrev: Record<string, NhlTeamPlayoffStatus>;
  nameA: string;
  nameB: string;
  isCumulative: boolean;
}) {
  const picksA = useMemo(() => buildPicksByRound(breakdownA), [breakdownA]);
  const picksB = useMemo(() => buildPicksByRound(breakdownB), [breakdownB]);

  const allRounds = useMemo(() => {
    const rounds = new Set<number>([...picksA.keys(), ...picksB.keys()]);
    return [...rounds].sort((a, b) => a - b);
  }, [picksA, picksB]);

  const shortNameA = nameA.split(" ")[0] ?? nameA;
  const shortNameB = nameB.split(" ")[0] ?? nameB;

  const aPicksAhead = allRounds.filter((r) => {
    const pa = picksA.get(r);
    const pb = picksB.get(r);
    return (pa?.points ?? 0) > (pb?.points ?? 0);
  }).length;
  const bPicksAhead = allRounds.filter((r) => {
    const pa = picksA.get(r);
    const pb = picksB.get(r);
    return (pb?.points ?? 0) > (pa?.points ?? 0);
  }).length;

  const aSkaterTotal = breakdownA.skaterPoints;
  const bSkaterTotal = breakdownB.skaterPoints;
  const aTeamTotal = breakdownA.teamWinPoints;
  const bTeamTotal = breakdownB.teamWinPoints;

  return (
    <section
      className="rounded-2xl bg-white px-5 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08]"
      aria-labelledby="h2h-roster-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id="h2h-roster-heading"
          className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          Roster
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {isCumulative ? "Season totals" : "This date"}
          {" · "}
          {aPicksAhead > bPicksAhead ? (
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {shortNameA} leads on {aPicksAhead} picks
            </span>
          ) : bPicksAhead > aPicksAhead ? (
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {shortNameB} leads on {bPicksAhead} picks
            </span>
          ) : (
            <span>Even on picks</span>
          )}
        </p>
      </div>

      {/* Pick mix summary */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-zinc-50/90 px-3 py-2.5 dark:bg-zinc-900/40">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
            Skater pts
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-pool-display text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {aSkaterTotal}
            </span>
            <span className={`text-xs font-semibold tabular-nums ${deltaColorClass(aSkaterTotal - bSkaterTotal)}`}>
              {fmtDelta(aSkaterTotal - bSkaterTotal)}
            </span>
            <span className="ml-auto font-pool-display text-xl font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
              {bSkaterTotal}
            </span>
          </div>
        </div>
        <div className="rounded-xl bg-zinc-50/90 px-3 py-2.5 dark:bg-zinc-900/40">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
            Team wins
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-pool-display text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {aTeamTotal}
            </span>
            <span className={`text-xs font-semibold tabular-nums ${deltaColorClass(aTeamTotal - bTeamTotal)}`}>
              {fmtDelta(aTeamTotal - bTeamTotal)}
            </span>
            <span className="ml-auto font-pool-display text-xl font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
              {bTeamTotal}
            </span>
          </div>
        </div>
      </div>

      {/* Round-by-round comparison: mobile stacked */}
      <ul className="mt-4 space-y-2 sm:hidden" role="list">
        {allRounds.map((round) => {
          const pa = picksA.get(round);
          const pb = picksB.get(round);
          const ptsA = pa?.points ?? 0;
          const ptsB = pb?.points ?? 0;
          const d = ptsA - ptsB;

          return (
            <li
              key={round}
              className={`rounded-xl px-3 py-3 ring-1 ${
                d > 0
                  ? "bg-emerald-50/40 ring-emerald-200/50 dark:bg-emerald-950/10 dark:ring-emerald-900/30"
                  : d < 0
                    ? "bg-rose-50/40 ring-rose-200/50 dark:bg-rose-950/10 dark:ring-rose-900/30"
                    : "bg-zinc-50/80 ring-zinc-200/50 dark:bg-zinc-900/20 dark:ring-zinc-700/30"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  Round {round}
                </span>
                <span className={`text-[0.65rem] font-semibold tabular-nums ${deltaColorClass(d)}`}>
                  {d === 0
                    ? "Tied"
                    : d > 0
                      ? `${shortNameA} +${d}`
                      : `${shortNameB} +${Math.abs(d)}`}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <PickLabel pick={pa} teamStatusByAbbrev={teamStatusByAbbrev} />
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600">
                    {shortNameA}
                  </span>
                  <span
                    className={`shrink-0 w-6 text-right font-pool-display text-sm font-semibold tabular-nums ${
                      d > 0 ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-600"
                    }`}
                  >
                    {ptsA}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <PickLabel pick={pb} teamStatusByAbbrev={teamStatusByAbbrev} />
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600">
                    {shortNameB}
                  </span>
                  <span
                    className={`shrink-0 w-6 text-right font-pool-display text-sm font-semibold tabular-nums ${
                      d < 0 ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-600"
                    }`}
                  >
                    {ptsB}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Round-by-round comparison: desktop table */}
      <div className="mt-4 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
              <th className="pb-2 text-left font-bold">R</th>
              <th className="pb-2 pl-2 text-left font-bold">{shortNameA}</th>
              <th className="pb-2 text-right font-bold">Pts</th>
              <th className="pb-2 text-center font-bold">Delta</th>
              <th className="pb-2 text-left font-bold">Pts</th>
              <th className="pb-2 pr-2 text-left font-bold">{shortNameB}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {allRounds.map((round) => {
              const pa = picksA.get(round);
              const pb = picksB.get(round);
              const ptsA = pa?.points ?? 0;
              const ptsB = pb?.points ?? 0;
              const d = ptsA - ptsB;

              return (
                <tr
                  key={round}
                  className={
                    d > 0
                      ? "bg-emerald-50/30 dark:bg-emerald-950/10"
                      : d < 0
                        ? "bg-rose-50/30 dark:bg-rose-950/10"
                        : ""
                  }
                >
                  <td className="py-2 text-left">
                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                      {round}
                    </span>
                  </td>
                  <td className="py-2 pl-2 align-middle">
                    <PickLabel pick={pa} teamStatusByAbbrev={teamStatusByAbbrev} />
                  </td>
                  <td className="py-2 text-right align-middle">
                    <PickPoints pick={pa} />
                  </td>
                  <td className="py-2 text-center align-middle">
                    <span
                      className={`text-xs font-semibold tabular-nums ${deltaColorClass(d)}`}
                    >
                      {fmtDelta(d)}
                    </span>
                  </td>
                  <td className="py-2 text-left align-middle">
                    <PickPoints pick={pb} />
                  </td>
                  <td className="py-2 pr-2 align-middle">
                    <PickLabel pick={pb} teamStatusByAbbrev={teamStatusByAbbrev} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ProjectionRow = {
  teamId: string;
  totalToDate: number;
  projectedRemaining: number;
  projectedFinal: number;
  remainingSkaters: number;
  totalSkaters: number;
  remainingTeams: number;
  totalTeams: number;
  teamWinPicks: Array<{ teamAbbrev: string; eliminated: boolean }>;
};

function OutlookComparisonSection({
  teamA,
  teamB,
  projA,
  projB,
}: {
  teamA: TeamPayload;
  teamB: TeamPayload;
  projA: ProjectionRow | null;
  projB: ProjectionRow | null;
}) {
  if (!projA && !projB) return null;

  const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
  const shortNameA = teamA.name.split(" ")[0] ?? teamA.name;
  const shortNameB = teamB.name.split(" ")[0] ?? teamB.name;

  const projFinalA = projA?.projectedFinal ?? teamA.totalPoints;
  const projFinalB = projB?.projectedFinal ?? teamB.totalPoints;
  const projRemainingA = projA?.projectedRemaining ?? 0;
  const projRemainingB = projB?.projectedRemaining ?? 0;
  const projDiff = projFinalA - projFinalB;

  return (
    <section
      className="rounded-2xl bg-white px-5 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08]"
      aria-labelledby="h2h-outlook-heading"
    >
      <h2
        id="h2h-outlook-heading"
        className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
      >
        Roster outlook
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {/* Projected final */}
        <div className="rounded-xl bg-zinc-50/90 px-3 py-2.5 dark:bg-zinc-900/40">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
            Projected final
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`font-pool-display text-xl font-semibold tabular-nums ${projFinalA >= projFinalB ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}>
              {fmt1(projFinalA)}
            </span>
            <span className={`text-xs font-semibold tabular-nums ${deltaColorClass(projDiff)}`}>
              {fmtDelta(Math.round(projDiff * 10) / 10)}
            </span>
            <span className={`ml-auto font-pool-display text-xl font-semibold tabular-nums ${projFinalB > projFinalA ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}>
              {fmt1(projFinalB)}
            </span>
          </div>
        </div>

        {/* Projected remaining */}
        <div className="rounded-xl bg-zinc-50/90 px-3 py-2.5 dark:bg-zinc-900/40">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
            Projected remaining
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`font-pool-display text-xl font-semibold tabular-nums ${projRemainingA >= projRemainingB ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}>
              +{fmt1(projRemainingA)}
            </span>
            <span className={`text-xs font-semibold tabular-nums ${deltaColorClass(projRemainingA - projRemainingB)}`}>
              {fmtDelta(Math.round((projRemainingA - projRemainingB) * 10) / 10)}
            </span>
            <span className={`ml-auto font-pool-display text-xl font-semibold tabular-nums ${projRemainingB > projRemainingA ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}>
              +{fmt1(projRemainingB)}
            </span>
          </div>
        </div>
      </div>

      {/* Alive picks comparison */}
      {(projA || projB) ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            { proj: projA, team: teamA, shortName: shortNameA },
            { proj: projB, team: teamB, shortName: shortNameB },
          ].map(({ proj, team, shortName }) => (
            <div key={team.teamId} className="rounded-xl bg-zinc-50/90 px-3 py-2.5 dark:bg-zinc-900/40">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                {shortName} alive picks
              </p>
              {proj ? (
                <div className="mt-1.5 flex flex-col gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="tabular-nums">
                    <span className="font-semibold">{proj.remainingSkaters}/{proj.totalSkaters}</span>
                    {" "}skaters
                  </span>
                  <span className="tabular-nums">
                    <span className="font-semibold">{proj.remainingTeams}/{proj.totalTeams}</span>
                    {" "}team picks
                  </span>
                  {proj.teamWinPicks.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {proj.teamWinPicks.map((t, i) => (
                        <NhlTeamLogoEliminatedWrap
                          key={i}
                          eliminated={t.eliminated}
                          className="h-5 w-5 shrink-0"
                        >
                          <NhleTeamLogoImage
                            src={nhlTeamLogoLightSvgUrl(t.teamAbbrev)}
                            width={20}
                            height={20}
                            alt={t.teamAbbrev}
                            className="h-5 w-5"
                          />
                        </NhlTeamLogoEliminatedWrap>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">—</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function OpponentSelector({
  currentTeamId,
  opponentId,
  allTeams,
  primaryTeamId,
}: {
  currentTeamId: string;
  opponentId: string;
  allTeams: TeamSummary[];
  primaryTeamId: string;
}) {
  const router = useRouter();
  const options = allTeams.filter(
    (t) => t.id !== primaryTeamId && t.id !== currentTeamId,
  );

  if (options.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
        vs
      </span>
      <select
        value={opponentId}
        onChange={(e) => {
          if (e.target.value) {
            router.push(
              `/standings/team/${encodeURIComponent(primaryTeamId)}/vs/${encodeURIComponent(e.target.value)}`,
            );
          }
        }}
        className="rounded-lg border border-zinc-200/80 bg-white px-2 py-1 text-sm font-medium text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60 dark:border-zinc-700/60 dark:bg-zinc-900 dark:text-zinc-100"
        aria-label="Change opponent"
      >
        {allTeams
          .filter((t) => t.id !== primaryTeamId)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
      </select>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type ProjectionPayload = {
  asOfDate: string;
  rows: Array<
    ProjectionRow & {
      teamId: string;
      name: string;
      ownerName: string;
      ownerAvatar?: string;
      rank: number;
      bestPick: { round: number; label: string; teamAbbrev?: string; ev: number } | null;
      collisions: Array<{
        seriesAbbrev: string;
        round: number;
        teamAbbrevs: [string, string];
        pickLabels: string[];
      }>;
    }
  >;
  meta: {
    perGameProbModel: string;
    baselineP: number;
    ppgPriorWeight: number;
    bracketAvailable: boolean;
    playoffSampleJoined: boolean;
  };
};

export function PoolHeadToHeadView({
  teamIdA,
  teamIdB,
  allTeams,
}: {
  teamIdA: string;
  teamIdB: string;
  allTeams: TeamSummary[];
}) {
  const h2hQuery = useQuery({
    queryKey: ["pool-h2h", teamIdA, teamIdB],
    queryFn: () =>
      fetchJson<H2HApiResponse>(
        `/api/pool/head-to-head?teamA=${encodeURIComponent(teamIdA)}&teamB=${encodeURIComponent(teamIdB)}`,
      ),
  });

  const dailySeriesQuery = useQuery({
    queryKey: ["pool-daily-points-series"],
    queryFn: () =>
      fetchJson<DailyPointsSeriesPayload>("/api/pool/daily-points-series"),
    enabled: !!h2hQuery.data?.asOfDate,
  });

  const projectionQuery = useQuery({
    queryKey: ["pool-projection", h2hQuery.data?.asOfDate ?? ""],
    queryFn: () =>
      fetchJson<ProjectionPayload>(
        `/api/pool/projection?date=${encodeURIComponent(h2hQuery.data!.asOfDate)}`,
      ),
    enabled: !!h2hQuery.data?.asOfDate,
    staleTime: 0,
    refetchInterval: false,
  });

  const projA = useMemo(
    () => projectionQuery.data?.rows.find((r) => r.teamId === teamIdA) ?? null,
    [projectionQuery.data, teamIdA],
  );
  const projB = useMemo(
    () => projectionQuery.data?.rows.find((r) => r.teamId === teamIdB) ?? null,
    [projectionQuery.data, teamIdB],
  );

  if (h2hQuery.isLoading) {
    return (
      <CenteredLoading message="Loading comparison…" ariaLabel="Loading head to head" variant="viewport" />
    );
  }

  if (h2hQuery.error instanceof Error) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50"
          role="alert"
        >
          {h2hQuery.error.message}
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-amber-800/90 underline-offset-2 hover:underline hover:text-amber-900 dark:text-amber-400/95 dark:hover:text-amber-300"
        >
          ← Back to standings
        </Link>
      </div>
    );
  }

  if (!h2hQuery.data) return null;

  const { teamA, teamB, asOfDate, leaderboardMode, teamStatusByAbbrev } =
    h2hQuery.data;
  const isCumulative = leaderboardMode === "cumulative";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-8">
        <PoolSiteChrome
          standingsHref="/"
          scoringHref="/scoring"
          scoringPlayersHref="/scoring/players"
          isStandingsRoute={false}
          isScoringRoute={false}
          isScoringPoolTeamRoute={false}
          isScoringPlayersRoute={false}
          showScoringGroupNav={false}
        />
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/standings/team/${encodeURIComponent(teamIdA)}`}
            className="w-fit text-sm font-medium text-amber-800/90 underline-offset-2 hover:underline hover:text-amber-900 dark:text-amber-400/95 dark:hover:text-amber-300"
          >
            ← {teamA.name}
          </Link>
          <OpponentSelector
            currentTeamId={teamIdB}
            opponentId={teamIdB}
            allTeams={allTeams}
            primaryTeamId={teamIdA}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-pool-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Head to head
          </h1>
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            through {format(parseISO(asOfDate), "MMMM d, yyyy")}
          </span>
        </div>
      </div>

      <MatchupBanner teamA={teamA} teamB={teamB} />

      <ScoreSummaryCard teamA={teamA} teamB={teamB} />

      {dailySeriesQuery.data ? (
        <DailyScoresSection
          series={dailySeriesQuery.data}
          teamIdA={teamIdA}
          teamIdB={teamIdB}
          nameA={teamA.name}
          nameB={teamB.name}
        />
      ) : null}

      {teamA.breakdown && teamB.breakdown ? (
        <RosterComparisonSection
          breakdownA={teamA.breakdown}
          breakdownB={teamB.breakdown}
          teamStatusByAbbrev={teamStatusByAbbrev}
          nameA={teamA.name}
          nameB={teamB.name}
          isCumulative={isCumulative}
        />
      ) : null}

      <OutlookComparisonSection
        teamA={teamA}
        teamB={teamB}
        projA={projA}
        projB={projB}
      />
    </div>
  );
}
