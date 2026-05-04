import type { Metadata } from "next";
import { PoolStandings } from "@/components/pool-standings";
import { SITE_TITLE } from "@/lib/site-metadata";

const pageTitle = "Daily scoring";
const pageDescription =
  "Playoff pool scoring from today’s games — by pool team or by NHL player.";

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

export default async function ScoringPage({
  searchParams,
}: {
  searchParams: Promise<{ simulateRankMovement?: string }>;
}) {
  const sp = await searchParams;
  return (
    <PoolStandings
      poolView="sources"
      simulateRankMovement={sp.simulateRankMovement === "1"}
    />
  );
}
