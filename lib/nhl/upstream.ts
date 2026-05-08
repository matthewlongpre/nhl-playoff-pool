import { NHL_WEB_API } from "@/lib/nhl/constants";
import {
  boxscoreResponseSchema,
  playoffBracketResponseSchema,
  scoreboardResponseSchema,
  type BoxscoreResponse,
  type PlayoffBracketResponse,
  type ScoreboardResponse,
} from "@/lib/nhl/schemas";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * NHL web API rate-limits bursty parallel scoreboard calls (429). Retry with backoff
 * and respect `Retry-When` when present.
 */
export async function fetchNhlScoreboard(
  date: string,
): Promise<ScoreboardResponse> {
  const maxAttempts = 5;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const upstream = await fetch(`${NHL_WEB_API}/scoreboard/${date}`, {
      next: { revalidate: 5 },
      headers: { Accept: "application/json" },
    });
    if (upstream.ok) {
      const json: unknown = await upstream.json();
      const parsed = scoreboardResponseSchema.safeParse(json);
      if (!parsed.success) {
        const i = parsed.error.issues[0];
        const hint = i ? ` (${i.path.join(".")}: ${i.message})` : "";
        throw new Error(`Unexpected scoreboard payload${hint}`);
      }
      return parsed.data;
    }

    const status = upstream.status;
    if ((status === 429 || status === 503) && attempt < maxAttempts - 1) {
      const retryAfter = upstream.headers.get("Retry-After");
      let delayMs = 400 * 2 ** attempt + Math.floor(Math.random() * 150);
      if (retryAfter != null) {
        const sec = Number(retryAfter);
        if (Number.isFinite(sec) && sec > 0) {
          delayMs = Math.min(Math.max(sec * 1000, delayMs), 15_000);
        }
      }
      await sleep(delayMs);
      lastError = new Error(`NHL scoreboard failed: ${status}`);
      continue;
    }

    throw new Error(`NHL scoreboard failed: ${status}`);
  }
  throw lastError ?? new Error("NHL scoreboard failed");
}

export async function fetchNhlBoxscore(gameId: number): Promise<BoxscoreResponse> {
  const upstream = await fetch(
    `${NHL_WEB_API}/gamecenter/${gameId}/boxscore`,
    {
      next: { revalidate: 5 },
      headers: { Accept: "application/json" },
    },
  );
  if (!upstream.ok) {
    throw new Error(`NHL boxscore failed: ${upstream.status}`);
  }
  const json: unknown = await upstream.json();
  const parsed = boxscoreResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Unexpected boxscore payload");
  }
  return parsed.data;
}

export async function fetchNhlPlayoffBracket(
  season: number,
): Promise<PlayoffBracketResponse> {
  const upstream = await fetch(`${NHL_WEB_API}/playoff-bracket/${season}`, {
    next: { revalidate: 300 },
    headers: { Accept: "application/json" },
  });
  if (!upstream.ok) {
    throw new Error(`NHL playoff bracket failed: ${upstream.status}`);
  }
  const json: unknown = await upstream.json();
  const parsed = playoffBracketResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Unexpected playoff bracket payload");
  }
  return parsed.data;
}
