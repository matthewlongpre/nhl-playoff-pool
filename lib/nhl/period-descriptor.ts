/**
 * Regulation periods 1–3: show `P1` … `P3` only — `REG` is redundant on the wire.
 * OT / shootout / etc. keep the period type suffix.
 */
export function formatPeriodDescriptorLabel(pd: {
  number: number;
  periodType: string;
}): string {
  const t = pd.periodType.trim();
  if (t.toUpperCase() === "REG" && pd.number >= 1 && pd.number <= 3) {
    return `P${pd.number}`;
  }
  return `P${pd.number} ${pd.periodType}`;
}
