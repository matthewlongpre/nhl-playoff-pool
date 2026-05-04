/** Pick counts used to draw the skater / team-win / eliminated stacked bar. */
export type RunwayPickCounts = {
  remainingSkaters: number;
  totalSkaters: number;
  remainingTeams: number;
  totalTeams: number;
};

export function runwayStackedBarWidths(
  row: RunwayPickCounts,
): {
  skAlivePct: number;
  tmAlivePct: number;
  eliminatedPct: number;
  totalSlots: number;
} {
  const totalSlots = row.totalSkaters + row.totalTeams;
  if (totalSlots <= 0) {
    return { skAlivePct: 0, tmAlivePct: 0, eliminatedPct: 0, totalSlots: 0 };
  }
  const skAlivePct = (row.remainingSkaters / totalSlots) * 100;
  const tmAlivePct = (row.remainingTeams / totalSlots) * 100;
  const eliminatedPct = Math.max(0, 100 - skAlivePct - tmAlivePct);
  return { skAlivePct, tmAlivePct, eliminatedPct, totalSlots };
}
