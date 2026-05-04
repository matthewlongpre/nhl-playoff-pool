import type { PoolRostersFile } from "@/lib/pool/roster-schema";
import { pickSlateKey } from "@/lib/pool/slate-option-key";

const DEFAULT_ROUNDS = 24;

export type PoolTeamSimilarityRow = {
  teamId: string;
  name: string;
  ownerName: string;
  ownerAvatar?: string;
};

export type PickSimilarityMatrix = {
  rounds: number;
  teams: PoolTeamSimilarityRow[];
  /** Symmetric N×N, values in [0, 1]. Diagonal is always 1. */
  similarity: number[][];
};

function pickAtRound(team: PoolRostersFile["teams"][number], round: number) {
  return team.picks.find((p) => p.round === round);
}

/**
 * For each pair of pool teams, fraction of draft rounds (1…`rounds`) where both submitted
 * a pick and it is the same skater/team identity ({@link pickSlateKey}).
 * Rounds where either side is missing a pick count as no match.
 */
export function buildPickSimilarityMatrix(
  rosters: PoolRostersFile,
  rounds: number = DEFAULT_ROUNDS,
): PickSimilarityMatrix {
  const teams = rosters.teams.map((t) => ({
    teamId: t.id,
    name: t.name,
    ownerName: t.ownerName,
    ownerAvatar: t.ownerAvatar,
  }));

  const n = teams.length;
  const similarity: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );

  const rosterById = new Map(rosters.teams.map((t) => [t.id, t]));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        similarity[i]![j] = 1;
        continue;
      }
      const a = rosterById.get(teams[i]!.teamId)!;
      const b = rosterById.get(teams[j]!.teamId)!;
      let matches = 0;
      for (let r = 1; r <= rounds; r++) {
        const pa = pickAtRound(a, r);
        const pb = pickAtRound(b, r);
        if (!pa || !pb) continue;
        if (pickSlateKey(pa) === pickSlateKey(pb)) matches += 1;
      }
      similarity[i]![j] = matches / rounds;
    }
  }

  return { rounds, teams, similarity };
}

export type SimilarityPairHighlight = {
  teamA: PoolTeamSimilarityRow;
  teamB: PoolTeamSimilarityRow;
  /** Fraction of rounds matched, [0, 1] off-diagonal. */
  similarity: number;
  matchingRounds: number;
};

/**
 * Off-diagonal pairs with the highest and lowest similarity (first pair wins ties).
 */
export function getPickSimilarityExtremes(matrix: PickSimilarityMatrix): {
  mostSimilar: SimilarityPairHighlight | null;
  leastSimilar: SimilarityPairHighlight | null;
} {
  const { teams, similarity, rounds } = matrix;
  const n = teams.length;
  if (n < 2) {
    return { mostSimilar: null, leastSimilar: null };
  }

  let bestI = 0;
  let bestJ = 1;
  let bestSim = similarity[0]![1]!;

  let worstI = 0;
  let worstJ = 1;
  let worstSim = similarity[0]![1]!;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = similarity[i]![j]!;
      if (s > bestSim) {
        bestSim = s;
        bestI = i;
        bestJ = j;
      }
      if (s < worstSim) {
        worstSim = s;
        worstI = i;
        worstJ = j;
      }
    }
  }

  const toHighlight = (
    i: number,
    j: number,
    sim: number,
  ): SimilarityPairHighlight => ({
    teamA: teams[i]!,
    teamB: teams[j]!,
    similarity: sim,
    matchingRounds: Math.round(sim * rounds),
  });

  return {
    mostSimilar: toHighlight(bestI, bestJ, bestSim),
    leastSimilar: toHighlight(worstI, worstJ, worstSim),
  };
}
