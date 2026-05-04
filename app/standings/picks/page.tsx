import { redirect } from "next/navigation";

/** Legacy URL — team mix now lives at the bottom of `/`. */
export default async function StandingsPicksRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ simulateRankMovement?: string }>;
}) {
  const sp = await searchParams;
  const base =
    sp.simulateRankMovement === "1" ? "/?simulateRankMovement=1" : "/";
  redirect(`${base}#team-mix`);
}
