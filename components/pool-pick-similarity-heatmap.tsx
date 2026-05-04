import { OwnerAvatarImage } from "@/components/owner-avatar-image";
import { ownerAvatarSrc } from "@/lib/pool/owner-avatar";
import {
  getPickSimilarityExtremes,
  type PickSimilarityMatrix,
  type PoolTeamSimilarityRow,
  type SimilarityPairHighlight,
} from "@/lib/pool/pick-similarity";

type PoolPickSimilarityHeatmapProps = {
  data: PickSimilarityMatrix;
};

function heatClasses(sim: number, isDiagonal: boolean): string {
  if (isDiagonal) {
    return "bg-zinc-200/60 dark:bg-zinc-800/75";
  }
  const idx = Math.min(9, Math.floor(sim * 10));
  /** Monochrome heatmap: pale zinc (less alike) → deep zinc (more alike) */
  const steps = [
    "bg-zinc-50/95 dark:bg-zinc-950/28",
    "bg-zinc-100/92 dark:bg-zinc-900/34",
    "bg-zinc-200/88 dark:bg-zinc-900/42",
    "bg-zinc-300/85 dark:bg-zinc-800/48",
    "bg-zinc-400/82 dark:bg-zinc-700/52",
    "bg-zinc-500/78 dark:bg-zinc-600/56",
    "bg-zinc-600/75 dark:bg-zinc-500/54",
    "bg-zinc-700/72 dark:bg-zinc-500/58",
    "bg-zinc-800/68 dark:bg-zinc-400/52",
    "bg-zinc-900/65 dark:bg-zinc-300/48",
  ];
  return steps[idx] ?? steps[0]!;
}

