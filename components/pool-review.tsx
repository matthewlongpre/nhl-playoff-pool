"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CenteredLoading } from "@/components/centered-loading";
import { PoolScopeTiles, ScopeSubHeader } from "@/components/pool-scope-tiles";
import type {
  PoolReviewPayload,
  ScopeKey,
  ScopeSummary,
} from "@/lib/pool/scope-summary";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === "string" ? err.error : "Request failed");
  }
  return res.json();
}

type Props = {
  /** YYYY-MM-DD; usually `poolCalendarToday()`. */
  asOfDate: string;
};

const HEADING_ID = "pool-review-heading";

/** Tab pill styling — kept inline since it's the only place we need it now. */
function tabBadgeClass(
  status: ScopeSummary["status"] | "neutral",
  selected: boolean,
): string {
  if (selected) {
    return "bg-zinc-900 text-white shadow-sm dark:bg-zinc-50 dark:text-zinc-900";
  }
  if (status === "upcoming") {
    return "bg-zinc-100 text-zinc-400 dark:bg-zinc-900/50 dark:text-zinc-600";
  }
  if (status === "active") {
    return "bg-amber-100 text-amber-900 hover:bg-amber-200/80 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25";
  }
  return "bg-zinc-100 text-zinc-700 hover:bg-zinc-200/90 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-800";
}

function shortLabel(scope: ScopeKey): string {
  if (scope === "all") return "All";
  switch (scope) {
    case 1:
      return "R1";
    case 2:
      return "R2";
    case 3:
      return "Conf";
    case 4:
      return "Final";
    default:
      return `R${scope}`;
  }
}

/**
 * Pick a sensible default scope: prefer the active round, else the latest complete
 * round, else "all" (when nothing has started).
 */
function pickDefaultScope(scopes: ReadonlyArray<ScopeSummary>): ScopeKey {
  const rounds = scopes.filter((s) => s.scope !== "all");
  const anyMeaningful = rounds.some((r) => r.status !== "upcoming");
  if (!anyMeaningful) return "all";
  const active = rounds.find((r) => r.status === "active");
  if (active) return active.scope;
  const completed = [...rounds].reverse().find((r) => r.status === "complete");
  if (completed) return completed.scope;
  return "all";
}

export function PoolReview({ asOfDate }: Props) {
  const query = useQuery({
    queryKey: ["pool-review", asOfDate],
    queryFn: () =>
      fetchJson<PoolReviewPayload>(
        `/api/pool/review?date=${encodeURIComponent(asOfDate)}`,
      ),
    /** Snapshots change after ingest; avoid infinite stale + HTTP cache showing old tiles. */
    staleTime: 0,
    refetchInterval: false,
  });

  const data = query.data;
  const defaultScope = useMemo<ScopeKey>(
    () => (data ? pickDefaultScope(data.scopes) : "all"),
    [data],
  );

  /** `null` means "use the computed default" so an explicit user click is sticky. */
  const [selected, setSelected] = useState<ScopeKey | null>(null);
  const effectiveSelected: ScopeKey = selected ?? defaultScope;

  if (query.isLoading) {
    return (
      <section
        className="rounded-2xl bg-white px-4 py-6 shadow-[0_4px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-zinc-900/[0.06] dark:bg-zinc-950 dark:shadow-[0_8px_40px_-20px_rgba(0,0,0,0.65)] dark:ring-white/[0.08]"
        aria-labelledby={HEADING_ID}
      >
        <h2
          id={HEADING_ID}
          className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Pool in review
        </h2>
        <CenteredLoading message="Loading pool review…" variant="section" />
      </section>
    );
  }

  if (query.error instanceof Error) {
    return (
      <section
        className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200/80 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50"
        aria-labelledby={HEADING_ID}
        role="alert"
      >
        <h2
          id={HEADING_ID}
          className="font-pool-display text-base font-semibold tracking-tight"
        >
          Pool in review
        </h2>
        <p className="mt-1">{query.error.message}</p>
      </section>
    );
  }

  if (!data) return null;
  /** Hide entire section until at least one round has started. */
  const allScope = data.scopes.find((s) => s.scope === "all");
  const anyStarted =
    (allScope && allScope.daysCovered > 0) ||
    data.scopes.some((s) => s.scope !== "all" && s.status !== "upcoming");
  if (!anyStarted) return null;

  const scopeForTab =
    data.scopes.find((s) => s.scope === effectiveSelected) ??
    data.scopes.find((s) => s.scope === "all") ??
    null;

  return (
    <section className="relative flex flex-col gap-3" aria-labelledby={HEADING_ID}>
      <div
        className="sticky top-0 isolate z-50 -mx-4 px-4 pt-3 pb-4 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.14)] dark:shadow-[0_16px_44px_-14px_rgba(0,0,0,0.88)] sm:-mx-6 sm:px-6 sm:pt-4"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-zinc-50 dark:bg-zinc-950"
        />
        {/*
          Solid backdrop layer + no flex column-gap: avoids compositor gaps where
          scrolling card rings show through the sticky header.
        */}
        <div className="relative flex w-full min-w-0 flex-col">
          <div className="flex flex-col gap-1">
            <h2
              id={HEADING_ID}
              className="font-pool-display text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              Pool in review
            </h2>
            <p className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">
              Highlights from the playoff run — updates after nightly scoring ingest.
              Switch tabs to slice by Stanley Cup round.
              {data.poolPlayerStatsAvailable
                ? ""
                : " (Live snapshot only — historical tiles unlock once the database is wired.)"}
            </p>
          </div>

          <div
            className="mt-3 flex flex-wrap gap-1.5"
            role="tablist"
            aria-label="Pool review scope"
          >
            {data.scopes.map((s) => {
              const isSelected = effectiveSelected === s.scope;
              const isUpcoming = s.scope !== "all" && s.status === "upcoming";
              const status: ScopeSummary["status"] | "neutral" =
                s.scope === "all" ? "neutral" : s.status;
              return (
                <button
                  key={String(s.scope)}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`pool-review-panel-${s.scope}`}
                  disabled={isUpcoming}
                  onClick={() => setSelected(s.scope)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400/90 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950 ${tabBadgeClass(status, isSelected)}`}
                  title={`${s.label}${s.scope === "all" ? "" : ` — ${s.status}`}`}
                >
                  <span>{shortLabel(s.scope)}</span>
                  {s.scope !== "all" && s.status === "active" ? (
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"
                      aria-hidden="true"
                    />
                  ) : null}
                  {s.scope !== "all" && s.status === "complete" ? (
                    <span aria-hidden="true">✓</span>
                  ) : null}
                  {s.scope !== "all" && s.status === "upcoming" ? (
                    <span aria-hidden="true">·</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {scopeForTab ? (
            <div className="mt-3 min-w-0">
              <ScopeSubHeader scope={scopeForTab} />
            </div>
          ) : null}
        </div>
      </div>

      {scopeForTab ? (
        <PoolScopeTiles
          scope={scopeForTab}
          poolPlayerStatsAvailable={data.poolPlayerStatsAvailable}
          ariaLabelledBy={HEADING_ID}
        />
      ) : null}
    </section>
  );
}
