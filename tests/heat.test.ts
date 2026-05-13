import { test } from "node:test";
import assert from "node:assert/strict";
import { heat } from "../src/heat.js";

test("fresh loud rumour scores high", () => {
  const h = heat({ id: "x", text: "listing", source: "ct", firstSeen: Date.now(), mentions: 400, newAccounts: 20 });
  assert.ok(h > 60, `expected hot, got ${h}`);
});

test("stale rumour decays", () => {
  const old = Date.now() - 24 * 3_600_000;
  const h = heat({ id: "x", text: "listing", source: "ct", firstSeen: old, mentions: 400, newAccounts: 20 });
  assert.ok(h < 40, `expected cold, got ${h}`);
});
