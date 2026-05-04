"use client";

export type ScoringDay = "today" | "yesterday";

type Props = {
  value: ScoringDay;
  onChange: (value: ScoringDay) => void;
  /** Optional id for aria-controls on tabs (content region). */
  controlsId?: string;
};

/**
 * Today vs yesterday toggle for daily pool scoring — matches pool nav pill styling.
 */
export function ScoringDayTabs({ value, onChange, controlsId }: Props) {
  const tabId = (d: ScoringDay) => `scoring-day-tab-${d}`;
  return (
    <div
      className="inline-flex w-full max-w-sm rounded-full bg-zinc-200/70 p-1 dark:bg-zinc-950/60 sm:w-auto"
      role="tablist"
      aria-label="Scoring day"
    >
      <button
        id={tabId("today")}
        type="button"
        role="tab"
        aria-selected={value === "today"}
        aria-controls={controlsId}
        className={`min-h-[2.25rem] flex-1 rounded-full px-4 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-5 ${
          value === "today"
            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-white/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
        }`}
        onClick={() => onChange("today")}
      >
        Today
      </button>
      <button
        id={tabId("yesterday")}
        type="button"
        role="tab"
        aria-selected={value === "yesterday"}
        aria-controls={controlsId}
        className={`min-h-[2.25rem] flex-1 rounded-full px-4 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-5 ${
          value === "yesterday"
            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-white/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
        }`}
        onClick={() => onChange("yesterday")}
      >
        Yesterday
      </button>
    </div>
  );
}
