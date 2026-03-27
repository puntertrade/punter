// Shared domain types for the Punter rumour engine.

export type Side = "YES" | "NO";
export type MarketStatus = "open" | "resolving" | "settled" | "void";

export interface Rumour {
  id: string;
  text: string;
  source: string;          // e.g. "ct", "leak", "listing-calendar"
  firstSeen: number;       // epoch ms
  mentions: number;
  newAccounts: number;     // accounts < 30d old amplifying it
  heat: number;            // 0..100, see heat.ts
}

export interface Market {
  id: string;
  question: string;
  terms: string;           // frozen resolution condition
  deadline: number;        // epoch ms
  status: MarketStatus;
  yes: number;             // live YES price in cents, 0..100
  volume: number;
  chain: "solana" | "ethereum" | "bnb" | "base";
}

export interface Position {
  market: string;
  side: Side;
  size: number;
  price: number;
  wallet: string;
  filledAt: number;
}
