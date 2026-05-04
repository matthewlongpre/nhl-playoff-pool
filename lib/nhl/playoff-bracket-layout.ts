import type {
  PlayoffBracketResponse,
  PlayoffBracketSeries,
} from "@/lib/nhl/schemas";

/** Which half of the bracket a series belongs to for layout (East / West / Stanley Cup Final). */
export type BracketConferenceBucket = "east" | "west" | "final";

/**
 * NHL web API `seriesLetter` topology for a 16-team bracket (verified against live payloads):
 * - R1: `A`–`D` Eastern matchups, `E`–`H` Western
 * - R2: `I`, `J` East, `K`, `L` West
 * - R3: `M` ECF, `N` WCF
 * - R4: `O` SCF
 */
export function conferenceForSeries(
  s: PlayoffBracketSeries,
): BracketConferenceBucket {
  if (s.playoffRound === 4 || s.seriesAbbrev === "SCF") {
    return "final";
  }
  const ca = s.conferenceAbbrev?.trim().toUpperCase();
  if (ca === "E") return "east";
  if (ca === "W") return "west";

  const letter = s.seriesLetter?.trim().toUpperCase() ?? "";
  if (letter === "O") return "final";
  if (["A", "B", "C", "D", "I", "J", "M"].includes(letter)) return "east";
  if (["E", "F", "G", "H", "K", "L", "N"].includes(letter)) return "west";

  /** No letter / unknown topology — default East so UI still renders. */
  return "east";
}

function compareSeriesForDisplay(a: PlayoffBracketSeries, b: PlayoffBracketSeries) {
  if (a.playoffRound !== b.playoffRound) return a.playoffRound - b.playoffRound;
  return (a.seriesLetter ?? "").localeCompare(b.seriesLetter ?? "");
}

export type GroupedBracket = {
  east: PlayoffBracketSeries[];
  west: PlayoffBracketSeries[];
  final: PlayoffBracketSeries[];
};

export function groupForDisplay(bracket: PlayoffBracketResponse): GroupedBracket {
  const east: PlayoffBracketSeries[] = [];
  const west: PlayoffBracketSeries[] = [];
  const final: PlayoffBracketSeries[] = [];

  for (const s of bracket.series) {
    const bucket = conferenceForSeries(s);
    if (bucket === "final") final.push(s);
    else if (bucket === "east") east.push(s);
    else west.push(s);
  }

  east.sort(compareSeriesForDisplay);
  west.sort(compareSeriesForDisplay);
  final.sort(compareSeriesForDisplay);

  return { east, west, final };
}

export type RoundSection = {
  round: number;
  /** Label from API (`seriesTitle` of first series in this round). */
  title: string;
  series: PlayoffBracketSeries[];
};

/** Groups sorted series into contiguous round sections for one conference column. */
/** Bracket slot letters per round / conference (NHL web API). */
export const WEST_R1_LETTERS = ["E", "F", "G", "H"] as const;
export const WEST_R2_LETTERS = ["K", "L"] as const;
export const WEST_R3_LETTERS = ["N"] as const;
export const EAST_R1_LETTERS = ["A", "B", "C", "D"] as const;
export const EAST_R2_LETTERS = ["I", "J"] as const;
export const EAST_R3_LETTERS = ["M"] as const;

export type ConferenceBracketSlots = {
  r1: (PlayoffBracketSeries | undefined)[];
  r2: (PlayoffBracketSeries | undefined)[];
  r3: (PlayoffBracketSeries | undefined)[];
};

/** Resolve series in bracket slot order; missing letters become `undefined`. */
export function orderedSeriesByLetters(
  letters: readonly string[],
  pool: PlayoffBracketSeries[],
): (PlayoffBracketSeries | undefined)[] {
  return letters.map((L) =>
    pool.find((s) => s.seriesLetter?.trim().toUpperCase() === L),
  );
}

export function westBracketSlots(west: PlayoffBracketSeries[]): ConferenceBracketSlots {
  return {
    r1: [...orderedSeriesByLetters(WEST_R1_LETTERS, west)],
    r2: [...orderedSeriesByLetters(WEST_R2_LETTERS, west)],
    r3: [...orderedSeriesByLetters(WEST_R3_LETTERS, west)],
  };
}

export function eastBracketSlots(east: PlayoffBracketSeries[]): ConferenceBracketSlots {
  return {
    r1: [...orderedSeriesByLetters(EAST_R1_LETTERS, east)],
    r2: [...orderedSeriesByLetters(EAST_R2_LETTERS, east)],
    r3: [...orderedSeriesByLetters(EAST_R3_LETTERS, east)],
  };
}

export function roundSectionsForConference(
  series: PlayoffBracketSeries[],
): RoundSection[] {
  if (series.length === 0) return [];

  const sorted = [...series].sort(compareSeriesForDisplay);
  const out: RoundSection[] = [];
  let currentRound = sorted[0]!.playoffRound;
  let bucket: PlayoffBracketSeries[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const title =
      bucket[0]?.seriesTitle?.trim() ||
      `Round ${bucket[0]?.playoffRound ?? currentRound}`;
    out.push({
      round: currentRound,
      title,
      series: bucket,
    });
    bucket = [];
  };

  for (const s of sorted) {
    if (s.playoffRound !== currentRound) {
      flush();
      currentRound = s.playoffRound;
    }
    bucket.push(s);
  }
  flush();
  return out;
}
