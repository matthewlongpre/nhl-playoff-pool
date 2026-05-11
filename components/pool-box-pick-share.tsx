import Image from "next/image";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
import { NhlTeamLogoEliminatedWrap } from "@/components/nhl-team-logo-eliminated-wrap";
import type { PickShareEntry, RoundPickShare } from "@/lib/pool/box-pick-counts";
import { nhlPlayerHeadshotUrl, nhlTeamLogoLightSvgUrl } from "@/lib/nhl/media";

type PoolBoxPickShareProps = {
  byRound: RoundPickShare[];
};

function BoxPickVisual({ e }: { e: PickShareEntry }) {
  const eliminated = e.eliminated ?? false;

  if (e.kind === "team" && e.teamAbbrev) {
    const abbrev = e.teamAbbrev.toUpperCase();
    return (
      <div
        className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white p-1 ring-1 ring-zinc-900/10 dark:bg-zinc-900 dark:ring-white/10"
        title="Team pick"
      >
        <NhlTeamLogoEliminatedWrap eliminated={eliminated} className="h-full w-full">
          <NhleTeamLogoImage
            src={nhlTeamLogoLightSvgUrl(abbrev)}
            alt=""
            width={28}
            height={28}
            className="h-full w-full"
          />
        </NhlTeamLogoEliminatedWrap>
      </div>
    );
  }

  if (e.kind === "skater") {
    const id = e.nhlPlayerId;
    if (typeof id === "number" && id > 0) {
      return (
        <div
          className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-200/80 ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10${eliminated ? " grayscale opacity-45" : ""}`}
          title={e.roleLabel === "D" ? "Defence" : "Forward"}
        >
          <Image
            src={nhlPlayerHeadshotUrl(id)}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 object-cover object-top"
          />
        </div>
      );
    }
    return (
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[0.65rem] font-bold uppercase tracking-wide text-zinc-600 ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-white/10${eliminated ? " grayscale opacity-45" : ""}`}
        title={e.roleLabel === "D" ? "Defence" : "Forward"}
      >
        {e.roleLabel}
      </span>
    );
  }

  return null;
}

export function PoolBoxPickShare({ byRound }: PoolBoxPickShareProps) {
  return (
    <section className="flex flex-col gap-8" aria-label="Pick counts by draft round">
      <div className="flex flex-col gap-2">
        <h2 className="font-pool-display text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Pick counts by box
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Each row matches the official box sheet (East/West forwards, defence, team
          picks). Counts are how many pool teams chose that option in that round.
          Rows at the bottom marked as not on the sheet mean the roster pick did not
          match any line on the PDF (usually a name or team typo vs the sheet).
        </p>
      </div>

      <div className="flex flex-col gap-10">
        {byRound.map((round) => (
          <article
            key={round.round}
            className="rounded-2xl bg-white p-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08] sm:p-5"
          >
            <div className="mb-4">
              <h3 className="font-pool-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Box {round.round} · {round.title}
              </h3>
            </div>

            <ul className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80" role="list">
              {round.entries.map((e, idx) => (
                <li
                  key={`${round.round}-${idx}`}
                  className={`flex min-h-[3rem] items-center gap-3 py-2.5 first:pt-0 last:pb-0 ${
                    e.count === 0 ? "opacity-70" : ""
                  }`}
                >
                  <BoxPickVisual e={e} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <div
                        className={`truncate font-medium ${
                          e.count === 0
                            ? "text-zinc-500 dark:text-zinc-500"
                            : e.eliminated
                              ? "text-zinc-400 dark:text-zinc-500"
                              : "text-zinc-900 dark:text-zinc-100"
                        }`}
                      >
                        {e.label}
                      </div>
                      {e.notOnSlate ? (
                        <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
                          Not on sheet
                        </span>
                      ) : null}
                    </div>
                    {e.kind === "skater" && e.nhlTeamAbbrev ? (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {e.nhlTeamAbbrev}
                      </div>
                    ) : null}
                  </div>
                  <div
                    className="shrink-0 text-right font-pool-display tabular-nums"
                    title={`${e.count} of ${round.totalPoolTeams} pool teams`}
                  >
                    <span
                      className={`text-lg font-semibold ${
                        e.count === 0
                          ? "text-zinc-400 dark:text-zinc-600"
                          : "text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      {e.count}
                    </span>
                    <span className="text-zinc-400 dark:text-zinc-500">/</span>
                    <span className="text-base font-medium text-zinc-600 dark:text-zinc-300">
                      {round.totalPoolTeams}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
