/**
 * Display rules: omit stat segments when the value is zero (e.g. “3 assists” not “0 goals · 3 assists”).
 */

/** Compact “2 G · 1 A” style; `null` when both are zero. */
export function formatGoalsAssistsShort(
  goals: number,
  assists: number,
): string | null {
  const parts: string[] = [];
  if (goals > 0) parts.push(`${goals} G`);
  if (assists > 0) parts.push(`${assists} A`);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

/** Prose line for headers (“2 goals · 1 assist”). Empty string if both zero. */
export function formatGoalsAssistsProse(goals: number, assists: number): string {
  const parts: string[] = [];
  if (goals > 0) parts.push(`${goals} goal${goals === 1 ? "" : "s"}`);
  if (assists > 0) parts.push(`${assists} assist${assists === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** Box score leader line: “2G 1A” with no zero parts. */
export function formatGoalsAssistsCompact(goals: number, assists: number): string {
  const parts: string[] = [];
  if (goals > 0) parts.push(`${goals}G`);
  if (assists > 0) parts.push(`${assists}A`);
  return parts.join(" ");
}

/** “Won tonight” / “2 wins tonight”; empty when wins ≤ 0. */
export function formatWinsTonight(wins: number): string {
  if (wins <= 0) return "";
  if (wins === 1) return "Won tonight";
  return `${wins} wins tonight`;
}
