import type { Metadata } from "next";
import { Suspense } from "react";
import { CenteredLoading } from "@/components/centered-loading";
import { PlayoffBracketPanel } from "@/components/playoff-bracket-panel";
import { SITE_TITLE } from "@/lib/site-metadata";

const pageTitle = "Playoff bracket";
const pageDescription =
  "Stanley Cup Playoffs bracket: series matchups and wins from the NHL web API.";

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

export default function NhlBracketPage() {
  return (
    <Suspense
      fallback={
        <CenteredLoading message="Loading bracket…" variant="viewport" />
      }
    >
      <PlayoffBracketPanel />
    </Suspense>
  );
}
