import raw from "@/data/pool-rosters.json";
import { poolRostersFileSchema } from "@/lib/pool/roster-schema";

export function loadPoolRosters() {
  return poolRostersFileSchema.parse(raw);
}
