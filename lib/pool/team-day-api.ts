import type { PoolTeamCrewRow } from "@/lib/pool/day-sources-by-pool";
import type { SkatersSlatePoolTeam } from "@/lib/pool/skater-slate";

/** `GET /api/pool/team/[teamId]/day` — one NHL pass for daily scoring + skaters slate. */
export type TeamDayApiResponse = {
  date: string;
  gamesOnSlate: number;
  scoreboardMeta: {
    requestedDate: string;
    effectiveDate: string;
    fellBack: boolean;
  };
  playoffGamesForPoll: Array<{ gameState: string }>;
  slate: SkatersSlatePoolTeam;
  fantasy: PoolTeamCrewRow | null;
};
