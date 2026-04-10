import type { Rumour } from "./types.js";

/**
 * Rumour heat — a bounded 0..100 signal blending three components:
 *   - mention spike (how loud, log-scaled)
 *   - freshness (younger rumours score higher)
 *   - new-account velocity (organic CT vs coordinated shilling)
 *
 * The window before a rumour is consensus is where the edge lives, so
 * freshness is weighted hard and decays over ~6h.
 */
const HOUR = 3_600_000;

export function heat(r: Omit<Rumour, "heat">, now = Date.now()): number {
  const ageH = Math.max(0, (now - r.firstSeen) / HOUR);
  const freshness = Math.exp(-ageH / 6);                 // 1 → 0 over ~6h
  const loudness = Math.log10(1 + r.mentions) / 3;       // ~0..1 at 1000 mentions
  const organic = r.mentions > 0 ? clamp01(1 - r.newAccounts / r.mentions) : 0;
  const raw = 0.5 * freshness + 0.35 * loudness + 0.15 * organic;
  return Math.round(clamp01(raw) * 100);
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
