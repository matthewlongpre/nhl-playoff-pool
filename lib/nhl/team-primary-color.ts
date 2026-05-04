/**
 * Approximate official NHL club primary (dominant jersey/marketing) hex colors.
 * Used for lightweight UI (e.g. pick-distribution bars); not for print/Pantone matching.
 */
const HEX: Record<string, string> = {
  ANA: "#F47920",
  ARI: "#8C2633",
  BOS: "#000000",
  BUF: "#003087",
  CGY: "#C8102E",
  CAR: "#CC0000",
  CHI: "#CF0A2C",
  COL: "#6F263D",
  CBJ: "#002654",
  DAL: "#00843D",
  DET: "#CE1126",
  EDM: "#FF4C00",
  FLA: "#041E42",
  LAK: "#000000",
  MIN: "#154734",
  MTL: "#AF1E2D",
  NSH: "#FFB81C",
  NJD: "#CE1126",
  NYI: "#00539B",
  NYR: "#0038A8",
  OTT: "#E31837",
  PHI: "#F74902",
  PIT: "#000000",
  SEA: "#001628",
  SJS: "#006D75",
  STL: "#002F87",
  TBL: "#002868",
  TOR: "#00205B",
  UTA: "#6CACE4",
  VAN: "#00205B",
  VGK: "#B4975A",
  WSH: "#C8102E",
  WPG: "#041E42",
};

/** Primary brand hex for an NHL team abbrev, or `null` if unknown. */
export function nhlTeamPrimaryHex(teamAbbrev: string): string | null {
  const k = teamAbbrev.trim().toUpperCase();
  return HEX[k] ?? null;
}
