import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPoolRosters } from "@/lib/pool/load-rosters";
import { SITE_TITLE } from "@/lib/site-metadata";
import { PoolHeadToHeadView } from "@/components/pool-head-to-head-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ teamId: string; opponentId: string }>;
}): Promise<Metadata> {
  const { teamId, opponentId } = await params;
  const rosters = loadPoolRosters();
  const teamA = rosters.teams.find((t) => t.id === teamId);
  const teamB = rosters.teams.find((t) => t.id === opponentId);
  if (!teamA || !teamB) {
    return { title: "Head to Head" };
  }
  const pageTitle = `${teamA.name} vs ${teamB.name}`;
  const pageDescription = `Head to head: ${teamA.ownerName} vs ${teamB.ownerName} — scores, picks, and roster outlook.`;
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

export default async function HeadToHeadPage({
  params,
}: {
  params: Promise<{ teamId: string; opponentId: string }>;
}) {
  const { teamId, opponentId } = await params;
  const rosters = loadPoolRosters();
  const teamAExists = rosters.teams.some((t) => t.id === teamId);
  const teamBExists = rosters.teams.some((t) => t.id === opponentId);
  if (!teamAExists || !teamBExists || teamId === opponentId) {
    notFound();
  }

  const allTeams = rosters.teams.map((t) => ({
    id: t.id,
    name: t.name,
    ownerName: t.ownerName,
    ownerAvatar: t.ownerAvatar,
  }));

  return (
    <PoolHeadToHeadView
      teamIdA={teamId}
      teamIdB={opponentId}
      allTeams={allTeams}
    />
  );
}
