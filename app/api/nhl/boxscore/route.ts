import { NextResponse } from "next/server";
import { fetchNhlBoxscore } from "@/lib/nhl/upstream";
import { BOXSCORE_CACHE_CONTROL } from "@/lib/nhl/constants";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get("gameId");
  const gameId = rawId ? Number.parseInt(rawId, 10) : NaN;
  if (!Number.isFinite(gameId) || gameId <= 0) {
    return NextResponse.json(
      { error: "Query parameter `gameId` (positive integer) is required." },
      { status: 400 },
    );
  }

  try {
    const data = await fetchNhlBoxscore(gameId);
    return NextResponse.json(data, {
      headers: { "Cache-Control": BOXSCORE_CACHE_CONTROL },
    });
  } catch {
    return NextResponse.json(
      { error: "NHL boxscore request failed." },
      { status: 502 },
    );
  }
}
