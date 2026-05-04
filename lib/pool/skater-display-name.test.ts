import { describe, expect, it } from "vitest";
import {
  formatSkaterDisplayName,
  skaterEyebrowAndPrimary,
} from "@/lib/pool/skater-display-name";

describe("formatSkaterDisplayName", () => {
  it("reorders Last, Initial to I. Last", () => {
    expect(formatSkaterDisplayName("Kaprizov, K")).toBe("K. Kaprizov");
    expect(formatSkaterDisplayName("McDavid, C")).toBe("C. McDavid");
  });

  it("uses First Last when a full first name is present", () => {
    expect(formatSkaterDisplayName("McDavid, Connor")).toBe("Connor McDavid");
  });

  it("returns unparsed labels unchanged", () => {
    expect(formatSkaterDisplayName("SingleName")).toBe("SingleName");
  });
});

describe("skaterEyebrowAndPrimary", () => {
  it("uses NHL full name for eyebrow + surname line", () => {
    expect(
      skaterEyebrowAndPrimary("Eriksson Ek, J", "Joel Eriksson Ek"),
    ).toEqual({ eyebrow: "Joel", primary: "Eriksson Ek" });
  });

  it("shows NHL initial on the eyebrow line when full first name is absent", () => {
    expect(skaterEyebrowAndPrimary("Kaprizov, K", "K. Kaprizov")).toEqual({
      eyebrow: "K.",
      primary: "Kaprizov",
    });
  });

  it("uses roster full first name when NHL name is absent", () => {
    expect(skaterEyebrowAndPrimary("McDavid, Connor", undefined)).toEqual({
      eyebrow: "Connor",
      primary: "McDavid",
    });
  });

  it("shows roster initial on the eyebrow line when NHL name is absent", () => {
    expect(skaterEyebrowAndPrimary("Eriksson Ek, J", undefined)).toEqual({
      eyebrow: "J.",
      primary: "Eriksson Ek",
    });
  });
});
