import { describe, expect, it } from "vitest";
import { mergePoolSkaterDisplayNameMaps } from "@/lib/pool/pool-skater-display-names";

describe("mergePoolSkaterDisplayNameMaps", () => {
  it("overlays live onto static", () => {
    const a = new Map<number, string>([
      [1, "One"],
      [2, "Two"],
    ]);
    const b = new Map<number, string>([
      [2, "Two Live"],
      [3, "Three"],
    ]);
    const out = mergePoolSkaterDisplayNameMaps(a, b);
    expect([...out.entries()].sort((x, y) => x[0] - y[0])).toEqual([
      [1, "One"],
      [2, "Two Live"],
      [3, "Three"],
    ]);
  });
});
