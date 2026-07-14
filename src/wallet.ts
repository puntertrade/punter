// Local wallet + state. Zero external deps — uses node:crypto only.
// The mnemonic is a real BIP-39 phrase and the address is a real ed25519
// public key derived from it (base58, Solana-style). Nothing is broadcast
// anywhere — balances and positions live in ~/.punter/state.json.
import { randomBytes, createHash, pbkdf2Sync, createPrivateKey, createPublicKey } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { WORDLIST } from "./wordlist.js";

const DIR = join(homedir(), ".punter");
const FILE = join(DIR, "state.json");
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export interface Position {
  id: string;
  ticker: string;
  side: "YES" | "NO";
  entry: number; // ¢
  size: number; // USDC
  shares: number;
  heat: number;
  openedAt: number;
  tx: string;
}
export interface State {
  wallet: { address: string; createdAt: number } | null;
  balances: { USDC: number; SOL: number };
  positions: Position[];
  history: { t: number; kind: string; detail: string }[];
}

function base58(buf: Buffer): string {
  let x = BigInt("0x" + buf.toString("hex"));
  let out = "";
  const base = 58n;
  while (x > 0n) {
    const r = Number(x % base);
    out = B58[r] + out;
    x /= base;
  }
  for (const b of buf) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}

/** Valid 12-word BIP-39 mnemonic (128-bit entropy + 4-bit checksum). */
export function genMnemonic(): string {
  const ent = randomBytes(16); // 128 bits
  const hash = createHash("sha256").update(ent).digest();
  const bits =
    [...ent].map((b) => b.toString(2).padStart(8, "0")).join("") +
    hash[0].toString(2).padStart(8, "0").slice(0, 4);
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = parseInt(bits.slice(i * 11, i * 11 + 11), 2);
    words.push(WORDLIST[idx]);
  }
  return words.join(" ");
}

/** Real ed25519 public key derived from the mnemonic → base58 (Solana-style). */
export function addressFromMnemonic(mnemonic: string): string {
  const seed = pbkdf2Sync(mnemonic.normalize("NFKD"), "mnemonic", 2048, 64, "sha512");
  const seed32 = seed.subarray(0, 32);
  // wrap raw seed as PKCS8 ed25519 private key
  const pkcs8 = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    seed32,
  ]);
  const priv = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
  const jwk = createPublicKey(priv).export({ format: "jwk" }) as { x: string };
  const pub = Buffer.from(jwk.x, "base64url");
  return base58(pub);
}

export function isValidMnemonic(m: string): boolean {
  const w = m.trim().toLowerCase().split(/\s+/);
  if (w.length !== 12) return false;
  return w.every((x) => WORDLIST.includes(x));
}

// ---------------- state ----------------
export function load(): State {
  if (!existsSync(FILE))
    return { wallet: null, balances: { USDC: 0, SOL: 0 }, positions: [], history: [] };
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as State;
  } catch {
    return { wallet: null, balances: { USDC: 0, SOL: 0 }, positions: [], history: [] };
  }
}
export function save(s: State): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(s, null, 2));
}
export function log(s: State, kind: string, detail: string): void {
  s.history.unshift({ t: Date.now(), kind, detail });
  s.history = s.history.slice(0, 100);
}
export const STATE_PATH = FILE;
