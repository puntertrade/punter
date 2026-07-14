import { test } from "node:test";
import assert from "node:assert/strict";
import { frame, take, quote } from "../dist/market.js";

test("taking YES moves the price up", () => {
  const m = frame({ id: "m", text: "will it list", source: "ct", firstSeen: Date.now(), mentions: 1, newAccounts: 0, heat: 0 }, Date.now() + 1e6);
  const before = quote(m, "YES");
  take(m, "YES", 2000, "wallet1");
  assert.ok(quote(m, "YES") > before);
});
