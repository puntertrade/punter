import type { Market, Side } from "./types.js";

/**
 * The oracle resolves a market against reality. Resolution is a pure read of
 * the frozen terms — no discretion. In production the resolver set is
 * decentralized and bonded; here we expose the interface + a manual resolver.
 */
export interface Resolver { resolve(m: Market): Promise<Side | "void">; }

export async function settle(m: Market, resolver: Resolver): Promise<Market> {
  if (Date.now() < m.deadline) throw new Error("deadline not reached");
  m.status = "resolving";
  const outcome = await resolver.resolve(m);
  m.status = outcome === "void" ? "void" : "settled";
  return m;
}

export const manualResolver = (outcome: Side | "void"): Resolver => ({
  async resolve() { return outcome; },
});
