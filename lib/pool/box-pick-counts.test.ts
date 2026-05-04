import { describe, expect, it } from "vitest";
import { buildBoxPickShareByRound } from "@/lib/pool/box-pick-counts";
import type { PoolBoxSlatesFile } from "@/lib/pool/box-slates-schema";
import { loadPoolBoxSlates } from "@/lib/pool/load-box-slates";
import type { PoolRostersFile } from "@/lib/pool/roster-schema";

const miniSlate: PoolBoxSlatesFile = {
  version: 1,
  rounds: [
    {
      round: 1,
      title: "East Fwd 1",
      options: [
        { kind: "skater", label: "Kucherov, N", nhlTeamAbbrev: "TBL" },
        { kind: "skater", label: "Pastrnak, D", nhlTeamAbbrev: "BOS" },
      ],
    },
    {
      round: 2,
      title: "East Fwd 2",
      options: [
        { kind: "skater", label: "Hagel, B", nhlTeamAbbrev: "TBL" },
        { kind: "skater", label: "Aho, S", nhlTeamAbbrev: "CAR" },
      ],
    },
  ],
};

describe("loadPoolBoxSlates", () => {
  it("parses the Friends of Longpre 24-round sheet", () => {
    const s = loadPoolBoxSlates();
    expect(s.rounds).toHaveLength(24);
    expect(s.rounds[0]!.round).toBe(1);
    expect(s.rounds[0]!.title).toBe("East Fwd 1");
    expect(s.rounds[23]!.title).toBe("West Team 2");
  });
});

describe("buildBoxPickShareByRound", () => {
  it("counts picks against official slate rows (label + team)", () => {
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
              label: "Kucherov, N",
              position: "F",
              nhlTeamAbbrev: "TBL",
              nhlPlayerId: 8476453,
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
              label: "Kucherov, N",
              position: "F",
              nhlTeamAbbrev: "TBL",
              nhlPlayerId: 8476453,
            },
          ],
        },
      ],
    };

    const rows = buildBoxPickShareByRound(rosters, miniSlate);
    const r1 = rows.find((r) => r.round === 1)!;
    expect(r1.title).toBe("East Fwd 1");
    expect(r1.pooliesInRound).toBe(2);
    const kuch = r1.entries.find((e) => e.label === "Kucherov, N");
    const pasta = r1.entries.find((e) => e.label === "Pastrnak, D");
    expect(kuch?.count).toBe(2);
    expect(pasta?.count).toBe(0);
  });

  it("shows zero on slate rows nobody took in that round", () => {
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
              label: "Kucherov, N",
              position: "F",
              nhlTeamAbbrev: "TBL",
              nhlPlayerId: 1,
            },
            {
              round: 2,
              kind: "skater",
              label: "Hagel, B",
              position: "F",
              nhlTeamAbbrev: "TBL",
              nhlPlayerId: 2,
            },
          ],
        },
      ],
    };

    const rows = buildBoxPickShareByRound(rosters, miniSlate);
    const r1 = rows.find((r) => r.round === 1)!;
    const pasta = r1.entries.find((e) => e.label === "Pastrnak, D");
    expect(pasta?.count).toBe(0);
  });

  it("flags roster picks that do not match any slate row", () => {
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
              label: "Nobody, X",
              position: "F",
              nhlTeamAbbrev: "BUF",
              nhlPlayerId: 999,
            },
          ],
        },
      ],
    };

    const rows = buildBoxPickShareByRound(rosters, miniSlate);
    const r1 = rows.find((r) => r.round === 1)!;
    const overflow = r1.entries.filter((e) => e.notOnSlate);
    expect(overflow).toHaveLength(1);
    expect(overflow[0]!.label).toBe("Nobody, X");
    expect(overflow[0]!.count).toBe(1);
  });
});
