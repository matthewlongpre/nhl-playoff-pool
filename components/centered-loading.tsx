/**
 * Shared centered spinner + message for page, panel, or compact (inline) loading.
 * Default `viewport` fills the dynamic viewport height for full-page states.
 */
const variantClass = {
  viewport: "min-h-dvh",
  section: "min-h-[min(52dvh,30rem)]",
  compact: "min-h-[11rem] py-10",
} as const;

export type CenteredLoadingVariant = keyof typeof variantClass;

export function CenteredLoading({
  message,
  ariaLabel,
  variant = "viewport",
  className,
}: {
  message: string;
  ariaLabel?: string;
  variant?: CenteredLoadingVariant;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel ?? message}
      className={[
        "mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-5 px-4 sm:px-6",
        variantClass[variant],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="h-11 w-11 shrink-0 animate-spin rounded-full border-2 border-zinc-200 border-t-amber-600 dark:border-zinc-700 dark:border-t-amber-400"
        aria-hidden
      />
      <p className="text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {message}
      </p>
    </div>
  );
}
