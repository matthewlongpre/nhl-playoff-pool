/** NHLE CDN — verified pattern for current player headshots. */
const NHLE_ASSETS = "https://assets.nhle.com";

/** NHLE uses `team-tbd-light.svg` / `team-tbd-dark.svg` for unknown bracket opponents. */
export function nhleIsTbdPlaceholderLogoUrl(src: string): boolean {
  return src.includes("team-tbd");
}

export function nhlPlayerHeadshotUrl(playerId: number): string {
  return `${NHLE_ASSETS}/mugs/nhl/latest/${playerId}.png`;
}

/** Light SVG crest used across NHLE (same pattern as day-sources). */
export function nhlTeamLogoLightSvgUrl(teamAbbrev: string): string {
  return `${NHLE_ASSETS}/logos/nhl/svg/${teamAbbrev.toUpperCase()}_light.svg`;
}

/** SVG for dark UI backgrounds (light / inverse crest); pair with `_light` in `dark:`. */
export function nhlTeamLogoDarkSvgUrl(teamAbbrev: string): string {
  return `${NHLE_ASSETS}/logos/nhl/svg/${teamAbbrev.toUpperCase()}_dark.svg`;
}

/**
 * Playoff bracket API `bracketLogo` points at a wide horizontal banner; the bracket center
 * column uses the standalone cup asset (`*-cup.png`) so it reads clearly on mobile.
 */
export function nhlePlayoffBracketCenterLogoUrl(
  bracketLogo: string | undefined,
): string | undefined {
  const u = bracketLogo?.trim();
  if (!u) return undefined;
  return u.replace(/-horizontal-banner-(?:en|fr)\.png/i, "-cup.png");
}

/**
 * When `src` is an NHLE `*_light.svg` mark, returns the paired `*_dark.svg` URL (query string preserved).
 * Non-NHLE or non-light URLs return `null` (caller keeps a single image).
 */
export function nhleTeamLogoDarkSrcIfLight(src: string): string | null {
  if (!src.includes(`${NHLE_ASSETS}/logos/nhl/svg/`)) return null;
  if (!/_light\.svg(\?|$)/.test(src)) return null;
  return src.replace(/_light\.svg/, "_dark.svg");
}

/** Teams whose `_light.svg` reads as a dark mark and needs the inverse `_dark.svg` on primary-color chips/bars in light UI. */
const NHLE_TEAM_LOGO_INVERT_ON_PRIMARY_BG: ReadonlySet<string> = new Set(["TBL"]);

/** Parses `.../TEAM_light.svg` NHLE URLs; returns null otherwise. */
export function nhleTeamAbbrevFromNhleLightLogoSrc(src: string): string | null {
  if (!src.includes(`${NHLE_ASSETS}/logos/nhl/svg/`)) return null;
  const m = src.match(/\/logos\/nhl\/svg\/([A-Za-z0-9]+)_light\.svg(?:\?|$)/);
  return m ? m[1].toUpperCase() : null;
}

/** True when `src` is an NHLE light mark for a club that should use the inverse crest on team-primary fills (light + dark site theme). */
export function nhleTeamLogoInvertOnTeamPrimaryBg(src: string): boolean {
  const abbrev = nhleTeamAbbrevFromNhleLightLogoSrc(src);
  return abbrev != null && NHLE_TEAM_LOGO_INVERT_ON_PRIMARY_BG.has(abbrev);
}
