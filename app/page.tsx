import type { Metadata } from "next";
import { PoolStandings } from "@/components/pool-standings";
import { SITE_TITLE } from "@/lib/site-metadata";

const pageTitle = "Standings";
const pageDescription =
  "Cumulative playoff pool leaderboard, daily scoring, and team breakdowns.";

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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ simulateRankMovement?: string }>;
}) {
  const sp = await searchParams;
  return (
    <PoolStandings
      poolView="standings"
      simulateRankMovement={sp.simulateRankMovement === "1"}
    />
  );
}
