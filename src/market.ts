import type { Market, Rumour, Position, Side } from "./types.js";

/** Frame a scored rumour into a binary market with frozen terms. */
export function frame(r: Rumour, deadlineMs: number, chain: Market["chain"] = "solana"): Market {
  return {
    id: r.id,
    question: capitalize(r.text.trim()).replace(/\??$/, "?"),
    terms: `YES if the event described resolves true before ${new Date(deadlineMs).toISOString()}.`,
    deadline: deadlineMs,
    status: "open",
    yes: 50,
    volume: 0,
    chain,
  };
}

/** Quote the fill price for a size on a side, given the current book. */
export function quote(m: Market, side: Side): number {
  return side === "YES" ? m.yes : 100 - m.yes;
}

export function take(m: Market, side: Side, size: number, wallet: string): Position {
  if (m.status !== "open") throw new Error(`market ${m.id} is ${m.status}`);
  const price = quote(m, side);
  m.volume += size;
  // naive constant-product nudge; real book lives in the settlement layer
  const impact = Math.min(6, size / 500);
  m.yes = clamp(side === "YES" ? m.yes + impact : m.yes - impact, 1, 99);
  return { market: m.id, side, size, price, wallet, filledAt: Date.now() };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
