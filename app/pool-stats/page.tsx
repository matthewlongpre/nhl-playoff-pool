import type { Metadata } from "next";
import { PoolPickSimilarityHeatmap } from "@/components/pool-pick-similarity-heatmap";
import { PoolSiteChrome } from "@/components/pool-site-chrome";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import { buildPickSimilarityMatrix } from "@/lib/pool/pick-similarity";
import { SITE_TITLE } from "@/lib/site-metadata";

const pageTitle = "Pool stats";
const pageDescription =
  "Pick overlap across pool teams — heatmap, most alike and least alike pairs.";

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

export default async function PoolStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ simulateRankMovement?: string }>;
}) {
  const sp = await searchParams;
  const simulateRankMovement = sp.simulateRankMovement === "1";
  const simQ = simulateRankMovement ? "?simulateRankMovement=1" : "";

  const rosters = loadPoolRosters();
  const matrix = buildPickSimilarityMatrix(rosters);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-8">
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
      </header>

      <PoolPickSimilarityHeatmap data={matrix} />
    </div>
  );
}
