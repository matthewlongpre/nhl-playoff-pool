import type { Metadata } from "next";
import { Suspense } from "react";
import { CenteredLoading } from "@/components/centered-loading";
import { NhlDashboard } from "@/components/nhl-dashboard";
import { SITE_TITLE } from "@/lib/site-metadata";

const pageTitle = "Live scores";
const pageDescription =
  "Live NHL playoff scoreboard, game status, and box scores from the league API.";

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

export default function NhlScoresPage() {
  return (
    <Suspense
      fallback={
        <CenteredLoading message="Loading dashboard…" variant="viewport" />
      }
    >
      <NhlDashboard />
    </Suspense>
  );
}
