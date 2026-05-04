import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { resolvePoolDateQueryParam } from "@/lib/pool/resolve-pool-date-query";

describe("resolvePoolDateQueryParam", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults missing date to pool calendar today", () => {
    const r = resolvePoolDateQueryParam(null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.date).toBe("2026-04-19");
  });

  it("rejects malformed dates", () => {
    const r = resolvePoolDateQueryParam("nope");
    expect(r.ok).toBe(false);
  });

  it("accepts valid explicit dates", () => {
    const r = resolvePoolDateQueryParam("2026-04-18");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.date).toBe("2026-04-18");
  });
});
