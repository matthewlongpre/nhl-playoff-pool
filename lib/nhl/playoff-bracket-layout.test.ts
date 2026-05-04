import { describe, expect, it } from "vitest";
import type { PlayoffBracketResponse } from "@/lib/nhl/schemas";
import {
  conferenceForSeries,
  eastBracketSlots,
  groupForDisplay,
  roundSectionsForConference,
  westBracketSlots,
} from "@/lib/nhl/playoff-bracket-layout";

/** Trimmed from `GET /v1/playoff-bracket/2025` — letters + conferences only. */
const bracket2025Sample: PlayoffBracketResponse = {
  series: [
    {
      seriesAbbrev: "R1",
      seriesLetter: "A",
      seriesTitle: "1st Round",
      playoffRound: 1,
      topSeedWins: 4,
      bottomSeedWins: 2,
      topSeedTeam: { id: 10, abbrev: "TOR" },
      bottomSeedTeam: { id: 9, abbrev: "OTT" },
    },
    {
      seriesAbbrev: "R1",
      seriesLetter: "E",
      seriesTitle: "1st Round",
      playoffRound: 1,
      topSeedWins: 4,
      bottomSeedWins: 3,
      topSeedTeam: { id: 52, abbrev: "WPG" },
      bottomSeedTeam: { id: 19, abbrev: "STL" },
    },
    {
      seriesAbbrev: "R2",
      seriesLetter: "I",
      seriesTitle: "2nd Round",
      playoffRound: 2,
      topSeedWins: 3,
      bottomSeedWins: 4,
      topSeedTeam: { id: 10, abbrev: "TOR" },
      bottomSeedTeam: { id: 13, abbrev: "FLA" },
    },
    {
      seriesAbbrev: "R2",
      seriesLetter: "K",
      seriesTitle: "2nd Round",
      playoffRound: 2,
      topSeedWins: 2,
      bottomSeedWins: 4,
      topSeedTeam: { id: 52, abbrev: "WPG" },
      bottomSeedTeam: { id: 25, abbrev: "DAL" },
    },
    {
      seriesAbbrev: "ECF",
      seriesLetter: "M",
      seriesTitle: "Eastern Conference Finals",
      conferenceAbbrev: "E",
      conferenceName: "Eastern",
      playoffRound: 3,
      topSeedWins: 1,
      bottomSeedWins: 4,
      topSeedTeam: { id: 12, abbrev: "CAR" },
      bottomSeedTeam: { id: 13, abbrev: "FLA" },
    },
    {
      seriesAbbrev: "WCF",
      seriesLetter: "N",
      seriesTitle: "Western Conference Finals",
      conferenceAbbrev: "W",
      conferenceName: "Western",
      playoffRound: 3,
      topSeedWins: 1,
      bottomSeedWins: 4,
      topSeedTeam: { id: 25, abbrev: "DAL" },
      bottomSeedTeam: { id: 22, abbrev: "EDM" },
    },
    {
      seriesAbbrev: "SCF",
      seriesLetter: "O",
      seriesTitle: "Stanley Cup Final",
      playoffRound: 4,
      topSeedWins: 2,
      bottomSeedWins: 4,
      topSeedTeam: { id: 22, abbrev: "EDM" },
      bottomSeedTeam: { id: 13, abbrev: "FLA" },
    },
  ],
};

describe("conferenceForSeries", () => {
  it("maps R1 letters A–D to East and E–H to West", () => {
    expect(conferenceForSeries(bracket2025Sample.series[0]!)).toBe("east");
    expect(conferenceForSeries(bracket2025Sample.series[1]!)).toBe("west");
  });

  it("maps R2 I,J East and K,L West", () => {
    expect(conferenceForSeries(bracket2025Sample.series[2]!)).toBe("east");
    expect(conferenceForSeries(bracket2025Sample.series[3]!)).toBe("west");
  });

  it("uses conferenceAbbrev when set", () => {
    expect(conferenceForSeries(bracket2025Sample.series[4]!)).toBe("east");
    expect(conferenceForSeries(bracket2025Sample.series[5]!)).toBe("west");
  });

  it("treats Stanley Cup Final as final bucket", () => {
    expect(conferenceForSeries(bracket2025Sample.series[6]!)).toBe("final");
  });
});

describe("groupForDisplay", () => {
  it("splits East, West, and Final", () => {
    const g = groupForDisplay(bracket2025Sample);
    expect(g.east.map((s) => s.seriesLetter)).toEqual(["A", "I", "M"]);
    expect(g.west.map((s) => s.seriesLetter)).toEqual(["E", "K", "N"]);
    expect(g.final.map((s) => s.seriesLetter)).toEqual(["O"]);
  });
});

describe("roundSectionsForConference", () => {
  it("chunks by playoffRound in display order", () => {
    const g = groupForDisplay(bracket2025Sample);
    const eastSections = roundSectionsForConference(g.east);
    expect(eastSections.length).toBe(3);
    expect(eastSections[0]!.round).toBe(1);
    expect(eastSections[0]!.title).toBe("1st Round");
    expect(eastSections[1]!.round).toBe(2);
    expect(eastSections[2]!.round).toBe(3);
  });
});

describe("eastBracketSlots / westBracketSlots", () => {
  it("orders series by NHL bracket letters", () => {
    const g = groupForDisplay(bracket2025Sample);
    const east = eastBracketSlots(g.east);
    expect(east.r1.map((s) => s?.seriesLetter)).toEqual(["A", undefined, undefined, undefined]);
    expect(east.r2.map((s) => s?.seriesLetter)).toEqual(["I", undefined]);
    expect(east.r3.map((s) => s?.seriesLetter)).toEqual(["M"]);

    const west = westBracketSlots(g.west);
    expect(west.r1.map((s) => s?.seriesLetter)).toEqual(["E", undefined, undefined, undefined]);
    expect(west.r2.map((s) => s?.seriesLetter)).toEqual(["K", undefined]);
    expect(west.r3.map((s) => s?.seriesLetter)).toEqual(["N"]);
  });
});
