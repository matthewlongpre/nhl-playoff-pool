"use client";

import { useMemo } from "react";
import type { ScoreboardGame } from "@/lib/nhl/schemas";
import { getNhlScoreboardRefreshIntervalMsCapped } from "@/lib/nhl/adaptive-interval";

export function useAdaptiveNhlRefreshInterval(
  games: ReadonlyArray<ScoreboardGame>,
): number {
  return useMemo(
    () => getNhlScoreboardRefreshIntervalMsCapped(games),
    [games],
  );
}
