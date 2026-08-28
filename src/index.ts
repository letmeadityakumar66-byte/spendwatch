#!/usr/bin/env node
import { summarise } from "./aggregate.js";
import { scan } from "./parsers/index.js";
import { render, renderMissing } from "./report.js";

const VERSION = "0.1.0";

// node:sqlite is still flagged experimental on Node 22. Suppress only that one
// notice, so genuine warnings from anywhere else still reach the user.
const emitWarning = process.emitWarning.bind(process);
(process as any).emitWarning = (warning: any, ...rest: any[]) => {
  const text = typeof warning === "string" ? warning : String(warning?.message ?? "");
  if (text.includes("SQLite is an experimental feature")) return;
  return emitWarning(warning, ...rest);
};

const HELP = `
  spendwatch ${VERSION}

  See what your AI coding agents actually cost — across Claude Code, Codex and
  Cursor. Reads only local log files. Makes no network requests, ever.

  USAGE
    npx spendwatch [options]

  OPTIONS
    --days <n>        Only count activity from the last n days
    --json            Emit machine-readable JSON instead of a report
    --inr-rate <n>    USD→INR rate used for display (default 88)
    --no-color        Disable ANSI colour
    -v, --version     Print version
    -h, --help        Print this help

  WHAT IT READS
    ~/.claude/projects/**/*.jsonl          Claude Code transcripts
    ~/.codex/{sessions,archived_sessions}  Codex rollouts
    ~/.cursor/ai-tracking/*.db             Cursor commit authorship (read-only)

  Prompts, code and file contents are never read for reporting, never stored,
  and never transmitted. Only token counts, model ids and paths are aggregated.
`;

function parseArgs(argv: string[]) {
  const opts = { json: false, days: null as number | null, inrRate: 88, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "-v" || a === "--version") opts.version = true;
    else if (a === "--no-color") process.env.NO_COLOR = "1";
    else if (a === "--days" || a === "--since") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v <= 0) fail(`--days needs a positive number, got "${argv[i]}"`);
      opts.days = v;
    } else if (a === "--inr-rate") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v <= 0) fail(`--inr-rate needs a positive number, got "${argv[i]}"`);
      opts.inrRate = v;
    } else fail(`unknown option "${a}" — try --help`);
  }
  return opts;
}

function fail(msg: string): never {
  process.stderr.write(`spendwatch: ${msg}\n`);
  process.exit(2);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { process.stdout.write(HELP); return; }
  if (opts.version) { process.stdout.write(`${VERSION}\n`); return; }

  const result = await scan();
  const sinceMs = opts.days === null ? null : Date.now() - opts.days * 86_400_000;
  const summary = summarise(result, sinceMs);

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      version: VERSION,
      generatedAt: new Date().toISOString(),
      windowDays: opts.days,
      sessions: summary.sessions,
      turns: summary.totals.turns,
      costUsd: Number(summary.totals.cost.toFixed(6)),
      unpricedModels: summary.unpricedModels,
      cacheReuseRatio: Number(summary.cacheReuseRatio.toFixed(3)),
      tokens: {
        input: summary.totals.inputTokens,
        cacheWrite: summary.totals.cacheWriteTokens,
        cacheRead: summary.totals.cacheReadTokens,
        output: summary.totals.outputTokens,
        thinking: summary.totals.thinkingTokens,
      },
      byModel: summary.byModel.map(b => ({ model: b.label, costUsd: Number(b.cost.toFixed(6)), turns: b.turns })),
      byProject: summary.byRepo.map(b => ({ project: b.label, costUsd: Number(b.cost.toFixed(6)), turns: b.turns })),
      byAgent: summary.byVendor.map(b => ({ agent: b.label, costUsd: Number(b.cost.toFixed(6)), turns: b.turns })),
      missing: result.missing,
      warnings: result.warnings,
    }, null, 2) + "\n");
    return;
  }

  if (summary.totals.turns === 0) {
    process.stdout.write("\n  No agent activity found.\n\n");
    process.stdout.write(renderMissing(result.missing, result.warnings));
    process.stdout.write("\n");
    return;
  }

  process.stdout.write(render(summary, { inrRate: opts.inrRate, days: opts.days }));
  const notes = renderMissing(result.missing, result.warnings);
  if (notes) process.stdout.write(notes + "\n");
}

main().catch((e) => {
  process.stderr.write(`spendwatch: ${e?.stack ?? e}\n`);
  process.exit(1);
});
