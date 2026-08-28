import type { Summary, Bucket } from "./aggregate.js";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = c("2"), bold = c("1"), cyan = c("36"), yellow = c("33"), green = c("32"), red = c("31");

const n = (v: number) => v.toLocaleString("en-US");
const usd = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Indian digit grouping (lakh/crore), which en-IN gives us for free. */
const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

const pad = (s: string, w: number) => s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
const lpad = (s: string, w: number) => s.length >= w ? s : " ".repeat(w - s.length) + s;

function bar(frac: number, width = 12): string {
  const filled = Math.round(Math.max(0, Math.min(1, frac)) * width);
  return cyan("█".repeat(filled)) + dim("·".repeat(width - filled));
}

function date(ts: number | null): string {
  return ts === null ? "?" : new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function section(title: string): string {
  return `\n  ${bold(title)}\n`;
}

function table(rows: Bucket[], total: number, limit: number): string {
  if (rows.length === 0) return dim("    (none)\n");
  let out = "";
  for (const b of rows.slice(0, limit)) {
    const share = total > 0 ? b.cost / total : 0;
    const label = b.unpricedTokens > 0 && b.cost === 0 ? `${b.label} ${yellow("(unpriced)")}` : b.label;
    out += `    ${pad(label, 40)} ${lpad(usd(b.cost), 12)}  ${lpad((share * 100).toFixed(1) + "%", 6)}  ${bar(share)}\n`;
  }
  if (rows.length > limit) out += dim(`    … and ${rows.length - limit} more\n`);
  return out;
}

export function render(s: Summary, opts: { inrRate: number; days: number | null }): string {
  const t = s.totals;
  let out = "\n";

  out += `  ${bold(cyan("spendwatch"))}  ${dim("·")}  ${n(s.sessions)} sessions  ${dim("·")}  ${n(t.turns)} turns`;
  out += `  ${dim("·")}  ${dim(`${date(s.firstTs)} → ${date(s.lastTs)}`)}\n`;
  if (opts.days !== null) out += dim(`  (filtered to the last ${opts.days} days)\n`);

  out += section("SPEND");
  out += `    ${pad("API-equivalent cost", 28)} ${bold(lpad(usd(t.cost), 14))}   ${dim(lpad(inr(t.cost * opts.inrRate), 14))}\n`;
  out += dim(`    list-price equivalent of these tokens · at ₹${opts.inrRate}/$\n`);
  out += dim(`    if you are on a subscription this is the value you extracted, not a bill\n`);

  out += section("TOKENS");
  const rows: [string, number, string][] = [
    ["input (uncached)", t.inputTokens, ""],
    ["cache write", t.cacheWriteTokens, "billed 1.25× input"],
    ["cache read", t.cacheReadTokens, "billed 0.10× input"],
    ["output", t.outputTokens, ""],
    ["thinking", t.thinkingTokens, "subset of output"],
  ];
  for (const [label, v, note] of rows) {
    out += `    ${pad(label, 24)} ${lpad(n(v), 18)}  ${dim(note)}\n`;
  }
  if (t.cacheWriteTokens > 0) {
    const r = s.cacheReuseRatio;
    const verdict = r >= 10 ? green("healthy") : r >= 3 ? yellow("could improve") : red("poor — cache is being rebuilt, not reused");
    out += `\n    ${pad("cache reuse", 24)} ${lpad(r.toFixed(1) + "×", 18)}  ${verdict}\n`;
    out += dim(`    ${" ".repeat(24)} ${lpad("", 18)}  reads per token written\n`);
  }

  out += section("BY MODEL");
  out += table(s.byModel, t.cost, 8);
  out += section("BY PROJECT");
  out += table(s.byRepo, t.cost, 8);
  if (s.byVendor.length > 1) {
    out += section("BY AGENT");
    out += table(s.byVendor, t.cost, 5);
  }

  if (s.commits.length > 0) {
    const ai = s.commits.reduce((a, x) => a + x.aiLinesAdded, 0);
    const hum = s.commits.reduce((a, x) => a + x.humanLinesAdded, 0);
    const tot = ai + hum;
    out += section("SHIPPED (from Cursor)");
    out += `    ${pad("commits scored", 24)} ${lpad(n(s.commits.length), 18)}\n`;
    out += `    ${pad("lines by agent", 24)} ${lpad(n(ai), 18)}  ${dim(tot > 0 ? `${((ai / tot) * 100).toFixed(0)}% of added lines` : "")}\n`;
    out += `    ${pad("lines by human", 24)} ${lpad(n(hum), 18)}\n`;
  }

  if (s.unpricedModels.length > 0) {
    out += section(yellow("UNPRICED MODELS"));
    out += dim(`    No confirmed public rate — tokens counted, cost deliberately excluded\n`);
    out += dim(`    rather than guessed. Add rates via PR in src/pricing.ts.\n`);
    for (const m of s.unpricedModels) out += `    ${yellow("·")} ${m}\n`;
  }

  return out + "\n";
}

export function renderMissing(missing: string[], warnings: string[]): string {
  let out = "";
  for (const w of warnings) out += `  ${yellow("!")} ${w}\n`;
  if (missing.length > 0) out += dim(`  Not installed / no logs found: ${missing.join(", ")}\n`);
  return out;
}
