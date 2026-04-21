import type { Market, Position } from "./types.js";

/** Append-only in-memory ledger. Swappable for an on-chain / kv backend. */
export class Store {
  private markets = new Map<string, Market>();
  private positions: Position[] = [];

  upsertMarket(m: Market) { this.markets.set(m.id, m); return m; }
  getMarket(id: string) { return this.markets.get(id); }
  live() { return [...this.markets.values()].filter((m) => m.status === "open"); }

  record(p: Position) { this.positions.push(p); return p; }
  positionsFor(wallet: string) { return this.positions.filter((p) => p.wallet === wallet); }
}
