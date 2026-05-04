import { describe, expect, it } from "vitest";
import {
  nhleIsTbdPlaceholderLogoUrl,
  nhlePlayoffBracketCenterLogoUrl,
  nhleTeamLogoDarkSrcIfLight,
  nhleTeamLogoInvertOnTeamPrimaryBg,
  nhleTeamAbbrevFromNhleLightLogoSrc,
  nhlTeamLogoDarkSvgUrl,
  nhlTeamLogoLightSvgUrl,
} from "@/lib/nhl/media";

describe("nhleIsTbdPlaceholderLogoUrl", () => {
  it("detects NHLE TBD crest URLs", () => {
    expect(
      nhleIsTbdPlaceholderLogoUrl(
        "https://assets.nhle.com/logos/nhl/svg/team-tbd-light.svg",
      ),
    ).toBe(true);
    expect(
      nhleIsTbdPlaceholderLogoUrl(
        "https://assets.nhle.com/logos/nhl/svg/team-tbd-dark.svg",
      ),
    ).toBe(true);
    expect(nhleIsTbdPlaceholderLogoUrl("https://assets.nhle.com/logos/nhl/svg/MIN_light.svg")).toBe(
      false,
    );
  });
});

describe("nhlePlayoffBracketCenterLogoUrl", () => {
  it("maps horizontal banner to cup asset (en/fr)", () => {
    expect(
      nhlePlayoffBracketCenterLogoUrl(
        "https://assets.nhle.com/logos/playoffs/png/scp-20252026-horizontal-banner-en.png",
      ),
    ).toBe("https://assets.nhle.com/logos/playoffs/png/scp-20252026-cup.png");
    expect(
      nhlePlayoffBracketCenterLogoUrl(
        "https://assets.nhle.com/logos/playoffs/png/scp-20252026-horizontal-banner-fr.png",
      ),
    ).toBe("https://assets.nhle.com/logos/playoffs/png/scp-20252026-cup.png");
  });

  it("returns undefined for missing input", () => {
    expect(nhlePlayoffBracketCenterLogoUrl(undefined)).toBeUndefined();
    expect(nhlePlayoffBracketCenterLogoUrl("   ")).toBeUndefined();
  });

  it("passes through URLs that are not NHLE horizontal banners", () => {
    expect(nhlePlayoffBracketCenterLogoUrl("https://example.com/logo.png")).toBe(
      "https://example.com/logo.png",
    );
  });
});

describe("nhleTeamLogoDarkSrcIfLight", () => {
  it("maps NHLE light SVG to dark variant", () => {
    const light = nhlTeamLogoLightSvgUrl("TBL");
    expect(nhleTeamLogoDarkSrcIfLight(light)).toBe(nhlTeamLogoDarkSvgUrl("TBL"));
  });

  it("preserves query string when swapping", () => {
    const src = `${nhlTeamLogoLightSvgUrl("MIN")}?v=1`;
    expect(nhleTeamLogoDarkSrcIfLight(src)).toBe(`${nhlTeamLogoDarkSvgUrl("MIN")}?v=1`);
  });

  it("returns null for non-NHLE URLs", () => {
    expect(nhleTeamLogoDarkSrcIfLight("https://example.com/TBL_light.svg")).toBeNull();
  });

  it("returns null for NHLE URLs that are not light marks", () => {
    expect(
      nhleTeamLogoDarkSrcIfLight("https://assets.nhle.com/logos/nhl/svg/TBL_dark.svg"),
    ).toBeNull();
  });
});

describe("nhleTeamAbbrevFromNhleLightLogoSrc", () => {
  it("parses abbrev from NHLE light mark URLs", () => {
    expect(nhleTeamAbbrevFromNhleLightLogoSrc(nhlTeamLogoLightSvgUrl("TBL"))).toBe("TBL");
    expect(nhleTeamAbbrevFromNhleLightLogoSrc(`${nhlTeamLogoLightSvgUrl("MIN")}?v=2`)).toBe(
      "MIN",
    );
  });

  it("returns null for non-light NHLE marks", () => {
    expect(nhleTeamAbbrevFromNhleLightLogoSrc(nhlTeamLogoDarkSvgUrl("TBL"))).toBeNull();
  });
});

describe("nhleTeamLogoInvertOnTeamPrimaryBg", () => {
  it("is true for Tampa light mark", () => {
    expect(nhleTeamLogoInvertOnTeamPrimaryBg(nhlTeamLogoLightSvgUrl("TBL"))).toBe(true);
  });

  it("is false for other clubs", () => {
    expect(nhleTeamLogoInvertOnTeamPrimaryBg(nhlTeamLogoLightSvgUrl("MIN"))).toBe(false);
  });
});
