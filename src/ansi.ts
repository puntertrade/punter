// Zero-dependency ANSI helpers. Colour is auto-disabled when not a TTY or NO_COLOR is set.
const enabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const wrap = (code: string) => (s: string | number): string =>
  enabled ? `\x1b[${code}m${s}\x1b[0m` : String(s);

export const c = {
  reset: "\x1b[0m",
  dim: wrap("2"),
  bold: wrap("1"),
  red: wrap("38;5;203"),
  orange: wrap("38;5;215"),
  yellow: wrap("38;5;221"),
  green: wrap("38;5;114"),
  cyan: wrap("38;5;81"),
  blue: wrap("38;5;75"),
  gray: wrap("38;5;244"),
  white: wrap("38;5;255"),
  brand: wrap("38;5;75"), // Punter blue
};

export function heatColor(h: number): (s: string | number) => string {
  if (h >= 80) return c.red;
  if (h >= 62) return c.orange;
  if (h >= 42) return c.yellow;
  if (h >= 22) return c.cyan;
  return c.gray;
}

export function bar(pct: number, width = 12): string {
  const p = Math.max(0, Math.min(100, pct));
  const filled = Math.round((p / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export const clearScreen = "\x1b[2J\x1b[H";
export const hideCursor = "\x1b[?25l";
export const showCursor = "\x1b[?25h";

/** pad a string to a visible width, ignoring ANSI escape codes. */
export function padVisible(s: string, width: number): string {
  const visible = s.replace(/\x1b\[[0-9;]*m/g, "").length;
  return s + " ".repeat(Math.max(0, width - visible));
}
