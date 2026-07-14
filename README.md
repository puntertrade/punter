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
npm install
npm run build

npx punter scan                       # live feed of what's moving, ranked by heat
npx punter scan --watch               # auto-refreshing, top-style (--<sec> to set interval)
npx punter markets                    # list the live markets you can trade
npx punter open "$PENGU pumps 20% this week"   # open a market and take a side (YES/NO)
```

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