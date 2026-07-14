// Live rumour signal — pulls real data. CoinGecko trending needs no key and
// works out of the box; if a Twitter (twitterapi.io) key is present in
// TWITTERAPI_KEY / PUNTER_X_KEY, CT mention velocity is layered on top.

export interface Signal {
  ticker: string;
  name: string;
  rank: number | null;
  heat: number;
  change24h: number;
  volume: number;
  mentions: number;
  ageMin: number;
  source: "trending" | "ct" | "trending+ct";
  quote?: string; // a real CT snippet, when available
}

const CG = "https://api.coingecko.com/api/v3";
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function num(v: unknown): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Real trending coins from CoinGecko — no API key required. */
export async function fetchTrending(): Promise<Signal[]> {
  const res = await fetch(`${CG}/search/trending`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`coingecko ${res.status}`);
  const data = (await res.json()) as any;
  const coins: any[] = (data.coins ?? []).slice(0, 14);

  const out: Signal[] = coins.map((c, i) => {
    const it = c.item ?? {};
    const chg = num(it.data?.price_change_percentage_24h?.usd);
    const vol = num(it.data?.total_volume);
    const trend = 1 - i / Math.max(1, coins.length);
    const momentum = Math.min(1, Math.abs(chg) / 40);
    const volNorm = Math.min(1, Math.log10(1 + vol) / 10);
    const heat = Math.round(100 * clamp01(0.52 * trend + 0.33 * momentum + 0.15 * volNorm));
    return {
      ticker: String(it.symbol ?? "?").toUpperCase(),
      name: String(it.name ?? "?"),
      rank: it.market_cap_rank ?? null,
      heat,
      change24h: chg,
      volume: vol,
      mentions: 0,
      ageMin: 0,
      source: "trending" as const,
    };
  });
  return out.sort((a, b) => b.heat - a.heat);
}

/** Layer real CT mention velocity + a live snippet onto the signals. One request. */
export async function enrichWithCT(signals: Signal[], key: string): Promise<Signal[]> {
  try {
    // Build one broad query from the actual trending tickers, so tweets we get
    // back really mention what's moving right now.
    const tickers = [...new Set(signals.slice(0, 10).map((s) => s.ticker))].filter(
      (t) => /^[A-Z0-9]{2,10}$/.test(t),
    );
    if (!tickers.length) return signals;
    const orGroup = "(" + tickers.map((t) => `$${t}`).join(" OR ") + ")";
    const query = encodeURIComponent(`${orGroup} lang:en -is:retweet`);
    const res = await fetch(
      `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${query}&queryType=Latest`,
      { headers: { "X-API-Key": key } },
    );
    if (!res.ok) return signals;
    const d = (await res.json()) as any;
    const tweets: any[] = d.tweets ?? [];
    const now = Date.now();

    const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const s of signals) {
      const re = new RegExp(`\\$${esc(s.ticker)}\\b|\\b${esc(s.name)}\\b`, "i");
      const hits = tweets.filter((t) => re.test(t.text ?? ""));
      if (!hits.length) continue;
      s.mentions = hits.length;
      s.source = s.source === "trending" ? "trending+ct" : "ct";
      const newest = Math.max(...hits.map((t) => Date.parse(t.createdAt) || 0));
      if (newest > 0) s.ageMin = Math.max(0, Math.round((now - newest) / 60000));
      const q = (hits[0].text ?? "").replace(/\s+/g, " ").trim();
      if (q) s.quote = q.slice(0, 88);
      s.heat = Math.min(100, s.heat + Math.min(12, hits.length * 2));
    }
  } catch {
    // Twitter is best-effort enrichment — never fail the scan over it.
  }
  return signals.sort((a, b) => b.heat - a.heat);
}

export function twitterKey(): string | undefined {
  return process.env.TWITTERAPI_KEY || process.env.PUNTER_X_KEY || undefined;
}

/** Full live scan: trending (always) + CT (if a key is configured). */
export async function scanLive(): Promise<{ signals: Signal[]; ct: boolean }> {
  const signals = await fetchTrending();
  const key = twitterKey();
  if (key) {
    await enrichWithCT(signals, key);
    return { signals, ct: true };
  }
  return { signals, ct: false };
}
