import { describe, expect, it } from "vitest";
import { formatPeriodDescriptorLabel } from "@/lib/nhl/period-descriptor";

describe("formatPeriodDescriptorLabel", () => {
  it("drops REG for periods 1–3", () => {
    expect(
      formatPeriodDescriptorLabel({ number: 1, periodType: "REG" }),
    ).toBe("P1");
    expect(
      formatPeriodDescriptorLabel({ number: 3, periodType: "REG" }),
    ).toBe("P3");
  });

  it("keeps type for OT and other periods", () => {
    expect(
      formatPeriodDescriptorLabel({ number: 4, periodType: "OT" }),
    ).toBe("P4 OT");
  });
});
