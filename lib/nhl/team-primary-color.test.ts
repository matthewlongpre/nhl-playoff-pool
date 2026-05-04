import { describe, expect, it } from "vitest";
import { nhlTeamPrimaryHex } from "@/lib/nhl/team-primary-color";

describe("nhlTeamPrimaryHex", () => {
  it("returns a hex for known teams", () => {
    expect(nhlTeamPrimaryHex("TBL")).toMatch(/^#/);
    expect(nhlTeamPrimaryHex("tbl")).toBe(nhlTeamPrimaryHex("TBL"));
  });

  it("returns null for unknown abbrev", () => {
    expect(nhlTeamPrimaryHex("ZZZ")).toBeNull();
  });
});
