import { describe, expect, it } from "vitest";
import { computePickDistributionRanking } from "@/lib/pool/pick-distribution-ranking";

describe("computePickDistributionRanking", () => {
  it("orders abbrevs by pool-wide pick weight", () => {
    const teams = [
      {
        name: "B",
        teamId: "b",
        entries: [{ abbrev: "TBL", count: 2, status: "active" as const }],
      },
      {
        name: "A",
        teamId: "a",
        entries: [
          { abbrev: "CAR", count: 1, status: "active" as const },
          { abbrev: "TBL", count: 1, status: "active" as const },
        ],
      },
    ];
    const r = computePickDistributionRanking(teams);
    expect(r.abbrevOrder).toEqual(["TBL", "CAR"]);
  });

  it("sorts teams by name and merges eliminated status across rosters", () => {
    const teams = [
      {
        name: "Zed",
        entries: [{ abbrev: "OTT", count: 1, status: "eliminated" as const }],
      },
      {
        name: "Alpha",
        entries: [{ abbrev: "OTT", count: 1, status: "active" as const }],
      },
    ];
    const r = computePickDistributionRanking(teams);
    expect(r.teamsSorted.map((t) => t.name)).toEqual(["Alpha", "Zed"]);
    expect(r.legendEntries.find((e) => e.abbrev === "OTT")?.status).toBe("eliminated");
  });
});
