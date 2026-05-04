/** Walk `Error.cause` chains (Drizzle → postgres → …) for debugging. */
export function collectErrorMessages(error: unknown, maxDepth = 12): string[] {
  const out: string[] = [];
  let cur: unknown = error;
  for (let i = 0; i < maxDepth && cur != null; i++) {
    if (cur instanceof Error && cur.message) {
      out.push(cur.message);
    }
    cur =
      cur instanceof Error && cur.cause !== undefined ? cur.cause : undefined;
  }
  return out;
}

export function joinErrorChain(error: unknown, separator = " | "): string {
  return collectErrorMessages(error).join(separator);
}
