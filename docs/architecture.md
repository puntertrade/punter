# Architecture

Punter is a small deterministic core with pluggable edges.

```
Feed adapter ──▶ scanner ──▶ heat ──▶ frame ──▶ Market
                                                  │
                                     take ◀───────┤ (positions)
                                                  ▼
                                    Resolver ──▶ settle ──▶ payout
```

- **Core** (`src/`) is pure: given the same feed + resolver, output is identical.
- **Edges** are injected: the CT feed, the resolver network, the settlement chain.
- This is what makes the engine testable and chain-independent.
