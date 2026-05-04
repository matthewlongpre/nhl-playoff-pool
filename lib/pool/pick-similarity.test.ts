import { describe, expect, it } from "vitest";
import {
  buildPickSimilarityMatrix,
  getPickSimilarityExtremes,
} from "@/lib/pool/pick-similarity";
import type { PoolRostersFile } from "@/lib/pool/roster-schema";

describe("buildPickSimilarityMatrix", () => {
  it("is 1 on the diagonal and symmetric off-diagonal", () => {
    const rosters: PoolRostersFile = {
      version: 1,
      teams: [
        {
          id: "a",
          name: "A",
          ownerName: "OA",
          picks: [
            {
              round: 1,
              kind: "skater",
              label: "X",
              position: "F",
              nhlTeamAbbrev: "EDM",
              nhlPlayerId: 1,
            },
          ],
        },
        {
          id: "b",
          name: "B",
          ownerName: "OB",
          picks: [
            {
              round: 1,
              kind: "skater",
              label: "X",
              position: "F",
              nhlTeamAbbrev: "EDM",
              nhlPlayerId: 1,
            },
          ],
        },
      ],
    };

    const { similarity } = buildPickSimilarityMatrix(rosters, 24);
    expect(similarity[0]![0]).toBe(1);
    expect(similarity[1]![1]).toBe(1);
    expect(similarity[0]![1]).toBeCloseTo(1 / 24);
    expect(similarity[1]![0]).toBe(similarity[0]![1]);
  });

  it("counts identical picks across all overlapping rounds", () => {
    const rosters: PoolRostersFile = {
      version: 1,
      teams: [
        {
          id: "a",
          name: "A",
          ownerName: "OA",
          picks: [
            {
              round: 1,
              kind: "skater",
              label: "X",
              position: "F",
              nhlTeamAbbrev: "EDM",
              nhlPlayerId: 1,
            },
            {
              round: 2,
              kind: "skater",
              label: "Y",
              position: "F",
              nhlTeamAbbrev: "EDM",
              nhlPlayerId: 2,
            },
          ],
        },
        {
          id: "b",
          name: "B",
          ownerName: "OB",
          picks: [
            {
              round: 1,
              kind: "skater",
              label: "X",
              position: "F",
              nhlTeamAbbrev: "EDM",
              nhlPlayerId: 1,
            },
            {
              round: 2,
              kind: "skater",
              label: "Z",
              position: "F",
              nhlTeamAbbrev: "EDM",
              nhlPlayerId: 3,
            },
          ],
        },
      ],
    };

    const { similarity } = buildPickSimilarityMatrix(rosters, 2);
    expect(similarity[0]![1]).toBeCloseTo(0.5);
  });
});

describe("getPickSimilarityExtremes", () => {
  it("returns null when fewer than two teams", () => {
    const rosters: PoolRostersFile = {
      version: 1,
      teams: [
        {
          id: "a",
          name: "A",
          ownerName: "OA",
          picks: [
            {
              round: 1,
              kind: "skater",
              label: "X",
              position: "F",
              nhlTeamAbbrev: "EDM",
              nhlPlayerId: 1,
            },
          ],
        },
      ],
    };
    const m = buildPickSimilarityMatrix(rosters, 24);
    const x = getPickSimilarityExtremes(m);
    expect(x.mostSimilar).toBeNull();
    expect(x.leastSimilar).toBeNull();
  });

  it("finds highest and lowest off-diagonal pair", () => {
    const rosters: PoolRostersFile = {
      version: 1,
      teams: [
        {
          id: "a",
          name: "A",
          ownerName: "OA",
          picks: [
            {
              round: 1,
              kind: "skater",
              label: "X",
              position: "F",
              nhlTeamAbbrev: "EDM",
              nhlPlayerId: 1,
            },
          ],
        },
        {
          id: "b",
          name: "B",
          ownerName: "OB",
          picks: [
            {
              round: 1,
              kind: "skater",
              label: "X",
              position: "F",
              nhlTeamAbbrev: "EDM",
              nhlPlayerId: 1,
            },
          ],
        },
        {
          id: "c",
          name: "C",
          ownerName: "OC",
          picks: [
            {
              round: 1,
              kind: "skater",
              label: "Y",
              position: "F",
              nhlTeamAbbrev: "EDM",
              nhlPlayerId: 2,
            },
          ],
        },
      ],
    };

    const m = buildPickSimilarityMatrix(rosters, 24);
    const { mostSimilar, leastSimilar } = getPickSimilarityExtremes(m);
    expect(mostSimilar?.teamA.teamId).toBe("a");
    expect(mostSimilar?.teamB.teamId).toBe("b");
    expect(mostSimilar?.matchingRounds).toBe(1);
    expect(leastSimilar?.teamA.teamId).toBe("a");
    expect(leastSimilar?.teamB.teamId).toBe("c");
    expect(leastSimilar?.matchingRounds).toBe(0);
  });
});
