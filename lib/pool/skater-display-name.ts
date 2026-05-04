/**
 * Prefer "First Last" or "I. Last" over roster-style "Last, I" when the label is parseable.
 */
export function formatSkaterDisplayName(label: string): string {
  const t = label.trim();
  const m = t.match(/^([^,]+),\s*(.+)$/);
  if (!m) return t;
  const last = m[1].trim();
  const rest = m[2].trim();
  if (/^[A-Za-z]\.?$/.test(rest)) {
    const initial = rest.replace(/\./g, "");
    return `${initial}. ${last}`;
  }
  return `${rest} ${last}`;
}

function isSingleInitialToken(s: string): boolean {
  return /^[A-Za-z]\.?$/.test(s);
}

/** "J" / "J." / "k" → "J." for the given-name line when we only have an initial. */
function initialAsEyebrow(token: string): string {
  const letter = token.replace(/\./g, "").trim().slice(0, 1).toUpperCase();
  return letter ? `${letter}.` : token.trim();
}

/**
 * Split a skater into a small "eyebrow" (given name) and primary line (usually surname[s]),
 * using NHL player landing full names (`nhlDisplayName`) when present so we can show full
 * first names even when the roster label is only "Last, I".
 *
 * The eyebrow is always set when a separate given name or initial can be inferred (including
 * initial-only cases like "K. Kaprizov" or roster "Eriksson Ek, J").
 */
export function skaterEyebrowAndPrimary(
  rosterLabel: string,
  nhlDisplayName?: string | null,
): { eyebrow: string | null; primary: string } {
  const nhl = nhlDisplayName?.trim();
  if (nhl) {
    const parts = nhl.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0] ?? "";
      const rest = parts.slice(1).join(" ");
      if (isSingleInitialToken(first)) {
        return { eyebrow: initialAsEyebrow(first), primary: rest };
      }
      return { eyebrow: first, primary: rest };
    }
  }

  const t = rosterLabel.trim();
  const m = t.match(/^([^,]+),\s*(.+)$/);
  if (!m) {
    return { eyebrow: null, primary: t };
  }
  const last = m[1].trim();
  const rest = m[2].trim();
  if (!isSingleInitialToken(rest)) {
    return { eyebrow: rest, primary: last };
  }
  return { eyebrow: initialAsEyebrow(rest), primary: last };
}
