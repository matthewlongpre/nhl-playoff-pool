"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { NhleTeamLogoImage } from "@/components/nhle-team-logo";
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

type PickDistributionResponse = {
  date: string;
  teams: TeamRow[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === "string" ? err.error : "Request failed");
  }
  return res.json();
}

export function PoolTeamPickMixRow({
  name,
  ownerName,
  entries,
  abbrevOrder,
}: {
  name: string;
  ownerName: string;
  entries: Entry[];
  abbrevOrder: string[];
}) {
  const total = entries.reduce((s, e) => s + e.count, 0);
  const byAbbrev = new Map(entries.map((e) => [e.abbrev, e]));

  return (
    <div
      className="w-full min-w-0 rounded-xl px-0 py-1 sm:py-1"
      role="group"
      aria-label={`${name}, ${ownerName}. ${total} picks across NHL teams.`}
    >
      <div className="min-w-0 w-full">
        {total <= 0 ? (
          <div className="h-4 rounded-md bg-zinc-200/80 dark:bg-zinc-800/80" />
        ) : (
          <div className="flex flex-col gap-0.5">
            <div className="flex h-4 overflow-hidden rounded-md ring-1 ring-zinc-900/10 dark:brightness-110 dark:ring-white/10 sm:h-5">
              {abbrevOrder.map((abbrev) => {
                const e = byAbbrev.get(abbrev);
                const count = e?.count ?? 0;
                if (count <= 0) return null;
                const eliminated = e?.status === "eliminated";
                const src = nhlTeamLogoLightSvgUrl(abbrev);
                const primary = nhlTeamPrimaryHex(abbrev);
                return (
                  <div
                    key={abbrev}
                    style={{
                      flexGrow: count,
                      flexBasis: 0,
                      minWidth: 2,
                      ...(primary ? { backgroundColor: primary } : {}),
                    }}
                    className={`relative min-h-0 self-stretch overflow-hidden ring-1 ring-inset ring-black/10 dark:ring-white/15 ${
                      primary ? "" : "bg-zinc-200/90 dark:bg-zinc-800/95"
                    } ${eliminated ? "opacity-55 grayscale" : ""}`}
                    title={`${abbrev} ×${count}${eliminated ? " (eliminated)" : ""}`}
                  >
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-px">
                      <NhleTeamLogoImage
                        src={src}
                        alt=""
                        width={16}
                        height={16}
                        onTeamPrimaryBackground={Boolean(primary)}
                        className="max-h-[11px] w-auto max-w-[min(100%,2rem)] object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)] sm:max-h-[14px] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              className="flex min-h-3 px-px sm:min-h-3.5"
              aria-hidden="true"
            >
              {abbrevOrder.map((abbrev) => {
                const e = byAbbrev.get(abbrev);
                const count = e?.count ?? 0;
                if (count <= 0) return null;
                const eliminated = e?.status === "eliminated";
                return (
                  <div
                    key={`${abbrev}-count`}
                    style={{
                      flexGrow: count,
                      flexBasis: 0,
                      minWidth: 2,
                    }}
                    className="flex min-w-0 justify-center"
                  >
                    <span
                      className={`text-[0.6rem] font-semibold tabular-nums leading-none tracking-tight text-zinc-500 dark:text-zinc-400 ${
                        eliminated ? "opacity-60" : ""
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Team mix row for a single pool team (same NHL order and styling as the home Team mix list).
 */
export function PoolTeamDetailPickMix({
  teamId,
  asOfDate,
}: {
  teamId: string;
  asOfDate: string;
}) {
  const q = useQuery({
    queryKey: ["pool-pick-distribution", asOfDate],
    queryFn: () =>
      fetchJson<PickDistributionResponse>(
        `/api/pool/pick-distribution?date=${encodeURIComponent(asOfDate)}`,
      ),
    refetchInterval: 90_000,
    enabled: Boolean(asOfDate),
  });

  const { row, abbrevOrder } = useMemo(() => {
    const teams = q.data?.teams ?? [];
    const { abbrevOrder: order } = computePickDistributionRanking(teams);
    const found = teams.find((t) => t.teamId === teamId) ?? null;
    return { row: found, abbrevOrder: order };
  }, [q.data?.teams, teamId]);

  if (!asOfDate) return null;

  const cardChrome =
    "rounded-2xl bg-white px-4 py-4 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08] sm:px-5";

  if (q.isLoading) {
    return (
      <section className={cardChrome} aria-labelledby="team-pick-mix-heading">
        <h2
          id="team-pick-mix-heading"
          className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Team mix
        </h2>
        <div className="mt-3">
          <CenteredLoading message="Loading team mix…" variant="section" ariaLabel="Loading team mix" />
        </div>
      </section>
    );
  }

  if (q.error instanceof Error || !row) {
    return null;
  }

  return (
    <section className={cardChrome} aria-labelledby="team-pick-mix-heading">
      <h2
        id="team-pick-mix-heading"
        className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
      >
        Team mix
      </h2>
      <p className="sr-only">
        Horizontal stacked bar: segment width is pick count per NHL team, using the same club order as the
        standings team mix chart.
      </p>
      <div className="mt-3">
        <PoolTeamPickMixRow
          name={row.name}
          ownerName={row.ownerName}
          entries={row.entries}
          abbrevOrder={abbrevOrder}
        />
      </div>
    </section>
  );
}
