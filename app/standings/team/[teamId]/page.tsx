import type { Metadata } from "next";
import { PoolTeamDetailView } from "@/components/pool-team-detail-view";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import { SITE_TITLE } from "@/lib/site-metadata";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ teamId: string }>;
}): Promise<Metadata> {
  const { teamId } = await params;
  const rosters = loadPoolRosters();
  const team = rosters.teams.find((t) => t.id === teamId);
  if (!team) {
    return {
      title: "Team",
      description: "Playoff pool team page.",
    };
  }
  const pageTitle = team.name;
  const pageDescription = `${team.ownerName} — playoff pool standings, scoring, and game breakdown.`;
  return {
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
}

export default async function PoolTeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const rosters = loadPoolRosters();
  const allTeams = rosters.teams.map((t) => ({
    id: t.id,
    name: t.name,
    ownerName: t.ownerName,
    ownerAvatar: t.ownerAvatar,
  }));

  return <PoolTeamDetailView teamId={teamId} allTeams={allTeams} />;
}
