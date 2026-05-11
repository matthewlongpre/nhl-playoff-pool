import type { Metadata } from "next";
import { PoolBoxPickShare } from "@/components/pool-box-pick-share";
import { PoolSiteChrome } from "@/components/pool-site-chrome";
import { getCachedPlayoffTeamStatusByDate } from "@/lib/nhl/cached-playoff-team-status";
import { buildBoxPickShareByRound } from "@/lib/pool/box-pick-counts";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import { poolCalendarToday } from "@/lib/pool/pool-season";
import { SITE_TITLE } from "@/lib/site-metadata";

const pageTitle = "Boxes";
const pageDescription =
  "Pick counts per official box (East/West forwards, defence, teams) from the Friends of Longpre sheet.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: `${pageTitle} · ${SITE_TITLE}`,
    description: pageDescription,
  },
  twitter: {
    title: `${pageTitle} · ${SITE_TITLE}`,
    description: pageDescription,
  },
};

export default async function BoxesPage({
  searchParams,
}: {
  searchParams: Promise<{ simulateRankMovement?: string }>;
}) {
  const sp = await searchParams;
  const simulateRankMovement = sp.simulateRankMovement === "1";
  const simQ = simulateRankMovement ? "?simulateRankMovement=1" : "";

  const rosters = loadPoolRosters();
  const teamStatus = await getCachedPlayoffTeamStatusByDate(poolCalendarToday());
  const byRound = buildBoxPickShareByRound(rosters, undefined, teamStatus);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6">
      <PoolSiteChrome
        standingsHref={simulateRankMovement ? "/?simulateRankMovement=1" : "/"}
        scoringHref={simulateRankMovement ? `/scoring${simQ}` : "/scoring"}
        scoringPlayersHref={
          simulateRankMovement ? `/scoring/players${simQ}` : "/scoring/players"
        }
        isStandingsRoute={false}
        isScoringRoute={false}
        isScoringPoolTeamRoute={false}
        isScoringPlayersRoute={false}
        showScoringGroupNav={false}
      />

      <PoolBoxPickShare byRound={byRound} />
    </div>
  );
}