function TeamMini({ team }: { team: PoolTeamSimilarityRow }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {ownerAvatarSrc(team.ownerAvatar) ? (
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950">
          <OwnerAvatarImage
            filename={team.ownerAvatar}
            width={36}
            height={36}
            className="h-9 w-9 object-cover object-top"
          />
        </div>
      ) : (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200/90 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          aria-hidden
        >
          {team.name.trim().charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{team.name}</div>
        <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{team.ownerName}</div>
      </div>
    </div>
  );
}

function samePair(
  a: SimilarityPairHighlight | null,
  b: SimilarityPairHighlight | null,
): boolean {
  if (!a || !b) return false;
  const x = new Set([a.teamA.teamId, a.teamB.teamId]);
  return x.has(b.teamA.teamId) && x.has(b.teamB.teamId);
}

function SimilarityPairCard({
  label,
  tone,
  pair,
  rounds,
}: {
  label: string;
  tone: "emerald" | "violet" | "zinc";
  pair: SimilarityPairHighlight;
  rounds: number;
}) {
  const pct = Math.round(pair.similarity * 100);
  const shell =
    tone === "emerald"
      ? "bg-emerald-50/80 ring-emerald-200/90 dark:bg-emerald-950/25 dark:ring-emerald-900/50"
      : tone === "violet"
        ? "bg-violet-50/80 ring-violet-200/90 dark:bg-violet-950/25 dark:ring-violet-900/50"
        : "bg-zinc-100/80 ring-zinc-200/90 dark:bg-zinc-900/50 dark:ring-zinc-700/60";
  const labelCls =
    tone === "emerald"
      ? "text-emerald-900/90 dark:text-emerald-300/95"
      : tone === "violet"
        ? "text-violet-900/90 dark:text-violet-300/95"
        : "text-zinc-600 dark:text-zinc-400";
  return (
    <article className={`flex flex-col gap-4 rounded-2xl p-4 ring-1 sm:p-5 ${shell}`}>
      <p className={`text-[0.65rem] font-bold uppercase tracking-[0.16em] ${labelCls}`}>
        {label}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <TeamMini team={pair.teamA} />
        <span
          className="hidden shrink-0 text-xs font-semibold uppercase tracking-wider text-zinc-400 sm:inline"
          aria-hidden
        >
          vs
        </span>
        <TeamMini team={pair.teamB} />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
        <span className="font-pool-display text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
          {pct}%
        </span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {pair.matchingRounds} of {rounds} rounds matched
        </span>
      </div>
    </article>
  );
}

export function PoolPickSimilarityHeatmap({ data }: PoolPickSimilarityHeatmapProps) {
  const { teams, similarity, rounds } = data;
  const n = teams.length;
  const { mostSimilar, leastSimilar } = getPickSimilarityExtremes(data);
  const showHighlights = n >= 2 && mostSimilar && leastSimilar;
  const onlyOnePair = showHighlights && samePair(mostSimilar, leastSimilar);

  return (
    <section className="flex flex-col gap-6" aria-label="Pool stats — pick overlap between teams">
      <h2 className="font-pool-display text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Pool stats
      </h2>

      {showHighlights ? (
        onlyOnePair ? (
          <SimilarityPairCard
            label="Pick overlap (only two teams)"
            tone="zinc"
            pair={mostSimilar}
            rounds={rounds}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <SimilarityPairCard
              label="Most alike"
              tone="emerald"
              pair={mostSimilar}
              rounds={rounds}
            />
            <SimilarityPairCard
              label="Least alike"
              tone="violet"
              pair={leastSimilar}
              rounds={rounds}
            />
          </div>
        )
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        <span>Less alike</span>
        <div className="flex h-3 flex-1 min-w-[8rem] max-w-xs overflow-hidden rounded-full ring-1 ring-zinc-200/80 dark:ring-zinc-600/70">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className={`flex-1 ${heatClasses((i + 0.5) / 10, false)}`} />
          ))}
        </div>
        <span>More alike</span>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08]">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 bg-zinc-50/95 px-2 py-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-zinc-500 backdrop-blur-sm dark:bg-zinc-950/90 dark:text-zinc-400 sm:px-3"
              >
                <span className="sr-only">Pool team</span>
              </th>
              {teams.map((t) => (
                <th
                  key={t.teamId}
                  scope="col"
                  className="max-w-[4.5rem] px-1 py-2 text-center align-bottom text-[0.65rem] font-semibold leading-tight text-zinc-600 dark:text-zinc-300 sm:max-w-[6rem] sm:px-2"
                  title={t.name}
                >
                  <span className="line-clamp-2">{t.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((rowTeam, i) => (
              <tr key={rowTeam.teamId} className="border-t border-zinc-200/70 dark:border-zinc-800/80">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-zinc-50/95 px-2 py-2 text-left backdrop-blur-sm dark:bg-zinc-950/90 sm:px-3"
                >
                  <div className="flex max-w-[12rem] items-center gap-2">
                    {ownerAvatarSrc(rowTeam.ownerAvatar) ? (
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-200/80 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-950">
                        <OwnerAvatarImage
                          filename={rowTeam.ownerAvatar}
                          width={32}
                          height={32}
                          className="h-8 w-8 object-cover object-top"
                        />
                      </div>
                    ) : (
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200/90 text-[0.65rem] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        aria-hidden
                      >
                        {rowTeam.name.trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                        {rowTeam.name}
                      </div>
                      <div className="truncate text-[0.7rem] text-zinc-500 dark:text-zinc-400">
                        {rowTeam.ownerName}
                      </div>
                    </div>
                  </div>
                </th>
                {teams.map((_, j) => {
                  const sim = similarity[i]![j]!;
                  const pct = Math.round(sim * 100);
                  const isDiagonal = i === j;
                  const matching = Math.round(sim * rounds);
                  return (
                    <td
                      key={`${i}-${j}`}
                      className={`px-1 py-1.5 text-center align-middle sm:px-2 ${heatClasses(sim, isDiagonal)}`}
                      style={
                        isDiagonal ? undefined : { opacity: 0.48 + sim * 0.52 }
                      }
                      title={
                        isDiagonal
                          ? "Same team — not compared"
                          : `${rowTeam.name} vs ${teams[j]!.name}: ${matching} of ${rounds} rounds matched (${pct}%)`
                      }
                    >
                      {isDiagonal ? (
                        <>
                          <span className="sr-only">Same team (not compared)</span>
                          <span
                            aria-hidden
                            className="font-pool-display text-lg leading-none text-zinc-400 dark:text-zinc-500"
                          >
                            —
                          </span>
                        </>
                      ) : (
                        <span className="font-pool-display tabular-nums font-semibold text-zinc-900 dark:text-zinc-50">
                          {pct}%
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
