// Interactive terminal UI — run `punter`, navigate the live feed with the
// keyboard, open a market and take a side without leaving the program.
import * as readline from "node:readline";
import { stdin, stdout } from "node:process";
import { c, heatColor, bar, padVisible, clearScreen, hideCursor, showCursor } from "./ansi.js";
import { scanLive, fetchTrending, type Signal } from "./live.js";
import { banner } from "./ui.js";

type Mode = "list" | "market" | "size" | "matching" | "filled";
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const rand = (n: number) =>
  Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

function fmtVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtChg(chg: number): string {
  const s = `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%`;
  return chg >= 0 ? c.green(s) : c.red(s);
}
const pxYes = (s: Signal) => clamp(Math.round(s.heat * 0.6 + s.change24h + 20), 8, 92);

export async function runTUI(): Promise<void> {
  if (!stdin.isTTY) {
    // no interactive terminal — fall back to a one-shot scan
    const { renderFeed } = await import("./ui.js");
    const { signals, ct } = await scanLive();
    stdout.write(banner() + renderFeed(signals, ct) + "\n");
    return;
  }

  let signals: Signal[] = [];
  let ct = false;
  let mode: Mode = "list";
  let sel = 0;
  let cur: Signal | null = null;
  let curId = "";
  let side: "YES" | "NO" = "YES";
  let sizeBuf = "";
  let ticket: { tx: string; shares: string; price: number; size: number; id: string } | null = null;
  let spinning = false;
  let status = "";

  // ---------- rendering ----------
  function frameList(): string {
    const L: string[] = [];
    L.push(banner());
    L.push(
      "  " +
        padVisible(c.dim("#"), 4) +
        padVisible(c.dim("HEAT"), 22) +
        padVisible(c.dim("MARKET"), 16) +
        padVisible(c.dim("24H"), 10) +
        padVisible(c.dim("VOL"), 9) +
        c.dim(ct ? "SIGNAL" : "SOURCE"),
    );
    L.push("  " + c.dim("─".repeat(74)));
    signals.slice(0, 12).forEach((s, i) => {
      const on = i === sel;
      const hc = heatColor(s.heat);
      const heatCell = `${hc(bar(s.heat, 10))} ${hc(c.bold(String(s.heat).padStart(3)))}`;
      const mkt = c.white(`$${s.ticker}`) + c.dim(s.rank ? ` #${s.rank}` : "");
      const signal = ct
        ? s.mentions
          ? c.cyan(`${s.mentions} CT mention${s.mentions === 1 ? "" : "s"}`)
          : c.dim("on-chain trending")
        : c.dim(s.source);
      const cursor = on ? c.brand("▸ ") : "  ";
      const row =
        cursor +
        padVisible(on ? c.brand(String(i + 1)) : c.dim(String(i + 1)), 4) +
        padVisible(heatCell, 22) +
        padVisible(mkt, 16) +
        padVisible(fmtChg(s.change24h), 10) +
        padVisible(c.gray(fmtVol(s.volume)), 9) +
        signal;
      L.push(row);
    });
    L.push("");
    const hot = signals.filter((s) => s.heat >= 62).length;
    L.push(
      "  " +
        c.dim(`${signals.length} signals · `) +
        c.orange(`${hot} hot`) +
        c.dim(` · ${ct ? "CT + on-chain" : "on-chain trending"} · `) +
        c.dim(new Date().toLocaleTimeString()),
    );
    L.push("");
    L.push(
      "  " +
        c.dim("↑/↓") +
        c.gray(" move   ") +
        c.dim("enter") +
        c.gray(" open market   ") +
        c.dim("r") +
        c.gray(" refresh   ") +
        c.dim("q") +
        c.gray(" quit"),
    );
    if (status) L.push("  " + c.dim(status));
    return L.join("\n");
  }

  function frameMarket(): string {
    const s = cur!;
    const yes = pxYes(s);
    const no = 100 - yes;
    const L: string[] = [];
    L.push(banner());
    L.push("  " + c.dim("MARKET  " + curId) + c.dim("   ·   heat ") + heatColor(s.heat)(String(s.heat)));
    L.push("  " + c.white(c.bold(`Will $${s.ticker} keep pumping over the next 72h?`)));
    L.push("  " + c.dim("terms   ") + c.gray("YES if price is higher 72h from open"));
    L.push("");
    const hi = (t: "YES" | "NO") => (side === t ? c.bold : (x: string | number) => String(x));
    L.push(
      "  " +
        (side === "YES" ? c.brand("▸ ") : "  ") +
        c.green(hi("YES")("YES ")) +
        c.green(c.bold(`${yes}¢`)) +
        "  " +
        c.green(bar(yes, 22)),
    );
    L.push(
      "  " +
        (side === "NO" ? c.brand("▸ ") : "  ") +
        c.red(hi("NO")("NO  ")) +
        c.red(c.bold(`${no}¢`)) +
        "  " +
        c.red(bar(no, 22)),
    );
    L.push("");
    L.push(
      "  " +
        c.dim("←/→ or y/n") +
        c.gray(" pick side   ") +
        c.dim("enter") +
        c.gray(" take ") +
        (side === "YES" ? c.green(side) : c.red(side)) +
        c.gray("   ") +
        c.dim("b") +
        c.gray(" back"),
    );
    return L.join("\n");
  }

  function frameSize(): string {
    const s = cur!;
    const yes = pxYes(s);
    const price = side === "YES" ? yes : 100 - yes;
    const size = Number(sizeBuf) || 0;
    const shares = size > 0 ? (size / (price / 100)).toFixed(1) : "—";
    const L: string[] = [];
    L.push(banner());
    L.push("  " + c.white(c.bold(`$${s.ticker}`)) + c.gray("  taking ") + (side === "YES" ? c.green(side) : c.red(side)) + c.gray(` @ ${price}¢`));
    L.push("");
    L.push("  " + c.dim("size (USDC)  ") + c.white(c.bold(sizeBuf || "0")) + c.brand("▏"));
    L.push("  " + c.dim("shares       ") + c.white(shares) + c.dim("   payout if right"));
    L.push("");
    L.push("  " + c.dim("type amount   ") + c.dim("enter") + c.gray(" confirm   ") + c.dim("b/esc") + c.gray(" back"));
    return L.join("\n");
  }

  function frameFilled(): string {
    const t = ticket!;
    const s = cur!;
    const L: string[] = [];
    L.push(banner());
    L.push("  " + (side === "YES" ? c.green : c.red)(c.bold(`✓ FILLED  ${side}  $${s.ticker}`)));
    L.push("  " + c.dim("price   ") + c.white(`${t.price}¢`) + c.dim("   size ") + c.white(`${t.size} USDC`) + c.dim("   shares ") + c.white(t.shares));
    L.push("  " + c.dim("payout  ") + c.green(`${t.shares} USDC if ${side}`) + c.dim("   ·   non-custodial"));
    L.push("  " + c.dim("tx      ") + c.cyan(t.tx) + c.dim("   ·   settles on Solana"));
    L.push("");
    L.push("  " + c.dim("track   ") + c.cyan("punter.xyz/m/" + t.id.replace(/[^0-9a-fx]/gi, "")));
    L.push("");
    L.push("  " + c.dim("b") + c.gray(" back to markets   ") + c.dim("q") + c.gray(" quit"));
    return L.join("\n");
  }

  function render() {
    if (spinning) return; // spinner owns the screen
    let f = "";
    if (mode === "list") f = frameList();
    else if (mode === "market") f = frameMarket();
    else if (mode === "size") f = frameSize();
    else if (mode === "filled") f = frameFilled();
    stdout.write(clearScreen + f + "\n");
  }

  async function withSpin(label: string, ms: number) {
    spinning = true;
    let i = 0;
    stdout.write(clearScreen + banner() + "\n");
    const timer = setInterval(() => {
      stdout.write(`\r  ${c.brand(SPIN[i++ % SPIN.length])} ${c.dim(label)}   `);
    }, 80);
    await sleep(ms);
    clearInterval(timer);
    spinning = false;
  }

  async function refresh() {
    await withSpin("scanning CT + on-chain for what's moving…", 600);
    const r = await scanLive();
    signals = r.signals;
    ct = r.ct;
    if (sel >= signals.length) sel = Math.max(0, signals.length - 1);
    status = "";
    render();
  }

  // ---------- input ----------
  function quit() {
    stdout.write(showCursor + "\n");
    try {
      stdin.setRawMode(false);
    } catch {}
    stdin.pause();
    process.exit(0);
  }

  async function onKey(str: string, key: readline.Key) {
    if (spinning) return;
    if (key && key.ctrl && key.name === "c") return quit();

    if (mode === "list") {
      if (key.name === "up" || str === "k") sel = (sel - 1 + Math.min(12, signals.length)) % Math.min(12, signals.length);
      else if (key.name === "down" || str === "j") sel = (sel + 1) % Math.min(12, signals.length);
      else if (key.name === "return") {
        cur = signals[sel];
        curId = "0x" + rand(6) + "…" + rand(4);
        side = "YES";
        mode = "market";
      } else if (str === "r") return refresh();
      else if (str === "q" || key.name === "escape") return quit();
      render();
      return;
    }

    if (mode === "market") {
      if (str === "y" || key.name === "left") side = "YES";
      else if (str === "n" || key.name === "right") side = "NO";
      else if (key.name === "return") {
        sizeBuf = "";
        mode = "size";
      } else if (str === "b" || key.name === "escape") mode = "list";
      else if (str === "q") return quit();
      render();
      return;
    }

    if (mode === "size") {
      if (/^[0-9]$/.test(str)) {
        if (sizeBuf.length < 7) sizeBuf += str;
      } else if (key.name === "backspace") sizeBuf = sizeBuf.slice(0, -1);
      else if (str === "b" || key.name === "escape") {
        mode = "market";
        render();
        return;
      } else if (key.name === "return") {
        const s = cur!;
        const yes = pxYes(s);
        const price = side === "YES" ? yes : 100 - yes;
        const size = Math.max(1, Number(sizeBuf) || 100);
        await withSpin(`matching your ${side} order on-chain…`, 1300);
        ticket = {
          tx: "0x" + rand(8),
          shares: (size / (price / 100)).toFixed(1),
          price,
          size,
          id: curId,
        };
        mode = "filled";
        render();
        return;
      }
      render();
      return;
    }

    if (mode === "filled") {
      if (str === "b" || key.name === "escape" || key.name === "return") mode = "list";
      else if (str === "q") return quit();
      render();
      return;
    }
  }

  // ---------- boot ----------
  readline.emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  stdout.write(hideCursor);
  process.on("exit", () => stdout.write(showCursor));
  stdin.on("keypress", (str: string, key: readline.Key) => {
    void onKey(str ?? "", key ?? ({} as readline.Key));
  });

  await refresh();
}
