// Interactive terminal UI — a full LARP trading journey:
// onboard a wallet -> back up the seed -> fund via faucet -> browse the live
// feed -> open a market -> size -> review -> sign -> broadcast -> fill ->
// track it in the portfolio -> close it. State persists in ~/.punter.
import * as readline from "node:readline";
import { stdin, stdout } from "node:process";
import { c, heatColor, bar, padVisible, clearScreen, hideCursor, showCursor } from "./ansi.js";
import { scanLive, fetchTrending, type Signal } from "./live.js";
import { banner } from "./ui.js";
import * as W from "./wallet.js";

type Mode =
  | "ob_welcome" | "ob_seed" | "ob_verify" | "ob_fund"
  | "list" | "market" | "size" | "review" | "sign" | "filled"
  | "portfolio" | "pos" | "closed" | "wallet";

const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// Solana-style identifiers: base58, addresses ~44 chars, signatures ~88.
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58 = (n: number) => Array.from({ length: n }, () => B58[Math.floor(Math.random() * 58)]).join("");
const shortSig = (s: string) => (s.length > 12 ? s.slice(0, 5) + "…" + s.slice(-4) : s);
const PROGRAM_ID = "PUNTrLhvf2rNE44Dirm5ZrZxnni1VNrvjAg3Dt3MMoHR";
const USDC_MINT = "AzD8HqWKKWUqWJr7EEjHrhin1asuetCFoEEkg7EEMcf7"; // devnet
const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortAddr = (a: string) => a.slice(0, 4) + "…" + a.slice(-4);
function fmtVol(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
const fmtChg = (chg: number) => (chg >= 0 ? c.green(`+${chg.toFixed(1)}%`) : c.red(`${chg.toFixed(1)}%`));
const pxYes = (s: { heat: number; change24h: number }) => clamp(Math.round(s.heat * 0.6 + s.change24h + 20), 8, 92);
const FEE = 0.01;

export async function runTUI(): Promise<void> {
  if (!stdin.isTTY) {
    const { renderFeed } = await import("./ui.js");
    const { signals, ct } = await scanLive();
    stdout.write(banner() + renderFeed(signals, ct) + "\n");
    return;
  }

  let st = W.load();
  let signals: Signal[] = [];
  let ct = false;
  let mode: Mode = st.wallet ? "list" : "ob_welcome";
  let sel = 0;
  let posSel = 0;
  let cur: Signal | null = null;
  let curId = "";
  let blockhash = "";
  let side: "YES" | "NO" = "YES";
  let sizeBuf = "";
  let status = "";
  let spinning = false;

  // onboarding scratch
  let newMnemonic = "";
  let verifyIdx = 0;
  let verifyBuf = "";
  let obImporting = false;
  let importBuf = "";

  // ---------- helpers ----------
  const width = 76;
  const rule = () => c.dim("─".repeat(width));
  function walletBar(): string {
    if (!st.wallet) return "";
    const pos = st.positions.length;
    return (
      "  " +
      c.dim("wallet ") + c.brand(shortAddr(st.wallet.address)) +
      c.dim("   bal ") + c.white(money(st.balances.USDC)) +
      c.dim("   ◎ ") + c.white(st.balances.SOL.toFixed(2)) +
      c.dim("   positions ") + (pos ? c.orange(String(pos)) : c.dim("0"))
    );
  }

  // ---------- frames ----------
  function fObWelcome() {
    const L = [banner()];
    L.push("  " + c.white(c.bold("Welcome to Punter.")) + c.dim("  Price the rumour before the headline."));
    L.push("");
    L.push("  " + c.gray("To trade you need a wallet. Funds settle non-custodially to your"));
    L.push("  " + c.gray("own keys — Punter never holds them."));
    L.push("");
    L.push("  " + c.brand("▸ ") + (obImporting ? c.dim("create a new wallet") : c.white("create a new wallet")));
    L.push("    " + (obImporting ? c.white("import an existing 12-word seed") : c.dim("import an existing 12-word seed")));
    if (obImporting) {
      L.push("");
      L.push("  " + c.dim("seed  ") + c.white(importBuf || "") + c.brand("▏"));
      L.push("  " + c.dim("type/paste 12 words · enter import · esc cancel"));
    } else {
      L.push("");
      L.push("  " + c.dim("↑/↓") + c.gray(" switch   ") + c.dim("enter") + c.gray(" continue   ") + c.dim("q") + c.gray(" quit"));
    }
    if (status) L.push("\n  " + c.red(status));
    return L.join("\n");
  }
  function fObSeed() {
    const words = newMnemonic.split(" ");
    const L = [banner()];
    L.push("  " + c.white(c.bold("Your recovery phrase")) + c.dim("   — write these 12 words down, in order."));
    L.push("  " + c.red("Anyone with this phrase controls the wallet. Never share it."));
    L.push("");
    for (let r = 0; r < 4; r++) {
      let row = "  ";
      for (let ccol = 0; ccol < 3; ccol++) {
        const i = r * 3 + ccol;
        row += c.dim(String(i + 1).padStart(2) + ". ") + padVisible(c.white(words[i]), 16);
      }
      L.push(row);
    }
    L.push("");
    L.push("  " + c.dim("addr  ") + c.brand(W.addressFromMnemonic(newMnemonic)));
    L.push("");
    L.push("  " + c.dim("enter") + c.gray(" I've saved it   ") + c.dim("q") + c.gray(" cancel"));
    return L.join("\n");
  }
  function fObVerify() {
    const L = [banner()];
    L.push("  " + c.white(c.bold("Confirm your phrase")) + c.dim("   — prove you wrote it down."));
    L.push("");
    L.push("  " + c.gray(`What is word `) + c.brand(`#${verifyIdx + 1}`) + c.gray(" of your recovery phrase?"));
    L.push("");
    L.push("  " + c.dim("word " + (verifyIdx + 1) + "  ") + c.white(verifyBuf) + c.brand("▏"));
    L.push("");
    L.push("  " + c.dim("type the word · enter check · b back to phrase"));
    if (status) L.push("\n  " + c.red(status));
    return L.join("\n");
  }
  function fObFund() {
    const L = [banner()];
    L.push("  " + c.green(c.bold("✓ Wallet ready")) + c.dim("   " + shortAddr(st.wallet!.address)));
    L.push("");
    L.push("  " + c.gray("You're on ") + c.white("devnet") + c.gray(". Claim test funds to start trading —"));
    L.push("  " + c.gray("no real money involved."));
    L.push("");
    L.push("  " + c.dim("faucet  ") + c.white("1,000 USDC") + c.dim(" + ") + c.white("2 ◎ SOL"));
    L.push("");
    L.push("  " + c.dim("enter") + c.gray(" claim from faucet   ") + c.dim("s") + c.gray(" skip"));
    return L.join("\n");
  }

  function fList() {
    const L = [banner()];
    L.push(walletBar());
    L.push("");
    L.push(
      "  " + padVisible(c.dim("#"), 4) + padVisible(c.dim("HEAT"), 22) +
      padVisible(c.dim("MARKET"), 16) + padVisible(c.dim("24H"), 10) +
      padVisible(c.dim("VOL"), 9) + c.dim(ct ? "SIGNAL" : "SOURCE"),
    );
    L.push("  " + rule());
    signals.slice(0, 12).forEach((s, i) => {
      const on = i === sel;
      const hc = heatColor(s.heat);
      const heatCell = `${hc(bar(s.heat, 10))} ${hc(c.bold(String(s.heat).padStart(3)))}`;
      const mkt = c.white(`$${s.ticker}`) + c.dim(s.rank ? ` #${s.rank}` : "");
      const signal = ct
        ? s.mentions ? c.cyan(`${s.mentions} CT mention${s.mentions === 1 ? "" : "s"}`) : c.dim("on-chain trending")
        : c.dim(s.source);
      L.push(
        (on ? c.brand("▸ ") : "  ") +
        padVisible(on ? c.brand(String(i + 1)) : c.dim(String(i + 1)), 4) +
        padVisible(heatCell, 22) + padVisible(mkt, 16) +
        padVisible(fmtChg(s.change24h), 10) + padVisible(c.gray(fmtVol(s.volume)), 9) + signal,
      );
    });
    L.push("");
    L.push(
      "  " + c.dim("↑/↓") + c.gray(" move   ") + c.dim("enter") + c.gray(" open   ") +
      c.dim("p") + c.gray(" portfolio   ") + c.dim("w") + c.gray(" wallet   ") +
      c.dim("r") + c.gray(" refresh   ") + c.dim("q") + c.gray(" quit"),
    );
    if (status) L.push("  " + c.dim(status));
    return L.join("\n");
  }

  function orderbook(s: Signal, yes: number) {
    // fabricate a shallow book around the mid, deterministic-ish per heat
    const rows: string[] = [];
    rows.push("  " + c.dim("      YES bids            NO bids"));
    for (let i = 1; i <= 3; i++) {
      const yb = clamp(yes - i, 1, 99);
      const nb = clamp(100 - yes - i, 1, 99);
      const yq = (s.heat * 7 + i * 130) % 900 + 50;
      const nq = (s.heat * 5 + i * 90) % 700 + 40;
      rows.push(
        "  " + c.green(`${yb}¢`.padStart(5)) + c.dim(` × ${yq}`.padEnd(12)) +
        c.red(`${nb}¢`.padStart(7)) + c.dim(` × ${nq}`),
      );
    }
    return rows.join("\n");
  }
  function fMarket() {
    const s = cur!;
    const yes = pxYes(s), no = 100 - yes;
    const L = [banner()];
    L.push("  " + c.dim("MARKET  " + shortSig(curId)) + c.dim("   heat ") + heatColor(s.heat)(String(s.heat)) + c.dim("   vol ") + c.gray(fmtVol(s.volume)));
    L.push("  " + c.white(c.bold(`Will $${s.ticker} keep pumping over the next 72h?`)));
    L.push("  " + c.dim("terms   ") + c.gray("YES if price is higher 72h from open · oracle: Pyth + CT consensus"));
    L.push("");
    L.push("  " + (side === "YES" ? c.brand("▸ ") : "  ") + c.green("YES ") + c.green(c.bold(`${yes}¢`)) + "  " + c.green(bar(yes, 22)));
    L.push("  " + (side === "NO" ? c.brand("▸ ") : "  ") + c.red("NO  ") + c.red(c.bold(`${no}¢`)) + "  " + c.red(bar(no, 22)));
    L.push("");
    L.push(orderbook(s, yes));
    L.push("");
    L.push("  " + c.dim("←/→ or y/n") + c.gray(" pick side   ") + c.dim("enter") + c.gray(" size order   ") + c.dim("b") + c.gray(" back"));
    return L.join("\n");
  }

  function fSize() {
    const s = cur!;
    const yes = pxYes(s);
    const price = side === "YES" ? yes : 100 - yes;
    const size = Number(sizeBuf) || 0;
    const shares = size > 0 ? (size / (price / 100)) : 0;
    const L = [banner()];
    L.push("  " + c.white(c.bold(`$${s.ticker}`)) + c.gray("  taking ") + (side === "YES" ? c.green("YES") : c.red("NO")) + c.gray(` @ ${price}¢`));
    L.push("  " + c.dim("balance ") + c.white(money(st.balances.USDC)));
    L.push("");
    L.push("  " + c.dim("size (USDC)  ") + c.white(c.bold(sizeBuf || "0")) + c.brand("▏"));
    L.push("  " + c.dim("shares       ") + c.white(shares ? shares.toFixed(1) : "—"));
    L.push("");
    L.push("  " + c.dim("type amount   ") + c.dim("25/50/max") + c.gray(" presets   ") + c.dim("enter") + c.gray(" review   ") + c.dim("b") + c.gray(" back"));
    if (status) L.push("\n  " + c.red(status));
    return L.join("\n");
  }

  function reviewNums() {
    const s = cur!;
    const yes = pxYes(s);
    const price = side === "YES" ? yes : 100 - yes;
    const size = Math.max(1, Number(sizeBuf) || 0);
    const fee = size * FEE;
    const slip = size * 0.003;
    const total = size + fee + slip;
    const shares = size / (price / 100);
    return { price, size, fee, slip, total, shares, yes };
  }
  function fReview() {
    const s = cur!;
    const n = reviewNums();
    const after = st.balances.USDC - n.total;
    const L = [banner()];
    L.push("  " + c.white(c.bold("Review order")));
    L.push("  " + rule());
    const row = (k: string, v: string) => "  " + padVisible(c.dim(k), 16) + v;
    L.push(row("market", c.white(`$${s.ticker}`) + c.dim("  keep pumping 72h")));
    L.push(row("side", side === "YES" ? c.green("YES") : c.red("NO")) );
    L.push(row("price", c.white(`${n.price}¢`)));
    L.push(row("size", c.white(money(n.size))));
    L.push(row("shares", c.white(n.shares.toFixed(1))));
    L.push(row("fee (1%)", c.gray(money(n.fee))));
    L.push(row("est. slippage", c.gray(money(n.slip))));
    L.push("  " + rule());
    L.push(row("total cost", c.white(c.bold(money(n.total)))));
    L.push(row("balance after", (after < 0 ? c.red : c.gray)(money(after))));
    L.push(row("max payout", c.green(money(n.shares))));
    L.push("");
    if (after < 0) L.push("  " + c.red("insufficient balance — reduce size (b) or fund wallet (w)"));
    else L.push("  " + c.dim("enter") + c.gray(" sign & submit   ") + c.dim("e") + c.gray(" edit size   ") + c.dim("b") + c.gray(" cancel"));
    return L.join("\n");
  }

  function fSign() {
    const s = cur!;
    const n = reviewNums();
    const netFee = 0.000005 + 0.000005; // base + priority, ◎
    const L = [banner()];
    L.push("  " + c.white(c.bold("Approve transaction")) + c.dim("   Solana devnet"));
    L.push("  " + rule());
    const row = (k: string, v: string) => "  " + padVisible(c.gray(k), 15) + v;
    L.push(row("Program", c.white(shortSig(PROGRAM_ID)) + c.dim("  Punter Markets")));
    L.push(row("Instruction", c.white("takePosition")));
    L.push(row("  side", (side === "YES" ? c.green : c.red)(side)));
    L.push(row("  amount", c.white(`${n.size.toFixed(2)} USDC`) + c.dim(`  (${USDC_MINT.slice(0, 4)}…)`)));
    L.push(row("  maxSlippage", c.white("50 bps")));
    L.push(row("  market", c.dim(shortSig(curId))));
    L.push("  " + rule());
    L.push(row("Fee payer", c.brand(shortSig(st.wallet!.address))));
    L.push(row("Network fee", c.gray(`${netFee.toFixed(6)} ◎`) + c.dim("  ~$" + (netFee * 150).toFixed(4))));
    L.push(row("Debit", c.white(money(n.total)) + c.dim("  amount + fee + est. slippage")));
    L.push(row("Blockhash", c.dim(shortSig(blockhash))));
    L.push("  " + rule());
    L.push("");
    L.push("  " + c.dim("s") + c.gray(" sign with wallet   ") + c.dim("b") + c.gray(" reject"));
    return L.join("\n");
  }

  function fFilled() {
    const p = st.positions[0];
    const L = [banner()];
    L.push("  " + (p.side === "YES" ? c.green : c.red)(c.bold(`✓ FILLED  ${p.side}  $${p.ticker}`)));
    L.push("  " + c.dim("price   ") + c.white(`${p.entry}¢`) + c.dim("   size ") + c.white(money(p.size)) + c.dim("   shares ") + c.white(p.shares.toFixed(1)));
    L.push("  " + c.dim("payout  ") + c.green(money(p.shares)) + c.dim(` if ${p.side}`) + c.dim("   ·   non-custodial"));
    L.push("  " + c.dim("tx      ") + c.cyan(shortSig(p.tx)) + c.dim("   ·   Solana devnet"));
    L.push("  " + c.dim("balance ") + c.white(money(st.balances.USDC)));
    L.push("");
    L.push("  " + c.dim("p") + c.gray(" view portfolio   ") + c.dim("b") + c.gray(" back to markets   ") + c.dim("q") + c.gray(" quit"));
    return L.join("\n");
  }

  function posPx(p: W.Position): number {
    const live = signals.find((s) => s.ticker === p.ticker);
    if (!live) return p.entry;
    const yes = pxYes(live);
    return p.side === "YES" ? yes : 100 - yes;
  }
  function fPortfolio() {
    const L = [banner()];
    L.push(walletBar());
    L.push("");
    if (!st.positions.length) {
      L.push("  " + c.dim("no open positions yet. press ") + c.white("b") + c.dim(" and open a market."));
      L.push("");
      L.push("  " + c.dim("b") + c.gray(" back   ") + c.dim("q") + c.gray(" quit"));
      return L.join("\n");
    }
    L.push("  " + padVisible(c.dim("MARKET"), 14) + padVisible(c.dim("SIDE"), 7) + padVisible(c.dim("ENTRY"), 8) +
      padVisible(c.dim("NOW"), 8) + padVisible(c.dim("SIZE"), 10) + padVisible(c.dim("VALUE"), 11) + c.dim("PnL"));
    L.push("  " + rule());
    st.positions.forEach((p, i) => {
      const on = i === posSel;
      const now = posPx(p);
      const value = p.shares * (now / 100);
      const pnl = value - p.size;
      const pct = (pnl / p.size) * 100;
      const pnlStr = (pnl >= 0 ? c.green : c.red)(`${pnl >= 0 ? "+" : ""}${money(pnl).replace("$", "$")} (${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%)`);
      L.push(
        (on ? c.brand("▸ ") : "  ") +
        padVisible(c.white(`$${p.ticker}`), 14) +
        padVisible(p.side === "YES" ? c.green("YES") : c.red("NO"), 7) +
        padVisible(c.gray(`${p.entry}¢`), 8) + padVisible(c.white(`${now}¢`), 8) +
        padVisible(c.gray(money(p.size)), 10) + padVisible(c.white(money(value)), 11) + pnlStr,
      );
    });
    const totVal = st.positions.reduce((a, p) => a + p.shares * (posPx(p) / 100), 0);
    const totCost = st.positions.reduce((a, p) => a + p.size, 0);
    const totPnl = totVal - totCost;
    L.push("  " + rule());
    L.push("  " + c.dim("total value ") + c.white(money(totVal)) + c.dim("   PnL ") + (totPnl >= 0 ? c.green : c.red)(`${totPnl >= 0 ? "+" : ""}${money(totPnl)}`));
    L.push("");
    L.push("  " + c.dim("↑/↓") + c.gray(" move   ") + c.dim("enter") + c.gray(" position   ") + c.dim("c") + c.gray(" close   ") + c.dim("b") + c.gray(" back"));
    if (status) L.push("  " + c.dim(status));
    return L.join("\n");
  }
  function fPos() {
    const p = st.positions[posSel];
    const now = posPx(p);
    const value = p.shares * (now / 100);
    const pnl = value - p.size;
    const L = [banner()];
    L.push("  " + c.white(c.bold(`$${p.ticker}`)) + c.gray("  position"));
    L.push("  " + rule());
    const row = (k: string, v: string) => "  " + padVisible(c.dim(k), 14) + v;
    L.push(row("side", p.side === "YES" ? c.green("YES") : c.red("NO")));
    L.push(row("entry", c.white(`${p.entry}¢`)));
    L.push(row("now", c.white(`${now}¢`)));
    L.push(row("size", c.white(money(p.size))));
    L.push(row("shares", c.white(p.shares.toFixed(1))));
    L.push(row("value", c.white(money(value))));
    L.push(row("PnL", (pnl >= 0 ? c.green : c.red)(`${pnl >= 0 ? "+" : ""}${money(pnl)}`)));
    L.push(row("tx", c.cyan(shortSig(p.tx))));
    L.push("  " + rule());
    L.push("");
    L.push("  " + c.dim("c") + c.gray(" close position   ") + c.dim("b") + c.gray(" back"));
    return L.join("\n");
  }
  function fClosed() {
    const L = [banner()];
    L.push("  " + c.green(c.bold("✓ Position closed")));
    L.push("  " + c.dim(status));
    L.push("  " + c.dim("balance ") + c.white(money(st.balances.USDC)));
    L.push("");
    L.push("  " + c.dim("p") + c.gray(" portfolio   ") + c.dim("b") + c.gray(" markets   ") + c.dim("q") + c.gray(" quit"));
    return L.join("\n");
  }

  function fWallet() {
    const L = [banner()];
    L.push("  " + c.white(c.bold("Wallet")));
    L.push("  " + rule());
    L.push("  " + c.dim("address  ") + c.brand(st.wallet!.address));
    L.push("  " + c.dim("USDC     ") + c.white(money(st.balances.USDC)));
    L.push("  " + c.dim("SOL      ") + c.white(st.balances.SOL.toFixed(3) + " ◎"));
    L.push("  " + c.dim("network  ") + c.gray("Solana devnet"));
    L.push("  " + c.dim("state    ") + c.dim(W.STATE_PATH));
    L.push("  " + rule());
    L.push("");
    L.push("  " + c.dim("f") + c.gray(" faucet +1,000 USDC   ") + c.dim("b") + c.gray(" back"));
    if (status) L.push("\n  " + c.dim(status));
    return L.join("\n");
  }

  function render() {
    if (spinning) return;
    const map: Record<Mode, () => string> = {
      ob_welcome: fObWelcome, ob_seed: fObSeed, ob_verify: fObVerify, ob_fund: fObFund,
      list: fList, market: fMarket, size: fSize, review: fReview, sign: fSign, filled: fFilled,
      portfolio: fPortfolio, pos: fPos, closed: fClosed, wallet: fWallet,
    };
    stdout.write(clearScreen + map[mode]() + "\n");
  }

  async function broadcast(title: string, stages: string[]) {
    spinning = true;
    const done: string[] = [];
    for (const stg of stages) {
      let i = 0;
      const draw = () => {
        const lines = [banner(), "  " + c.white(c.bold(title)), ""];
        for (const dline of done) lines.push("  " + c.green("✓ ") + c.dim(dline));
        lines.push("  " + c.brand(SPIN[i++ % SPIN.length]) + " " + c.gray(stg));
        stdout.write(clearScreen + lines.join("\n") + "\n");
      };
      draw();
      const timer = setInterval(draw, 80);
      await sleep(420 + Math.floor((stg.length % 5) * 90));
      clearInterval(timer);
      done.push(stg);
    }
    // final flash of all-done
    const lines = [banner(), "  " + c.white(c.bold(title)), ""];
    for (const dline of done) lines.push("  " + c.green("✓ ") + c.dim(dline));
    stdout.write(clearScreen + lines.join("\n") + "\n");
    await sleep(260);
    spinning = false;
  }

  async function refresh() {
    spinning = true;
    let i = 0;
    const timer = setInterval(() => {
      stdout.write(`\r  ${c.brand(SPIN[i++ % SPIN.length])} ${c.dim("scanning CT + on-chain for what's moving…")}   `);
    }, 80);
    const r = await scanLive();
    clearInterval(timer);
    spinning = false;
    signals = r.signals; ct = r.ct;
    if (sel >= signals.length) sel = Math.max(0, signals.length - 1);
  }

  function quit() {
    stdout.write(showCursor + "\n");
    try { stdin.setRawMode(false); } catch {}
    stdin.pause();
    process.exit(0);
  }

  // ---------- input ----------
  async function onKey(str: string, key: readline.Key) {
    if (spinning) return;
    if (key && key.ctrl && key.name === "c") return quit();
    status = "";

    // ---- onboarding ----
    if (mode === "ob_welcome") {
      if (obImporting) {
        if (key.name === "escape") { obImporting = false; importBuf = ""; }
        else if (key.name === "backspace") importBuf = importBuf.slice(0, -1);
        else if (key.name === "return") {
          if (!W.isValidMnemonic(importBuf)) { status = "not a valid 12-word BIP-39 phrase"; }
          else {
            const addr = W.addressFromMnemonic(importBuf.trim().toLowerCase());
            st.wallet = { address: addr, createdAt: Date.now() };
            W.log(st, "wallet", "imported " + shortAddr(addr));
            W.save(st);
            mode = "ob_fund";
          }
        } else if (str && str.length === 1 && /[a-z ]/i.test(str)) importBuf += str.toLowerCase();
      } else {
        if (key.name === "up" || key.name === "down") obImporting = !obImporting; // 2 options toggle
        else if (str === "i") obImporting = true;
        else if (key.name === "return") {
          if (obImporting) { /* handled above */ }
          else { newMnemonic = W.genMnemonic(); mode = "ob_seed"; }
        } else if (str === "q") return quit();
      }
      return render();
    }
    if (mode === "ob_seed") {
      if (key.name === "return") {
        verifyIdx = Math.floor((newMnemonic.split(" ").length) * ((Date.now() % 9) / 9)) % 12;
        verifyBuf = ""; mode = "ob_verify";
      } else if (str === "q") return quit();
      return render();
    }
    if (mode === "ob_verify") {
      if (key.name === "backspace") verifyBuf = verifyBuf.slice(0, -1);
      else if (str === "b") { mode = "ob_seed"; }
      else if (key.name === "return") {
        const want = newMnemonic.split(" ")[verifyIdx];
        if (verifyBuf.trim().toLowerCase() === want) {
          const addr = W.addressFromMnemonic(newMnemonic);
          st.wallet = { address: addr, createdAt: Date.now() };
          W.log(st, "wallet", "created " + shortAddr(addr));
          W.save(st);
          newMnemonic = "";
          mode = "ob_fund";
        } else status = `that's not word #${verifyIdx + 1} — check your backup`;
      } else if (str && str.length === 1 && /[a-z]/i.test(str)) verifyBuf += str.toLowerCase();
      return render();
    }
    if (mode === "ob_fund") {
      if (key.name === "return") {
        await broadcast("Requesting airdrop from devnet faucet", [
          "connecting to faucet.punter.xyz",
          "requesting 1,000 USDC + 2 SOL",
          "airdrop tx " + shortSig(b58(88)),
          "confirming (32/32 slots)",
        ]);
        st.balances.USDC += 1000; st.balances.SOL += 2;
        W.log(st, "faucet", "+1,000 USDC +2 SOL");
        W.save(st);
        await refresh();
        mode = "list";
      } else if (str === "s") { await refresh(); mode = "list"; }
      return render();
    }

    // ---- main ----
    if (mode === "list") {
      const n = Math.min(12, signals.length) || 1;
      if (key.name === "up" || str === "k") sel = (sel - 1 + n) % n;
      else if (key.name === "down" || str === "j") sel = (sel + 1) % n;
      else if (key.name === "return") { cur = signals[sel]; curId = b58(44); side = "YES"; mode = "market"; }
      else if (str === "p") { posSel = 0; mode = "portfolio"; }
      else if (str === "w") mode = "wallet";
      else if (str === "r") { await refresh(); }
      else if (str === "q") return quit();
      return render();
    }
    if (mode === "market") {
      if (str === "y" || key.name === "left") side = "YES";
      else if (str === "n" || key.name === "right") side = "NO";
      else if (key.name === "return") { sizeBuf = ""; mode = "size"; }
      else if (str === "b" || key.name === "escape") mode = "list";
      else if (str === "q") return quit();
      return render();
    }
    if (mode === "size") {
      if (/^[0-9]$/.test(str)) { if (sizeBuf.length < 7) sizeBuf += str; }
      else if (key.name === "backspace") sizeBuf = sizeBuf.slice(0, -1);
      else if (str === "b" || key.name === "escape") { mode = "market"; }
      else if (key.name === "return") {
        if ((Number(sizeBuf) || 0) < 1) status = "enter a size of at least 1 USDC";
        else mode = "review";
      }
      return render();
    }
    if (mode === "review") {
      const n = reviewNums();
      if (key.name === "return") {
        if (st.balances.USDC < n.total) { status = "insufficient balance"; return render(); }
        blockhash = b58(44);
        mode = "sign";
      } else if (str === "e") mode = "size";
      else if (str === "b" || key.name === "escape") mode = "market";
      return render();
    }
    if (mode === "sign") {
      if (str === "s") {
        const n = reviewNums();
        const sig = b58(88);
        await broadcast("Submitting transaction", [
          "simulating against " + shortSig(PROGRAM_ID),
          "signing with " + shortSig(st.wallet!.address),
          "sending to devnet RPC",
          "sig " + shortSig(sig),
          "matching " + n.shares.toFixed(0) + " shares against the book",
          "confirmed · 32/32 slots · finalized",
        ]);
        const p: W.Position = {
          id: curId, ticker: cur!.ticker, side, entry: n.price, size: n.size,
          shares: n.shares, heat: cur!.heat, openedAt: Date.now(), tx: sig,
        };
        st.positions.unshift(p);
        st.balances.USDC -= n.total;
        W.log(st, "trade", `${side} $${cur!.ticker} ${money(n.size)} @ ${n.price}¢`);
        W.save(st);
        mode = "filled";
      } else if (str === "b" || key.name === "escape") mode = "review";
      return render();
    }
    if (mode === "filled") {
      if (str === "p") { posSel = 0; mode = "portfolio"; }
      else if (str === "b" || key.name === "return") mode = "list";
      else if (str === "q") return quit();
      return render();
    }
    if (mode === "portfolio") {
      const n = st.positions.length || 1;
      if (key.name === "up") posSel = (posSel - 1 + n) % n;
      else if (key.name === "down") posSel = (posSel + 1) % n;
      else if (key.name === "return" && st.positions.length) mode = "pos";
      else if (str === "c" && st.positions.length) return closePosition();
      else if (str === "b" || key.name === "escape") mode = "list";
      else if (str === "q") return quit();
      return render();
    }
    if (mode === "pos") {
      if (str === "c") return closePosition();
      else if (str === "b" || key.name === "escape") mode = "portfolio";
      else if (str === "q") return quit();
      return render();
    }
    if (mode === "closed") {
      if (str === "p") { posSel = 0; mode = "portfolio"; }
      else if (str === "b" || key.name === "return") mode = "list";
      else if (str === "q") return quit();
      return render();
    }
    if (mode === "wallet") {
      if (str === "f") {
        await broadcast("Requesting airdrop from devnet faucet", [
          "requesting 1,000 USDC", "airdrop tx " + shortSig(b58(88)), "confirming (32/32 slots)",
        ]);
        st.balances.USDC += 1000; W.log(st, "faucet", "+1,000 USDC"); W.save(st);
        status = "airdropped 1,000 USDC";
      } else if (str === "b" || key.name === "escape") mode = "list";
      else if (str === "q") return quit();
      return render();
    }
  }

  async function closePosition() {
    const p = st.positions[posSel];
    const now = posPx(p);
    const proceeds = p.shares * (now / 100);
    await broadcast("Closing position on Solana", [
      "building close transaction",
      "signing with " + shortAddr(st.wallet!.address),
      "settling " + p.shares.toFixed(1) + " shares",
      "confirming (32/32 slots)",
    ]);
    st.balances.USDC += proceeds;
    const pnl = proceeds - p.size;
    st.positions.splice(posSel, 1);
    W.log(st, "close", `$${p.ticker} → ${money(proceeds)} (${pnl >= 0 ? "+" : ""}${money(pnl)})`);
    W.save(st);
    status = `$${p.ticker} settled for ${money(proceeds)}  ·  PnL ${pnl >= 0 ? "+" : ""}${money(pnl)}`;
    posSel = 0;
    mode = "closed";
  }

  // ---------- boot ----------
  readline.emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  stdout.write(hideCursor);
  process.on("exit", () => stdout.write(showCursor));
  stdin.on("keypress", (s: string, k: readline.Key) => void onKey(s ?? "", k ?? ({} as readline.Key)));

  if (st.wallet) await refresh();
  render();
}
