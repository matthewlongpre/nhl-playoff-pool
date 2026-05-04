import type { ReactNode } from "react";

/** Small corner mark so eliminated crests stay readable. */
export function NhlTeamLogoEliminatedCornerX() {
  return (
    <span className="pointer-events-none absolute bottom-0.5 right-0.5 z-[1] flex h-2 w-2 items-end justify-end">
      <svg
        className="h-2 w-2 text-red-500 drop-shadow-[0_0_1px_rgba(0,0,0,0.85)] dark:text-red-400"
        viewBox="0 0 8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" />
      </svg>
    </span>
  );
}

type Props = {
  eliminated: boolean;
  children: ReactNode;
  /** Classes on the outer `relative` wrapper (e.g. `h-full w-full`). */
  className?: string;
  /** Applied to the logo wrapper when `eliminated` (default matches scoring runway). */
  eliminatedDimClassName?: string;
};

const DEFAULT_ELIM_DIM = "opacity-45 grayscale";

/**
 * Wraps an NHL crest: when eliminated, dims/grayscales only the logo and draws a small red ×
 * in the corner. Surrounding fills (bar segment, chip circle, etc.) are up to the caller.
 */
export function NhlTeamLogoEliminatedWrap({
  eliminated,
  children,
  className = "",
  eliminatedDimClassName = DEFAULT_ELIM_DIM,
}: Props) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`.trim()}>
      <span
        className={
          eliminated
            ? `inline-flex items-center justify-center ${eliminatedDimClassName}`.trim()
            : "inline-flex items-center justify-center"
        }
      >
        {children}
      </span>
      {eliminated ? <NhlTeamLogoEliminatedCornerX /> : null}
    </span>
  );
}
