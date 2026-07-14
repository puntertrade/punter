import type { Rumour } from "./types.js";
import { heat } from "./heat.js";

/**
 * The scanner turns a raw CT feed into scored rumour candidates. The feed
 * adapter is injected so the same core runs over live search, a firehose,
 * or a fixture in tests.
 */
export interface FeedItem { id: string; text: string; author: string; createdAt: number; source: string; }
export interface Feed { pull(sinceMs: number): Promise<FeedItem[]>; }

const KEYS = /\b(list(ing|s|ed)?|launch|tge|airdrop|unlock|partnership|leak|mainnet)\b/i;

export async function scan(feed: Feed, sinceMs = Date.now() - 6 * 3_600_000): Promise<Rumour[]> {
  const items = await feed.pull(sinceMs);
  const groups = new Map<string, FeedItem[]>();
  for (const it of items) {
    if (!KEYS.test(it.text)) continue;
    const key = normalize(it.text);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(it);
  }
  const out: Rumour[] = [];
  for (const [key, g] of groups) {
    const firstSeen = Math.min(...g.map((x) => x.createdAt));
    const base = {
      id: key.slice(0, 24),
      text: g[0].text,
      source: g[0].source,
      firstSeen,
      mentions: g.length,
      newAccounts: 0, // resolved by the account-age adapter downstream
    };
    out.push({ ...base, heat: heat(base) });
  }
  return out.sort((a, b) => b.heat - a.heat);
}

const normalize = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((w) => w.length > 3).slice(0, 8).join("-");
