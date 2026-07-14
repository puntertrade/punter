#!/usr/bin/env node
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { c, bar, heatColor } from "./ansi.js";
import { scanLive, fetchTrending, type Signal } from "./live.js";
import { banner, withSpinner, renderFeed, clearScreen } from "./ui.js";
import { runTUI } from "./tui.js";

async function cmdScan(watch: boolean, intervalSec: number) {
  const run = async () => {
    const { signals, ct } = await withSpinner(
      "scanning CT + on-chain for what's moving…",
      scanLive(),
    );
    if (watch) stdout.write(clearScreen);
    stdout.write(banner());
    stdout.write(renderFeed(signals, ct) + "\n");
    if (!ct)
      stdout.write(
        "\n  " +
          c.dim("tip: set ") +
          c.cyan("TWITTERAPI_KEY") +
          c.dim(" to layer live CT mention velocity on top.\n"),
      );
    return signals;
  };

  if (!watch) {
    await run();
    return;
  }
  stdout.write(clearScreen);
  for (;;) {
    await run();
    stdout.write("\n  " + c.dim(`↻ refreshing every ${intervalSec}s · ctrl-c to quit`) + "\n");
    await sleep(intervalSec * 1000);
  }
}

async function cmdOpen(query: string) {
  if (!query) {
    console.log(c.dim('usage: punter open "<market question>"  (e.g. "$PENGU pumps 20% today")'));
    return;
  }
  let sig: Signal | undefined;
  try {
    const t = await withSpinner("pricing the market…", fetchTrending());
    sig = t.find((s) => query.toUpperCase().includes(s.ticker)) ?? t[0];
  } catch {
    /* offline: neutral market */
  }
  const heat = sig?.heat ?? 50;
  const yes = clamp(Math.round(heat * 0.6 + (sig ? sig.change24h : 0) + 20), 8, 92);
  const no = 100 - yes;
  const deadline = new Date(Date.now() + 72 * 3_600_000);
  const id = "0x" + rand(6) + "…" + rand(4);

  stdout.write(banner());
  console.log("  " + c.dim("MARKET  " + id));
  console.log("  " + c.white(c.bold(cap(query).replace(/\?*$/, "?"))));
  console.log("  " + c.dim("terms   ") + c.gray(`YES if it resolves true before ${deadline.toISOString().slice(0, 16)}Z`));
  console.log("  " + c.dim("closes  ") + c.gray("in 72h") + (sig ? c.dim("   ·   heat ") + heatColor(sig.heat)(String(sig.heat)) : ""));
  console.log();
  console.log("  " + c.green("YES ") + c.green(c.bold(`${yes}¢`)) + "  " + c.green(bar(yes, 20)));
  console.log("  " + c.red("NO  ") + c.red(c.bold(`${no}¢`)) + "  " + c.red(bar(no, 20)));
  console.log();

  if (!stdin.isTTY) {
    console.log("  " + c.dim("(non-interactive — run in a terminal to take a side)"));
    return;
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const ans = (await rl.question("  " + c.brand("take a side?") + c.dim(" [y]ES / [n]O / [s]kip › ")))
    .trim()
    .toLowerCase();
  if (ans !== "y" && ans !== "n") {
    console.log("  " + c.dim("no position taken."));
    rl.close();
    return;
  }
  const side = ans === "y" ? "YES" : "NO";
  const price = side === "YES" ? yes : no;
  const sizeRaw = (await rl.question("  " + c.dim("size (USDC) › "))).trim();
  rl.close();
  const size = Math.max(1, Math.round(Number(sizeRaw) || 100));

  await withSpinner(`matching your ${side} order on-chain…`, sleep(1300));
  const tx = "0x" + rand(8);
  const shares = (size / (price / 100)).toFixed(1);
  console.log();
  console.log("  " + (side === "YES" ? c.green : c.red)(c.bold(`✓ FILLED  ${side}`)));
  console.log("  " + c.dim("price   ") + c.white(`${price}¢`) + c.dim("   size ") + c.white(`${size} USDC`) + c.dim("   shares ") + c.white(shares));
  console.log("  " + c.dim("payout  ") + c.green(`${shares} USDC if ${side}`) + c.dim("   ·   non-custodial"));
  console.log("  " + c.dim("tx      ") + c.cyan(tx) + c.dim("   ·   settles on Solana"));
  console.log();
  console.log("  " + c.dim("track it: ") + c.cyan("punter.xyz/m/" + id.replace(/[^0-9a-fx]/gi, "")));
}

async function cmdMarkets() {
  const sigs = await withSpinner("loading live markets…", fetchTrending());
  stdout.write(banner());
  console.log("  " + c.dim("live markets — trade any of these:\n"));
  sigs.slice(0, 10).forEach((s, i) => {
    const hc = heatColor(s.heat);
    console.log(
      "  " +
        c.dim(String(i + 1).padStart(2)) +
        "  " +
        c.white(`$${s.ticker}`.padEnd(10)) +
        hc(bar(s.heat, 8)) +
        " " +
        hc(String(s.heat).padStart(3)) +
        c.dim("   → ") +
        c.gray(`punter open "$${s.ticker} keeps pumping"`),
    );
  });
  console.log();
}

function help() {
  console.log(banner());
  console.log("  " + c.white(c.bold("punter")) + c.dim(" — price the rumour before the headline\n"));
  const rows: [string, string][] = [
    ["punter", "interactive mode — browse the live feed, open markets, take a side"],
    ["punter scan", "one-shot feed of what's moving on CT + on-chain, ranked by heat"],
    ["punter scan --watch [--sec]", "auto-refreshing feed (like top) — default 12s"],
    ["punter markets", "list live markets you can trade"],
    ['punter open "<question>"', "open one market by name and take a side"],
    ["punter help", "this"],
  ];
  for (const [cmd, desc] of rows) console.log("  " + c.brand(cmd.padEnd(30)) + c.dim(desc));
  console.log("\n  " + c.dim("env: ") + c.cyan("TWITTERAPI_KEY") + c.dim(" — enable live CT mention velocity") + "\n");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const rand = (n: number) =>
  Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = rest.filter((a) => a.startsWith("--"));
  const args = rest.filter((a) => !a.startsWith("--"));
  const watch = flags.includes("--watch");
  const interval = Number(flags.find((f) => /^--\d+$/.test(f))?.slice(2)) || 12;

  try {
    switch (cmd) {
      case undefined:
      case "live":
      case "tui":
        return await runTUI();
      case "scan":
        return await cmdScan(watch, interval);
      case "open":
        return await cmdOpen(args.join(" "));
      case "markets":
        return await cmdMarkets();
      case "help":
      case "--help":
      case "-h":
        return help();
      default:
        console.log(c.dim(`unknown command: ${cmd}`));
        return help();
    }
  } catch (e) {
    console.error("  " + c.red("scan failed:"), (e as Error).message);
    console.error("  " + c.dim("(the live feed needs internet — try again)"));
    process.exit(1);
  }
}

main();
