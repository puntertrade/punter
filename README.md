<div align="center">

# Punter

**Price the rumour before the headline.**

The rumour engine behind [Punter](https://puntertrade.xyz) — it watches Crypto Twitter, scores what's moving, and turns live launches, leaks and CT chaos into clean YES/NO markets.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/badge/CI-passing-22c55e?style=flat-square)](../../actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square)](#)
[![stars](https://img.shields.io/github/stars/puntertrade/punter?style=social)](../../stargazers)

</div>

---

> **Rumours move faster than facts.** CT trades them anyway. Punter turns that window into a market — everything on-chain, non-custodial, priced before the crowd catches up.

## What it does

- **Scans CT** for launches, listings, leaks and unlocks as they start moving.
- **Scores rumour heat** — a spike of mentions × freshness × new-account velocity.
- **Opens markets** — frames a rumour into one binary question with hard terms.
- **Settles on-chain** — a decentralized oracle reads reality and pays winners.

## Quick start

Node 20+. No API key needed for the live feed — on-chain trending is pulled from
a keyless source out of the box.

```bash
git clone https://github.com/puntertrade/punter && cd punter
npm install                           # postinstall builds it for you

npm start                             # interactive — browse the live feed, open a market, take a side
```

First run walks you through a wallet: generate a **real BIP-39 seed phrase**
(back it up, confirm a word) or import your own, then claim test USDC from the
devnet faucet. Your wallet, balance and positions persist in `~/.punter`.

Then the loop is: `↑/↓` move through the live feed → `enter` opens a market
(YES/NO, live odds, order book) → `←/→` or `y/n` pick a side → type your size →
**review** the order (price, shares, fee, slippage, total, balance after) →
**sign** → watch it broadcast and confirm on-chain → track it in your
**portfolio** with live PnL → `c` to close and settle. `p` portfolio, `w`
wallet, `r` refresh, `q` quit.

Want a global `punter` command? Link it once, then call it from anywhere:

```bash
npm link                              # creates a global `punter`
punter                                # interactive mode (wallet + trading)
punter wallet                         # show address + balance
punter faucet                         # claim 1,000 test USDC
punter portfolio                      # list open positions
punter scan                           # print the feed once, ranked by heat
punter scan --watch                   # auto-refreshing, top-style (--<sec> to set interval)
punter markets                        # list the live markets you can trade
punter open "$PENGU pumps 20% this week"   # open one market by name and take a side
```

> `npx punter` won't work from inside this repo — npx looks up the npm registry,
> and Punter isn't published there. Use `npm start` or `npm link` above.

```text
  ◆ PUNTER  crypto markets for launches, leaks and CT chaos
  #   HEAT                  MARKET          24H       VOL      SIGNAL
  ──────────────────────────────────────────────────────────────────
  1   █████████░  93        $LAB #262       +37.3%    $161.9M  6 CT mentions · 1m
  2   ████████░░  80        $CASHCAT #190   +11.9%    $67.6M   3 CT mentions · 1m
  3   ███████░░░  68        $BTC #1         +4.1%     $30.8B   6 CT mentions · now
```

> Set `TWITTERAPI_KEY` in your env to layer live Crypto-Twitter mention velocity
> on top of the on-chain feed — heat then reflects what CT is actually posting.

## Architecture

```text
scanner   →  pulls CT signal, dedupes, extracts candidate events
heat      →  mentions × freshness × new-account velocity  → 0..100
market    →  frames a rumour as a binary market with terms + deadline
oracle    →  resolves against reality, settles on-chain, pays out
store     →  append-only market + position ledger
```

## Why Punter

| | |
|---|---|
| **Early, not fast** | A market opens the moment a rumour moves — the edge is the window before the headline. |
| **Clean terms** | Every market ships with unambiguous resolution terms. No moved goalposts. |
| **Non-custodial** | Funds settle to your own wallet through on-chain escrow. |
| **Any chain** | Solana, Ethereum, BNB Chain or Base. The oracle is chain-independent. |

## Roadmap

- [x] CT scanner + heat scoring
- [x] Market framing + terms engine
- [x] On-chain settlement adapter (Solana)
- [ ] Resolver bonding + dispute window
- [ ] $PUNTER staking + fee share

## Links

[Website](https://puntertrade.xyz) · [Docs](https://puntertrade.xyz/docs) · [@usepunterxyz](https://x.com/usepunterxyz)

## License

MIT — see [LICENSE](LICENSE).
\n<!-- perf pass on scanner grouping -->\n