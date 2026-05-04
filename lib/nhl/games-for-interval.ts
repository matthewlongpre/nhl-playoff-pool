import type { ScoreboardResponse } from "@/lib/nhl/schemas";

export function getVisibleGamesForDay(
  scoreboard: ScoreboardResponse | undefined,
  date: string,
  playoffsOnly: boolean,
) {
  const day =
    scoreboard?.gamesByDate?.find((x) => x.date === date)?.games ?? [];
  return playoffsOnly ? day.filter((g) => g.gameType === 3) : day;
}
