#!/usr/bin/env node
/**
 * One-shot: read `data/pool-rosters.json`, fetch NHL player landing names for every
 * skater `nhlPlayerId`, merge into `data/pool-skater-display-names.json` (keeps existing).
 *
 * Usage: npm run pool:skater-names
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NHL_WEB_API = "https://api-web.nhle.com/v1";
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "data/pool-skater-display-names.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rosters = JSON.parse(
  readFileSync(join(root, "data/pool-rosters.json"), "utf8"),
);

const ids = new Set();
for (const team of rosters.teams ?? []) {
  for (const p of team.picks ?? []) {
    if (p?.kind === "skater" && typeof p.nhlPlayerId === "number" && p.nhlPlayerId > 0) {
      ids.add(p.nhlPlayerId);
    }
  }
}

let names = {};
try {
  const prev = JSON.parse(readFileSync(outPath, "utf8"));
  if (prev && typeof prev.names === "object" && prev.names !== null) {
    names = { ...prev.names };
  }
} catch {
  // no previous file
}

const unique = [...ids].sort((a, b) => a - b);
const toFetch = unique.filter((id) => {
  const v = names[String(id)];
  return typeof v !== "string" || v.trim().length === 0;
});

async function fetchOne(playerId) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await fetch(`${NHL_WEB_API}/player/${playerId}/landing`, {
      headers: { Accept: "application/json" },
    });
    if (res.status === 429) {
      const wait = 2000 * 2 ** attempt;
      console.warn(`player ${playerId}: 429, retry in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      console.warn(`player ${playerId}: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const fn = json?.firstName?.default?.trim?.() ?? "";
    const ln = json?.lastName?.default?.trim?.() ?? "";
    const full = `${fn} ${ln}`.trim();
    return full.length > 0 ? full : null;
  }
  console.warn(`player ${playerId}: gave up after 429s`);
  return null;
}

let ok = 0;
let fail = 0;

for (const id of toFetch) {
  try {
    const name = await fetchOne(id);
    if (name) {
      names[String(id)] = name;
      ok += 1;
    } else {
      fail += 1;
    }
  } catch (e) {
    console.warn(`player ${id}:`, e);
    fail += 1;
  }
  await sleep(450);
}

const out = {
  version: 1,
  names,
};

writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");

const total = Object.keys(names).length;
console.log(
  `Merged ${ok} new names (${fail} failed). ${total}/${unique.length} ids in file; ${toFetch.length} were missing before this run.`,
);
