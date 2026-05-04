import Image from "next/image";
import { NhlTeamLogoEliminatedCornerX } from "@/components/nhl-team-logo-eliminated-wrap";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { nhlPlayerHeadshotUrl, nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";
import { loadStaticPoolSkaterDisplayNameById } from "@/lib/pool/pool-skater-display-names";
import { skaterEyebrowAndPrimary } from "@/lib/pool/skater-display-name";
import type { TeamScoreBreakdown } from "@/lib/pool/scoring";
import type { NhlTeamPlayoffStatus } from "@/lib/nhl/schemas";

type SkaterRow = TeamScoreBreakdown["skaterDetail"][number];

const skaterDisplayNameById = loadStaticPoolSkaterDisplayNameById();

function skaterRowKey(s: SkaterRow): string {
  return `${s.round}-${s.label}`;
}

function SkaterIdentity({
  row,
  teamStatusByAbbrev,
}: {
  row: SkaterRow;
  teamStatusByAbbrev?: Readonly<Record<string, NhlTeamPlayoffStatus>>;
}) {
  const nhlDisplayName =
    row.nhlPlayerId != null
      ? skaterDisplayNameById.get(row.nhlPlayerId)
      : undefined;
  const { eyebrow, primary } = skaterEyebrowAndPrimary(row.label, nhlDisplayName);
  const initial = primary.trim().charAt(0).toUpperCase() || "?";
  const headshotUrl =
    row.nhlPlayerId != null ? nhlPlayerHeadshotUrl(row.nhlPlayerId) : null;
  const abbrev = row.nhlTeamAbbrev?.trim().toUpperCase();
  const eliminated =
    abbrev != null && teamStatusByAbbrev?.[abbrev] === "eliminated";

  const dimmed = eliminated ? "opacity-55 grayscale" : "";

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {headshotUrl ? (
        <div className="relative h-9 w-9 shrink-0">
          <div
            className={`h-full w-full overflow-hidden rounded-full bg-zinc-200/80 ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10 ${dimmed}`}
          >
            <Image
              src={headshotUrl}
              alt={eyebrow ? `${eyebrow} ${primary}` : primary}
              width={36}
              height={36}
              className="h-9 w-9 object-cover object-top"
            />
          </div>
          {eliminated ? <NhlTeamLogoEliminatedCornerX /> : null}
        </div>
      ) : (
        <div className="relative h-9 w-9 shrink-0">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200/90 text-xs font-bold text-zinc-600 ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-white/10 ${dimmed}`}
            aria-hidden
          >
            {initial}
          </div>
          {eliminated ? <NhlTeamLogoEliminatedCornerX /> : null}
        </div>
      )}
      <div className={`min-w-0 flex-1 ${dimmed}`}>
        {eyebrow ? (
          <p className="text-[0.7rem] font-medium leading-tight text-zinc-500 dark:text-zinc-400">
            {eyebrow}
          </p>
        ) : null}
        <p
          className={`font-medium leading-snug text-zinc-900 dark:text-zinc-100${
            eyebrow ? " mt-0.5" : ""
          }`}
        >
          {primary}
        </p>
        {abbrev ? (
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-[0.7rem] font-semibold tabular-nums tracking-wide text-zinc-500 dark:text-zinc-400">
              {abbrev}
            </span>
            <NhleTeamLogoImage
              src={nhlTeamLogoLightSvgUrl(abbrev)}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MobileStatChip({
  label,
  value,
  markRosterTop,
}: {
  label: string;
  value: number;
  /** Roster points leader — corner mark on this chip (use on Pts only). */
  markRosterTop?: boolean;
}) {
  return (
    <span
      className={`relative inline-flex min-w-[2.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-zinc-900 shadow-sm ring-1 dark:text-zinc-50 ${
        markRosterTop
          ? "bg-amber-50/90 ring-amber-500/45 dark:bg-amber-950/35 dark:ring-amber-400/35"
          : "bg-zinc-200/95 ring-zinc-900/[0.08] dark:bg-zinc-800/95 dark:ring-white/[0.12]"
      }`}
    >
      {markRosterTop ? (
        <span
          className="pointer-events-none absolute -right-1 -top-1 z-[1] inline-flex items-center rounded-full bg-amber-400 px-[3px] py-px text-[0.42rem] font-bold uppercase leading-none tracking-wide text-amber-950 shadow ring-1 ring-amber-800/30 dark:bg-amber-300 dark:text-amber-950 dark:ring-amber-700/40"
          aria-hidden="true"
        >
          Top
        </span>
      ) : null}
      <span className="text-[0.55rem] font-bold uppercase leading-none tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="font-pool-display text-sm font-semibold tabular-nums leading-none">{value}</span>
    </span>
  );
}

function pickKey(round: number, label: string): string {
  return `${round}::${label}`;
}

function formatOneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function ProjectedChip({ ev }: { ev: number }) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.55rem] font-semibold tabular-nums leading-tight text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/50"
      title="Probability-weighted expected remaining points"
    >
      +{formatOneDecimal(ev)}
    </span>
  );
}

/**
 * Skater G/A/Pts: stacked rows on small screens, table from `sm:` up.
 */
export function PoolSkaterStatsResponsive({
  skaters,
  teamStatusByAbbrev,
  projectedEvByPickKey,
}: {
  skaters: SkaterRow[];
  teamStatusByAbbrev?: Readonly<Record<string, NhlTeamPlayoffStatus>>;
  /** Optional per-pick projected EV — keyed by `${round}::${label}`. */
  projectedEvByPickKey?: ReadonlyMap<string, number>;
}) {
  const maxPts =
    skaters.length > 0 ? Math.max(...skaters.map((sk) => sk.points)) : 0;
  const topScorerKeys = new Set<string>();
  if (maxPts > 0) {
    for (const sk of skaters) {
      if (sk.points === maxPts) topScorerKeys.add(skaterRowKey(sk));
    }
  }
  const showProjCol = projectedEvByPickKey != null;

  const projectedFor = (s: SkaterRow): number | null => {
    if (!projectedEvByPickKey) return null;
    const abbrev = s.nhlTeamAbbrev?.trim().toUpperCase();
    if (abbrev && teamStatusByAbbrev?.[abbrev] === "eliminated") return null;
    const v = projectedEvByPickKey.get(pickKey(s.round, s.label));
    return v != null && v > 0 ? v : null;
  };

  return (
    <>
      <ul
        className="sm:hidden divide-y divide-zinc-200/70 rounded-xl bg-white/60 ring-1 ring-zinc-900/[0.05] dark:divide-zinc-800/70 dark:bg-zinc-950/30 dark:ring-white/[0.06]"
        role="list"
      >
        {skaters.map((s) => {
          const isTop = topScorerKeys.has(skaterRowKey(s));
          const projected = projectedFor(s);
          return (
            <li
              key={`sk-m-${s.round}-${s.label}`}
              className={`px-4 py-3.5 text-zinc-900 first:rounded-t-xl last:rounded-b-xl dark:text-zinc-100 ${
                isTop
                  ? "bg-amber-50/60 dark:bg-amber-950/25"
                  : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0 flex-1">
                  <SkaterIdentity row={s} teamStatusByAbbrev={teamStatusByAbbrev} />
                  {projected != null ? (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[0.65rem] text-zinc-500 dark:text-zinc-400">
                      <span className="uppercase tracking-[0.12em]">Proj</span>
                      <ProjectedChip ev={projected} />
                    </p>
                  ) : null}
                </div>
                <div
                  className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs tabular-nums text-zinc-600 dark:text-zinc-400"
                  aria-label={`${s.goals} goals, ${s.assists} assists, ${s.points} points${
                    isTop ? "; roster high in points" : ""
                  }${projected != null ? `; projected to add ${formatOneDecimal(projected)} more points` : ""}`}
                >
                  <MobileStatChip label="G" value={s.goals} />
                  <MobileStatChip label="A" value={s.assists} />
                  <MobileStatChip label="Pts" value={s.points} markRosterTop={isTop} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl bg-white/60 ring-1 ring-zinc-900/[0.05] dark:bg-zinc-950/30 dark:ring-white/[0.06] sm:block">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50/90 text-left text-[0.65rem] font-bold uppercase tracking-[0.12em] text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2 tabular-nums">G</th>
              <th className="px-3 py-2 tabular-nums">A</th>
              <th className="px-3 py-2 tabular-nums">Pts</th>
              {showProjCol ? <th className="px-3 py-2 tabular-nums">Proj</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
            {skaters.map((s) => {
              const isTop = topScorerKeys.has(skaterRowKey(s));
              const projected = projectedFor(s);
              return (
                <tr
                  key={`sk-d-${s.round}-${s.label}`}
                  className={`text-zinc-900 dark:text-zinc-100 ${
                    isTop ? "bg-amber-50/55 dark:bg-amber-950/22" : ""
                  }`}
                >
                  <td className="max-w-[min(100%,22rem)] px-3 py-2 align-middle">
                    <SkaterIdentity row={s} teamStatusByAbbrev={teamStatusByAbbrev} />
                  </td>
                  <td className="px-3 py-2 tabular-nums align-middle">{s.goals}</td>
                  <td className="px-3 py-2 tabular-nums align-middle">{s.assists}</td>
                  <td className="relative px-3 py-2 align-middle text-right tabular-nums font-medium">
                    {isTop ? (
                      <span
                        className="pointer-events-none absolute right-2 top-1.5 z-[1] inline-flex items-center rounded-full bg-amber-400 px-1 py-px text-[0.45rem] font-bold uppercase leading-none text-amber-950 shadow ring-1 ring-amber-800/30 dark:bg-amber-300 dark:text-amber-950 dark:ring-amber-700/40"
                        aria-hidden="true"
                      >
                        Top
                      </span>
                    ) : null}
                    {s.points}
                  </td>
                  {showProjCol ? (
                    <td className="px-3 py-2 align-middle text-right">
                      {projected != null ? (
                        <ProjectedChip ev={projected} />
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600" aria-hidden>
                          —
                        </span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
