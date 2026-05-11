import type { BoxSlateOption } from "@/lib/pool/box-slates-schema";
import type { PoolBoxSlatesFile } from "@/lib/pool/box-slates-schema";
import { loadPoolBoxSlates } from "@/lib/pool/load-box-slates";
import type { NhlTeamPlayoffStatus } from "@/lib/nhl/schemas";
import type { PoolPick, PoolRostersFile } from "@/lib/pool/roster-schema";
import { isPickTeamStillActive } from "@/lib/pool/remaining-picks-by-team";
import { pickSlateKey, slateOptionToIdentityKey } from "@/lib/pool/slate-option-key";

export type PickShareEntry = {
  kind: "skater" | "team";
  label: string;
  count: number;
  roleLabel: string;
  nhlTeamAbbrev?: string;
  /** Team abbreviation (team rows) — for NHLE logo URL. */
  teamAbbrev?: string;
  /** From any pool roster row matching this sheet line (NHLE headshot). */
  nhlPlayerId?: number | null;
  /** Roster pick does not match any row on the official sheet (label/team mismatch). */
  notOnSlate?: boolean;
  /** NHL team is eliminated from the playoffs. */
  eliminated?: boolean;
};

export type RoundPickShare = {
  round: number;
  /** Official box name from the pool sheet (e.g. East Fwd 1). */
  title: string;
  /** Pool teams that have a pick recorded for this round */
  pooliesInRound: number;
  /** All pool teams (denominator for counts) */
  totalPoolTeams: number;
  entries: PickShareEntry[];
};

function roleLabelFromSlateTitle(title: string, opt: BoxSlateOption): string {
  if (opt.kind === "team") return "Team";
  return title.includes("Def") ? "D" : "F";
}

function optionToEntry(
  opt: BoxSlateOption,
  title: string,
  count: number,
  nhlPlayerIdFromRosters: number | null | undefined,
  statusByAbbrev: ReadonlyMap<string, NhlTeamPlayoffStatus>,
): PickShareEntry {
  if (opt.kind === "team") {
    return {
      kind: "team",
      label: opt.label,
      teamAbbrev: opt.teamAbbrev,
      count,
      roleLabel: "Team",
      eliminated: !isPickTeamStillActive(opt.teamAbbrev, statusByAbbrev),
    };
  }
  return {
    kind: "skater",
    label: opt.label,
    count,
    roleLabel: roleLabelFromSlateTitle(title, opt),
    nhlTeamAbbrev: opt.nhlTeamAbbrev,
    nhlPlayerId: nhlPlayerIdFromRosters ?? null,
    eliminated: !isPickTeamStillActive(opt.nhlTeamAbbrev, statusByAbbrev),
  };
}

function pickToOverflowEntry(
  pick: PoolPick,
  count: number,
  statusByAbbrev: ReadonlyMap<string, NhlTeamPlayoffStatus>,
): PickShareEntry {
  if (pick.kind === "team") {
    return {
      kind: "team",
      label: pick.label,
      teamAbbrev: pick.teamAbbrev,
      count,
      roleLabel: "Team",
      notOnSlate: true,
      eliminated: !isPickTeamStillActive(pick.teamAbbrev, statusByAbbrev),
    };
  }
  return {
    kind: "skater",
    label: pick.label,
    count,
    roleLabel: pick.position === "D" ? "D" : "F",
    nhlTeamAbbrev: pick.nhlTeamAbbrev,
    nhlPlayerId: pick.nhlPlayerId ?? null,
    notOnSlate: true,
    eliminated: !isPickTeamStillActive(pick.nhlTeamAbbrev, statusByAbbrev),
  };
}

/** First NHL player id seen for each skater sheet key across all rosters (for headshots). */
function buildGlobalSkaterKeyToPlayerId(
  rosters: PoolRostersFile,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const team of rosters.teams) {
    for (const pick of team.picks) {
      if (pick.kind !== "skater") continue;
      const id = pick.nhlPlayerId;
      if (typeof id !== "number" || id <= 0) continue;
      const k = pickSlateKey(pick);
      if (!m.has(k)) m.set(k, id);
    }
  }
  return m;
}

/**
 * Pick counts per official box row from {@link loadPoolBoxSlates} (Friends of Longpre sheet).
 */
export function buildBoxPickShareByRound(
  rosters: PoolRostersFile,
  slates: PoolBoxSlatesFile = loadPoolBoxSlates(),
  statusByAbbrev: ReadonlyMap<string, NhlTeamPlayoffStatus> = new Map(),
): RoundPickShare[] {
  const totalPoolTeams = rosters.teams.length;
  const skaterKeyToPlayerId = buildGlobalSkaterKeyToPlayerId(rosters);
  const out: RoundPickShare[] = [];

  for (const slate of [...slates.rounds].sort((a, b) => a.round - b.round)) {
    const slateKeySet = new Set(
      slate.options.map((opt) => slateOptionToIdentityKey(opt)),
    );

    const counts = new Map<string, number>();
    const keyToSamplePick = new Map<string, PoolPick>();
    let pooliesInRound = 0;

    for (const team of rosters.teams) {
      const pick = team.picks.find((x) => x.round === slate.round);
      if (!pick) continue;
      pooliesInRound += 1;
      const k = pickSlateKey(pick);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      if (!keyToSamplePick.has(k)) keyToSamplePick.set(k, pick);
    }

    const entries: PickShareEntry[] = slate.options.map((opt) =>
      optionToEntry(
        opt,
        slate.title,
        counts.get(slateOptionToIdentityKey(opt)) ?? 0,
        opt.kind === "skater"
          ? skaterKeyToPlayerId.get(slateOptionToIdentityKey(opt)) ?? null
          : undefined,
        statusByAbbrev,
      ),
    );

    const overflowKeys = [...counts.keys()].filter((k) => !slateKeySet.has(k));
    if (overflowKeys.length > 0) {
      overflowKeys.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
      for (const k of overflowKeys) {
        const pick = keyToSamplePick.get(k);
        if (!pick) continue;
        entries.push(pickToOverflowEntry(pick, counts.get(k) ?? 0, statusByAbbrev));
      }
    }

    out.push({
      round: slate.round,
      title: slate.title,
      pooliesInRound,
      totalPoolTeams,
      entries,
    });
  }

  return out;
}
