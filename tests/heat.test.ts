import { test } from "node:test";
import assert from "node:assert/strict";
import { heat } from "../dist/heat.js";

const base = { id: "x", text: "listing", source: "ct", mentions: 400, newAccounts: 20 };

test("fresh loud rumour scores high", () => {
  const h = heat({ ...base, firstSeen: Date.now() });
  assert.ok(h > 60, `expected hot, got ${h}`);
});

test("staleness decays a rumour below its fresh score", () => {
  const fresh = heat({ ...base, firstSeen: Date.now() });
  const stale = heat({ ...base, firstSeen: Date.now() - 24 * 3_600_000 });
  assert.ok(stale < fresh, `stale ${stale} should decay below fresh ${fresh}`);
});
