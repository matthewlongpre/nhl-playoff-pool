import { format, parseISO, subDays } from "date-fns";
import type { ScoreboardResponse } from "@/lib/nhl/schemas";
import { fetchNhlScoreboard } from "@/lib/nhl/upstream";
import { getPoolPlayoffStartDate } from "@/lib/pool/pool-season";
import { isPlayoffGame } from "@/lib/pool/scoring";

const DEFAULT_MAX_BACK = 21;

function playoffCountForDate(
  scoreboard: ScoreboardResponse,
  date: string,
): number {
  const day = scoreboard.gamesByDate.find((d) => d.date === date);
  if (!day) return 0;
  return day.games.filter(isPlayoffGame).length;
}

/**
 * When the requested calendar day has no playoff games (off day), walk backward
 * to the most recent day that does, so the playoff slate is not empty.
 */
export async function fetchPlayoffScoreboardWithCalendarFallback(
  requestedDate: string,
  maxBack: number = DEFAULT_MAX_BACK,
): Promise<{
  scoreboard: ScoreboardResponse;
  effectiveDate: string;
  requestedDate: string;
  fellBack: boolean;
}> {
  const start = getPoolPlayoffStartDate();

  for (let i = 0; i <= maxBack; i++) {
    const candidate = format(subDays(parseISO(requestedDate), i), "yyyy-MM-dd");
    if (candidate < start) {
      break;
    }

    const scoreboard = await fetchNhlScoreboard(candidate);
    if (playoffCountForDate(scoreboard, candidate) > 0) {
      return {
        scoreboard,
        effectiveDate: candidate,
        requestedDate: requestedDate,
        fellBack: i > 0,
      };
    }
  }

  const scoreboard = await fetchNhlScoreboard(requestedDate);
  return {
    scoreboard,
    effectiveDate: requestedDate,
    requestedDate: requestedDate,
    fellBack: false,
  };
}
