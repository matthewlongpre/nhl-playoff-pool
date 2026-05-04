import { NHL_WEB_API } from "@/lib/nhl/constants";
import {
  boxscoreResponseSchema,
  playoffBracketResponseSchema,
  scoreboardResponseSchema,
  type BoxscoreResponse,
  type PlayoffBracketResponse,
  type ScoreboardResponse,
} from "@/lib/nhl/schemas";

export async function fetchNhlScoreboard(
  date: string,
): Promise<ScoreboardResponse> {
  const upstream = await fetch(`${NHL_WEB_API}/scoreboard/${date}`, {
    next: { revalidate: 5 },
    headers: { Accept: "application/json" },
  });
  if (!upstream.ok) {
    throw new Error(`NHL scoreboard failed: ${upstream.status}`);
  }
  const json: unknown = await upstream.json();
  const parsed = scoreboardResponseSchema.safeParse(json);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    const hint = i ? ` (${i.path.join(".")}: ${i.message})` : "";
    throw new Error(`Unexpected scoreboard payload${hint}`);
  }
  return parsed.data;
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
