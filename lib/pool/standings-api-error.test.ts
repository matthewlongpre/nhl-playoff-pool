import { describe, expect, it, vi, afterEach } from "vitest";
import { publicMessageForStandingsFailure } from "@/lib/pool/standings-api-error";

describe("publicMessageForStandingsFailure", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects missing pool_team_daily_points table", () => {
    vi.stubEnv("NODE_ENV", "production");
    const err = new Error(
      'relation "pool_team_daily_points" does not exist',
    );
    expect(publicMessageForStandingsFailure(err)).toContain("npm run db:push");
  });
});
