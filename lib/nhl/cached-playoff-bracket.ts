import { unstable_cache } from "next/cache";
import { fetchNhlPlayoffBracket } from "@/lib/nhl/upstream";

/** Shared bracket fetch for round windows, projection, and team-status derivation. */
export const getCachedPlayoffBracket = unstable_cache(
  async (seasonYear: number) => fetchNhlPlayoffBracket(seasonYear),
  ["nhl-playoff-bracket"],
  { revalidate: 60 },
);
