import type { DependencyEdge } from "@waypoint/shared";

// Pure projection helpers shared by the read models (inbox, spine, re-entry story/digest).
// No ports, no clock, no random — same input always yields the same output, so every read
// model agrees and stays unit-testable without a transaction.

// Friendly name pools for the deterministic session alias. A stable, human-legible "who"
// derived from a session id, so the same session always reads as the same actor in the
// story/spine without ever exposing the raw id (security.md).
const ALIAS_ADJECTIVES = [
  "swift",
  "calm",
  "bright",
  "bold",
  "keen",
  "wise",
  "brave",
  "quiet",
  "sharp",
  "deft",
] as const;
const ALIAS_NOUNS = [
  "otter",
  "falcon",
  "maple",
  "harbor",
  "cedar",
  "comet",
  "river",
  "lark",
  "ember",
  "fox",
] as const;

export function stableAliasFromSession(sessionId: string): string {
  // FNV-1a 32-bit hash → deterministic index into the friendly name pools.
  let h = 0x811c9dc5;
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const u = h >>> 0;
  const adj = ALIAS_ADJECTIVES[u % ALIAS_ADJECTIVES.length] ?? "agent";
  const noun =
    ALIAS_NOUNS[Math.floor(u / ALIAS_ADJECTIVES.length) % ALIAS_NOUNS.length] ?? "session";
  return `${adj}-${noun}`;
}

// Count of nodes that directly depend on `nodeId` — its blast radius (direct edges only).
export function countDependents(edges: DependencyEdge[], nodeId: string): number {
  return edges.filter((e) => e.dependsOnId === nodeId).length;
}
