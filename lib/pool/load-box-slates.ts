import raw from "@/data/pool-box-slates.json";
import { poolBoxSlatesFileSchema } from "@/lib/pool/box-slates-schema";

export function loadPoolBoxSlates() {
  return poolBoxSlatesFileSchema.parse(raw);
}
