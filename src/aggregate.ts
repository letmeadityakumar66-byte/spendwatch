import { homedir } from "node:os";
import { gitRoot } from "./gitroot.js";
import type { PricedTurn, ScanResult, ShippedCommit } from "./types.js";

export interface Bucket {
  label: string;
  cost: number;
  /** Tokens belonging to models with no confirmed rate — cost excludes these. */
  unpricedTokens: number;
  turns: number;
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  thinkingTokens: number;
}

export interface Summary {
  totals: Bucket;
  byModel: Bucket[];
  byRepo: Bucket[];
  byVendor: Bucket[];
  unpricedModels: string[];
  sessions: number;
  /** Cache reads per token written. High is good — it means cache is being reused. */
  cacheReuseRatio: number;
  firstTs: number | null;
  lastTs: number | null;
  commits: ShippedCommit[];
}

const empty = (label: string): Bucket => ({
  label, cost: 0, unpricedTokens: 0, turns: 0, inputTokens: 0,
  cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0, thinkingTokens: 0,
});

function add(b: Bucket, t: PricedTurn): void {
  b.turns++;
  b.inputTokens += t.inputTokens;
  b.cacheWriteTokens += t.cacheWriteTokens;
  b.cacheReadTokens += t.cacheReadTokens;
  b.outputTokens += t.outputTokens;
  b.thinkingTokens += t.thinkingTokens;
  if (t.cost === null) {
    b.unpricedTokens += t.inputTokens + t.cacheWriteTokens + t.cacheReadTokens + t.outputTokens;
  } else {
    b.cost += t.cost;
  }
}

/** Collapse an absolute path to the project root, tilde-shortened for display. */
export function shortenRepo(repo: string | null): string {
  if (!repo) return "(unknown)";
  return (gitRoot(repo) ?? repo).replace(homedir(), "~");
}

export function summarise(result: ScanResult, sinceMs: number | null): Summary {
  const turns = sinceMs === null
    ? result.turns
    : result.turns.filter((t) => t.ts !== null && t.ts >= sinceMs);

  const totals = empty("total");
  const models = new Map<string, Bucket>();
  const repos = new Map<string, Bucket>();
  const vendors = new Map<string, Bucket>();
  const sessions = new Set<string>();
  const unpriced = new Set<string>();
  let firstTs: number | null = null;
  let lastTs: number | null = null;

  for (const t of turns) {
    add(totals, t);
    sessions.add(`${t.vendor}:${t.sessionId}`);
    if (t.cost === null) unpriced.add(t.model);
    if (t.ts !== null) {
      if (firstTs === null || t.ts < firstTs) firstTs = t.ts;
      if (lastTs === null || t.ts > lastTs) lastTs = t.ts;
    }
    for (const [map, key] of [
      [models, t.model],
      [repos, shortenRepo(t.repo)],
      [vendors, t.vendor],
    ] as const) {
      let b = map.get(key);
      if (!b) { b = empty(key); map.set(key, b); }
      add(b, t);
    }
  }

  const rank = (m: Map<string, Bucket>): Bucket[] =>
    [...m.values()].sort((a, b) => b.cost - a.cost || b.turns - a.turns);

  return {
    totals,
    byModel: rank(models),
    byRepo: rank(repos),
    byVendor: rank(vendors),
    unpricedModels: [...unpriced].sort(),
    sessions: sessions.size,
    cacheReuseRatio: totals.cacheWriteTokens > 0 ? totals.cacheReadTokens / totals.cacheWriteTokens : 0,
    firstTs,
    lastTs,
    commits: result.commits,
  };
}
