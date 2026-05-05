#!/usr/bin/env node
import { scan } from "./scanner.js";
import { frame } from "./market.js";

const [cmd, ...rest] = process.argv.slice(2);

async function main() {
  if (cmd === "scan") {
    // demo feed; wire a real CT adapter via --source
    const feed = { async pull() { return demo(); } };
    const rumours = await scan(feed);
    for (const r of rumours) console.log(`${String(r.heat).padStart(3)}  ${r.text}`);
    return;
  }
  if (cmd === "open") {
    const q = rest.filter((a) => !a.startsWith("--")).join(" ");
    const m = frame({ id: "cli", text: q, source: "cli", firstSeen: Date.now(), mentions: 1, newAccounts: 0, heat: 0 }, Date.now() + 72 * 3_600_000);
    console.log(JSON.stringify(m, null, 2));
    return;
  }
  console.log("usage: punter <scan|open>");
}

const demo = () => [
  { id: "1", text: "TOKEN listing on Binance", author: "a", createdAt: Date.now() - 6e5, source: "ct" },
  { id: "2", text: "Fund rotating into the airdrop", author: "b", createdAt: Date.now() - 12e5, source: "leak" },
];

main().catch((e) => { console.error(e); process.exit(1); });
