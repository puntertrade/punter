import { c, heatColor, bar, padVisible, clearScreen, hideCursor, showCursor } from "./ansi.js";
import type { Signal } from "./live.js";

const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function banner(): string {
  const P = c.brand(c.bold("◆ PUNTER"));
  const t = c.dim("crypto markets for launches, leaks and CT chaos");
  return `\n  ${P}  ${t}\n`;
}

/** Animated spinner for `ms`, printed in place. Resolves after the work you await elsewhere. */
export async function withSpinner<T>(label: string, work: Promise<T>): Promise<T> {
  const tty = Boolean(process.stdout.isTTY);
  if (!tty) return work;
  let i = 0;
  process.stdout.write(hideCursor);
  const timer = setInterval(() => {
    process.stdout.write(`\r  ${c.brand(SPIN[i++ % SPIN.length])} ${c.dim(label)}   `);
  }, 80);
  try {
    return await work;
  } finally {
    clearInterval(timer);
    process.stdout.write("\r" + " ".repeat(label.length + 12) + "\r" + showCursor);
  }
}

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

function fmtAge(min: number): string {
  if (!min) return c.dim("now");
  if (min < 60) return c.dim(`${min}m`);
  return c.dim(`${Math.round(min / 60)}h`);
}

export function renderFeed(signals: Signal[], ct: boolean): string {
  const rows: string[] = [];
  rows.push(
    "  " +
      padVisible(c.dim("#"), 4) +
      padVisible(c.dim("HEAT"), 22) +
      padVisible(c.dim("MARKET"), 16) +
      padVisible(c.dim("24H"), 10) +
      padVisible(c.dim("VOL"), 9) +
      c.dim(ct ? "SIGNAL" : "SOURCE"),
  );
  rows.push("  " + c.dim("─".repeat(74)));

  signals.slice(0, 12).forEach((s, i) => {
    const hc = heatColor(s.heat);
    const heatCell = `${hc(bar(s.heat, 10))} ${hc(c.bold(String(s.heat).padStart(3)))}`;
    const mkt = c.white(`$${s.ticker}`) + c.dim(s.rank ? ` #${s.rank}` : "");
    const signal = ct
      ? s.mentions
        ? c.cyan(`${s.mentions} CT mention${s.mentions === 1 ? "" : "s"}`) + c.dim(` · ${fmtAge(s.ageMin)}`)
        : c.dim("on-chain trending")
      : c.dim(s.source);
    rows.push(
      "  " +
        padVisible(c.dim(String(i + 1)), 4) +
        padVisible(heatCell, 22) +
        padVisible(mkt, 16) +
        padVisible(fmtChg(s.change24h), 10) +
        padVisible(c.gray(fmtVol(s.volume)), 9) +
        signal,
    );
  });

  // one live quote for flavour
  const withQuote = signals.find((s) => s.quote);
  if (withQuote?.quote) {
    rows.push("");
    rows.push("  " + c.dim("↳ ") + c.dim(`"${withQuote.quote}"`) + c.dim(` — $${withQuote.ticker} on CT`));
  }

  const hot = signals.filter((s) => s.heat >= 62).length;
  rows.push("");
  rows.push(
    "  " +
      c.dim(`${signals.length} signals scanned · `) +
      c.orange(`${hot} hot`) +
      c.dim(` · ${ct ? "CT + on-chain" : "on-chain trending"} · `) +
      c.dim(new Date().toLocaleTimeString()) +
      c.dim(" · punter.xyz/docs"),
  );
  return rows.join("\n");
}

export { clearScreen };
