export type PickDistributionRankingTeamBase = {
  name: string;
  entries: ReadonlyArray<{
    abbrev: string;
    count: number;
    status: "active" | "eliminated";
  }>;
};

export type PickDistributionLegendEntry = {
  abbrev: string;
  status: "active" | "eliminated";
};

/**
 * Pool-wide NHL abbrev order (by total pick weight) and merged elimination flags,
 * plus pool teams sorted by display name — same rules as the Team mix standings chart.
 */
export function computePickDistributionRanking<T extends PickDistributionRankingTeamBase>(
  teams: readonly T[],
): {
  abbrevOrder: string[];
  legendEntries: PickDistributionLegendEntry[];
  teamsSorted: T[];
} {
  const weight = new Map<string, number>();
  const statusByAbbrev = new Map<string, "active" | "eliminated">();
  for (const t of teams) {
    for (const e of t.entries) {
      weight.set(e.abbrev, (weight.get(e.abbrev) ?? 0) + e.count);
      const prev = statusByAbbrev.get(e.abbrev);
      if (e.status === "eliminated" || prev === "eliminated") {
        statusByAbbrev.set(e.abbrev, "eliminated");
      } else {
        statusByAbbrev.set(e.abbrev, "active");
      }
    }
  }
  const abbrevOrder = [...weight.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([a]) => a);
  const legendEntries: PickDistributionLegendEntry[] = abbrevOrder.map((abbrev) => ({
    abbrev,
    status: statusByAbbrev.get(abbrev) ?? "active",
  }));
  const teamsSorted: T[] = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  return { abbrevOrder, legendEntries, teamsSorted };
}
