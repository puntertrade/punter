<div align="center">

# Punter

**Price the rumour before the headline.**

The rumour engine behind [Punter](https://zkpassorg.vercel.app) — it watches Crypto Twitter, scores what's moving, and turns live launches, leaks and CT chaos into clean YES/NO markets.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/badge/CI-passing-22c55e?style=flat-square)](../../actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square)](#)
[![stars](https://img.shields.io/github/stars/ramdany29/punter?style=social)](../../stargazers)

</div>

---

> **Rumours move faster than facts.** CT trades them anyway. Punter turns that window into a market — everything on-chain, non-custodial, priced before the crowd catches up.

## What it does

- **Scans CT** for launches, listings, leaks and unlocks as they start moving.
- **Scores rumour heat** — a spike of mentions × freshness × new-account velocity.
- **Opens markets** — frames a rumour into one binary question with hard terms.
- **Settles on-chain** — a decentralized oracle reads reality and pays winners.

## Quick start

```bash
npm install
npm run build
npx punter scan            # print the hot rumours right now
npx punter open "TOKEN lists on Binance" --deadline 72h
```

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

[Website](https://zkpassorg.vercel.app) · [Docs](https://zkpassorg.vercel.app/docs) · [@usepunterxyz](https://x.com/usepunterxyz)

## License

MIT — see [LICENSE](LICENSE).
\n<!-- perf pass on scanner grouping -->\n