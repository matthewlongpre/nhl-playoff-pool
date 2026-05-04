import { describe, expect, it } from "vitest";
import {
  formatGoalsAssistsCompact,
  formatGoalsAssistsProse,
  formatGoalsAssistsShort,
  formatWinsTonight,
} from "@/lib/format-stats";

describe("formatGoalsAssistsShort", () => {
  it("omits zero goals", () => {
    expect(formatGoalsAssistsShort(0, 3)).toBe("3 A");
  });

  it("omits zero assists", () => {
    expect(formatGoalsAssistsShort(2, 0)).toBe("2 G");
  });

  it("joins both when non-zero", () => {
    expect(formatGoalsAssistsShort(1, 2)).toBe("1 G · 2 A");
  });

  it("returns null when both zero", () => {
    expect(formatGoalsAssistsShort(0, 0)).toBeNull();
  });
});

describe("formatGoalsAssistsProse", () => {
  it("omits zero goals", () => {
    expect(formatGoalsAssistsProse(0, 1)).toBe("1 assist");
  });
});

describe("formatGoalsAssistsCompact", () => {
  it("skips zero parts", () => {
    expect(formatGoalsAssistsCompact(0, 2)).toBe("2A");
  });
});

describe("formatWinsTonight", () => {
  it("returns empty for zero wins", () => {
    expect(formatWinsTonight(0)).toBe("");
  });

  it("uses compact copy for one win", () => {
    expect(formatWinsTonight(1)).toBe("Won tonight");
  });

  it("pluralizes multiple wins", () => {
    expect(formatWinsTonight(2)).toBe("2 wins tonight");
  });
});
